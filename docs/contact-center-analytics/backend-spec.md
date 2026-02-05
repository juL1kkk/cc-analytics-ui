# ТЗ для backend: расширенная аналитика контакт-центра

## 1. Контекст проекта

Дашборд «Расширенная аналитика контакт-центра» строится вокруг единого факта обращений (`interactions`) и справочников (`channels`, `queues`, `departments`, `operators`, `topics`).

UI состоит из следующих ключевых зон:
- **KPI-карточки**: «Входящие», «Пропущенные», «Средняя длительность (AHT)», «Нагрузка операторов», «FCR».
- **Вкладка «Обзор»**: динамика обращений/пропусков, загрузка операторов, распределение по каналам, эмоциональный фон, достижение цели.
- **Вкладка «Операторы»**: нагрузка по операторам, качество (AHT/FCR), тренд AHT/ASA.
- **Вкладка «Очереди»**: SLA и ожидание, доля брошенных, динамика длины очередей.
- **Вкладка «Каналы»**: объём входящие/исходящие, скорость реакции, динамика response time.
- **Вкладка «Тематики»**: тренд incoming/missed, тематические donut, топ тематик.
- **Сайдбар**: срез по тематикам + «Последние коммуникации».

### Обязательные фильтры (должны поддерживаться всеми analytics endpoint)
- `period=today|yesterday|7d|30d|custom`
- `from`, `to` для `period=custom`
- `dept` (код/id отдела)
- `channel` (код/id канала)
- `queue` (код/id очереди)
- `topic` (id/код темы или `all`)
- `q` (поиск по `external_id`, оператору, теме)

Ниже SQL-примеры написаны под PostgreSQL с единым CTE `filtered`, чтобы backend мог переиспользовать фильтрацию во всех методах.

---

## 2. Базовый шаблон фильтрации (использовать как основу)

```sql
WITH filtered AS (
  SELECT
    i.*, c.channel_code, c.name_ru AS channel_name_ru,
    q.queue_code, q.name_ru AS queue_name_ru,
    d.department_code, d.name_ru AS department_name_ru,
    o.full_name_ru AS operator_name_ru,
    t.topic_code, t.name_ru AS topic_name_ru
  FROM interactions i
  JOIN channels c    ON c.id = i.channel_id
  JOIN queues q      ON q.id = i.queue_id
  JOIN departments d ON d.id = i.department_id
  LEFT JOIN operators o ON o.id = i.operator_id
  LEFT JOIN topics t    ON t.id = i.topic_id
  WHERE i.started_at >= :from_ts
    AND i.started_at < :to_ts
    AND (:dept_is_null OR d.department_code = :dept OR d.id::text = :dept)
    AND (:channel_is_null OR c.channel_code = :channel OR c.id::text = :channel)
    AND (:queue_is_null OR q.queue_code = :queue OR q.id::text = :queue)
    AND (:topic_is_all OR t.topic_code = :topic OR t.id::text = :topic)
    AND (
      :q_is_null
      OR i.external_id ILIKE '%' || :q || '%'
      OR COALESCE(o.full_name_ru, '') ILIKE '%' || :q || '%'
      OR COALESCE(t.name_ru, '') ILIKE '%' || :q || '%'
    )
)
SELECT * FROM filtered;
```

---

## 3. UI блок → endpoint → SQL пример → источники

> Обозначения:
> - **НЕТ (нужно добавить)** — endpoint отсутствует в `openapi.yaml`.
> - **Требует расширения схемы** — см. `schema.extension.dbml`.

### 3.1 KPI + Обзор

