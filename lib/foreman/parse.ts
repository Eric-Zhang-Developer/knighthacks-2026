// Ports of the parsers in .agents/scripts/lib.py and status.py, so the page and status.py agree on every state.

export type Title = { kind: "feature" | "fix" | "docs" | "contract" | "plan" | "revert"; type: string; scope: string | null };

const TITLE = /^([a-z]+)(?:\(([^)]*)\))?!?:\s*\S/;
const KINDS: Record<string, Title["kind"]> = {
  feat: "feature",
  fix: "fix",
  refactor: "fix",
  perf: "fix",
  test: "fix",
  chore: "fix",
  style: "fix",
  docs: "docs",
  contract: "contract",
  plan: "plan",
  revert: "revert",
};

export function parseTitle(title: string): Title | null {
  title = (title ?? "").trim().replace(/ \(#\d+\)$/, "");
  if (title.startsWith('Revert "')) return { kind: "revert", type: "revert", scope: null };
  const m = TITLE.exec(title);
  const type = m?.[1] ?? "";
  if (!m || !(type in KINDS)) return null;
  const kind = KINDS[type];
  const scope = (m[2] ?? "").trim() || null;
  if (kind === "feature" && !scope) return null;
  return { kind, type, scope };
}

const stripComment = (line: string) => line.replace(/\s+#.*$/, "").replace(/^#.*$/, "");

function scalar(v: string): string | boolean {
  v = v.trim();
  if (v === "true" || v === "false") return v === "true";
  return v.replace(/^["']|["']$/g, "");
}

/** Spec front matter: `key: value`, `key: [a, b]`, and `key:` followed by `  - item` lines. */
export function frontMatter(text: string): Record<string, string | boolean | string[]> {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return {};
  const data: Record<string, string | boolean | string[]> = {};
  let current: string | null = null;
  for (const raw of m[1].split(/\r?\n/)) {
    const line = stripComment(raw);
    if (!line.trim()) continue;
    if (!/^[ \t]/.test(line)) {
      const i = line.indexOf(":");
      current = line.slice(0, i).trim();
      const val = line.slice(i + 1).trim();
      data[current] = !val ? [] : val.startsWith("[") ? splitList(val) : scalar(val);
    } else if (current && line.trim().startsWith("- ") && Array.isArray(data[current])) {
      (data[current] as string[]).push(String(scalar(line.trim().slice(2))));
    }
  }
  return data;
}

const splitList = (v: string) =>
  v
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((x) => String(scalar(x)))
    .filter(Boolean);

export const asList = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v ? [String(v)] : []);

/** The subset of TOML milestones.toml uses: top-level keys, [[milestone]] tables, strings, booleans, string arrays. */
export function parseMilestonesToml(text: string): { start?: string; milestone: Record<string, unknown>[] } {
  const out: { start?: string; milestone: Record<string, unknown>[] } = { milestone: [] };
  let table: Record<string, unknown> = out;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;
    if (line === "[[milestone]]") {
      table = {};
      out.milestone.push(table);
      continue;
    }
    const m = /^([A-Za-z_][\w-]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let val = m[2];
    if (val.startsWith("[")) {
      while (!/\]\s*(#.*)?$/.test(val) && i + 1 < lines.length) val += " " + lines[++i].trim();
      table[m[1]] = [...val.slice(0, val.lastIndexOf("]")).matchAll(/"([^"]*)"/g)].map((x) => x[1]);
    } else if (val.startsWith('"')) {
      table[m[1]] = val.slice(1, val.indexOf('"', 1));
    } else {
      table[m[1]] = scalar(stripComment(val));
    }
  }
  return out;
}

/** '2d', '36h', 'H:MM' or '' -> milliseconds. */
export function parseSpan(v: unknown): number {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  let m;
  if ((m = /^(\d+)\s*d$/.exec(s))) return +m[1] * 86_400_000;
  if ((m = /^(\d+)\s*h$/.exec(s))) return +m[1] * 3_600_000;
  if ((m = /^(\d+):(\d{2})$/.exec(s))) return +m[1] * 3_600_000 + +m[2] * 60_000;
  throw new Error(`${s} is not a span: use 2d, 36h or H:MM`);
}

/** '+H:MM' after start, 'YYYY-MM-DD' (through the end of that day, UTC), or an ISO time with an offset. */
export function parseWhen(v: unknown, start: number | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (s.startsWith("+")) return start === null ? null : start + parseSpan(s.slice(1));
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return Date.parse(`${s}T00:00:00Z`) + 86_400_000;
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(s)) throw new Error(`${s} needs a UTC offset`);
  return Date.parse(s);
}

/** Body of `## <heading>` in a done note (trimmed), or null if the note has no such heading. */
export function noteSection(text: string, heading: string): string | null {
  const esc = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`^##[ \\t]+${esc}[ \\t]*$([\\s\\S]*?)(?=^##[ \\t]|(?![\\s\\S]))`, "m").exec(text);
  return m ? m[1].trim() : null;
}

const bullet = (x: string) => x.replace(/^[-*\s]+/, "").trim();

/** status.py's rule: verified only with a passing verify line and no failing or "not verified" line. */
export function isVerified(note: string): boolean {
  const lines = (noteSection(note, "How to check it") ?? "").split("\n").map(bullet);
  const passed = lines.some((x) => /^verify: `.*` pass\b/.test(x));
  const failed = lines.some((x) => (x.startsWith("verify: ") && x.includes(" FAIL")) || x.toLowerCase().includes("not verified"));
  return passed && !failed;
}

/** First line of the done note's `## Gaps`, or '' when it's empty or says none. */
export function firstGap(note: string): string {
  const body = noteSection(note, "Gaps") ?? "";
  const first = body ? bullet(body.split("\n")[0]) : "";
  return /^none( known| yet)?\.?$/i.test(first) ? "" : first;
}

/** The first prose line of a done note (its `## What shipped`). */
export function firstLine(note: string): string {
  return bullet(note.split("\n").find((x) => x.trim() && !x.startsWith("#")) ?? "");
}

/** `Worker: <name>` from a PR body; agents put their worker name there (AGENTS.md, the loop step 2). */
export function workerOf(body: string | null): string | null {
  return /worker:\s*`?([\w.-]*\w)/i.exec(body ?? "")?.[1] ?? null;
}
