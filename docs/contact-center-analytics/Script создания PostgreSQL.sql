CREATE TYPE "interaction_status_code" AS ENUM (
  'completed',
  'missed',
  'waiting',
  'in_progress'
);

CREATE TABLE "departments" (
  "id" bigserial PRIMARY KEY,
  "department_code" varchar(64) UNIQUE NOT NULL,
  "name_ru" varchar(255) NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "channels" (
  "id" bigserial PRIMARY KEY,
  "channel_code" varchar(32) UNIQUE NOT NULL,
  "name_ru" varchar(128) NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "queues" (
  "id" bigserial PRIMARY KEY,
  "queue_code" varchar(64) UNIQUE NOT NULL,
  "name_ru" varchar(255) NOT NULL,
  "department_id" bigint NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "operators" (
  "id" bigserial PRIMARY KEY,
  "operator_code" varchar(64) UNIQUE NOT NULL,
  "full_name_ru" varchar(255) NOT NULL,
  "department_id" bigint,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "topics" (
  "id" bigserial PRIMARY KEY,
  "topic_code" varchar(128) UNIQUE NOT NULL,
  "name_ru" varchar(255) NOT NULL,
  "source_system" varchar(64),
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "interactions" (
  "id" bigserial PRIMARY KEY,
  "external_id" varchar(64) UNIQUE NOT NULL,
  "started_at" timestamptz NOT NULL,
  "channel_id" bigint NOT NULL,
  "queue_id" bigint NOT NULL,
  "department_id" bigint NOT NULL,
  "operator_id" bigint,
  "topic_id" bigint,
  "duration_sec" int NOT NULL DEFAULT 0,
  "status" interaction_status_code NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE INDEX ON "departments" ("name_ru");

CREATE INDEX ON "queues" ("department_id");

CREATE INDEX ON "queues" ("name_ru");

CREATE INDEX ON "operators" ("department_id");

CREATE INDEX ON "operators" ("full_name_ru");

CREATE INDEX ON "topics" ("name_ru");

CREATE INDEX ON "interactions" ("started_at");

CREATE INDEX ON "interactions" ("started_at", "channel_id");

CREATE INDEX ON "interactions" ("started_at", "queue_id");

CREATE INDEX ON "interactions" ("started_at", "department_id");

CREATE INDEX ON "interactions" ("topic_id", "started_at");

CREATE INDEX ON "interactions" ("operator_id", "started_at");

CREATE INDEX ON "interactions" ("status", "started_at");

COMMENT ON TABLE "departments" IS 'Справочник отделов (Контакт-центр, Контроль качества, Антифрод и т.д.).';

COMMENT ON COLUMN "departments"."id" IS 'PK отдела';

COMMENT ON COLUMN "departments"."department_code" IS 'Технический код отдела (англ.), используется в API/интеграциях.';

COMMENT ON COLUMN "departments"."name_ru" IS 'Русское название отдела для UI-фильтра "Отдел".';

COMMENT ON COLUMN "departments"."is_active" IS 'Признак активности справочника.';

COMMENT ON COLUMN "departments"."created_at" IS 'Время создания записи.';

COMMENT ON COLUMN "departments"."updated_at" IS 'Время обновления записи.';

COMMENT ON TABLE "channels" IS 'Справочник каналов коммуникации для фильтров и группировок.';

COMMENT ON COLUMN "channels"."id" IS 'PK канала';

COMMENT ON COLUMN "channels"."channel_code" IS 'Код канала (англ.): voice/chat/email/sms/push.';

COMMENT ON COLUMN "channels"."name_ru" IS 'Русское отображаемое название канала.';

COMMENT ON COLUMN "channels"."is_active" IS 'Признак активности канала.';

COMMENT ON COLUMN "channels"."created_at" IS 'Время создания записи.';

COMMENT ON COLUMN "channels"."updated_at" IS 'Время обновления записи.';

COMMENT ON TABLE "queues" IS 'Справочник очередей контакт-центра.';

COMMENT ON COLUMN "queues"."id" IS 'PK очереди';

COMMENT ON COLUMN "queues"."queue_code" IS 'Код очереди (англ.): general/vip/antifraud.';

COMMENT ON COLUMN "queues"."name_ru" IS 'Русское название очереди для UI.';

COMMENT ON COLUMN "queues"."department_id" IS 'Отдел-владелец очереди. Нужен для согласованной фильтрации "Отдел" + "Очередь".';

COMMENT ON COLUMN "queues"."is_active" IS 'Признак активности очереди.';

COMMENT ON COLUMN "queues"."created_at" IS 'Время создания записи.';

COMMENT ON COLUMN "queues"."updated_at" IS 'Время обновления записи.';

COMMENT ON TABLE "operators" IS 'Справочник операторов для разреза "Операторы" и KPI по загрузке.';

COMMENT ON COLUMN "operators"."id" IS 'PK оператора';

COMMENT ON COLUMN "operators"."operator_code" IS 'Технический код оператора (англ.) из кадровой/телефонии.';

COMMENT ON COLUMN "operators"."full_name_ru" IS 'ФИО оператора (рус.).';

COMMENT ON COLUMN "operators"."department_id" IS 'Основной отдел оператора (nullable для внешних/непривязанных сотрудников).';

COMMENT ON COLUMN "operators"."is_active" IS 'Признак активности оператора.';

COMMENT ON COLUMN "operators"."created_at" IS 'Время создания записи.';

COMMENT ON COLUMN "operators"."updated_at" IS 'Время обновления записи.';

COMMENT ON TABLE "topics" IS 'Справочник тематик. Выбран отдельной таблицей, чтобы нормализовать значения, исключить дубли и поддержать ML/CRM классификацию.';

COMMENT ON COLUMN "topics"."id" IS 'PK тематики';

COMMENT ON COLUMN "topics"."topic_code" IS 'Код тематики (англ.) для API и ML-классификации.';

COMMENT ON COLUMN "topics"."name_ru" IS 'Человекочитаемое русское название тематики (например, "Сброс пароля").';

COMMENT ON COLUMN "topics"."source_system" IS 'Источник классификации: crm/ivr/ml/manual.';

COMMENT ON COLUMN "topics"."is_active" IS 'Признак активности тематики.';

COMMENT ON COLUMN "topics"."created_at" IS 'Время создания записи.';

COMMENT ON COLUMN "topics"."updated_at" IS 'Время обновления записи.';

COMMENT ON TABLE "interactions" IS 'Факт коммуникаций/обращений — центральная таблица аналитики дашборда.';

COMMENT ON COLUMN "interactions"."id" IS 'PK факта обращения.';

COMMENT ON COLUMN "interactions"."external_id" IS 'Внешний идентификатор обращения (пример: C-10492).';

COMMENT ON COLUMN "interactions"."started_at" IS 'Дата/время начала обращения. Используется как основная ось времени для графиков.';

COMMENT ON COLUMN "interactions"."channel_id" IS 'Канал обращения (voice/chat/email/sms/push).';

COMMENT ON COLUMN "interactions"."queue_id" IS 'Очередь, в которую попало обращение.';

COMMENT ON COLUMN "interactions"."department_id" IS 'Отдел, в который относится обращение. Может определяться по очереди/каналу или приходить из источника.';

COMMENT ON COLUMN "interactions"."operator_id" IS 'Оператор, обработавший обращение. Nullable для пропущенных/нераспределённых.';

COMMENT ON COLUMN "interactions"."topic_id" IS 'Тематика обращения, классификация из CRM/IVR/ML. Nullable, если тема ещё не определена.';

COMMENT ON COLUMN "interactions"."duration_sec" IS 'Длительность обработки обращения в секундах (AHT-база).';

COMMENT ON COLUMN "interactions"."status" IS 'Состояние обращения: completed/missed/waiting/in_progress (UI: Завершён/Пропущен/Ожидание/В разговоре).';

COMMENT ON COLUMN "interactions"."created_at" IS 'Время создания записи в хранилище.';

COMMENT ON COLUMN "interactions"."updated_at" IS 'Время последнего обновления записи.';

ALTER TABLE "queues" ADD FOREIGN KEY ("department_id") REFERENCES "departments" ("id");

ALTER TABLE "operators" ADD FOREIGN KEY ("department_id") REFERENCES "departments" ("id");

ALTER TABLE "interactions" ADD FOREIGN KEY ("channel_id") REFERENCES "channels" ("id");

ALTER TABLE "interactions" ADD FOREIGN KEY ("queue_id") REFERENCES "queues" ("id");

ALTER TABLE "interactions" ADD FOREIGN KEY ("department_id") REFERENCES "departments" ("id");

ALTER TABLE "interactions" ADD FOREIGN KEY ("operator_id") REFERENCES "operators" ("id");

ALTER TABLE "interactions" ADD FOREIGN KEY ("topic_id") REFERENCES "topics" ("id");