| UI блок | Endpoint | SQL пример | Источники / System of Record |
|---|---|---|---|
| KPI «Входящие», «Пропущенные», «AHT», «Нагрузка операторов», «FCR», + доп. `avgWaitSec`, `slaPct` | `GET /api/analytics/kpis` | ```sql WITH filtered AS (...) SELECT count(*) AS incoming, count(*) FILTER (WHERE status='missed') AS missed, round(avg(duration_sec) FILTER (WHERE status='completed' AND duration_sec>0))::int AS aht_sec, count(DISTINCT operator_id) FILTER (WHERE operator_id IS NOT NULL) AS operators_on_calls, (SELECT count(*) FROM operators WHERE is_active=true) AS operators_total, round(100.0 * count(*) FILTER (WHERE status='completed') / NULLIF(count(*),0), 2) AS fcr_pct, NULL::int AS avg_wait_sec, NULL::numeric AS sla_pct FROM filtered; ``` `avg_wait_sec/sla_pct` — **требует расширения схемы** (`fact_queue_interval`, `fact_interaction_timing`) | `incoming/missed/duration/status` — CDR/CRM через ingestion в `interactions`; операторы — HR/WFM (`operators`); wait/SLA — FreeSWITCH ACD/очередные события (`queue_event`). |
| График «Динамика обращений и пропусков» | `GET /api/analytics/timeseries` | ```sql WITH filtered AS (...) SELECT date_trunc(:granularity, started_at) AS t, count(*) AS incoming, count(*) FILTER (WHERE status='missed') AS missed, round(avg(duration_sec) FILTER (WHERE status='completed' AND duration_sec>0))::int AS aht_sec FROM filtered GROUP BY 1 ORDER BY 1; ``` | SoR: `interactions.started_at/status/duration_sec` после нормализации ingestion. |
| Donut «Распределение по каналам» | `GET /api/analytics/channels/split` (`split`) | ```sql WITH filtered AS (...) SELECT channel_code, channel_name_ru, count(*) AS incoming, NULL::bigint AS outgoing, NULL::int AS response_sec FROM filtered GROUP BY channel_code, channel_name_ru ORDER BY incoming DESC; ``` `outgoing/response_sec` — **требует расширения схемы** | Канал — справочник `channels` (master data); факты коммуникаций — CDR/CRM. Направление (inbound/outbound) и первый ответ — из `message_event`/softphone webhook. |
| Pie «Эмоциональный фон» (в обзоре) | **НЕТ (нужно добавить)** `GET /api/analytics/sentiment/split` | ```sql -- требует расширения схемы WITH filtered AS (...), scored AS ( SELECT f.id, COALESCE(s.sentiment_label,'neutral') AS sentiment_label FROM filtered f LEFT JOIN fact_sentiment s ON s.interaction_id=f.id ) SELECT sentiment_label AS name_ru, count(*)::float AS value FROM scored GROUP BY sentiment_label; ``` | SoR sentiment: NLP/QA сервис (`fact_sentiment`). Без NLP возможен только proxy. |
| Pie «Достижение цели» (в обзоре) | **НЕТ (нужно добавить)** `GET /api/analytics/outcomes/split` | ```sql -- требует расширения схемы WITH filtered AS (...), x AS ( SELECT f.id, COALESCE(o.outcome_code,'requires_actions') AS outcome_code FROM filtered f LEFT JOIN fact_outcome o ON o.interaction_id=f.id ) SELECT outcome_code AS name_ru, count(*)::float AS value FROM x GROUP BY outcome_code; ``` | SoR outcome: CRM/ticketing (`fact_outcome`). |
| Обзор «Нагрузка операторов: На линии/Ожидают/Не доступен» | `GET /api/analytics/operators` (секция summary-state, нужно вернуть в ответе) | ```sql -- требует расширения схемы (agent_event) WITH latest AS ( SELECT ae.agent_id, (array_agg(ae.state ORDER BY ae.occurred_at DESC))[1] AS state FROM agent_event ae WHERE ae.occurred_at < :to_ts GROUP BY ae.agent_id ) SELECT count(*) FILTER (WHERE state='on_call') AS on_line, count(*) FILTER (WHERE state='ready') AS waiting, count(*) FILTER (WHERE state IN ('offline','break')) AS unavailable FROM latest; ``` | SoR: softphone/ACD agent-state stream. |

### 3.2 Вкладка «Операторы»

