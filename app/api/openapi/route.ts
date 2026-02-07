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
  const patchedSpec = ensureLocalServer(spec);

  return new Response(patchedSpec, {
    status: 200,
    headers: {
      "Content-Type": "text/yaml; charset=utf-8",
    },
  });
}

function ensureLocalServer(spec: string): string {
  const lines = spec.split("\n");
  const serversIndex = lines.findIndex((line) => line.startsWith("servers:"));

  if (serversIndex === -1) {
    return spec;
  }

  const hasLocalServer = lines.some((line) =>
    /^\s*-\s*url:\s*\/\s*$/.test(line),
  );

  if (hasLocalServer) {
    return spec;
  }

  lines.splice(
    serversIndex + 1,
    0,
    "  - url: /",
    "    description: Текущий хост (Vercel/локальный)",
  );

  return lines.join("\n");
}
