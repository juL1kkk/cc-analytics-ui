export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    ok: true,
    from: "nextjs-app-router",
    envHasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    vercelEnv: process.env.VERCEL_ENV,
    gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA,
  });
}