| UI блок | Endpoint | SQL пример | Источники / System of Record |
|---|---|---|---|
| Бар «Нагрузка по операторам» (`handled`, `missed`) | `GET /api/analytics/operators` | ```sql WITH filtered AS (...) SELECT operator_id, operator_name_ru, count(*) FILTER (WHERE status <> 'missed') AS handled, count(*) FILTER (WHERE status = 'missed') AS missed, round(avg(duration_sec) FILTER (WHERE duration_sec > 0 AND status='completed'))::int AS aht_sec, round(100.0 * count(*) FILTER (WHERE status='completed') / NULLIF(count(*),0),2) AS fcr_pct FROM filtered GROUP BY operator_id, operator_name_ru ORDER BY handled DESC NULLS LAST LIMIT :limit OFFSET :offset; ``` | SoR: `interactions` + `operators`. |
| Линейный тренд «AHT/ASA» | `GET /api/analytics/operators` (`trend`) | ```sql WITH filtered AS (...), aht AS ( SELECT date_trunc(:granularity, started_at) AS t, round(avg(duration_sec) FILTER (WHERE status='completed' AND duration_sec>0))::int AS aht_sec FROM filtered GROUP BY 1 ), asa AS ( SELECT date_trunc(:granularity, f.started_at) AS t, round(avg(fit.answer_wait_sec))::int AS asa_sec FROM fact_interaction_timing fit JOIN filtered f ON f.id = fit.interaction_id GROUP BY 1 ) SELECT aht.t, aht.aht_sec, asa.asa_sec FROM aht LEFT JOIN asa USING (t) ORDER BY aht.t; ``` `asa` — **требует расширения схемы** | SoR AHT: CDR; SoR ASA: queue answer timing из FreeSWITCH/ACD (`queue_event` → `fact_interaction_timing`). |

### 3.3 Вкладка «Очереди»

| UI блок | Endpoint | SQL пример | Источники / System of Record |
|---|---|---|---|
| Бар «SLA и ожидание» по очередям | `GET /api/analytics/queues` | ```sql WITH filtered AS (...) SELECT queue_code, queue_name_ru, count(*) AS total, round(100.0 * count(*) FILTER (WHERE status='missed') / NULLIF(count(*),0),2) AS abandoned_pct_proxy, NULL::int AS waiting, NULL::int AS avg_wait_sec, NULL::numeric AS sla_pct FROM filtered GROUP BY queue_code, queue_name_ru; ``` Прод-вариант: ```sql -- требует расширения схемы WITH qi AS ( SELECT queue_id, snapshot_at, waiting_count, sla_target_sec, answered_in_sla, answered_total, abandoned_total FROM fact_queue_interval WHERE snapshot_at >= :from_ts AND snapshot_at < :to_ts ) SELECT q.queue_code, q.name_ru AS queue_name_ru, sum(answered_total + abandoned_total) AS total, round(100.0 * sum(abandoned_total) / NULLIF(sum(answered_total + abandoned_total),0),2) AS abandoned_pct, max(waiting_count) FILTER (WHERE snapshot_at = (SELECT max(snapshot_at) FROM qi q2 WHERE q2.queue_id=qi.queue_id)) AS waiting, round(avg(sla_target_sec))::int AS avg_wait_sec, round(100.0 * sum(answered_in_sla) / NULLIF(sum(answered_total),0),2) AS sla_pct FROM qi JOIN dim_queue q ON q.id=qi.queue_id GROUP BY q.queue_code,q.name_ru; ``` | SoR: для proxy — `interactions`; для точных waiting/sla/abandoned — FreeSWITCH queue snapshots/events. |
| «Динамика длины очередей» | `GET /api/analytics/queues` (`queueDepthTrend`) | ```sql -- требует расширения схемы SELECT date_trunc(:granularity, snapshot_at) AS t, queue_id, round(avg(waiting_count))::int AS queue_depth FROM fact_queue_interval WHERE snapshot_at >= :from_ts AND snapshot_at < :to_ts GROUP BY 1,2 ORDER BY 1,2; ``` | SoR: ACD snapshots (`queue_event` type=snapshot). |

