import { query } from "@/lib/db";
import { internalError } from "@/lib/api/responses";

export async function GET() {
  try {
    const { rows } = await query<{
      id: number;
      code: string;
      name_ru: string;
    }>("SELECT id, topic_code AS code, name_ru FROM topics WHERE is_active = true ORDER BY id;");

    return Response.json({
      items: rows.map((row) => ({
        id: row.id,
        code: row.code,
        nameRu: row.name_ru,
      })),
    });
  } catch (error) {
    console.error("Failed to load topics", error);
    return internalError();
  }
}
