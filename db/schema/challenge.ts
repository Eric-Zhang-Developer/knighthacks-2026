import { pgTable, uuid, text, integer, timestamp, jsonb, primaryKey, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { ideaVersions } from "./ideas";
import type { Claim } from "../../lib/ai/claims";
export const challengeSessions = pgTable("challenge_sessions", {
  id: uuid("id").primaryKey(),
  versionId: uuid("version_id").notNull().references(() => ideaVersions.id, { onDelete: "cascade" }),
  perspective: text("perspective").notNull(),
  roundCount: integer("round_count").notNull().default(0),
  state: text("state").notNull().default("idle"),
  operationId: uuid("operation_id"), busyUntil: timestamp("busy_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [check("challenge_round_cap", sql`${t.roundCount} between 0 and 3`),
  check("challenge_perspective", sql`${t.perspective} in ('user', 'judge', 'engineer')`),
  check("challenge_state", sql`${t.state} in ('idle', 'generating', 'awaiting', 'answering')`)]);
export const challengeRounds = pgTable("challenge_rounds", {
  sessionId: uuid("session_id").notNull().references(() => challengeSessions.id, { onDelete: "cascade" }),
  round: integer("round").notNull(), status: text("status").notNull(),
  question: text("question"), assumption: text("assumption"), source: jsonb("source").$type<Claim>(),
  answer: text("answer"), outcome: text("outcome"),
}, (t) => [primaryKey({ columns: [t.sessionId, t.round] }), check("challenge_slot", sql`${t.round} between 1 and 3`)]);
