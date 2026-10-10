import { pgTable, uuid, jsonb, timestamp } from "drizzle-orm/pg-core";
import { ideaVersions } from "./ideas";
import type { Combinations, Source } from "../../lib/combinations/contract";
export const combinations = pgTable("combinations", {
  versionId: uuid("version_id").primaryKey().references(() => ideaVersions.id, { onDelete: "cascade" }),
  data: jsonb("data").$type<Combinations>().notNull(),
  sourceExcerpts: jsonb("source_excerpts").$type<Source[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
