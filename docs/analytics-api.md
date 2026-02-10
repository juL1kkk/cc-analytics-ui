# Analytics API (RU)

## 1) Общие принципы

### Источник данных
- **Переключатель**: `ANALYTICS_DATA_SOURCE`.
- **Значения**: `REAL_DB` или `MOCK`. По умолчанию используется `REAL_DB` (см. `lib/analytics/provider.ts`).
- **Как влияет**:
  - `REAL_DB` — запросы к PostgreSQL через `lib/db.ts`.
  - `MOCK` — возвращаются пустые массивы/нули без чтения БД.

### Единые параметры (query)
> Во всех endpoints параметры читаются из query. `period`/`q` сейчас не используются при расчётах и не влияют на результат (см. реализацию каждого провайдера).

| Параметр | Назначение (RU) | Формат / значения | Пример | Реальная обработка |
|---|---|---|---|---|
| `period` | Пресет периода. | `today`, `yesterday`, `7d`, `30d`, `custom` | `?period=7d` | **Игнорируется** в текущей реализации. Фактический диапазон берётся только из `from`/`to`. |
| `from` | Начало периода. | ISO 8601 datetime | `?from=2024-02-01T00:00:00Z` | Если некорректно или пусто — берётся дефолт (обычно последние 24ч, см. endpoint). |
| `to` | Конец периода. | ISO 8601 datetime | `?to=2024-02-02T00:00:00Z` | Если некорректно или пусто — берётся дефолт (обычно «сейчас», см. endpoint). |
| `dept` | Отдел. | **Числовой id** (строка), а не код | `?dept=3` | В части endpoints **отключён** или требует `interactions.department_id` в БД. |
| `channel` | Канал. | **Числовой id** (строка) | `?channel=2` | Фильтр по `interactions.channel_id` (если указан и число). |
| `queue` | Очередь. | **Числовой id** (строка) | `?queue=5` | Фильтр по `interactions.queue_id` (если указан и число). |
| `topic` | Тематика. | **Числовой id** (строка) | `?topic=7` | Фильтр по `interactions.topic_id` (если указан и число). |
| `q` | Поиск (externalId/оператор/тема). | строка | `?q=Иван` | **Игнорируется** в текущей реализации. |
| `limit` | Лимит записей (пагинация). | integer | `?limit=50` | Используется в `/operators`, `/recent`, `/topics/top`. |
| `offset` | Смещение (пагинация). | integer | `?offset=100` | Используется в `/operators`, `/recent`. |
| `granularity` | Гранулярность для таймсерий. | `auto`, `hour`, `day` | `?granularity=day` | В реализации `auto` → `hour`. |

### Семантика статусов/метрик (как в коде)
- **incoming** — `COUNT(*)` по `public.interactions` в выбранном периоде.
- **missed** — `COUNT(*)` где `status='unresolved' AND ended_at IS NULL`.
- **handled** (для операторов) — `COUNT(*)` где `status='resolved'`.
- **ahtSec / avgHandleSec** — `ROUND(AVG(duration_sec))` только для `status='resolved' AND duration_sec > 0`.
- **fcrPct** — `ROUND(100 * AVG(CASE WHEN fcr THEN 1 ELSE 0 END), 2)`.
- **responseSec** — `ROUND(AVG(response_time_sec))`.
- **statusCode/statusRu** (в `/recent`) вычисляются по `interactions.status` + `ended_at`:
  - `resolved` → `completed` / `Завершён`
  - `unresolved` и `ended_at IS NULL` → `missed` / `Пропущен`
  - `unresolved` и `ended_at IS NOT NULL` → `waiting` / `Ожидание`
  - иначе → `in_progress` / `В разговоре`

> Все фильтры по `dept/channel/queue/topic` работают **только если параметр приводится к числу**. Нечисловые значения игнорируются.

---

## 2) Описание методов

### 2.1 `GET /api/analytics/kpis`
**Назначение**: KPI карточки (входящие, пропущенные, AHT, нагрузка, FCR).

