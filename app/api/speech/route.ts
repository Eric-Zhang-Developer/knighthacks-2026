import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export const runtime = "nodejs";
const VOICE = "JBFqnCBsd6RMkjVDRZzb";
const MODEL = "eleven_flash_v2_5";
const unavailable = () => Response.json({ error: "Speech is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
const invalid = () => Response.json({ error: "Provide text containing 1 to 200 Unicode characters." }, { status: 400, headers: { "Cache-Control": "no-store" } });

async function readText(request: Request): Promise<string | null> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json" || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!body || typeof body.text !== "string" || !body.text.trim() || [...body.text].length > 200) return null;
    return body.text;
  } catch { return null; }
  finally { reader.releaseLock(); }
}

/** No provider response metadata or error text crosses this boundary. */
export async function POST(request: Request): Promise<Response> {
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
    return Response.json({ error: "Same-origin request required." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const text = await readText(request);
  if (text === null) return invalid();
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey || request.signal.aborted) return unavailable();

  const upstream = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let output: ReadableStreamDefaultController<Uint8Array> | undefined;
  let ended = false;
  const stop = (failed: boolean) => {
    if (ended) return;
    ended = true;
    clearTimeout(timer);
    request.signal.removeEventListener("abort", onDisconnect);
    upstream.abort();
    void reader?.cancel().catch(() => undefined);
    if (failed) output?.error(new Error("Speech stream interrupted."));
  };
  const onDisconnect = () => stop(true);
  const timer = setTimeout(onDisconnect, 30000);
  request.signal.addEventListener("abort", onDisconnect, { once: true });
  if (request.signal.aborted) onDisconnect();
  // Enforce the same deadline even when a provider/mock does not settle on abort.
  async function bounded<T>(promise: PromiseLike<T>): Promise<T> {

    let rejectAbort: () => void = () => undefined;
    const aborted = new Promise<never>((_, reject) => { rejectAbort = () => reject(new Error("Speech unavailable")); if (upstream.signal.aborted) rejectAbort(); else upstream.signal.addEventListener("abort", rejectAbort, { once: true }); });
    try { return await Promise.race([promise, aborted]); }
    finally { upstream.signal.removeEventListener("abort", rejectAbort); }
  }
  async function nextChunk(): Promise<ReadableStreamReadResult<Uint8Array>> {
    while (true) {
      const chunk = await bounded(reader!.read());
      if (chunk.done) return chunk;
      if (!(chunk.value instanceof Uint8Array)) throw new Error("Invalid audio chunk");
      if (chunk.value.byteLength) return chunk;
    }
  }
  try {
    const client = new ElevenLabsClient({ apiKey, maxRetries: 0, timeoutInSeconds: 30 });
    const pending = Promise.resolve(client.textToSpeech.stream(VOICE, { text, modelId: MODEL, outputFormat: "mp3_44100_128" }, { abortSignal: upstream.signal, maxRetries: 0, timeoutInSeconds: 30 }))
      .then((stream) => { if (ended) { void stream.cancel().catch(() => undefined); throw new Error("Speech unavailable"); } return stream; });
    const stream = await bounded(pending);
    reader = stream.getReader();
    let first: Uint8Array | undefined;
    const chunk = await nextChunk();
    if (chunk.done || ended) throw new Error("No audio");
    first = chunk.value;
    const body = new ReadableStream<Uint8Array>({
      start(controller) { output = controller; },
      async pull(controller) {
        if (ended) return;
        if (first) { controller.enqueue(first); first = undefined; return; }
        try {
          const next = await nextChunk();
          if (ended) return;
          if (next.done) { controller.close(); stop(false); }
          else controller.enqueue(next.value);
        } catch { stop(true); }
      },
      cancel() { stop(false); },
    }, { highWaterMark: 0 });
    return new Response(body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { stop(false); return unavailable(); }
}
