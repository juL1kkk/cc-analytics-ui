# Project Overview + Implementation Details (cc-analytics-ui)

## Авто-инвентарь API (фактические route.ts)

| Endpoint | route.ts path | mock module | real module | main filters (route.ts) |
|---|---|---|---|---|
| `GET /api/analytics/kpis` | `app/api/analytics/kpis/route.ts` | `@/lib/analytics/kpis/mock` | `@/lib/analytics/kpis/real` | `period, from, to, dept, channel, queue, topic, q` |
| `GET /api/analytics/kpis/v2` | `app/api/analytics/kpis/v2/route.ts` | `@/lib/analytics/kpis/mock` | `@/lib/analytics/kpis/real` | `period, from, to, dept, channel, queue, topic, q` |
| `GET /api/analytics/timeseries` | `app/api/analytics/timeseries/route.ts` | `@/lib/analytics/timeseries/mock` | `@/lib/analytics/timeseries/real` | `period, from, to, dept, channel, queue, topic, q, granularity` |
| `GET /api/analytics/channels/split` | `app/api/analytics/channels/split/route.ts` | `@/lib/analytics/channels/split/mock` | `@/lib/analytics/channels/split/real` | `period, from, to, dept, channel, queue, topic, q` |
| `GET /api/analytics/operators` | `app/api/analytics/operators/route.ts` | `@/lib/analytics/operators/mock` | `@/lib/analytics/operators/real` | `period, from, to, dept, channel, queue, topic, q, limit, offset` |
| `GET /api/analytics/queues` | `app/api/analytics/queues/route.ts` | `@/lib/analytics/queues/mock` | `@/lib/analytics/queues/real` | `period, from, to, dept, channel, queue, topic, q` |
| `GET /api/analytics/topics/top` | `app/api/analytics/topics/top/route.ts` | `@/lib/analytics/topics/top/mock` | `@/lib/analytics/topics/top/real` | `period, from, to, dept, channel, queue, topic, q, limit` |
| `GET /api/analytics/topics/timeseries` | `app/api/analytics/topics/timeseries/route.ts` | `@/lib/analytics/topics/timeseries/mock` | `@/lib/analytics/topics/timeseries/real` | `period, from, to, dept, channel, queue, topic, q` (`topicFilter` derived from `topic`) |
| `GET /api/analytics/recent` | `app/api/analytics/recent/route.ts` | `@/lib/analytics/recent/mock` | `@/lib/analytics/recent/real` | `period, from, to, dept, channel, queue, topic, q, limit, offset` |
| `GET /api/analytics/sentiment` | `app/api/analytics/sentiment/route.ts` | `@/lib/analytics/sentiment/mock` | `@/lib/analytics/sentiment/real` | `from, to, status, active, q` |

> Общий catch-all роут для `/api/analytics/*` отсутствует; каждый endpoint реализован отдельным `route.ts`.

---

## A) Краткое описание

### Что это за продукт
- Это Next.js App Router проект, совмещающий UI и backend API для аналитики КЦ.
- Backend часть — `app/api/...` с доменной зоной `/api/analytics/*` и swagger endpoint `/api/openapi`.
- UI точка входа — `app/page.tsx`, но текущий компонент `ContactCenterAnalyticsDashboard` в коде опирается на локальную генерацию/mock-данные и не делает `fetch` на `/api/analytics/*`.

### Для кого/что покрывает
- По спецификациям в `docs/contact-center-analytics/*` это "расширенная аналитика контакт-центра" (KPI, time series, operators, queues, topics, recent, sentiment).

### Ключевые страницы/роуты UI
- `/` -> `app/page.tsx` -> `components/ContactCenterAnalyticsDashboard.tsx`.
- `/swagger` -> `app/swagger/page.tsx` -> `components/SwaggerUIClient.tsx` (интерактивный Swagger UI).