**Параметры**:
- `from`, `to` — используются.
- `channel`, `queue`, `topic` — используются (фильтр по id).
- `dept` — **не применяется** (в коде комментарий «нет interactions.department_id»).
- `period`, `q` — **игнорируются**.

**Ответ (пример)**:
```json
{
  "incoming": 246,
  "missed": 29,
  "ahtSec": 311,
  "operatorsOnCalls": 32,
  "operatorsTotal": 44,
  "fcrPct": 88.2,
  "avgWaitSec": null,
  "slaPct": null
}
```

**Источники данных**:
- `public.interactions`: `started_at`, `ended_at`, `status`, `duration_sec`, `fcr`, `operator_id`, `channel_id`, `queue_id`, `topic_id`.
- `public.operators`: `id` (для `operatorsTotal`).

**Формулы/агрегации** (упрощённо):
```sql
SELECT
  COUNT(*) AS incoming,
  COUNT(*) FILTER (WHERE status='unresolved' AND ended_at IS NULL) AS missed,
  ROUND(AVG(duration_sec) FILTER (WHERE status='resolved' AND duration_sec > 0)) AS ahtSec,
  COUNT(DISTINCT operator_id) FILTER (WHERE status='resolved') AS operatorsOnCalls,
  ROUND(100.0 * AVG(CASE WHEN fcr THEN 1 ELSE 0 END), 2) AS fcrPct
FROM public.interactions
WHERE started_at >= $from AND started_at < $to
  [AND channel_id = ?] [AND queue_id = ?] [AND topic_id = ?];
```

**Ограничения**:
- `avgWaitSec` и `slaPct` всегда `null` (нет событий очередей). См. раздел 3.
- `dept` фильтр отключён.

---

### 2.2 `GET /api/analytics/timeseries`
**Назначение**: временные ряды `incoming/missed/ahtSec`.

**Параметры**:
- `from`, `to` — используются.
- `granularity` — `day` или `hour` (любой другой/`auto` → `hour`).
- `channel`, `queue`, `topic` — используются (фильтр по id).
- `dept` — **не применяется** (в коде комментарий «нет interactions.department_id»).
- `period`, `q` — **игнорируются**.

**Ответ (пример)**:
```json
{
  "granularity": "hour",
  "items": [
    { "t": "2024-02-01T09:00:00.000Z", "incoming": 42, "missed": 4, "ahtSec": 298 }
  ]
}
```

**Источники данных**:
- `public.interactions`: `started_at`, `ended_at`, `status`, `duration_sec`.

**Формулы/агрегации**:
```sql
SELECT
  date_trunc('hour', started_at) AS bucket,
  COUNT(*) AS incoming,
  COUNT(*) FILTER (WHERE status='unresolved' AND ended_at IS NULL) AS missed,
  ROUND(AVG(duration_sec) FILTER (WHERE status='resolved' AND duration_sec > 0)) AS ahtSec
FROM public.interactions
WHERE started_at >= $from AND started_at < $to
  [AND channel_id = ?] [AND queue_id = ?] [AND topic_id = ?]
GROUP BY 1
ORDER BY 1;
```

**Ограничения**:
- `dept` фильтр отключён.

---

### 2.3 `GET /api/analytics/channels/split`
**Назначение**: распределение по каналам + тренд скорости реакции.

**Параметры**:
- `from`, `to` — используются.
- `dept`, `channel`, `queue`, `topic` — используются (фильтр по id).
- `period`, `q` — **игнорируются**.

**Ответ (пример)**:
```json
{
  "split": [
    {
      "channelCode": "Звонки",
      "channelNameRu": "Звонки",
      "incoming": 120,
      "outgoing": null,
      "responseSec": 35
    }
  ],
  "responseTrend": [
    { "t": "2024-02-01T09:00:00.000Z", "voice": 30, "chat": null }
  ]
}
```

**Источники данных**:
- `public.interactions`: `started_at`, `channel_id`, `queue_id`, `topic_id`, `department_id`, `response_time_sec`.
- `public.channels`: `id`, `name`.

