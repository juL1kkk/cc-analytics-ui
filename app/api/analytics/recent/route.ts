import { NextResponse } from "next/server";

type RecentRow = {
  external_id: string;
  started_at: string;
  channel_code: string;
  channel_name_ru: string;
  queue_code: string;
  queue_name_ru: string;
  department_name_ru: string;
  operator_name_ru: string | null;
  topic_name_ru: string | null;
  duration_sec: number;
  status_code: "completed" | "missed" | "waiting" | "in_progress";
  status_ru: "Завершён" | "Пропущен" | "Ожидание" | "В разговоре";
};

export function GET() {
  const rows: RecentRow[] = [];
  const items = rows.map((row) => ({
    externalId: row.external_id,
    startedAt: row.started_at,
    channelCode: row.channel_code,
    channelNameRu: row.channel_name_ru,
    queueCode: row.queue_code,
    queueNameRu: row.queue_name_ru,
    departmentNameRu: row.department_name_ru,
    operatorNameRu: row.operator_name_ru,
    topicNameRu: row.topic_name_ru,
    durationSec: row.duration_sec,
    statusCode: row.status_code,
    statusRu: row.status_ru,
  }));

  return NextResponse.json({ items, total: rows.length });
}
