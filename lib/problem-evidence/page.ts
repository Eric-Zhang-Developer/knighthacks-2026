import "next/dist/compiled/server-only";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { z } from "zod";
import { fixture } from "@/lib/ai/generate";

const blocked = new BlockList();
for (const [address, prefix] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 3]] as const) blocked.addSubnet(address, prefix);
const global6 = new BlockList(); global6.addSubnet("2000::", 3, "ipv6");
const blocked6 = new BlockList(); blocked6.addSubnet("2001::", 23, "ipv6"); blocked6.addSubnet("2002::", 16, "ipv6"); blocked6.addSubnet("3fff::", 20, "ipv6");
export function publicAddress(address: string) {
  return isIP(address) === 4 ? !blocked.check(address) : isIP(address) === 6 && global6.check(address, "ipv6") && !blocked6.check(address, "ipv6");
}
function webURL(raw: string) {
  const url = new URL(raw);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.port) throw new Error("Not a public web URL");
  return url;
}
export function publishedAt(html: string): string | null {
  const valid = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}(?:T[^\s]+)?$/.test(value) && Number.isFinite(Date.parse(value)) ? value : null;
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)].map((a) => [a[1].toLowerCase(), a[3]]));
    if ((attributes.property ?? attributes.name)?.toLowerCase() === "article:published_time") { const date = valid(attributes.content); if (date) return date; }
  }
  const find = (node: unknown): string | null => {
    if (!node || typeof node !== "object") return null;
    const own = valid((node as Record<string, unknown>).datePublished);
    if (own) return own;
    for (const value of Object.values(node)) { const date = find(value); if (date) return date; }
    return null;
  };
  for (const script of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    try { const date = find(JSON.parse(script[1])); if (date) return date; } catch { /* malformed page metadata is unknown */ }
  }
  return null;
}
async function fetchPage(initial: string) {
  const signal = AbortSignal.timeout(5000);
  let url = webURL(initial);
  for (let redirects = 0; redirects <= 3; redirects++) {
    signal.throwIfAborted();
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await Promise.race([
      lookup(host, { all: true }), new Promise<never>((_, reject) => signal.addEventListener("abort", () => reject(new Error("Timed out")), { once: true }))]);
    if (!addresses.length || addresses.some((a) => !publicAddress(a.address))) throw new Error("Non-public destination");
    const address = addresses[0];
    const result = await new Promise<{ status: number; location?: string; html: string }>((resolve, reject) => {
      // Pin the checked address; each redirect resolves and checks again. Never send cookies or credentials.
      const req = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, { signal, family: address.family,
        lookup: (_host, _options, callback) => callback(null, address.address, address.family),
        headers: { Accept: "text/html", "User-Agent": "UnchartedEvidence/1.0" } }, (res) => {
        const chunks: Buffer[] = []; let bytes = 0;
        res.on("error", reject);
        res.on("data", (chunk: Buffer) => { bytes += chunk.length; if (bytes > 262144) req.destroy(new Error("Page too large")); else chunks.push(chunk); });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, location: res.headers.location, html: Buffer.concat(chunks).toString("utf8") }));
      });
      req.on("error", reject); req.end();
    });
    if ([301, 302, 303, 307, 308].includes(result.status) && result.location) { url = webURL(new URL(result.location, url).href); continue; }
    if (result.status < 200 || result.status >= 300) throw new Error("Page unavailable");
    return { url: url.href, html: result.html };
  }
  throw new Error("Too many redirects");
}
const pages = z.record(z.string(), z.object({ url: z.string().nullable(), html: z.string() }));
export async function resolveSource(uri: string, stubKey: string) {
  try {
    const page = process.env.AI_STUB_DIR
      ? pages.parse(JSON.parse(await fixture(process.env.AI_STUB_DIR, stubKey)))[uri]
      : await fetchPage(uri);
    if (!page?.url) return { url: null, publishedAt: null };
    return { url: webURL(page.url).href, publishedAt: publishedAt(page.html) };
  } catch { return { url: null, publishedAt: null }; }
}
