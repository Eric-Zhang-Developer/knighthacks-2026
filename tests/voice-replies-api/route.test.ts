import { afterEach, beforeEach, expect, test, vi } from "vitest";
const { stream, construct } = vi.hoisted(() => ({ stream: vi.fn(), construct: vi.fn() }));
vi.mock("@elevenlabs/elevenlabs-js", () => ({ ElevenLabsClient: class { textToSpeech = { stream }; constructor(options: unknown) { construct(options); } } }));
import { POST } from "@/app/api/speech/route";
const secret = "speech-test-secret-never-expose";
function request(body: unknown = { text: "Hello" }, signal?: AbortSignal) {
  return new Request("https://uncharted.test/api/speech", { method: "POST", headers: { origin: "https://uncharted.test", "content-type": "application/json" }, body: JSON.stringify(body), signal });
}
function audio() { return new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array([73, 68, 51])); c.enqueue(new Uint8Array([1, 2])); c.close(); } }); }
async function safeFailure(response: Response, status = 503) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(JSON.stringify([...response.headers])).not.toContain(secret);
  expect(await response.text()).not.toContain(secret);
}
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("ELEVENLABS_API_KEY", secret); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
test("streams bytes with only safe headers and disables hidden retries", async () => {
  stream.mockResolvedValue(audio());
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("audio/mpeg");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(JSON.stringify([...response.headers])).not.toContain(secret);
  expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([73, 68, 51, 1, 2]);
  expect(construct).toHaveBeenCalledWith({ apiKey: secret, maxRetries: 0, timeoutInSeconds: 30 });
  expect(stream.mock.calls[0][2]).toMatchObject({ maxRetries: 0, timeoutInSeconds: 30 });
});
test.each([{}, { text: "" }, { text: "  " }, { text: 1 }, { text: "😀".repeat(201) }, { text: "x".repeat(9000) }])("rejects malformed or oversized input before provider call", async (input) => {
  await safeFailure(await POST(request(input)), 400); expect(stream).not.toHaveBeenCalled();
});
test("200 Unicode code points are accepted, not counted as UTF-16 units", async () => {
  stream.mockResolvedValue(audio()); const result = await POST(request({ text: "😀".repeat(200) })); expect(result.status).toBe(200); await result.body!.cancel();
});
test("malformed JSON and cross-origin requests are rejected", async () => {
  await safeFailure(await POST(new Request("https://uncharted.test/api/speech", { method: "POST", headers: { origin: "https://uncharted.test", "content-type": "application/json" }, body: "{" })), 400);
  await safeFailure(await POST(new Request("https://uncharted.test/api/speech", { method: "POST", headers: { origin: "https://other.test" }, body: "{}" })), 403);
  expect(stream).not.toHaveBeenCalled();
});
test("missing configuration, provider errors and empty audio return sanitized 503", async () => {
  vi.stubEnv("ELEVENLABS_API_KEY", ""); await safeFailure(await POST(request())); expect(stream).not.toHaveBeenCalled();
  vi.stubEnv("ELEVENLABS_API_KEY", secret); stream.mockRejectedValue(new Error(secret)); await safeFailure(await POST(request()));
  stream.mockResolvedValue(new ReadableStream({ start(c) { c.close(); } })); await safeFailure(await POST(request()));
});
test("request abort while awaiting first byte cancels upstream and returns503", async () => {
  const cancel = vi.fn(); stream.mockResolvedValue(new ReadableStream({ cancel }));
  const controller = new AbortController(); const response = POST(request(undefined, controller.signal));
  await vi.waitFor(() => expect(stream).toHaveBeenCalled());
  controller.abort(); await safeFailure(await response); expect(cancel).toHaveBeenCalled(); expect(stream.mock.calls[0][2].abortSignal.aborted).toBe(true);
});
test("consumer cancellation after first chunk cancels upstream", async () => {
  const cancel = vi.fn(); stream.mockResolvedValue(new ReadableStream({ start(c) { c.enqueue(new Uint8Array([73,68,51])); }, cancel }));
  const response = await POST(request()); const reader = response.body!.getReader(); await reader.read(); await reader.cancel();
  expect(cancel).toHaveBeenCalled(); expect(stream.mock.calls[0][2].abortSignal.aborted).toBe(true);
});
test("first-byte stall expires under fake time and cancels provider", async () => {
  vi.useFakeTimers(); const cancel = vi.fn(); stream.mockResolvedValue(new ReadableStream({ cancel }));
  const response = POST(request()); await vi.advanceTimersByTimeAsync(30001); await safeFailure(await response);
  expect(cancel).toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});
test("midstream stall terminates without appending provider error text", async () => {
  vi.useFakeTimers(); const cancel = vi.fn(); stream.mockResolvedValue(new ReadableStream({ start(c) { c.enqueue(new Uint8Array([73,68,51])); }, cancel }));
  const response = await POST(request()); const reader = response.body!.getReader(); expect((await reader.read()).value).toEqual(new Uint8Array([73,68,51]));
  const pending = expect(reader.read()).rejects.toThrow("Speech stream interrupted.");
  await vi.advanceTimersByTimeAsync(30001); await pending;
  expect(response.status).toBe(200); expect(cancel).toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});

test("late SDK response after deadline is canceled instead of leaked", async () => {
  vi.useFakeTimers(); let resolveStream!: (value: ReadableStream<Uint8Array>) => void;
  stream.mockImplementation(() => new Promise<ReadableStream<Uint8Array>>((resolve) => { resolveStream = resolve; }));
  const response = POST(request()); await vi.advanceTimersByTimeAsync(30001); await safeFailure(await response);
  const cancel = vi.fn(); resolveStream(new ReadableStream({ cancel })); await vi.advanceTimersByTimeAsync(0);
  expect(cancel).toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});
test("midstream provider failure never leaks its exception into the response", async () => {
  let source!: ReadableStreamDefaultController<Uint8Array>;
  stream.mockResolvedValue(new ReadableStream({ start(c) { source = c; c.enqueue(new Uint8Array([73,68,51])); } }));
  const response = await POST(request()); const reader = response.body!.getReader(); await reader.read();
  source.error(new Error(secret));
  await expect(reader.read()).rejects.toThrow("Speech stream interrupted.");
  expect(response.status).toBe(200);
});
test("request disconnection after headers cancels the provider stream", async () => {
  const cancel = vi.fn(); stream.mockResolvedValue(new ReadableStream({ start(c) { c.enqueue(new Uint8Array([73,68,51])); }, cancel }));
  const abort = new AbortController(); const response = await POST(request(undefined, abort.signal));
  const reader = response.body!.getReader(); await reader.read(); abort.abort();
  await expect(reader.read()).rejects.toThrow("Speech stream interrupted."); expect(cancel).toHaveBeenCalled();
});
