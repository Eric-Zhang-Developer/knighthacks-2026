export function GET() {
  return Response.json({ commit: process.env.GIT_COMMIT ?? "unknown" });
}
