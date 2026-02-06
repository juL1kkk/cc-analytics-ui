import { query } from "@/lib/db";
import { internalError } from "@/lib/api/responses";

export async function GET() {
  try {
    const { rows } = await query<{
      id: number;
      code: string;
      full_name_ru: string;
      department_id: number | null;
    }>(
      "SELECT id, operator_code AS code, full_name_ru, department_id FROM operators WHERE is_active = true ORDER BY id;",
    );

    return Response.json({
      items: rows.map((row) => ({
        id: row.id,
        code: row.code,
        fullNameRu: row.full_name_ru,
        departmentId: row.department_id,
      })),
    });
  } catch (error) {
    console.error("Failed to load operators", error);
    return internalError();
  }
}