**Формулы/агрегации**:
```sql
-- split
SELECT
  c.name AS channelNameRu,
  c.name AS channelCode,
  COUNT(*) AS incoming,
  ROUND(AVG(i.response_time_sec)) AS responseSec
FROM public.interactions i
JOIN public.channels c ON c.id = i.channel_id
WHERE i.started_at >= $from AND i.started_at < $to
  [AND i.department_id = ?] [AND i.channel_id = ?] [AND i.queue_id = ?] [AND i.topic_id = ?]
GROUP BY c.name
ORDER BY COUNT(*) DESC, c.name ASC;

-- responseTrend (по часам)
SELECT date_trunc('hour', i.started_at) AS bucket,
       i.channel_id,
       ROUND(AVG(i.response_time_sec)) AS v
FROM public.interactions i
WHERE i.started_at >= $from AND i.started_at < $to
  [AND i.department_id = ?] [AND i.queue_id = ?] [AND i.topic_id = ?] [AND i.channel_id = ?]
GROUP BY 1,2
ORDER BY 1;
```

**Важные детали**:
- `channelCode` сейчас равен `channels.name` (в БД нет отдельного кода).
- `responseTrend` заполняет поля `voice/chat/email/sms/push` по **поиску подстрок** в `channels.name`:
  - содержит «звон» → `voice`, «чат» → `chat`, «email/почт» → `email`, «sms» → `sms`, «push» → `push`.
  - если имя не распознано — слот пропускается.

**Ограничения**:
- `outgoing` всегда `null` (в `interactions` нет направления).
- Требует `interactions.department_id` для фильтра `dept`.

---

### 2.4 `GET /api/analytics/operators`
**Назначение**: метрики по операторам + тренд AHT.

**Параметры**:
- `from`, `to` — используются.
- `dept`, `channel`, `queue`, `topic` — используются (фильтр по id).
- `limit`, `offset` — используются (дефолт `limit=20`, `offset=0`).
- `period`, `q` — **игнорируются**.

**Ответ (пример)**:
```json
{
  "items": [
    {
      "operatorId": 1,
      "operatorNameRu": "Иван Петров",
      "handled": 34,
      "missed": 4,
      "ahtSec": 305,
      "fcrPct": 86.8
    }
  ],
  "trend": [
    { "t": "2024-02-01T09:00:00.000Z", "ahtSec": 298, "asaSec": null }
  ]
}
```

**Источники данных**:
- `public.interactions`: `started_at`, `ended_at`, `status`, `duration_sec`, `fcr`, `operator_id`, `channel_id`, `queue_id`, `topic_id`, `department_id`.
- `public.operators`: `id`, `full_name`.

**Формулы/агрегации**:
```sql
-- items
SELECT
  o.id AS operatorId,
  o.full_name AS operatorNameRu,
  COUNT(*) FILTER (WHERE i.status = 'resolved') AS handled,
  COUNT(*) FILTER (WHERE i.status = 'unresolved' AND i.ended_at IS NULL) AS missed,
  ROUND(AVG(i.duration_sec) FILTER (WHERE i.status = 'resolved' AND i.duration_sec > 0)) AS ahtSec,
  ROUND(100.0 * AVG(CASE WHEN i.fcr THEN 1 ELSE 0 END), 2) AS fcrPct
FROM public.interactions i
JOIN public.operators o ON o.id = i.operator_id
WHERE i.started_at >= $from AND i.started_at < $to
  [AND i.department_id = ?] [AND i.channel_id = ?] [AND i.queue_id = ?] [AND i.topic_id = ?]
GROUP BY o.id, o.full_name
ORDER BY handled DESC, missed DESC, o.id ASC
LIMIT $limit OFFSET $offset;

-- trend
SELECT
  date_trunc('hour', i.started_at) AS bucket,
  ROUND(AVG(i.duration_sec) FILTER (WHERE i.status = 'resolved' AND i.duration_sec > 0)) AS ahtSec
FROM public.interactions i
WHERE i.started_at >= $from AND i.started_at < $to
  [AND i.department_id = ?] [AND i.channel_id = ?] [AND i.queue_id = ?] [AND i.topic_id = ?]
GROUP BY 1
ORDER BY 1;
```

