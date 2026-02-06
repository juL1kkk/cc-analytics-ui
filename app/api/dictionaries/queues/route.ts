import { query } from "@/lib/db";
import { internalError } from "@/lib/api/responses";

export async function GET() {
  try {
    const { rows } = await query<{
      id: number;
      code: string;
      name_ru: string;
      department_id: number;
    }>(
      "SELECT id, queue_code AS code, name_ru, department_id FROM queues WHERE is_active = true ORDER BY id;",
    );

    return Response.json({
      items: rows.map((row) => ({
        id: row.id,
        code: row.code,
        nameRu: row.name_ru,
        departmentId: row.department_id,
      })),
    });
  } catch (error) {
    console.error("Failed to load queues", error);
    return internalError();
  }
}
