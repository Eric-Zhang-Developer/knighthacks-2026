// classes.json is a static file from corpus-classify that may not be published yet. Reading it through here turns
// "not there" into a 204 instead of a 404 the browser logs as an error on every page load.
export async function GET(req: Request) {
  const res = await fetch(new URL("/classify/classes.json", req.url), { cache: "no-store" }).catch(() => null);
  if (!res?.ok) return new Response(null, { status: 204 });
  return new Response(res.body, { headers: { "content-type": "application/json" } });
}
