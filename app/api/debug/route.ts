export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    ok: true,
    from: "nextjs-app-router",
    envHasDatabaseUrl: Boolean(process.env.DATABASE_URL),
  });
}