**Ограничения**:
- `asaSec` всегда `null` (нет очередных событий/ASA таблиц для операторов).
- Требует `interactions.department_id` для фильтра `dept`.

---

### 2.5 `GET /api/analytics/queues`
**Назначение**: метрики по очередям.

**Параметры**:
- `from`, `to` — используются.
- `dept`, `channel`, `queue`, `topic` — используются (фильтр по id).
- `period`, `q` — **игнорируются**.

**Ответ (пример)**:
```json
{
  "items": [
    {
      "queueCode": "Поддержка клиентов",
      "queueNameRu": "Поддержка клиентов",
      "total": 150,
      "abandonedPct": 11.3,
      "waiting": null,
      "avgWaitSec": null,
      "slaPct": null
    }
  ],
  "queueDepthTrend": null
}
```

**Источники данных**:
- `public.interactions`: `started_at`, `ended_at`, `status`, `queue_id`, `channel_id`, `topic_id`, `department_id`.
- `public.queues`: `id`, `name`.

**Формулы/агрегации**:
```sql
SELECT
  q.name AS queueNameRu,
  q.name AS queueCode,
  COUNT(*) AS total,
  ROUND(
    100.0 * (COUNT(*) FILTER (WHERE i.status='unresolved' AND i.ended_at IS NULL)) / NULLIF(COUNT(*), 0),
    2
  ) AS abandonedPct
FROM public.interactions i
JOIN public.queues q ON q.id = i.queue_id
WHERE i.started_at >= $from AND i.started_at < $to
  [AND i.department_id = ?] [AND i.channel_id = ?] [AND i.queue_id = ?] [AND i.topic_id = ?]
GROUP BY q.name
ORDER BY COUNT(*) DESC, q.name ASC;
```

**Ограничения**:
- `waiting`, `avgWaitSec`, `slaPct` всегда `null`.
- `queueDepthTrend` всегда `null`.
- Требует `interactions.department_id` для фильтра `dept`.

---

### 2.6 `GET /api/analytics/topics/top`
**Назначение**: топ тематик + donut-распределение по каналам.

**Параметры**:
- `from`, `to` — используются.
- `dept`, `channel`, `queue`, `topic` — используются (фильтр по id).
- `limit` — используется (дефолт `10`).
- `period`, `q` — **игнорируются**.

**Ответ (пример)**:
```json
{
  "topTopics": [
    { "topicId": 10, "topicNameRu": "Сброс пароля", "count": 48, "avgHandleSec": 245, "fcrPct": 91.0 }
  ],
  "channelSplit": [
    { "nameRu": "Звонки", "value": 55 },
    { "nameRu": "Чат", "value": 30 }
  ],
  "sentimentSplit": null,
  "goalSplit": null
}
```

**Источники данных**:
- `public.interactions`: `started_at`, `duration_sec`, `fcr`, `topic_id`, `channel_id`, `queue_id`, `department_id`.
- `public.topics`: `id`, `name`.
- `public.channels`: `id`, `name` (для `channelSplit`).