### Как UI подключается к OpenAPI/Swagger
- Swagger UI компонент явно использует `specUrl = "/api/openapi"`.
- `app/api/openapi/route.ts` читает `docs/contact-center-analytics/openapi.yaml` и отдает YAML.
- В `ensureLocalServer()` блок `servers:` в YAML патчится на локальный (`url: /`), чтобы Swagger работал на текущем хосте (локально/Vercel).

---

## B) Архитектура и поток данных (end-to-end)

### Общий путь запроса
1. Клиент (UI/Swagger/curl) дергает `GET /api/analytics/...`.
2. `route.ts` в `app/api/analytics/...` парсит query-параметры.
3. `route.ts` вызывает `getAnalyticsDataSource()` из `@/lib/analytics/provider`.
4. По результату выбирается либо `.../mock.ts`, либо `.../real.ts`.
5. В `real.ts` выполняются SQL-запросы через `query()` из `lib/db.ts` (`pg.Pool`, `DATABASE_URL`/`DATABASE_URL_UNPOOLED`).
6. Возвращается JSON через `NextResponse.json`.

### MOCK/REAL деградация и выбор источника
- В `lib/analytics/provider.ts`:
  - Допустимые значения env: `ANALYTICS_DATA_SOURCE=MOCK|REAL_DB`.
  - По умолчанию: `REAL_DB`.
- Почти все analytics routes делают `dataSource === "MOCK" ? mock : real`.
- Видимость активного режима:
  - В `kpis`/`kpis/v2` есть `console.log("[analytics:kpis] dataSource =", dataSource)`.
  - Там же выставляется response header `x-analytics-data-source`.
  - Для остальных endpoint режим виден косвенно по содержимому ответа (mock в основном пустые массивы/нули).

### Важно для интеграции UI
- Ограничение проекта: UI менять нельзя; UI должен брать данные только через Analytics API.
- Фактическое состояние кода: текущий dashboard компонент не ходит в API (нет `fetch`/SWR/react-query), поэтому реальное «UI -> API» реализовано только через Swagger/manual requests.

---

## C) Список реализованных endpoint’ов `/api/analytics/*` (фактический)

### 1) `GET /api/analytics/kpis`
- Route: `app/api/analytics/kpis/route.ts`.
- Query: `period, from, to, dept, channel, queue, topic, q`.
- Response shape (`real.ts`):
  - `{ incoming, missed, ahtSec, operatorsOnCalls, operatorsTotal, fcrPct, avgWaitSec, slaPct }`.
- Mock: возвращает нули/null.
- Real: `lib/analytics/kpis/real.ts`, SQL по `public.interactions` + `public.operators`.

### 2) `GET /api/analytics/kpis/v2`
- Route: `app/api/analytics/kpis/v2/route.ts`.
- Полностью дублирует `/api/analytics/kpis` (те же параметры, тот же mock/real, тот же header).

### 3) `GET /api/analytics/timeseries`
- Route: `app/api/analytics/timeseries/route.ts`.
- Query: `period, from, to, dept, channel, queue, topic, q, granularity(auto|hour|day)`.
- Response shape: `{ granularity: "hour"|"day", items: [{ t, incoming, missed, ahtSec }] }`.
- Real: `lib/analytics/timeseries/real.ts`, `date_trunc` по `public.interactions`.

### 4) `GET /api/analytics/channels/split`
- Route: `app/api/analytics/channels/split/route.ts`.
- Query: `period, from, to, dept, channel, queue, topic, q`.
- Response shape: `{ split: [...], responseTrend: [...] }`.
- Real: `lib/analytics/channels/split/real.ts`, join `public.interactions` + `public.channels`.

### 5) `GET /api/analytics/operators`
- Route: `app/api/analytics/operators/route.ts`.
- Query: `period, from, to, dept, channel, queue, topic, q, limit, offset`.
- Response shape: `{ items: [{ operatorId, operatorNameRu, handled, missed, ahtSec, fcrPct }], trend: [{ t, ahtSec, asaSec }] }`.
- Real: `lib/analytics/operators/real.ts`, join `public.interactions` + `public.operators`.

