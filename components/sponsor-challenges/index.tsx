"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClaimBadge, PanelState } from "@/components/ui";
import { initWorkspace, post, shortId } from "@/components/workspace/api";
import { KINDS, MAX_EVIDENCE, MAX_TEXT, type Assessment, type AssessmentState, type Draft, type Kind, type Reason, type Revision, type Rubric } from "@/lib/sponsor-challenges/contract";
import { useAppState } from "@/lib/store";
import styles from "./sponsor-challenges.module.css";

// Sponsor challenges (specs/features/sponsor-challenges-ui): import a brief as text and/or one image, review and
// confirm what it requires, then assess a saved idea against it with cited reasons. Every status, basis, point, weight
// and total shown here comes from the API (specs/decisions/sponsor-challenges-api-response.md); nothing is defaulted
// or computed in the browser.

const MAX_IMAGE = 2 * 1024 * 1024;
const KIND_LABEL: Record<Kind, string> = { eligibility: "Eligibility", "required-integration": "Required integration", deliverable: "Deliverable", judging: "Judging" };
const STATUS_LABEL = { met: "Met", not_met: "Not met", unknown: "Unknown" } as const;
const BASIS_LABEL = { user_evidence: "your evidence", idea_intent: "the idea's stated intent", brief_only: "the brief alone", none: "nothing yet" } as const;
const SOURCE_LABEL = { brief: "Brief", evidence: "Your evidence", idea: "Idea" } as const;
const ELIGIBILITY = {
  met: "Eligibility: every condition is met by your evidence.",
  conflict: "Eligibility conflict: at least one eligibility condition is not met.",
  unknown: "Eligibility unknown: at least one condition has no evidence yet.",
  no_conditions: "The confirmed brief states no eligibility conditions.",
} as const;
const NOT_ODDS = "This assesses the brief you supplied and your evidence. It is not a judge's score or a chance of winning.";

type Listed = { challengeId: string; title: string | null; latestRevision: number | null; assessments: number; createdAt: string };
type Detail = { draft: Draft; revisions: Revision[]; assessments: { assessmentId: string; revisionId: string; versionId: string; status: string; createdAt: string }[] };
type Idea = { versionId: string; title: string | null };
type Row = { kind: Kind; quote: string; summary: string };
type Note = { text: string; link: string };
type Shown = { kind: "complete"; data: Assessment } | { kind: "pending" | "failed" | "expired"; assessmentId: string; error: string | null };

// A confirmed revision's rubric carries server-added ids and coefficients; confirming again sends only what the user
// confirms (the strict confirm schema rejects the rest).
const asInput = (r: NonNullable<Draft["proposed"]["rubric"]>) => ({
  criteria: r.criteria.map(({ name, quote, scale, anchors, weight }) => ({
    name, quote, scale: scale && { min: scale.min, max: scale.max, quote: scale.quote },
    anchors: anchors.map(({ points, quote }) => ({ points, quote })),
    weight: weight && { value: weight.value, unit: weight.unit, quote: weight.quote },
  })),
  aggregation: r.aggregation.map(({ rule, quote }) => ({ rule, quote })),
});

async function get<T>(path: string): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  try {
    const res = await fetch(path);
    const json = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data: json as T } : { ok: false, status: res.status, error: (json as { error?: string }).error ?? `HTTP ${res.status}` };
  } catch {
    return { ok: false, status: 0, error: "Network error" };
  }
}