**Формулы/агрегации**:
```sql
-- topTopics
SELECT
  t.id AS topicId,
  t.name AS topicNameRu,
  COUNT(*) AS count,
  ROUND(AVG(i.duration_sec) FILTER (WHERE i.status='resolved' AND i.duration_sec > 0)) AS avgHandleSec,
  ROUND(100.0 * AVG(CASE WHEN i.fcr THEN 1 ELSE 0 END), 2) AS fcrPct
FROM public.interactions i
JOIN public.topics t ON t.id = i.topic_id
WHERE i.started_at >= $from AND i.started_at < $to
  [AND i.department_id = ?] [AND i.channel_id = ?] [AND i.queue_id = ?] [AND i.topic_id = ?]
GROUP BY t.id, t.name
ORDER BY COUNT(*) DESC, t.id ASC
LIMIT $limit;

-- channelSplit для выбранной тематики
SELECT c.name AS nameRu, COUNT(*) AS value
FROM public.interactions i
JOIN public.channels c ON c.id = i.channel_id
WHERE i.started_at >= $from AND i.started_at < $to
  AND i.topic_id = $topicForSplit
  [AND i.department_id = ?] [AND i.channel_id = ?] [AND i.queue_id = ?]
GROUP BY c.name
ORDER BY COUNT(*) DESC, c.name ASC;
```

**Важные детали**:
- Тематика для `channelSplit` выбирается так:
  - если передан `topic` → используется он;
  - иначе используется топ-1 тема из `topTopics`.

**Ограничения**:
- `sentimentSplit` и `goalSplit` всегда `null`.
- Требует `interactions.department_id` для фильтра `dept`.

---

### 2.7 `GET /api/analytics/topics/timeseries`
**Назначение**: временной ряд по выбранной тематике (`incoming/missed`).

**Параметры**:
- `topic` — **обязателен** (значение `all` или числовой id).
- `from`, `to` — используются.
- `dept`, `channel`, `queue` — используются (фильтр по id).
- `period`, `q` — **игнорируются**.

**Ответ (пример)**:
```json
{
  "topic": "all",
  "items": [
    { "t": "2024-02-01T09:00:00.000Z", "incoming": 22, "missed": 2 }
  ]
}
```

**Источники данных**:
- `public.interactions`: `started_at`, `ended_at`, `status`, `topic_id`, `channel_id`, `queue_id`, `department_id`.

**Формулы/агрегации**:
```sql
SELECT
  date_trunc('hour', started_at) AS t,
  COUNT(*) AS incoming,
  COUNT(*) FILTER (WHERE status='unresolved' AND ended_at IS NULL) AS missed
FROM public.interactions
WHERE started_at >= $from AND started_at <= $to
  [AND department_id = ?] [AND channel_id = ?] [AND queue_id = ?]
  [AND topic_id = ?] -- если topic != 'all'
GROUP BY t
ORDER BY t ASC;
```

**Ограничения**:
- Требует `interactions.department_id` для фильтра `dept`.
- `topic` приводится к числу при фильтрации (нечисловые значения дадут `NaN`).

---

### 2.8 `GET /api/analytics/recent`
**Назначение**: последние коммуникации (лента/таблица).

**Параметры**:
- `from`, `to` — используются.
- `channel`, `queue`, `topic` — используются (фильтр по id).
- `limit`, `offset` — используются (дефолт `limit=20`, `offset=0`).
- `dept` — **не применяется** (в коде комментарий «нет interactions.department_id»).
- `period`, `q` — **игнорируются**.
- `debug=1` — **не в контракте OpenAPI**, но если передан и случилась ошибка, API вернёт `details`.

**Ответ (пример)**:
```json
{
  "items": [
    {
      "externalId": "123",
      "startedAt": "2024-02-01T09:15:00.000Z",
      "channelCode": "Звонки",
      "channelNameRu": "Звонки",
      "queueCode": "Поддержка клиентов",
      "queueNameRu": "Поддержка клиентов",
      "departmentNameRu": "—",
      "operatorNameRu": "Иван Петров",
      "topicNameRu": "Оплата",
      "durationSec": 360,
      "statusCode": "completed",
      "statusRu": "Завершён"
    }
  ],
  "total": 1
}
```

**Источники данных**:
- `public.interactions`: `id`, `started_at`, `ended_at`, `status`, `duration_sec`, `channel_id`, `queue_id`, `topic_id`, `operator_id`.
- `public.channels`, `public.queues`, `public.operators`, `public.topics`.

**Формулы/агрегации**:
- `externalId` = `interactions.id::text`.
- `departmentNameRu` всегда `'—'`.
- `statusCode/statusRu` рассчитываются на основе `status` и `ended_at` (см. общие принципы).