### 6) `GET /api/analytics/queues`
- Route: `app/api/analytics/queues/route.ts`.
- Query: `period, from, to, dept, channel, queue, topic, q`.
- Response shape: `{ items: [{ queueCode, queueNameRu, total, abandonedPct, waiting, avgWaitSec, slaPct }], queueDepthTrend }`.
- Real: `lib/analytics/queues/real.ts`, join `public.interactions` + `public.queues`.

### 7) `GET /api/analytics/topics/top`
- Route: `app/api/analytics/topics/top/route.ts`.
- Query: `period, from, to, dept, channel, queue, topic, q, limit`.
- Response shape: `{ topTopics, channelSplit, sentimentSplit, goalSplit }`.
- Real: `lib/analytics/topics/top/real.ts`, join `public.interactions` + `public.topics` + `public.channels`.

### 8) `GET /api/analytics/topics/timeseries`
- Route: `app/api/analytics/topics/timeseries/route.ts`.
- Query: `period, from, to, dept, channel, queue, topic, q`; внутри route добавляется `topicFilter = topic ?? "all"`.
- Response shape: `{ topic, items: [{ t, incoming, missed }] }`.
- Real: `lib/analytics/topics/timeseries/real.ts`, SQL по таблице `interactions` (без явного `public.`).

### 9) `GET /api/analytics/recent`
- Route: `app/api/analytics/recent/route.ts`.
- Query: `period, from, to, dept, channel, queue, topic, q, limit, offset`.
- Response shape: `{ items: RecentItem[], total }`.
- Real: `lib/analytics/recent/real.ts`, join `public.interactions` + `public.channels` + `public.queues` + `public.operators` + `public.topics`.

### 10) `GET /api/analytics/sentiment`
- Route: `app/api/analytics/sentiment/route.ts`.
- Query: `from, to, status, active, q`.
- Response shape: `{ items: [{ nameRu, value }], total }`.
- Real: `lib/analytics/sentiment/real.ts`, сначала autodetect WMT-таблицы в `information_schema.columns`, затем агрегация red/yellow/green.

---

## D) OpenAPI (структура)

### Файл
- Основная спецификация: `docs/contact-center-analytics/openapi.yaml`.

### Верхний уровень
- `openapi: 3.0.3`.
- `servers` (локальный `/`).
- `tags`: `Ingestion`, `Dictionaries`, `Analytics`.
- `paths` включает ingestion, dictionaries, analytics.

### Общие параметры (`components/parameters`)
- Для analytics core: `period`, `from`, `to`, `dept`, `channel`, `queue`, `topic`, `q`, `limit`, `offset`.
- Для sentiment: `sentimentFrom`, `sentimentTo`, `sentimentStatus`, `sentimentActive`.

### Схемы основных ответов (`components/schemas`)
- `KpisResponse` -> `/api/analytics/kpis`.
- `TimeSeriesResponse` -> `/api/analytics/timeseries`.
- `ChannelsSplitResponse` -> `/api/analytics/channels/split`.
- `OperatorsResponse` -> `/api/analytics/operators`.
- `QueuesResponse` -> `/api/analytics/queues`.
- `TopicsTopResponse` -> `/api/analytics/topics/top`.
- `TopicTimeSeriesResponse` -> `/api/analytics/topics/timeseries`.
- `RecentResponse` -> `/api/analytics/recent`.
- `SentimentResponse` -> `/api/analytics/sentiment`.

---

## E) Слой данных / БД

### DB клиент/конфиг
- `lib/db.ts` использует `pg.Pool`.
- Connection string: `DATABASE_URL` или `DATABASE_URL_UNPOOLED`.
- SSL включен (`rejectUnauthorized: false`).