export default function SponsorChallenges() {
  const active = useAppState((s) => s.activeIdeaVersionId);
  const [listed, setListed] = useState<Listed[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Import form. The typed text survives every failure; only a successful import moves on.
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Review: the editable transcript and requirement rows, confirmed into a revision.
  const [reviewing, setReviewing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [rubric, setRubric] = useState<Draft["proposed"]["rubric"]>(null);
  const [keepRubric, setKeepRubric] = useState(true);

  // Assessment inputs and result.
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [versionId, setVersionId] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [shown, setShown] = useState<Shown | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // One key per assessment attempt: a retry of a failed or expired one needs a new key (the API's replay rules).
  const attempt = useRef<{ key: string; body: string } | null>(null);

  // A preview URL lives only as long as its image: revoked when replaced, removed or unmounted.
  useEffect(() => {
    if (!image) return setPreview(null);
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const loadList = useCallback(async () => {
    if (!(await initWorkspace()).ok) return setListError("Sponsor challenges need a workspace, which couldn't start.");
    const res = await get<{ challenges: Listed[] }>("/api/sponsor-challenges");
    if (!res.ok) return setListError("Sponsor challenges are unavailable right now.");
    setListError(null);
    setListed(res.data.challenges);
  }, []);
  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    (async () => {
      if (!(await initWorkspace()).ok) return;
      const res = await get<Idea[]>("/api/ideas");
      if (res.ok) setIdeas(res.data);
    })();
  }, [active]);
  useEffect(() => {
    if (active) setVersionId(active);
  }, [active]);

  const latest = detail?.revisions.at(-1) ?? null;

  function chooseImage(file: File | null) {
    setError(null);
    if (fileInput.current && !file) fileInput.current.value = "";
    if (!file) return setImage(null);
    if (file.type !== "image/png" && file.type !== "image/jpeg") return setError("Choose a PNG or JPEG image, or paste the text instead.");
    if (file.size > MAX_IMAGE) return setError("That image is over 2 MB. Choose a smaller one, or paste the text instead.");
    setImage(file);
  }

  function review(transcriptText: string, requirements: { kind: Kind; quote: string; summary: string | null }[], proposed: Draft["proposed"]["rubric"]) {
    setTranscript(transcriptText);
    setRows(requirements.map((r) => ({ kind: r.kind, quote: r.quote, summary: r.summary ?? "" })));
    setRubric(proposed);
    setKeepRubric(true);
    setReviewing(true);
  }

  async function open(challengeId: string, assessmentId?: string) {
    setError(null);
    setShown(null);
    setConfirmDelete(false);
    const res = await get<Detail>(`/api/sponsor-challenges/${challengeId}`);
    if (!res.ok) return setError(res.status === 404 ? "That challenge no longer exists." : `Couldn't open the challenge: ${res.error}`);
    setDetail(res.data);
    // Reopened later, the idea picker starts at the idea the last assessment used.
    const lastUsed = res.data.assessments.at(-1)?.versionId;
    if (lastUsed) setVersionId((v) => v || lastUsed);
    const last = res.data.revisions.at(-1);
    if (last) setReviewing(false);
    else review(res.data.draft.transcript, res.data.draft.proposed.requirements, res.data.draft.proposed.rubric);
    const pick = assessmentId ?? res.data.assessments.at(-1)?.assessmentId;
    if (pick) await openAssessment(challengeId, pick);
  }

  async function openAssessment(challengeId: string, assessmentId: string) {
    const res = await get<AssessmentState>(`/api/sponsor-challenges/${challengeId}/assessments/${assessmentId}`);
    if (!res.ok) return setError(`Couldn't read the assessment: ${res.error}`);
    const body = res.data;
    setShown(body.status === "complete" ? { kind: "complete", data: body } : { kind: body.status, assessmentId: body.assessmentId, error: body.error });
  }

  async function importBrief() {
    setError(null);
    if (!text.trim() && !image) return setError("Paste the challenge text or choose an image.");
    if (text.length > MAX_TEXT) return setError(`The text is over ${MAX_TEXT.toLocaleString()} characters.`);
    if (!(await initWorkspace()).ok) return setError("Sponsor challenges need a workspace, which couldn't start.");
    const form = new FormData();
    if (text.trim()) form.set("text", text);
    if (image) form.set("image", image);
    if (title.trim()) form.set("title", title.trim());
    if (sourceUrl.trim()) form.set("sourceUrl", sourceUrl.trim());
    setBusy("Reading the brief…");
    const res = await fetch("/api/sponsor-challenges", { method: "POST", body: form }).catch(() => null);
    const body = (await res?.json().catch(() => ({}))) as Draft & { error?: string };
    setBusy(null);
    if (!res?.ok) {
      const why = { 413: "The text or image is too large.", 415: "That file isn't a PNG or JPEG image.", 502: "Reading the brief failed. Your text is kept; try again." }[res?.status ?? 0];
      return setError(why ?? body?.error ?? "Couldn't import the brief. Your text is kept; try again.");
    }
    setDetail({ draft: body, revisions: [], assessments: [] });
    setShown(null);
    review(body.transcript, body.proposed.requirements, body.proposed.rubric);
    loadList();
  }

  async function confirm() {
    if (!detail) return;
    setError(null);
    const missing = rows.filter((r) => !r.quote.trim() || !transcript.includes(r.quote));
    if (missing.length) return setError("Every requirement must quote text that appears in the transcript.");
    setBusy("Confirming…");
    const res = await post<Revision>(`/api/sponsor-challenges/${detail.draft.challengeId}/confirm`, {
      transcript,
      requirements: rows.map((r) => ({ kind: r.kind, quote: r.quote, summary: r.summary.trim() || null })),
      rubric: keepRubric && rubric ? asInput(rubric) : null,
    });
    setBusy(null);
    if (!res.ok) return setError(`Couldn't confirm: ${res.error}`);
    setDetail({ ...detail, revisions: [...detail.revisions, res.data] });
    setReviewing(false);
    setShown(null);
    loadList();
  }

  async function assess(fresh: boolean) {
    if (!detail || !latest) return;
    setError(null);
    if (!versionId) return setError("Choose a saved idea to assess.");
    const evidence = notes.filter((n) => n.text.trim()).map((n) => ({ text: n.text.trim(), link: n.link.trim() || null }));
    if (evidence.reduce((n, e) => n + e.text.length, 0) > MAX_EVIDENCE) return setError(`Evidence notes are over ${MAX_EVIDENCE.toLocaleString()} characters.`);
    const payload = JSON.stringify({ revisionId: latest.revisionId, versionId, evidence });
    if (fresh || attempt.current?.body !== payload) attempt.current = { key: crypto.randomUUID(), body: payload };
    setBusy("Assessing fit…");
    const path = `/api/sponsor-challenges/${detail.draft.challengeId}/assess`;
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": attempt.current.key }, body: payload }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as (Assessment & { error?: string }) | { assessmentId: string; status: string; error: string | null } | null;
    if (!res || !body) {
      setBusy(null);
      return setError("Assessing failed: network error. Try again.");
    }
    if (res.status === 202 && "assessmentId" in body) {
      // Another request with this key is still generating: poll it rather than starting a second one.
      for (let i = 0; i < 100; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const polled = await get<{ status: string }>(`${path.replace(/assess$/, "assessments")}/${body.assessmentId}`);
        if (polled.ok && polled.data.status !== "pending") break;
      }
      await openAssessment(detail.draft.challengeId, body.assessmentId);
    } else if (res.ok && body.status === "complete") {
      setShown({ kind: "complete", data: body as Assessment });
    } else if ("assessmentId" in body && (body.status === "failed" || body.status === "expired")) {
      setShown({ kind: body.status, assessmentId: body.assessmentId, error: body.error });
    } else {
      setError(`Couldn't assess: ${(body as { error?: string }).error ?? `HTTP ${res.status}`}`);
    }
    setBusy(null);
    const refreshed = await get<Detail>(`/api/sponsor-challenges/${detail.draft.challengeId}`);
    if (refreshed.ok) setDetail(refreshed.data);
    loadList();
  }

  async function remove() {
    if (!detail) return;
    setBusy("Deleting…");
    const res = await fetch(`/api/sponsor-challenges/${detail.draft.challengeId}`, { method: "DELETE" }).catch(() => null);
    setBusy(null);
    setConfirmDelete(false);
    if (!res?.ok) return setError("Couldn't delete the challenge. Try again.");
    setDetail(null);
    setShown(null);
    setReviewing(false);
    loadList();
  }

  function startOver() {
    setDetail(null);
    setShown(null);
    setReviewing(false);
    setError(null);
    setConfirmDelete(false);
  }

  return (
    <section className={`ui-panel ${styles.panel}`} aria-label="Sponsor challenges">
      <h2 className="ui-heading">Sponsor challenges</h2>
      <p className={styles.meta}>Check a saved idea against a sponsor&apos;s brief: what it requires, what your evidence shows, what is still unknown.</p>
      {listError && <PanelState kind="failed" message={listError} onRetry={loadList} />}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {busy && <PanelState kind="loading" message={busy} />}

      {!detail && (
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            importBrief();
          }}
        >
          <label className={styles.field}>
            Challenge text
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={MAX_TEXT} placeholder="Paste the sponsor's challenge, rules and judging criteria" />
            <span className={styles.meta}>
              {text.length.toLocaleString()} / {MAX_TEXT.toLocaleString()} characters
            </span>
          </label>
          <div
            className={styles.drop}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              chooseImage(e.dataTransfer.files[0] ?? null);
            }}
          >
            <label className={styles.field}>
              Challenge image (PNG or JPEG, up to 2 MB). Optional; drop it here or choose a file
              <input ref={fileInput} type="file" accept="image/png,image/jpeg" onChange={(e) => chooseImage(e.target.files?.[0] ?? null)} />
            </label>
            {preview && (
              <div className={styles.preview}>
                {/* eslint-disable-next-line @next/next/no-img-element -- a local blob preview, never uploaded or optimized */}
                <img src={preview} alt="Preview of the chosen challenge image" />
                <button type="button" onClick={() => chooseImage(null)}>
                  Remove image
                </button>
              </div>
            )}
          </div>
          <label className={styles.field}>
            Title (optional, as you name it)
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </label>
          <label className={styles.field}>
            Source link (optional, you supplied it; it is stored, never opened)
            <input type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} maxLength={2000} />
          </label>
          <button type="submit" className={styles.primary} disabled={!!busy}>
            Import brief
          </button>
        </form>
      )}

      {detail && (
        <article className={styles.challenge} aria-label="Challenge" data-challenge-id={detail.draft.challengeId}>
          <h3 className={styles.title}>{detail.draft.title ?? <span className={styles.unknown}>Untitled challenge</span>}</h3>
          <p className={styles.meta}>
            {detail.draft.sourceUrl && <>Source you supplied: {detail.draft.sourceUrl} · </>}
            {latest ? `Confirmed revision ${latest.revision}` : "Not confirmed yet"}
            {detail.revisions.length > 1 && ` (of ${detail.revisions.length})`}
          </p>

          {reviewing && (
            <div className={styles.review} aria-label="Review requirements">
              <h4>Review what the brief requires</h4>
              <div className={styles.side}>
                {preview && (
                  // eslint-disable-next-line @next/next/no-img-element -- a local blob preview, never uploaded or optimized
                  <img className={styles.thumb} src={preview} alt="The challenge image you chose" />
                )}
                <label className={styles.field}>
                  Transcript (edit anything misread)
                  <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={8} maxLength={MAX_TEXT} />
                </label>
              </div>
              {detail.draft.uncertain.length > 0 && !latest && (
                <div className={styles.uncertain}>
                  <p>
                    <strong>Check these: the reader wasn&apos;t sure.</strong>
                  </p>
                  <ul>
                    {detail.draft.uncertain.map((u, i) => (
                      <li key={i}>
                        &ldquo;{u.text}&rdquo;: {u.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {rows.length === 0 && <p className={styles.unknown}>No requirements found. Add each one with a quote from the transcript.</p>}
              <ol className={styles.rows}>
                {rows.map((r, i) => {
                  const quoted = r.quote.trim() !== "" && transcript.includes(r.quote);
                  const set = (patch: Partial<Row>) => setRows(rows.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                  return (
                    <li key={i} className={styles.row}>
                      <label className={styles.field}>
                        Kind
                        <select value={r.kind} onChange={(e) => set({ kind: e.target.value as Kind })}>
                          {KINDS.map((k) => (
                            <option key={k} value={k}>
                              {KIND_LABEL[k]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={styles.field}>
                        Quote from the transcript
                        <input value={r.quote} onChange={(e) => set({ quote: e.target.value })} aria-invalid={!quoted} />
                      </label>
                      {!quoted && <span className={styles.warn}>Not found in the transcript</span>}
                      <label className={styles.field}>
                        Summary (optional)
                        <input value={r.summary} onChange={(e) => set({ summary: e.target.value })} />
                      </label>
                      <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                        Remove requirement
                      </button>
                    </li>
                  );
                })}
              </ol>
              <button type="button" onClick={() => setRows([...rows, { kind: "eligibility", quote: "", summary: "" }])}>
                Add requirement
              </button>
              {rubric && (
                <div className={styles.rubric}>
                  <label>
                    <input type="checkbox" checked={keepRubric} onChange={(e) => setKeepRubric(e.target.checked)} /> Include the judging rubric found in the brief
                  </label>
                  <RubricTable rubric={rubric} />
                </div>
              )}
              <button type="button" className={styles.primary} disabled={!!busy} onClick={confirm}>
                Confirm requirements
              </button>
            </div>
          )}

          {latest && !reviewing && (
            <>
              <h4>Requirements (revision {latest.revision})</h4>
              <ul className={styles.list}>
                {latest.requirements.map((r) => (
                  <li key={r.id}>
                    <strong>{KIND_LABEL[r.kind]}:</strong> {r.summary ?? r.quote} <q className={styles.quote}>{r.quote}</q>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => review(latest.transcript, latest.requirements, latest.rubric)}>
                Correct the brief
              </button>

              <div className={styles.assess} aria-label="Assess fit">
                <label className={styles.field}>
                  Saved idea
                  <select value={versionId} onChange={(e) => setVersionId(e.target.value)}>
                    <option value="">Choose a saved idea</option>
                    {ideas.map((i) => (
                      <option key={i.versionId} value={i.versionId}>
                        {i.title ?? "Untitled idea"} · version {shortId(i.versionId)}
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset className={styles.notes}>
                  <legend>Evidence (optional): notes and links you vouch for</legend>
                  {notes.map((n, i) => (
                    <div key={i} className={styles.note}>
                      <label className={styles.field}>
                        Note {i + 1}
                        <textarea rows={2} value={n.text} onChange={(e) => setNotes(notes.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
                      </label>
                      <label className={styles.field}>
                        Link (stored, never opened)
                        <input type="url" value={n.link} onChange={(e) => setNotes(notes.map((x, j) => (j === i ? { ...x, link: e.target.value } : x)))} />
                      </label>
                      <button type="button" onClick={() => setNotes(notes.filter((_, j) => j !== i))}>
                        Remove note {i + 1}
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setNotes([...notes, { text: "", link: "" }])}>
                    Add evidence note
                  </button>
                </fieldset>
                <button type="button" className={styles.primary} disabled={!!busy} onClick={() => assess(false)}>
                  {shown ? "Reassess" : "Assess fit"}
                </button>
              </div>
            </>
          )}

          {shown && shown.kind !== "complete" && (
            <PanelState
              kind={shown.kind === "pending" ? "loading" : "failed"}
              message={shown.kind === "pending" ? "Still assessing…" : shown.kind === "expired" ? "That assessment expired before it finished." : `The assessment failed${shown.error ? `: ${shown.error}` : "."}`}
              onRetry={shown.kind === "pending" ? undefined : () => assess(true)}
            />
          )}
          {shown?.kind === "complete" && <AssessmentView data={shown.data} revisions={detail.revisions} ideas={ideas} />}

          {detail.assessments.length > 1 && (
            <details className={styles.history}>
              <summary>Earlier assessments ({detail.assessments.length})</summary>
              <ul className={styles.list}>
                {[...detail.assessments].reverse().map((a) => {
                  const rev = detail.revisions.find((r) => r.revisionId === a.revisionId);
                  return (
                    <li key={a.assessmentId}>
                      <button type="button" onClick={() => openAssessment(detail.draft.challengeId, a.assessmentId)}>
                        {new Date(a.createdAt).toLocaleString()} · revision {rev?.revision ?? "?"}
                        {rev && latest && rev.revision < latest.revision ? " (older revision)" : ""} · {a.status}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </details>
          )}

          <div className={styles.actions}>
            <button type="button" onClick={startOver}>
              Close
            </button>
            {confirmDelete ? (
              <>
                <button type="button" className={styles.danger} onClick={remove}>
                  Delete the brief and its assessments
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)}>
                  Keep it
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)}>
                Delete
              </button>
            )}
          </div>
        </article>
      )}

      {listed && listed.length > 0 && (
        <details className={styles.history} open={!detail}>
          <summary>Saved challenges ({listed.length})</summary>
          <ul className={styles.list}>
            {listed.map((c) => (
              <li key={c.challengeId}>
                <button type="button" aria-current={c.challengeId === detail?.draft.challengeId} onClick={() => open(c.challengeId)}>
                  {c.title ?? "Untitled challenge"} · {c.latestRevision ? `revision ${c.latestRevision}` : "not confirmed"} · {c.assessments} assessment{c.assessments === 1 ? "" : "s"}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function RubricTable({ rubric, estimate }: { rubric: Rubric | NonNullable<Draft["proposed"]["rubric"]>; estimate?: Assessment["rubricEstimate"] }) {
  const byId = new Map(estimate?.criteria.map((c) => [c.criterionId, c]) ?? []);
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col">Criterion</th>
          <th scope="col">Scale</th>
          <th scope="col">Weight</th>
          {estimate && <th scope="col">Estimate</th>}
        </tr>
      </thead>
      <tbody>
        {rubric.criteria.map((c, i) => {
          const id = "id" in c ? (c.id as string) : `c${i + 1}`;
          const e = byId.get(id);
          return (
            <tr key={id}>
              <th scope="row">
                {c.name} <q className={styles.quote}>{c.quote}</q>
              </th>
              <td>{c.scale ? `${c.scale.min} to ${c.scale.max}` : <span className={styles.unknown}>not stated</span>}</td>
              <td>{c.weight ? `${c.weight.value}${c.weight.unit === "percent" ? "%" : ""}` : <span className={styles.unknown}>not stated</span>}</td>
              {estimate && (
                <td>
                  {e?.points != null ? (
                    <>
                      {e.points}
                      {c.scale ? ` of ${c.scale.max}` : ""}
                      {e.anchorQuote && (
                        <>
                          {" "}
                          <q className={styles.quote}>{e.anchorQuote}</q>
                        </>
                      )}
                    </>
                  ) : (
                    <span className={styles.unknown}>Not estimated{e?.nullReason ? `: ${e.nullReason}` : ""}</span>
                  )}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ReasonList({ title, reasons }: { title: string; reasons: Reason[] }) {
  return (
    <section aria-label={title} className={styles.reasons}>
      <h4>{title}</h4>
      {reasons.length === 0 ? <p className={styles.unknown}>None.</p> : <Reasons reasons={reasons} />}
    </section>
  );
}

// Each reason with its claim label and, expandable, the exact source passages the server checked.
function Reasons({ reasons }: { reasons: Reason[] }) {
  return (
        <ul className={styles.list}>
          {reasons.map((r, i) => (
            <li key={i}>
              <ClaimBadge label={r.label} /> {r.text}
              {r.citations.length > 0 && (
                <details>
                  <summary>Sources ({r.citations.length})</summary>
                  <ul>
                    {r.citations.map((c, j) => (
                      <li key={j}>
                        {SOURCE_LABEL[c.source]}: <q className={styles.quote}>{c.quote}</q>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          ))}
        </ul>
  );
}

function AssessmentView({ data, revisions, ideas }: { data: Assessment; revisions: Revision[]; ideas: Idea[] }) {
  const revision = revisions.find((r) => r.revisionId === data.revisionId);
  const latest = revisions.at(-1);
  const idea = ideas.find((i) => i.versionId === data.versionId);
  const est = data.rubricEstimate;
  const kinds = new Map(revision?.requirements.map((r) => [r.id, r]) ?? []);
  return (
    <article className={styles.assessment} aria-label="Assessment" data-assessment-id={data.assessmentId}>
      <p className={styles.meta}>
        Brief revision {data.provenance.briefRevision}
        {latest && revision && revision.revision < latest.revision ? " (older revision)" : ""} · idea {idea?.title ?? "version"} {shortId(data.versionId)} · generated {new Date(data.createdAt).toLocaleString()}
      </p>
      <p className={styles.notice}>{NOT_ODDS}</p>
      <p className={styles[`eligibility_${data.eligibility}`]}>{ELIGIBILITY[data.eligibility]}</p>
      <p>
        Requirements: {data.counts.met} met, {data.counts.notMet} not met, {data.counts.unknown} unknown.
      </p>
      <ReasonList title="Why it fits" reasons={data.whyFits} />
      <ReasonList title="Why it does not fit" reasons={data.whyNot} />
      <ReasonList title="Still unknown" reasons={data.stillUnknown} />

      <section aria-label="Requirement checks" className={styles.reasons}>
        <h4>Requirement by requirement</h4>
        <ul className={styles.list}>
          {data.requirements.map((r) => (
            <li key={r.requirementId} data-status={r.status}>
              <strong>{STATUS_LABEL[r.status]}</strong> · {KIND_LABEL[r.kind]}: {kinds.get(r.requirementId)?.summary ?? kinds.get(r.requirementId)?.quote ?? r.requirementId}
              <span className={styles.meta}> (based on {BASIS_LABEL[r.basis]})</span>
              {r.reasons.length > 0 && <Reasons reasons={r.reasons} />}
              {r.missingProof && <p className={styles.warn}>Missing proof: {r.missingProof}</p>}
              {r.nextCheck && <p>Next check: {r.nextCheck}</p>}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Estimated rubric score" className={styles.reasons}>
        <h4>Estimated rubric score</h4>
        {revision?.rubric && est ? (
          <>
            <RubricTable rubric={revision.rubric} estimate={est} />
            {est.total != null ? (
              <p>
                Estimated total: <strong>{est.total}</strong>
                {est.maximum != null ? ` of ${est.maximum}` : ""} ({est.rule === "weighted_sum" ? "each estimate times its weight, summed" : "estimates summed"}, as the brief&apos;s{" "}
                <q className={styles.quote}>{revision.rubric.aggregation[0]?.quote}</q> states)
              </p>
            ) : (
              <p className={styles.unknown}>No total: {est.nullReason}</p>
            )}
            <p className={styles.meta}>{est.note}</p>
          </>
        ) : (
          <p className={styles.unknown}>No score can be calculated: {data.rubricNullReason ?? "the confirmed brief has no scorable rubric."}</p>
        )}
      </section>

      {data.evidence.length > 0 && (
        <section aria-label="Your evidence" className={styles.reasons}>
          <h4>Your evidence</h4>
          <p className={styles.meta}>{data.provenance.userSupplied}</p>
          <ul className={styles.list}>
            {data.evidence.map((e) => (
              <li key={e.evidenceId}>
                {e.text}
                {e.link && <span className={styles.meta}> · {e.link}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
