import { FIELDS, type FieldName, type Fields } from "@/components/idea/fields";

// The conversation drives the screen: a proposal fills the Idea step, a project search opens its top match.
export const MENTOR_PROPOSAL = "mentor:proposal";
export const MENTOR_EVIDENCE = "mentor:evidence";

// The mentor's latest draft fills every field the person hasn't typed in themselves. Their own edits always win,
// and a field the mentor left blank keeps what was already there rather than being wiped.
export function mergeDraft(form: Record<FieldName, string>, proposal: Fields, edited: ReadonlySet<FieldName>) {
  return Object.fromEntries(
    FIELDS.map(({ name }) => [name, edited.has(name) ? form[name] : proposal[name]?.trim() ? proposal[name]! : form[name]]),
  ) as Record<FieldName, string>;
}
