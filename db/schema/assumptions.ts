import { pgTable, uuid, jsonb, timestamp } from "drizzle-orm/pg-core";
import { ideaVersions } from "./ideas";
import type { Assumptions } from "../../lib/assumptions/contract";
// One list per version: a second POST returns this row without a model call.
export const assumptions = pgTable("assumptions", {
  versionId: uuid("version_id").primaryKey().references(() => ideaVersions.id, { onDelete: "cascade" }),
  data: jsonb("data").$type<Assumptions>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
