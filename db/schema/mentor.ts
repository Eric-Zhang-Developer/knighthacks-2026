import { sql } from "drizzle-orm";
import { pgTable, uuid, jsonb, timestamp, check } from "drizzle-orm/pg-core";
import { workspaces, members } from "./workspace";

// One workspace row serializes issuance across every server instance. Expired events are pruned on issuance.
export const mentorBudgets = pgTable("mentor_budgets", {
  workspaceId: uuid("workspace_id").primaryKey().references(() => workspaces.id, { onDelete: "cascade" }),
  events: jsonb("events").notNull().default([]),
}, (t) => [check("mentor_budget_bound", sql`jsonb_typeof(${t.events}) = 'array' and jsonb_array_length(${t.events}) <= 12 and octet_length(${t.events}::text) <= 4096`)]);

export const mentorSessions = pgTable("mentor_sessions", {
  id: uuid("id").primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  memberId: uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  calls: jsonb("calls").notNull().default({}),
  sourceIds: jsonb("source_ids").notNull().default([]),
}, (t) => [
  check("mentor_session_duration", sql`${t.expiresAt} > ${t.createdAt} and ${t.expiresAt} <= ${t.createdAt} + interval '20 minutes'`),
  check("mentor_calls_bound", sql`jsonb_typeof(${t.calls}) = 'object' and octet_length(${t.calls}::text) <= 6291456`),
  check("mentor_sources_bound", sql`jsonb_typeof(${t.sourceIds}) = 'array' and jsonb_array_length(${t.sourceIds}) <= 200 and octet_length(${t.sourceIds}::text) <= 10000`),
]);
