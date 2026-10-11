import { sql } from "drizzle-orm";
import { check, integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { members } from "./workspace";

export const voiceTokenLimits = pgTable("voice_token_limits", {
  memberId: uuid("member_id").primaryKey().references(() => members.id, { onDelete: "cascade" }),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
  attempts: integer("attempts").notNull(),
}, (table) => [check("voice_token_attempts_range", sql`${table.attempts} between 1 and 10`)]);
