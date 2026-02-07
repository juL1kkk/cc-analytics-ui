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

  const updated: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (i === serversIndex) {
      updated.push("servers:");
      updated.push("  - url: /");
      updated.push("    description: Текущий хост (Vercel/локальный)");
      i += 1;
      while (i < lines.length && (lines[i].startsWith("  ") || lines[i] === "")) {
        i += 1;
      }
      continue;
    }
    updated.push(line);
    i += 1;
  }

  return updated.join("\n");
}
