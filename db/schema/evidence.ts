import { pgTable, uuid, text, jsonb, primaryKey, timestamp } from "drizzle-orm/pg-core";
import { ideaVersions } from "./ideas";
import type { Claim } from "../../lib/ai/claims";
// Snapshot source fields: corpus replacement must not rewrite existing evidence.
export const evidenceCards = pgTable("evidence_cards", {
  versionId: uuid("version_id").notNull().references(() => ideaVersions.id, { onDelete: "cascade" }),
  projectId: text("project_id").notNull(),
  url: text("url").notNull(), title: text("title").notNull(), excerpt: text("excerpt").notNull(),
  overlaps: jsonb("overlaps").$type<Claim[]>().notNull(),
  differences: jsonb("differences").$type<Claim[]>().notNull(),
  uncertainty: jsonb("uncertainty").$type<Claim>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.versionId, t.projectId] })]);
