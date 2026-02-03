export type Period = "today" | "yesterday" | "7d" | "30d" | "custom";
export type Channel = "all" | "voice" | "chat" | "email" | "sms" | "push";
export type Queue = "all" | "general" | "vip" | "antifraud";

export type CallRow = {
  id: string;
  startedAt: string;
  channel: Exclude<Channel, "all">;
  queue: Exclude<Queue, "all">;
  operator: string;
  topic: string;
  durationSec: number;
  status: "Завершён" | "Пропущен" | "Ожидание" | "В разговоре";
};

export const CALLS_BY_PERIOD: Record<Exclude<Period, "custom">, CallRow[]> = {
  today: [
    {
      id: "C-10492",
      startedAt: "15:42",
      channel: "voice",
      queue: "general",
      operator: "Иван Петров",
      topic: "Авторизация ЛК",
      durationSec: 312,
      status: "Завершён",
    },
    {
      id: "C-10491",
      startedAt: "15:38",
      channel: "chat",
      queue: "general",
      operator: "Анна Соколова",
      topic: "Сброс пароля",
      durationSec: 420,
      status: "Завершён",
    },
    {
      id: "C-10490",
      startedAt: "15:30",
      channel: "voice",
      queue: "vip",
      operator: "Анна Соколова",
      topic: "Статус обращения",
      durationSec: 0,
      status: "Пропущен",
    },
    {
      id: "C-10489",
      startedAt: "15:30",
      channel: "email",
      queue: "general",
      operator: "Алексей Козлов",
      topic: "Консультация по продуктам",
      durationSec: 0,
      status: "Ожидание",
    },
    {
      id: "C-10488",
      startedAt: "15:27",
      channel: "voice",
      queue: "antifraud",
      operator: "Алексей Козлов",
      topic: "Подозрительная активность",
      durationSec: 198,
      status: "В разговоре",
    },
  ],

  yesterday: [
    // чуть другие времена/статусы, чтобы визуально было видно смену периода
    {
      id: "C-10392",
      startedAt: "14:52",
      channel: "voice",
      queue: "general",
      operator: "Иван Петров",
      topic: "Авторизация ЛК",
      durationSec: 280,
      status: "Завершён",
    },
    {
      id: "C-10391",
      startedAt: "14:45",
      channel: "chat",
      queue: "vip",
      operator: "Анна Соколова",
      topic: "Статус обращения",
      durationSec: 360,
      status: "Завершён",
    },
    {
      id: "C-10390",
      startedAt: "14:33",
      channel: "voice",
      queue: "antifraud",
      operator: "Алексей Козлов",
      topic: "Подозрительная активность",
      durationSec: 0,
      status: "Пропущен",
    },
    {
      id: "C-10389",
      startedAt: "14:30",
      channel: "email",
      queue: "general",
      operator: "Мария Орлова",
      topic: "Ошибки в приложении",
      durationSec: 0,
      status: "Ожидание",
    },
    {
      id: "C-10388",
      startedAt: "14:21",
      channel: "voice",
      queue: "general",
      operator: "Дмитрий Волков",
      topic: "Консультация по продуктам",
      durationSec: 420,
      status: "Завершён",
    },
  ],

  "7d": [],
  "30d": [],
};