### 3.4 Вкладка «Каналы»

| UI блок | Endpoint | SQL пример | Источники / System of Record |
|---|---|---|---|
| Бар «Объём входящие/исходящие» | `GET /api/analytics/channels/split` | ```sql -- требует расширения схемы (direction) WITH filtered AS (...) SELECT channel_code, channel_name_ru, count(*) FILTER (WHERE direction='inbound') AS incoming, count(*) FILTER (WHERE direction='outbound') AS outgoing, round(avg(first_response_sec))::int AS response_sec FROM filtered GROUP BY channel_code, channel_name_ru; ``` | SoR direction: softphone/CRM/message bus (`message_event.direction`). |
| Бар «Скорость реакции» (responseSec) | `GET /api/analytics/channels/split` | ```sql -- требует расширения схемы WITH filtered AS (...) SELECT channel_code, round(avg(fit.first_response_sec))::int AS response_sec, percentile_cont(0.95) WITHIN GROUP (ORDER BY fit.first_response_sec)::int AS response_p95_sec FROM filtered f JOIN fact_interaction_timing fit ON fit.interaction_id=f.id WHERE channel_code IN ('chat','email','sms','push') GROUP BY channel_code; ``` | SoR first response: CRM/чат-платформа/email gateway (`message_event`). |
| Линия «Динамика времени ответа» | `GET /api/analytics/channels/split` (`responseTrend`) | ```sql -- требует расширения схемы WITH filtered AS (...) SELECT date_trunc(:granularity, f.started_at) AS t, f.channel_code, round(avg(fit.first_response_sec))::int AS response_sec FROM filtered f JOIN fact_interaction_timing fit ON fit.interaction_id=f.id WHERE f.channel_code IN ('chat','email','sms','push') GROUP BY 1,2 ORDER BY 1,2; ``` | SoR: `message_event` + расчет в `fact_interaction_timing`. |

### 3.5 Вкладка «Тематики» + сайдбар

| UI блок | Endpoint | SQL пример | Источники / System of Record |
|---|---|---|---|
| Линия «Количество обращений по выбранной теме» | `GET /api/analytics/topics/timeseries` | ```sql WITH filtered AS (...) SELECT date_trunc(:granularity, started_at) AS t, count(*) AS incoming, count(*) FILTER (WHERE status='missed') AS missed FROM filtered GROUP BY 1 ORDER BY 1; ``` | SoR: `interactions` + `topics`. |
| Donut «Средняя продолжительность»/«Каналы»/«Эмоциональный фон»/«Достижение цели» + Top topics | `GET /api/analytics/topics/top` | ```sql WITH filtered AS (...) SELECT topic_id, topic_name_ru, count(*) AS count, round(avg(duration_sec) FILTER (WHERE status='completed' AND duration_sec>0))::int AS avg_handle_sec, round(100.0 * count(*) FILTER (WHERE status='completed') / NULLIF(count(*),0),2) AS fcr_pct FROM filtered GROUP BY topic_id, topic_name_ru ORDER BY count DESC LIMIT :limit; ``` Каналы внутри темы: ```sql WITH filtered AS (...) SELECT channel_name_ru AS name_ru, count(*)::float AS value FROM filtered GROUP BY channel_name_ru; ``` Sentiment/goal — **требует расширения схемы** (`fact_sentiment`, `fact_outcome`). | SoR тема — CRM/ML классификация; sentiment/outcome — NLP и CRM соответственно. |
| Сайдбар «Последние коммуникации» | `GET /api/analytics/recent` | ```sql WITH filtered AS (...) SELECT external_id, started_at, channel_code, channel_name_ru, queue_code, queue_name_ru, department_name_ru, operator_name_ru, topic_name_ru, duration_sec, status AS status_code, CASE status WHEN 'completed' THEN 'Завершён' WHEN 'missed' THEN 'Пропущен' WHEN 'waiting' THEN 'Ожидание' WHEN 'in_progress' THEN 'В разговоре' END AS status_ru FROM filtered ORDER BY started_at DESC LIMIT :limit OFFSET :offset; ``` | SoR: `interactions` + справочники. |

