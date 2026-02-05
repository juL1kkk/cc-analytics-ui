| Компонент / блок UI | Что отображает | Какие данные нужны | Как считать (агрегация) | Предлагаемый API endpoint |
|---|---|---|---|---|
| KPI: **Входящие** | Общее число обращений за период | `interactions.id`/`external_id`, `started_at`, фильтры (`department_id`, `channel_id`, `queue_id`, `topic_id`), поиск `q` по `external_id/operator/topic` | `incoming = count(*)` по отфильтрованным обращениям | `GET /api/analytics/kpis` |
| KPI: **Пропущенные** | Кол-во обращений со статусом «Пропущен» | `interactions.status` | `missed = count(*) where status='missed'` | `GET /api/analytics/kpis` |
| KPI: **Средняя длительность (AHT)** | Средняя длительность завершённых обращений | `duration_sec`, `status` | `ahtSec = avg(duration_sec) where status='completed' and duration_sec>0` | `GET /api/analytics/kpis` |
| KPI: **Нагрузка операторов** | Уникальные операторы в выборке и общее число операторов | `operator_id`, справочник `operators` | `operatorsOnCalls = count(distinct operator_id)`; `operatorsTotal = count(*) from operators where is_active=true` | `GET /api/analytics/kpis` |
| KPI: **FCR** | Доля завершённых от всех входящих (в текущем UI как прокси FCR) | `status` | `fcrPct = completed / incoming * 100` | `GET /api/analytics/kpis` |
| Обзор: **Динамика обращений и пропусков** (LineChart) | Ряды `incoming`, `missed` по времени | `started_at`, `status` | Группировка по бакету времени (`hour`/`day` в зависимости от периода), `incoming=count(*)`, `missed=count(*) filter(status='missed')` | `GET /api/analytics/timeseries?metrics=incoming,missed` |
| Обзор: **Нагрузка операторов** (BarChart) | Категории: «На линии», «Ожидают», «Не доступен» | База: `status`, `operator_id`; **для точного расчёта нужны** `agent_state_events` | Сейчас: расчётная модель от handled/missed. Прод: из `agent_state_events` по текущему состоянию оператора на момент отчёта | `GET /api/analytics/operators` |
| Обзор: **Распределение по каналам** (Pie/Donut) | Доля обращений по каналам | `channel_id` + `channels.channel_code/name_ru` | `count(*) group by channel` | `GET /api/analytics/channels/split` |
| Обзор: **Эмоциональный фон** (Pie) | Позитив/нейтрально/негатив | В текущем UI считается эвристикой из `status`+`channel`; для прод нужны отдельные оценки | Текущий proxy: missed→негатив, voice→нейтрально, иначе позитив. Прод: по полям sentiment из NLP | `GET /api/analytics/topics/top` (агрегат по теме) или отдельный `/sentiment` |
| Обзор: **Достижение цели** (Pie) | Решено/эскалация/требует действий | `status` (proxy), в прод лучше outcome из CRM | Текущий proxy: completed→решено, missed→эскалация, else→требует действий | `GET /api/analytics/topics/top` (или отдельный `/outcomes`) |
| Операторы: **Нагрузка по операторам** (BarChart) | handled и missed по оператору | `operator_id`, `status`, справочник `operators` | `group by operator`, `handled=count(status!='missed')`, `missed=count(status='missed')` | `GET /api/analytics/operators` |
| Операторы: **Качество AHT/FCR** (BarChart) | AHT (мин), FCR (%) по оператору | `operator_id`, `duration_sec`, `status` | `ahtSec=avg(duration_sec where duration_sec>0)`; `fcrPct=completed/total*100` по оператору | `GET /api/analytics/operators` |
| Операторы: **Динамика AHT/ASA** (LineChart) | Тренды AHT и ASA | `started_at`, `duration_sec`, `status`, `channel_id`; **ASA требует событий ожидания** | `ahtSec` можно из interactions; `asaSec` nullable без `queue_state_events`/`interaction_stage_events` | `GET /api/analytics/operators` (section trend) |
| Очереди: **SLA и ожидание** (BarChart) | waiting, avgWaitSec, slaPct по очередям | `queue_id`, `status`; **точные waiting/avgWait/sla требуют событий очереди** | Из interactions только proxy; прод: из `queue_state_events` (join/answer/abandon) | `GET /api/analytics/queues` |
| Очереди: **Доля брошенных** (BarChart) | abandonedPct по очередям | `queue_id`, `status` | В текущем UI `abandonedPct ≈ missed/total`; прод: `abandoned` из событий abandon | `GET /api/analytics/queues` |
| Очереди: **Динамика длины очередей** (LineChart) | Глубина очереди во времени по queue_code | Нужна отдельная таблица `queue_state_events` | `queueDepth` как снимки/дельты очереди по бакетам времени; из interactions не восстанавливается | `GET /api/analytics/queues` (trend) |
| Каналы: **Объём входящие/исходящие** (BarChart) | incoming/outgoing по каналам | `channel_id`, тип направления (нет в interactions сейчас) | `incoming=count(*)`; `outgoing` nullable без поля `direction`/отдельного факта исходящих | `GET /api/analytics/channels/split` |
| Каналы: **Скорость реакции** (BarChart) | responseSec по каналам | Нужны timestamps этапов (первый ответ) | `responseSec` nullable без событий `first_response_at`/stage events | `GET /api/analytics/channels/split` |
| Каналы: **Динамика времени ответа** (LineChart) | responseSec по каналам во времени | `started_at`, `channel_id` + события ответа | `group by time_bucket, channel`; `avg(response_sec)` nullable без source events | `GET /api/analytics/channels/split` |
| Тематики: **Количество обращений по выбранной теме** (LineChart 2 линии) | incoming/missed по часам для topic=all или конкретной темы | `started_at`, `status`, `topic_id`, справочник `topics` | `group by time_bucket`; фильтр `topic` | `GET /api/analytics/topics/timeseries` |
| Тематики: **Спидометр ср. продолж.** (donut) | AHT текущей темы (ограниченный диапазон в UI) | `topic_id`, `duration_sec`, `status` | `avg(duration_sec) where status='completed' and duration_sec>0` | `GET /api/analytics/topics/top` (деталь по теме) |
| Тематики: **Распределение по каналам** (donut) | Каналы внутри выбранной темы | `topic_id`, `channel_id`, `channels` | `count(*) group by channel` при фильтре по topic | `GET /api/analytics/topics/top` |
| Тематики: **Эмоциональный фон / Достижение цели** (donut) | sentiment и goal по теме | В текущем UI proxy из `status`; для прод нужны отдельные поля outcome/sentiment | Proxy-агрегация или nullable | `GET /api/analytics/topics/top` |
| Сайдбар: **Срез по тематикам** | Топ тематик: count, avgHandleSec, fcrPct | `topic_id`, `duration_sec`, `status`, `topics.name_ru` | `group by topic`, `count`, `avg(duration)`, `completed/total*100` | `GET /api/analytics/topics/top` |
| Сайдбар: **Последние коммуникации** | Лента карточек (id, статус, время, канал, очередь, тема, оператор, длительность) | `external_id`, `status`, `started_at`, `duration_sec`, FK на `channels/queues/topics/operators` | Сортировка по `started_at desc`, пагинация `limit/offset`, поиск `q` | `GET /api/analytics/recent` |

### Общие фильтры, которые должны поддерживаться всеми analytics endpoints
- `period=today|yesterday|7d|30d|custom`
- `from`, `to` (если `period=custom`)
- `dept` (department_code или id)
- `channel` (channel_code или id)
- `queue` (queue_code или id)
- `topic` (topic_id или `all`)
- `q` (поиск по `external_id`, имени оператора, названию темы)
- `limit`, `offset` (для табличных/списочных ответов)
