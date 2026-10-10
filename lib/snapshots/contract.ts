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
};
export class SnapshotError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