---

## 4. Покрытие всех endpoint из openapi.yaml

### 4.1 Ingestion

| Endpoint | Источник | SQL / действие |
|---|---|---|
| `POST /api/ingest/interactions` | CDR FreeSWITCH, CRM, chat/email connectors, softphone events | Upsert в `interactions` по `external_id` + upsert в справочники. ```sql INSERT INTO interactions (...) VALUES (...) ON CONFLICT (external_id) DO UPDATE SET started_at=EXCLUDED.started_at, channel_id=EXCLUDED.channel_id, queue_id=EXCLUDED.queue_id, department_id=EXCLUDED.department_id, operator_id=EXCLUDED.operator_id, topic_id=EXCLUDED.topic_id, duration_sec=EXCLUDED.duration_sec, status=EXCLUDED.status, updated_at=now(); ``` |

### 4.2 Dictionaries

| Endpoint | SQL пример | Source of truth |
|---|---|---|
| `GET /api/dictionaries/channels` | `SELECT id, channel_code AS code, name_ru FROM channels WHERE is_active=true ORDER BY id;` | MDM/CRM/телефония, нормализовано в `channels`. |
| `GET /api/dictionaries/queues` | `SELECT id, queue_code AS code, name_ru, department_id FROM queues WHERE is_active=true ORDER BY id;` | ACD/telephony config + оргсправочник. |
| `GET /api/dictionaries/departments` | `SELECT id, department_code AS code, name_ru FROM departments WHERE is_active=true ORDER BY id;` | HR/оргструктура. |
| `GET /api/dictionaries/operators` | `SELECT id, operator_code AS code, full_name_ru, department_id FROM operators WHERE is_active=true ORDER BY id;` | HR/WFM (master), softphone IDs (mapping). |
| `GET /api/dictionaries/topics` | `SELECT id, topic_code AS code, name_ru FROM topics WHERE is_active=true ORDER BY id;` | CRM reason codes / ML taxonomy. |

### 4.3 Analytics

Все analytics endpoints из `openapi.yaml` покрыты SQL-примерами в разделе 3.

---

## 5. Примеры payload (ключевые графики)

### 5.1 `GET /api/analytics/kpis`

```json
{
  "incoming": 246,
  "missed": 29,
  "ahtSec": 311,
  "operatorsOnCalls": 32,
  "operatorsTotal": 44,
  "fcrPct": 88.2,
  "avgWaitSec": 27,
  "slaPct": 81.5
}
```

### 5.2 `GET /api/analytics/queues`

```json
{
  "items": [
    {
      "queueCode": "general",
      "queueNameRu": "Общая",
      "total": 150,
      "abandonedPct": 11.3,
      "waiting": 6,
      "avgWaitSec": 23,
      "slaPct": 84.6
    }
  ],
  "queueDepthTrend": [
    { "t": "2026-01-30T09:00:00+03:00", "general": 4, "vip": 1, "antifraud": 2 }
  ]
}
```

---

## 6. Gaps / TODO

1. **Нет endpoint для обзора по Sentiment** (`/api/analytics/sentiment/split`) — требуется отдельная ручка и источник NLP.
2. **Нет endpoint для обзора по Outcome/Goal** (`/api/analytics/outcomes/split`) — требуется интеграция с CRM outcome.
3. Для точных метрик **ASA/SLA/avgWait/queueDepth/responseSec/outgoing** текущей `schema.dbml` недостаточно — нужно внедрить таблицы событий и агрегатов из `schema.extension.dbml`.
4. В `topics/timeseries` параметр `topic` объявлен дважды (общий и required локальный) — желательно унифицировать контракт.
5. Требуется единая политика дедупликации событий по `event_id`/`source_system` и корреляции по `call_id`/`conversation_id` (описано в integration-contour).