**Ограничения**:
- `dept` фильтр отключён.
- `departmentNameRu` всегда `'—'`.

---

## 3) Известные ограничения и план расширения

### 3.1 Отделы и `department_id`
- В **текущей рабочей схеме** (`docs/cc_analytics_schema.sql`) **нет** таблицы `public.departments` и поля `interactions.department_id`.
- При этом **часть SQL** в `channels/split`, `operators`, `queues`, `topics/top`, `topics/timeseries` **фильтрует по `i.department_id`**. Это будет работать **только если БД соответствует расширенной схеме** (см. `docs/contact-center-analytics/schema.dbml` и `Script создания PostgreSQL.sql`).
- В `kpis`, `timeseries`, `recent` фильтр `dept` **явно отключён** в коде.

**Что нужно добавить в БД**:
- Таблицу `departments` и столбец `interactions.department_id` + связи с `queues`/`operators` (см. `schema.dbml` / `Script создания PostgreSQL.sql`).

### 3.2 SLA/ASA/очереди
- `avgWaitSec`, `slaPct`, `waiting`, `queueDepthTrend`, `asaSec` **возвращаются `null`**.
- Причина: в текущем факте `interactions` нет событий очереди/стадий обработки.

**Что нужно добавить**:
- Событийные/интервальные таблицы (`queue_event`, `agent_event`, `fact_queue_interval`, `fact_interaction_timing`) из `schema.extension.dbml`.

### 3.3 Sentiment/Goals
- `sentimentSplit` и `goalSplit` в `/topics/top` **всегда `null`**.

**Что нужно добавить**:
- Производственные факты `fact_sentiment` и `fact_outcome`/`goal_metrics` (см. `schema.extension.dbml`).

### 3.4 Коды справочников
- В текущих dictionaries (`/api/dictionaries/*`) `code` маппится из `name` (нет отдельных кодов).
- В analytics запросах фильтры **ожидают числовой id**, хотя OpenAPI описывает «код или id».

**Что нужно добавить**:
- Отдельные поля `*_code` (см. `schema.dbml`) и согласованная логика фильтрации по `code`.

---

## 4) Чек-лист проверки (curl)

> Примеры подразумевают, что API работает локально на `localhost:3000`.

### KPI
```bash
curl "http://localhost:3000/api/analytics/kpis?from=2024-02-01T00:00:00Z&to=2024-02-02T00:00:00Z&channel=1"
```

### TimeSeries
```bash
curl "http://localhost:3000/api/analytics/timeseries?from=2024-02-01T00:00:00Z&to=2024-02-02T00:00:00Z&granularity=hour"
```

### Channels Split
```bash
curl "http://localhost:3000/api/analytics/channels/split?from=2024-02-01T00:00:00Z&to=2024-02-02T00:00:00Z"
```

### Operators
```bash
curl "http://localhost:3000/api/analytics/operators?from=2024-02-01T00:00:00Z&to=2024-02-02T00:00:00Z&limit=10&offset=0"
```

### Queues
```bash
curl "http://localhost:3000/api/analytics/queues?from=2024-02-01T00:00:00Z&to=2024-02-02T00:00:00Z"
```

### Topics Top
```bash
curl "http://localhost:3000/api/analytics/topics/top?from=2024-02-01T00:00:00Z&to=2024-02-08T00:00:00Z&limit=5"
```

### Topics TimeSeries
```bash
curl "http://localhost:3000/api/analytics/topics/timeseries?topic=all&from=2024-02-01T00:00:00Z&to=2024-02-02T00:00:00Z"
```

### Recent
```bash
curl "http://localhost:3000/api/analytics/recent?from=2024-02-01T00:00:00Z&to=2024-02-02T00:00:00Z&limit=20"
```

### 2.9 `GET /api/analytics/sentiment`
**Назначение**: donut-диаграмма «Эмоциональный фон» по таблице WMT responses.

