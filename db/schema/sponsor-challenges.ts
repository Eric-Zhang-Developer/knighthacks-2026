import { sql } from "drizzle-orm";
import { pgTable, uuid, text, integer, jsonb, timestamp, unique, check, index } from "drizzle-orm/pg-core";
import { workspaces } from "./workspace";
import { ideaVersions } from "./ideas";
import type { Assessment, Draft, Requirement, Rubric } from "../../lib/sponsor-challenges/contract";

// Imported sponsor briefs. Raw image bytes are never stored: only the media type and a SHA-256.
export const sponsorChallenges = pgTable("sponsor_challenges", {
  id: uuid("id").primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  draft: jsonb("draft").$type<Omit<Draft, "challengeId" | "createdAt">>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("sponsor_challenges_workspace").on(t.workspaceId, t.createdAt)]);

// Confirmed briefs are immutable: a correction inserts revision n + 1.
export const sponsorChallengeRevisions = pgTable("sponsor_challenge_revisions", {
  id: uuid("id").primaryKey(),
  challengeId: uuid("challenge_id").notNull().references(() => sponsorChallenges.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull(),
  transcript: text("transcript").notNull(),
  requirements: jsonb("requirements").$type<Requirement[]>().notNull(),
  rubric: jsonb("rubric").$type<Rubric | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("sponsor_challenge_revision").on(t.challengeId, t.revision), check("sponsor_challenge_revision_positive", sql`${t.revision} > 0`)]);

// One row per idempotency key: the reservation and, once complete, the immutable result. Results are written only
// while the row is still pending and unexpired, so a deleted or expired reservation is never brought back.
export const sponsorChallengeAssessments = pgTable("sponsor_challenge_assessments", {
  id: uuid("id").primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  challengeId: uuid("challenge_id").notNull().references(() => sponsorChallenges.id, { onDelete: "cascade" }),
  revisionId: uuid("revision_id").notNull().references(() => sponsorChallengeRevisions.id, { onDelete: "cascade" }),
  versionId: uuid("version_id").notNull().references(() => ideaVersions.id, { onDelete: "cascade" }),
  idempotencyKey: text("idempotency_key").notNull(),
  inputHash: text("input_hash").notNull(),
  evidence: jsonb("evidence").$type<Assessment["evidence"]>().notNull(),
  status: text("status").notNull(),
  data: jsonb("data").$type<Assessment>(),
  error: text("error"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("sponsor_challenge_assessment_key").on(t.workspaceId, t.idempotencyKey),
  check("sponsor_challenge_assessment_status", sql`${t.status} in ('pending', 'complete', 'failed', 'expired')`),
  index("sponsor_challenge_assessments_challenge").on(t.challengeId, t.createdAt),
]);
