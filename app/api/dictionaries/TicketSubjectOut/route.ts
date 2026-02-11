import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type TicketSubjectOutRow = {
  id: string;       // вероятнее всего UUID
  name: string;
  active?: boolean; // может отсутствовать в таблице
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const all = url.searchParams.get("all") === "1";
    const debug = url.searchParams.get("debug") === "1";

    // Важно: cc_replica + quoted identifiers
    // Если в таблице нет "active" — убери его из SELECT и условий (см. ниже)
    const sql = `
      SELECT "id", "name"${debug ? `, "active"` : ""}
      FROM cc_replica."TicketSubjectOut"
      ${
        // фильтруем active=false только если:
        // 1) debug=true (мы вообще выбираем active)
        // 2) all != 1
        // иначе не трогаем
        !all && debug ? `WHERE "active" = true` : ""
      }
      ORDER BY "name" ASC
    `;

    const { rows } = await query<TicketSubjectOutRow>(sql);

    const items = rows.map((row) => ({
      id: String(row.id),
      code: String(row.id), // code нет — используем id
      nameRu: row.name,
      ...(debug && row.active !== undefined ? { active: row.active } : {}),
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("TicketSubjectOut dictionary error", error);

    const details =
      process.env.NODE_ENV !== "production"
        ? error instanceof Error
          ? error.message
          : String(error)
        : undefined;

    return NextResponse.json(
      {
        error: {
          code: "DB_ERROR",
          message: "Database error",
          ...(details ? { details } : {}),
        },
      },
      { status: 500 },
    );
  }
}
