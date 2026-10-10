export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const expected = process.env.UNCHARTED_VERIFY_TOKEN;
  // 404 is intentional: Playwright considers 401 and 403 ready.
  if (!expected || token !== expected) return Response.json({ error: "not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return Response.json({ ready: true }, { headers: { "Cache-Control": "no-store" } });
}