**Параметры**:
- `from`, `to` — используются (если не переданы, берутся последние 24 часа).
- `status` — используется только если в WMT-таблице есть колонка `status`; по умолчанию `success`.
- `active` — используется только если в WMT-таблице есть колонка `active`; по умолчанию `true`.
- `q` — в MVP не используется.
- `debug=1` — при ошибке добавляет поле `details` в ответ 500.

**Ответ (пример)**:
```json
{
  "items": [
    { "nameRu": "Негатив", "value": 10 },
    { "nameRu": "Нейтрально", "value": 20 },
    { "nameRu": "Позитив", "value": 30 }
  ],
  "total": 60
}
```

**Как считается**:
- группировка по `communicationColor` (`communication_color`) с нормализацией `lower()`;
- маппинг цветов:
  - `red` → `Негатив`
  - `yellow` → `Нейтрально`
  - `green` → `Позитив`
- значения `NULL`/неизвестные цвета отбрасываются;
- порядок в `items` фиксированный: Негатив → Нейтрально → Позитив;
- `total` = сумма всех `value`.

**Реальная таблица/колонки в БД**:
- В коде используется авто-обнаружение таблицы в `public` через `information_schema.columns`.
- Провайдер ищет таблицу, где одновременно есть `communicationColor|communication_color` и `createdOn|created_on`.
- Далее поля алиасятся к единому виду (`createdOn`, `communicationColor`, `status`, `active`) внутри SQL CTE, поэтому поддерживаются варианты camelCase/snake_case.

**Ограничения MVP**:
- Нет связи с `interactions`, поэтому нельзя фильтровать по теме/очереди/каналу/оператору.
- Полнотекстовый `q` пока не влияет на результат.

---

### 3.5 Рекомендации по БД для `sentiment` (применять вручную)

> Ниже только рекомендации/DDL-примеры. API эти SQL **не выполняет автоматически**.

```sql
-- 0) Определить таблицу/колонки WMT в public
SELECT table_schema, table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND lower(column_name) IN (
    'requestid','request_id',
    'status',
    'communicationcolor','communication_color',
    'callid','call_id',
    'active',
    'transcription',
    'communicationresult','communication_result',
    'customersatisfaction','customer_satisfaction',
    'createdon','created_on',
    'updatedon','updated_on',
    'createdby','created_by',
    'updatedby','updated_by',
    'version',
    'id'
  )
ORDER BY table_name, column_name;

-- 1) Индекс по времени (обязательный для диапазонных фильтров)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wmt_created_on
  ON public.<wmt_table>(<created_col>);

-- 2) Составной индекс под частый WHERE status + active + created
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wmt_status_active_created
  ON public.<wmt_table>(<status_col>, <active_col>, <created_col>);

-- 3) Опциональный индекс по communicationColor (если много агрегаций)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wmt_communication_color
  ON public.<wmt_table>(<communication_color_col>);
```

**Если нужен будущий фильтр sentiment по тематике/очереди/оператору**:

Вариант A (если допустимо менять `interactions`):
```sql
ALTER TABLE public.interactions
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS call_id text,
  ADD COLUMN IF NOT EXISTS request_id text;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interactions_call_id
  ON public.interactions(call_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interactions_request_id
  ON public.interactions(request_id);
```

Вариант B (таблица связки):
```sql
CREATE TABLE IF NOT EXISTS public.interaction_wmt_map (
  interaction_id bigint NOT NULL,
  call_id varchar(128),
  request_id varchar(128),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (interaction_id, created_at)
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interaction_wmt_map_call_id
  ON public.interaction_wmt_map(call_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interaction_wmt_map_request_id
  ON public.interaction_wmt_map(request_id);
```

---

### Sentiment
```bash
curl "http://localhost:3000/api/analytics/sentiment?from=2024-02-01T00:00:00Z&to=2024-02-02T00:00:00Z"
```

```bash
curl "http://localhost:3000/api/analytics/sentiment?from=2024-02-01&to=2024-02-02&status=success&active=true"
```
