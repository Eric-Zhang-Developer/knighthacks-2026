// A released utterance joins the draft as a new sentence; partial transcripts never reach it.
export function appendUtterance(draft: string, utterance: string): string {
  const text = utterance.trim();
  if (!text) return draft;
  return draft.trim() ? `${draft.trim()} ${text}` : text;
}
