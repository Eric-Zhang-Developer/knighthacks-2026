import { z } from "zod";
import type { Claim } from "@/lib/ai/claims";
export const createSchema = z.object({ versionId: z.uuid() }).strict();
export type SnapshotData = {
  versionId: string;
  idea: { title: string | null; description: string | null; problem: string | null; workflow: string | null; constraints: string | null };
  audience: string | null;
  nearestAlternatives: { projectId: string; title: string | null; url: string | null }[];
  whatDiffers: { projectId: string; claims: Claim[] }[];
  mainUncertainty: { projectId: string; claim: Claim } | null;
  nextTest: Claim | null;
  // decision-context-api: the version's latest committed scope when the snapshot was taken; absent if none was saved.
  scope?: {
    selectionId: string;
    features: { id: string; title: Claim; demoStep: Claim }[];
    choices: { featureId: string; scope: "core" | "optional" | "later" }[];
    demoSketch: Claim[];
  };
};
export class SnapshotError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
