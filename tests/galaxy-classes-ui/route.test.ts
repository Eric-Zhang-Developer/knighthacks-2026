import { afterEach, expect, test, vi } from "vitest";
import { GET } from "@/app/api/classes/route";

afterEach(() => vi.unstubAllGlobals());
const answer = (r: Response | Error) => vi.stubGlobal("fetch", vi.fn(() => (r instanceof Error ? Promise.reject(r) : Promise.resolve(r))));
const get = () => GET(new Request("https://example.test/api/classes"));

test("the published file passes through with a CDN lifetime and browser revalidation", async () => {
  answer(new Response('{"corpus_version":"v"}', { status: 200 }));
  const res = await get();
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("public, max-age=0, s-maxage=31536000");
  expect(await res.text()).toBe('{"corpus_version":"v"}');
});

test("a missing file is a cacheable 204; a failed or erroring fetch is a 204 that isn't cached", async () => {
  answer(new Response("", { status: 404 }));
  expect((await get()).headers.get("cache-control")).toContain("s-maxage");
  answer(new Response("", { status: 500 }));
  const failed = await get();
  expect([failed.status, failed.headers.get("cache-control")]).toEqual([204, "no-store"]);
  answer(new Error("network"));
  const errored = await get();
  expect([errored.status, errored.headers.get("cache-control")]).toEqual([204, "no-store"]);
});
