import { pgTable, uuid, text, timestamp, unique, index, vector, real, type AnyPgColumn } from "drizzle-orm/pg-core";
import { workspaces } from "./workspace";

export const ideas = pgTable("ideas", {
  id: uuid("id").primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("ideas_workspace_idempotency").on(t.workspaceId, t.idempotencyKey)]);

// Application operations only INSERT versions. A revision must create a new row.
export const ideaVersions = pgTable("idea_versions", {
  id: uuid("id").primaryKey(),
  ideaId: uuid("idea_id").notNull().references(() => ideas.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id").references((): AnyPgColumn => ideaVersions.id),
  title: text("title"), description: text("description"), audience: text("audience"),
  problem: text("problem"), workflow: text("workflow"), constraints: text("constraints"),
  embedding: vector("embedding", { dimensions: 1024 }).notNull(),
  x: real("x").notNull(), y: real("y").notNull(), z: real("z").notNull(),
  neighborIds: text("neighbor_ids").array().notNull(),
  corpusVersion: text("corpus_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("idea_versions_latest").on(t.ideaId, t.createdAt)]);