### Схемы и источники
- Основная аналитика (`real.ts`) — в основном `public.*` таблицы.
- Справочники `users`, `TicketSubject`, `TicketSubjectOut` читаются из `cc_replica.*`.
- В `sentiment/real.ts` WMT-источник ищется в `public` по колонкам (`communicationColor/createdOn` и пр.).

### Таблицы, реально используемые в current real-реализациях analytics
- `public.interactions` (почти везде).
- `public.operators` (`kpis`, `operators`, `recent`).
- `public.channels` (`channels/split`, `recent`, `topics/top`).
- `public.queues` (`queues`, `recent`).
- `public.topics` (`topics/top`, `recent`).
- `information_schema.columns` (`sentiment` autodetect).
- динамически найденная WMT-таблица в `public` (`sentiment`).

### Сущности и связи (по SQL и схеме)
- По `docs/cc_analytics_schema.sql` у `interactions` есть FK на `operators`, `queues`, `channels`, `topics`.
- В запросах видно join-цепочки:
  - `interactions.channel_id -> channels.id`
  - `interactions.queue_id -> queues.id`
  - `interactions.operator_id -> operators.id`
  - `interactions.topic_id -> topics.id`
- `department_id` используется в ряде SQL как фильтр, но не везде гарантирован по факту схемы/данных.

---

## F) Известные ограничения / TODO / заглушки (по факту кода)

1. **MOCK режим почти пустой**:
   - Большинство `mock.ts` возвращают пустые `items`/`split`/`trend` либо нули.
   - Исключение: `sentiment/mock.ts` возвращает фиксированные 10/30/60.

2. **Деградация некоторых метрик в REAL как `null`**:
   - `kpis.real`: `avgWaitSec`, `slaPct` всегда `null`.
   - `operators.real`: `asaSec` всегда `null`.
   - `queues.real`: `waiting`, `avgWaitSec`, `slaPct`, `queueDepthTrend` = `null`.
   - `topics/top.real`: `sentimentSplit`, `goalSplit` = `null`.

3. **Фильтр `dept` неоднороден**:
   - `kpis/timeseries/recent` прямо комментируют, что `department_id` сейчас не поддержан в `interactions`.
   - `channels-split/operators/queues/topics*` фильтруют по `i.department_id`.

4. **`q` параметр во всех analytics route принимается, но в SQL фактически не применяется**.

5. **Нет фильтра `operator` в analytics API** (ни в route.ts, ни в OpenAPI analytics parameters).

6. **Ingestion endpoint пока заглушка**:
   - `POST /api/ingest/interactions` возвращает `501 NOT_IMPLEMENTED`.

7. **Справочники частично временно маппят поля**:
   - channels/departments/queues/operators/topics: `code` часто подменяется `name` или `id`, т.к. отдельного code в таблицах нет.

8. **Подозрительная реализация `TicketSubject`**:
   - route `app/api/dictionaries/TicketSubject/route.ts` фактически читает `cc_replica."TicketSubjectOut"`.

---

## G) Локальный запуск и проверка (из README/package.json)

### Команды
- `npm run dev` — запуск dev-сервера.
- `npm run build` — сборка.
- `npm run start` — запуск production-сборки.
- `npm run lint` — ESLint.

### Env vars
- `ANALYTICS_DATA_SOURCE=MOCK|REAL_DB`.
- `DATABASE_URL` (или `DATABASE_URL_UNPOOLED`) для реальной БД.

### Swagger UI
- URL UI: `http://localhost:3000/swagger`.
- Спека: `GET /api/openapi` (отдает YAML из `docs/contact-center-analytics/openapi.yaml`).

