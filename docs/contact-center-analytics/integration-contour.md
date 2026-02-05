# Контурная схема интеграции

```mermaid
flowchart LR
  subgraph SRC[Источники]
    FS[FreeSWITCH / ACD / CDR]
    SP[Softphone события оператора]
    CRM[CRM / тикетинг / outcome]
    MSG[Чат / Email / SMS / Push шлюзы]
    REF[HR/WFM и орг-справочники]
  end

  subgraph ING[Ingestion слой (stream + batch ETL)]
    GW[API ingestion: /api/ingest/interactions]
    BUS[(Kafka/NATS/Queue)]
    STG[(Staging таблицы)]
  end

  subgraph NORM[Нормализация и обогащение]
    DEDUP[Дедупликация\n(event_id + source_system + checksum)]
    LINK[Связка событий\n(call_id / conversation_id / external_id)]
    DIM[Обновление dim_*\nканалы/очереди/операторы/тематики/отделы]
    FACT[Формирование fact_*\ninteraction_timing, queue_interval, sentiment, outcome]
  end

  subgraph DB[PostgreSQL]
    CORE[(interactions + dictionaries)]
    EXT[(queue_event/agent_event/message_event\n+ fact_* + dim_*)]
  end

  subgraph API[Backend API]
    A1[/Analytics endpoints\n(/kpis /timeseries /operators /queues ...)/]
    A2[/Dictionaries endpoints/]
  end

  UI[UI Next.js\nРасширенная аналитика КЦ]

  FS --> BUS
  SP --> BUS
  CRM --> BUS
  MSG --> BUS
  REF --> BUS

  BUS --> STG
  STG --> DEDUP --> LINK --> DIM
  LINK --> FACT
  GW --> CORE
  DIM --> CORE
  FACT --> EXT

  CORE --> A1
  EXT --> A1
  CORE --> A2

  A1 --> UI
  A2 --> UI
```

## Пояснения по ответственности слоёв

1. **Дедупликация**
   - Выполняется в слое нормализации (`DEDUP`) до записи в факты.
   - Ключ: `source_system + event_id`; fallback: хэш `(occurred_at, entity_id, event_type, payload_checksum)`.
   - Для `interactions` используется idempotent upsert по `external_id`.

2. **Связывание событий (correlation)**
   - Главный ключ корреляции — `call_id` (voice) и `conversation_id` (digital).
   - При отсутствии — используется `external_id` из ingestion API.
   - Результат: привязка разрозненных `queue_event`, `agent_event`, `message_event` к единому `interaction_id`.

3. **Где считаются метрики**
   - **В БД (предпочтительно):** тяжёлые агрегаты и percentile (`ASA`, `SLA`, `response p95`, `queue depth trend`) в `fact_*` и materialized views.
   - **В API:** лёгкая пост-обработка (pivot по каналам/очередям, форматирование response, null-handling, округления).

4. **Обновление справочников**
   - `dim_agent`, `dim_department` — регулярный sync из HR/WFM (например, каждые 15 мин).
   - `dim_queue`, `dim_channel` — из конфигурации телефонии/маршрутизации.
   - `dim_topic` — из CRM taxonomy + ML-классификатора.
   - При конфликте имён приоритет у master-системы, историчность через `valid_from/valid_to` (SCD2 при необходимости).

5. **Интеграционный контракт с API**
   - Analytics API читает данные из `interactions` + расширений `fact_*`.
   - Если расширенные события не подключены, поля `avgWaitSec`, `slaPct`, `asaSec`, `responseSec`, `queueDepthTrend` возвращаются `null`.
