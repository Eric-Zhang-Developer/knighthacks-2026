// classes.json is a static file from corpus-classify that may not be published yet. Reading it through here turns
// "not there" into a 204 instead of a 404 the browser logs as an error on every page load.
// The file only changes with a deploy, and Vercel's CDN cache is per deployment, so the CDN keeps the answer for the
// deployment's life (s-maxage) while browsers still revalidate (max-age=0). Uncached, every visit ran this function
// and re-fetched 1.4 MB: 0.5-0.8 s to first byte in production. A failed fetch isn't cached, so it can't stick.
const CDN = "public, max-age=0, s-maxage=31536000";

export async function GET(req: Request) {
  const res = await fetch(new URL("/classify/classes.json", req.url), { cache: "no-store" }).catch(() => null);
  if (!res) return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  if (!res.ok) return new Response(null, { status: 204, headers: { "cache-control": res.status === 404 ? CDN : "no-store" } });
  return new Response(res.body, { headers: { "content-type": "application/json", "cache-control": CDN } });
}
