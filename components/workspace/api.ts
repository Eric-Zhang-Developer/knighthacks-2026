// Same-origin calls to the guest-workspace API (specs/features/guest-workspace/spec.md). The session lives only in
// the API's HttpOnly cookie: nothing here reads, stores or returns it.
export type Identity = { workspaceId: string; memberId: string };
export type Result<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export async function post<T>(path: string, body?: unknown): Promise<Result<T>> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as T & { error?: string };
    return res.ok ? { ok: true, data: json } : { ok: false, status: res.status, error: json.error ?? `HTTP ${res.status}` };
  } catch {
    return { ok: false, status: 0, error: "Network error" };
  }
}

// One initialization per page load, however many times the boundary mounts (React strict mode, remounts).
let started: Promise<Result<Identity>> | null = null;
export function initWorkspace(): Promise<Result<Identity>> {
  started ??= post<Identity>("/api/workspace").then((r) => {
    if (!r.ok) started = null; // a failure may be retried
    return r;
  });
  return started;
}

export const shortId = (id: string) => id.slice(0, 8);