### Примеры curl (ключевые endpoint’ы)
```bash
# KPI
curl "http://localhost:3000/api/analytics/kpis?from=2024-02-01T00:00:00Z&to=2024-02-02T00:00:00Z&channel=1"

# Timeseries
curl "http://localhost:3000/api/analytics/timeseries?from=2024-02-01T00:00:00Z&to=2024-02-02T00:00:00Z&granularity=hour"

# Operators
curl "http://localhost:3000/api/analytics/operators?from=2024-02-01T00:00:00Z&to=2024-02-02T00:00:00Z&limit=10&offset=0"

# Recent
curl "http://localhost:3000/api/analytics/recent?from=2024-02-01T00:00:00Z&to=2024-02-02T00:00:00Z&limit=20"

# Sentiment
curl "http://localhost:3000/api/analytics/sentiment?from=2024-02-01T00:00:00Z&to=2024-02-02T00:00:00Z"
```

---

## Проверка консистентности OpenAPI vs app/api (Mismatch)

1. **Есть в app/api, нет в OpenAPI**:
   - `GET /api/analytics/kpis/v2`.

2. **Фильтры analytics (требование period/from/to/dept/channel/queue/topic/operator/q/limit/offset)**:
   - Фактически реализованы в коде и OpenAPI: `period, from, to, dept, channel, queue, topic, q` + где нужно `limit, offset`.
   - **`operator` как query-filter отсутствует** и в `app/api/analytics/*`, и в OpenAPI (`components/parameters`).

3. **OpenAPI описывает `topic` в `/topics/timeseries` как `required: true`, но route ставит default `topicFilter = "all"` при отсутствии параметра.**

---

## Карта файлов (ключевые)

- `app/api/analytics/**/route.ts` — HTTP handlers аналитики.
- `lib/analytics/**/real.ts` — SQL-реализации (REAL_DB).
- `lib/analytics/**/mock.ts` — mock-реализации (MOCK).
- `lib/analytics/provider.ts` — переключатель `MOCK/REAL_DB`.
- `lib/db.ts` — pg Pool и `query()`.
- `docs/contact-center-analytics/openapi.yaml` — контракт API.
- `app/api/openapi/route.ts` — раздача OpenAPI в Swagger.
- `app/swagger/page.tsx` + `components/SwaggerUIClient.tsx` — Swagger UI.
- `app/page.tsx` + `components/ContactCenterAnalyticsDashboard.tsx` — текущий UI dashboard.
- `app/api/dictionaries/**/route.ts` — справочники (`public` + `cc_replica`).
- `app/api/ingest/interactions/route.ts` — ingestion stub (501).
- `docs/cc_analytics_schema.sql` — SQL схема и FK (legacy/reference).

---

## Готовый короткий промт (10–15 строк) для другого ИИ

```text
Проект: cc-analytics-ui (Next.js App Router). Нужен backend-first аудит Analytics API без изменения UI.
Главный контракт: docs/contact-center-analytics/openapi.yaml.
Фактические analytics handlers: app/api/analytics/**/route.ts (9 endpoint из OpenAPI + дополнительный /kpis/v2).
Источник данных переключается через ANALYTICS_DATA_SOURCE в lib/analytics/provider.ts: MOCK или REAL_DB (default REAL_DB).
REAL-логика в lib/analytics/**/real.ts, SQL через lib/db.ts (pg, DATABASE_URL/DATABASE_URL_UNPOOLED).
Основные таблицы: public.interactions + joins public.channels/queues/operators/topics; sentiment ищет WMT table в public через information_schema.
cc_replica используется в dictionaries/users и TicketSubject/TicketSubjectOut.
Единые фильтры фактически: period/from/to/dept/channel/queue/topic/q (+limit/offset на selected endpoints).
Важный mismatch: operator filter отсутствует, хотя ожидается в общем списке; /api/analytics/kpis/v2 нет в OpenAPI.
Ещё mismatch: OpenAPI требует topic в /topics/timeseries, а route подставляет all.
Ingestion endpoint /api/ingest/interactions пока 501 NOT_IMPLEMENTED.
Текущий UI dashboard не вызывает /api/analytics (нет fetch), Swagger доступен на /swagger через /api/openapi.
Правило интеграции: UI должен получать данные только через Analytics API; UI-компоненты не менять.
```
