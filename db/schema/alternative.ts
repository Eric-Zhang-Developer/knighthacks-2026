import { pgTable, uuid, jsonb, text, timestamp } from "drizzle-orm/pg-core";
import { ideaVersions } from "./ideas";
import type { Alternative } from "../../lib/alternative/contract";
export const strongestAlternatives = pgTable("strongest_alternatives", {
  versionId: uuid("version_id").primaryKey().references(() => ideaVersions.id, { onDelete: "cascade" }),
  data: jsonb("data").$type<Alternative>().notNull(),
  sourceExcerpt: text("source_excerpt").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
