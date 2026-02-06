import { NextResponse } from "next/server";

import { query } from "@/lib/db";

export async function GET() {
  try {
    const result = await query(
      `SELECT id, queue_code AS code, name_ru AS "nameRu", department_id AS "departmentId"
       FROM queues
       WHERE is_active = true
       ORDER BY id`,
    );

    return NextResponse.json({ items: result.rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: { code: "DB_ERROR", message: "Database error" } },
      { status: 500 },
    );
  }
}
