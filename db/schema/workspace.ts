import { sql } from "drizzle-orm";
import { pgTable, uuid, text, integer, timestamp, unique, check } from "drizzle-orm/pg-core";
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey(),
  memberCount: integer("member_count").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [check("workspace_member_cap", sql`${t.memberCount} between 1 and 2`)]);
export const members = pgTable("members", {
  id: uuid("id").primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  seat: integer("seat").notNull(),
  sessionHash: text("session_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("workspace_member_seat").on(t.workspaceId, t.seat), check("member_seat_range", sql`${t.seat} in (1, 2)`)]);
export const invites = pgTable("invites", {
  tokenHash: text("token_hash").primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});
