import { pgTable, uuid, text, integer, timestamp, foreignKey, unique, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { challengeRounds } from "./challenge";
// One ten-minute experiment per challenged assumption (a challenge round whose outcome is `test`).
export const experiments = pgTable("experiments", {
  id: uuid("id").primaryKey(),
  sessionId: uuid("session_id").notNull(),
  round: integer("round").notNull(),
  hypothesis: text("hypothesis").notNull(),
  procedure: text("procedure").notNull(),
  observable: text("observable").notNull(),
  result: text("result"), // null until the user records one: "not run"
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.sessionId, t.round], foreignColumns: [challengeRounds.sessionId, challengeRounds.round] }).onDelete("cascade"),
  unique("experiment_per_assumption").on(t.sessionId, t.round),
  check("experiment_result", sql`${t.result} is null or ${t.result} in ('confirmed', 'refuted', 'inconclusive')`),
]);
