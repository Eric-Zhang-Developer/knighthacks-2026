import { z } from "zod";
import { CRITERIA, resultSchema } from "./contract";

const entry = resultSchema.shape.criteria.element.shape.perVersion.element;
const cellSchema = z.object({
  r: entry.shape.reason.shape.text,
  l: entry.shape.reason.shape.label,
  s: entry.shape.reason.shape.sourceIds,
  u: entry.shape.uncertainty,
}).strict();

/** The model returns prose and citations only; the server supplies the known row/column identities. */
export function matrixSchema(versionCount: number) {
  return z.object({ m: z.array(z.array(cellSchema).length(versionCount)).length(CRITERIA.length) }).strict();
}

/** Distinct prefixes prevent a citation for another version from being accepted, even for the same project. */
export function citationAlias(versionIndex: number, cardIndex: number) {
  return `${String.fromCharCode(97 + versionIndex)}${cardIndex.toString(36)}`;
}
