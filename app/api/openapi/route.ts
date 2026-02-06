import { readFile } from "fs/promises";
import path from "path";

export async function GET() {
  const specPath = path.join(
    process.cwd(),
    "docs",
    "contact-center-analytics",
    "openapi.yaml",
  );
  const spec = await readFile(specPath, "utf8");

  return new Response(spec, {
    status: 200,
    headers: {
      "Content-Type": "text/yaml; charset=utf-8",
    },
  });
}
