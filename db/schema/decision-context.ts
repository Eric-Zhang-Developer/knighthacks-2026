import { pgTable, uuid, integer, jsonb, timestamp, unique, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspace";
import { ideaVersions } from "./ideas";

// Team fit (F15) and scope (F17): every write appends a revision; nothing is updated in place.
export const teamProfiles = pgTable("team_profiles", {
  id: uuid("id").primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull(),
  profile: jsonb("profile").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("team_profile_revision").on(t.workspaceId, t.revision), check("team_profile_revision_positive", sql`${t.revision} > 0`)]);

export const scopeRecommendations = pgTable("scope_recommendations", {
  id: uuid("id").primaryKey(),
  versionId: uuid("version_id").notNull().references(() => ideaVersions.id, { onDelete: "cascade" }),
  profileRevision: integer("profile_revision").notNull(), // 0: no profile saved, every field unknown
  profile: jsonb("profile"), // the exact profile it was assessed against; null at revision 0
  features: jsonb("features").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const scopeSelections = pgTable("scope_selections", {
  id: uuid("id").primaryKey(),
  versionId: uuid("version_id").notNull().references(() => ideaVersions.id, { onDelete: "cascade" }),
  recommendationId: uuid("recommendation_id").notNull().references(() => scopeRecommendations.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull(),
  choices: jsonb("choices").notNull(),
  demoSketch: jsonb("demo_sketch").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("scope_selection_revision").on(t.versionId, t.revision), check("scope_selection_revision_positive", sql`${t.revision} > 0`)]);
