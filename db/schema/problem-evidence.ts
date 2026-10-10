import { pgTable, uuid, jsonb, timestamp } from "drizzle-orm/pg-core";
import { ideaVersions } from "./ideas";
export const problemEvidence = pgTable("problem_evidence", {
  versionId: uuid("version_id").primaryKey().references(() => ideaVersions.id, { onDelete: "cascade" }),
  grounding: jsonb("grounding").notNull(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
