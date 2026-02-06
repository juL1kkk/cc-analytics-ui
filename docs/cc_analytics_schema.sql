BEGIN;

-- Таблица операторов контакт-центра
CREATE TABLE operators (
    id BIGSERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE,
    hired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

COMMENT ON TABLE operators IS 'Операторы контакт-центра';
COMMENT ON COLUMN operators.id IS 'Уникальный идентификатор оператора';
COMMENT ON COLUMN operators.full_name IS 'ФИО оператора';
COMMENT ON COLUMN operators.email IS 'Email оператора для внутренней коммуникации';
COMMENT ON COLUMN operators.hired_at IS 'Дата и время найма оператора';
COMMENT ON COLUMN operators.is_active IS 'Признак активности оператора';

-- Таблица очередей обработки обращений
CREATE TABLE queues (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT
);

COMMENT ON TABLE queues IS 'Очереди обработки обращений';
COMMENT ON COLUMN queues.id IS 'Уникальный идентификатор очереди';
COMMENT ON COLUMN queues.name IS 'Название очереди';
COMMENT ON COLUMN queues.description IS 'Описание и назначение очереди';

-- Таблица каналов обращения
CREATE TABLE channels (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

COMMENT ON TABLE channels IS 'Каналы обращения клиентов';
COMMENT ON COLUMN channels.id IS 'Уникальный идентификатор канала';
COMMENT ON COLUMN channels.name IS 'Название канала (Звонки, Чат, Email, SMS, Push)';

-- Таблица тематик обращений
CREATE TABLE topics (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT
);

COMMENT ON TABLE topics IS 'Тематики обращений клиентов';
COMMENT ON COLUMN topics.id IS 'Уникальный идентификатор тематики';
COMMENT ON COLUMN topics.name IS 'Название тематики обращения';
COMMENT ON COLUMN topics.description IS 'Описание тематики';

-- Таблица фактов обращений
CREATE TABLE interactions (
    id BIGSERIAL PRIMARY KEY,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    operator_id BIGINT NOT NULL REFERENCES operators(id),
    queue_id BIGINT NOT NULL REFERENCES queues(id),
    channel_id BIGINT NOT NULL REFERENCES channels(id),
    topic_id BIGINT NOT NULL REFERENCES topics(id),
    status TEXT NOT NULL CHECK (status IN ('resolved', 'unresolved')),
    fcr BOOLEAN NOT NULL DEFAULT FALSE,
    response_time_sec INTEGER NOT NULL,
    duration_sec INTEGER NOT NULL
);

COMMENT ON TABLE interactions IS 'Факты обращений клиентов (звонки, чаты, письма и т.д.)';
COMMENT ON COLUMN interactions.id IS 'Уникальный идентификатор обращения';
COMMENT ON COLUMN interactions.started_at IS 'Дата и время начала обращения';
COMMENT ON COLUMN interactions.ended_at IS 'Дата и время завершения обращения';
COMMENT ON COLUMN interactions.operator_id IS 'Оператор, обработавший обращение';
COMMENT ON COLUMN interactions.queue_id IS 'Очередь, в которую попало обращение';
COMMENT ON COLUMN interactions.channel_id IS 'Канал обращения';
COMMENT ON COLUMN interactions.topic_id IS 'Тематика обращения';
COMMENT ON COLUMN interactions.status IS 'Статус обращения: resolved/unresolved';
COMMENT ON COLUMN interactions.fcr IS 'Решено с первого обращения (FCR)';
COMMENT ON COLUMN interactions.response_time_sec IS 'Время ответа (ASA) в секундах';
COMMENT ON COLUMN interactions.duration_sec IS 'Длительность обработки (AHT) в секундах';

CREATE INDEX idx_interactions_started_at ON interactions (started_at);
CREATE INDEX idx_interactions_queue_id ON interactions (queue_id);
CREATE INDEX idx_interactions_operator_id ON interactions (operator_id);
CREATE INDEX idx_interactions_channel_id ON interactions (channel_id);
CREATE INDEX idx_interactions_topic_id ON interactions (topic_id);

-- История статусов операторов для расчета нагрузки
CREATE TABLE operator_status_history (
    id BIGSERIAL PRIMARY KEY,
    operator_id BIGINT NOT NULL REFERENCES operators(id),
    status TEXT NOT NULL CHECK (status IN ('available', 'busy', 'offline', 'break')),
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ
);

COMMENT ON TABLE operator_status_history IS 'История статусов операторов для анализа нагрузки';
COMMENT ON COLUMN operator_status_history.id IS 'Уникальный идентификатор записи статуса';
COMMENT ON COLUMN operator_status_history.operator_id IS 'Оператор, к которому относится статус';
COMMENT ON COLUMN operator_status_history.status IS 'Статус оператора (available/busy/offline/break)';
COMMENT ON COLUMN operator_status_history.started_at IS 'Дата и время начала статуса';
COMMENT ON COLUMN operator_status_history.ended_at IS 'Дата и время окончания статуса';

CREATE INDEX idx_operator_status_history_operator_id ON operator_status_history (operator_id);
CREATE INDEX idx_operator_status_history_started_at ON operator_status_history (started_at);

-- Метрики очередей (ASA, SLA, время ответа)
CREATE TABLE queue_metrics (
    id BIGSERIAL PRIMARY KEY,
    metric_date TIMESTAMPTZ NOT NULL,
    queue_id BIGINT NOT NULL REFERENCES queues(id),
    asa_sec INTEGER NOT NULL,
    sla_percent NUMERIC(5,2) NOT NULL,
    avg_response_time_sec INTEGER NOT NULL
);

COMMENT ON TABLE queue_metrics IS 'Агрегированные метрики очередей';
COMMENT ON COLUMN queue_metrics.id IS 'Уникальный идентификатор записи метрики';
COMMENT ON COLUMN queue_metrics.metric_date IS 'Дата и время агрегации метрики';
COMMENT ON COLUMN queue_metrics.queue_id IS 'Очередь, для которой рассчитана метрика';
COMMENT ON COLUMN queue_metrics.asa_sec IS 'Средняя скорость ответа (ASA) в секундах';
COMMENT ON COLUMN queue_metrics.sla_percent IS 'Процент соблюдения SLA';
COMMENT ON COLUMN queue_metrics.avg_response_time_sec IS 'Среднее время ответа в секундах';

CREATE INDEX idx_queue_metrics_metric_date ON queue_metrics (metric_date);
CREATE INDEX idx_queue_metrics_queue_id ON queue_metrics (queue_id);

-- Метрики FCR (решено с первого обращения)
CREATE TABLE fcr_metrics (
    id BIGSERIAL PRIMARY KEY,
    metric_date TIMESTAMPTZ NOT NULL,
    queue_id BIGINT REFERENCES queues(id),
    channel_id BIGINT REFERENCES channels(id),
    fcr_percent NUMERIC(5,2) NOT NULL,
    total_interactions INTEGER NOT NULL
);

COMMENT ON TABLE fcr_metrics IS 'Метрики FCR (решено с первого обращения)';
COMMENT ON COLUMN fcr_metrics.id IS 'Уникальный идентификатор записи метрики';
COMMENT ON COLUMN fcr_metrics.metric_date IS 'Дата и время агрегации метрики';
COMMENT ON COLUMN fcr_metrics.queue_id IS 'Очередь, по которой считается FCR';
COMMENT ON COLUMN fcr_metrics.channel_id IS 'Канал, по которому считается FCR';
COMMENT ON COLUMN fcr_metrics.fcr_percent IS 'Процент обращений, решенных с первого контакта';
COMMENT ON COLUMN fcr_metrics.total_interactions IS 'Количество обращений в выборке';

CREATE INDEX idx_fcr_metrics_metric_date ON fcr_metrics (metric_date);
CREATE INDEX idx_fcr_metrics_queue_id ON fcr_metrics (queue_id);
CREATE INDEX idx_fcr_metrics_channel_id ON fcr_metrics (channel_id);

-- Метрики эмоционального фона
CREATE TABLE sentiment_metrics (
    id BIGSERIAL PRIMARY KEY,
    metric_date TIMESTAMPTZ NOT NULL,
    queue_id BIGINT REFERENCES queues(id),
    channel_id BIGINT REFERENCES channels(id),
    sentiment_score NUMERIC(4,2) NOT NULL,
    negative_percent NUMERIC(5,2) NOT NULL,
    positive_percent NUMERIC(5,2) NOT NULL
);

COMMENT ON TABLE sentiment_metrics IS 'Метрики эмоционального фона обращений';
COMMENT ON COLUMN sentiment_metrics.id IS 'Уникальный идентификатор записи метрики';
COMMENT ON COLUMN sentiment_metrics.metric_date IS 'Дата и время агрегации метрики';
COMMENT ON COLUMN sentiment_metrics.queue_id IS 'Очередь, по которой рассчитан показатель';
COMMENT ON COLUMN sentiment_metrics.channel_id IS 'Канал, по которому рассчитан показатель';
COMMENT ON COLUMN sentiment_metrics.sentiment_score IS 'Сводный индекс эмоционального фона';
COMMENT ON COLUMN sentiment_metrics.negative_percent IS 'Доля негативных обращений';
COMMENT ON COLUMN sentiment_metrics.positive_percent IS 'Доля позитивных обращений';

CREATE INDEX idx_sentiment_metrics_metric_date ON sentiment_metrics (metric_date);
CREATE INDEX idx_sentiment_metrics_queue_id ON sentiment_metrics (queue_id);
CREATE INDEX idx_sentiment_metrics_channel_id ON sentiment_metrics (channel_id);

-- Метрики достижения целей
CREATE TABLE goal_metrics (
    id BIGSERIAL PRIMARY KEY,
    metric_date TIMESTAMPTZ NOT NULL,
    queue_id BIGINT REFERENCES queues(id),
    goal_name TEXT NOT NULL,
    goal_value NUMERIC(10,2) NOT NULL,
    actual_value NUMERIC(10,2) NOT NULL,
    achieved BOOLEAN NOT NULL
);

COMMENT ON TABLE goal_metrics IS 'Метрики достижения целей KPI';
COMMENT ON COLUMN goal_metrics.id IS 'Уникальный идентификатор записи метрики';
COMMENT ON COLUMN goal_metrics.metric_date IS 'Дата и время агрегации метрики';
COMMENT ON COLUMN goal_metrics.queue_id IS 'Очередь, для которой задана цель';
COMMENT ON COLUMN goal_metrics.goal_name IS 'Название цели или показателя';
COMMENT ON COLUMN goal_metrics.goal_value IS 'Целевое значение KPI';
COMMENT ON COLUMN goal_metrics.actual_value IS 'Фактическое значение KPI';
COMMENT ON COLUMN goal_metrics.achieved IS 'Признак достижения цели';

CREATE INDEX idx_goal_metrics_metric_date ON goal_metrics (metric_date);
CREATE INDEX idx_goal_metrics_queue_id ON goal_metrics (queue_id);

-- Тестовые данные
INSERT INTO operators (full_name, email, hired_at, is_active)
VALUES
    ('Иван Петров', 'ivan.petrov@example.com', NOW() - INTERVAL '120 days', TRUE),
    ('Мария Соколова', 'maria.sokolova@example.com', NOW() - INTERVAL '200 days', TRUE),
    ('Алексей Кузнецов', 'alexey.kuznetsov@example.com', NOW() - INTERVAL '90 days', TRUE);

INSERT INTO queues (name, description)
VALUES
    ('Входящие звонки', 'Очередь для обработки входящих звонков'),
    ('Поддержка клиентов', 'Очередь для сложных обращений'),
    ('Онлайн чат', 'Очередь для чатов');

INSERT INTO channels (name)
VALUES
    ('Звонки'),
    ('Чат'),
    ('Email'),
    ('SMS'),
    ('Push');

INSERT INTO topics (name, description)
VALUES
    ('Доставка', 'Вопросы о статусе доставки'),
    ('Оплата', 'Вопросы о платежах и счетах'),
    ('Техническая поддержка', 'Проблемы с продуктом или сервисом');

INSERT INTO interactions (
    started_at,
    ended_at,
    operator_id,
    queue_id,
    channel_id,
    topic_id,
    status,
    fcr,
    response_time_sec,
    duration_sec
)
VALUES
    (NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '8 minutes', 1, 1, 1, 1, 'resolved', TRUE, 45, 480),
    (NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '5 minutes', 2, 2, 2, 3, 'resolved', FALSE, 60, 300),
    (NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours' + INTERVAL '12 minutes', 3, 3, 2, 2, 'unresolved', FALSE, 75, 720);

INSERT INTO operator_status_history (operator_id, status, started_at, ended_at)
VALUES
    (1, 'available', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '3 hours'),
    (1, 'busy', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours 30 minutes'),
    (2, 'break', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 45 minutes');

INSERT INTO queue_metrics (metric_date, queue_id, asa_sec, sla_percent, avg_response_time_sec)
VALUES
    (NOW() - INTERVAL '1 day', 1, 50, 92.50, 55),
    (NOW() - INTERVAL '1 day', 2, 70, 88.10, 68),
    (NOW() - INTERVAL '1 day', 3, 40, 95.00, 45);

INSERT INTO fcr_metrics (metric_date, queue_id, channel_id, fcr_percent, total_interactions)
VALUES
    (NOW() - INTERVAL '1 day', 1, 1, 78.20, 120),
    (NOW() - INTERVAL '1 day', 2, 2, 65.00, 80),
    (NOW() - INTERVAL '1 day', 3, 2, 70.50, 60);

INSERT INTO sentiment_metrics (
    metric_date,
    queue_id,
    channel_id,
    sentiment_score,
    negative_percent,
    positive_percent
)
VALUES
    (NOW() - INTERVAL '1 day', 1, 1, 0.65, 12.50, 68.40),
    (NOW() - INTERVAL '1 day', 2, 2, 0.48, 20.00, 55.00),
    (NOW() - INTERVAL '1 day', 3, 2, 0.72, 8.00, 75.00);

INSERT INTO goal_metrics (
    metric_date,
    queue_id,
    goal_name,
    goal_value,
    actual_value,
    achieved
)
VALUES
    (NOW() - INTERVAL '1 day', 1, 'SLA 90%', 90.00, 92.50, TRUE),
    (NOW() - INTERVAL '1 day', 2, 'ASA 60 сек', 60.00, 70.00, FALSE),
    (NOW() - INTERVAL '1 day', 3, 'FCR 75%', 75.00, 70.50, FALSE);

COMMIT;
