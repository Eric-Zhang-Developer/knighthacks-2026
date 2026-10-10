import { pgTable, uuid, jsonb, timestamp } from "drizzle-orm/pg-core";
import { ideaVersions } from "./ideas";

// One research result per version: searched on the first POST, then only read (no outside call).
export const research = pgTable("research", {
  versionId: uuid("version_id").primaryKey().references(() => ideaVersions.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
