import { pgTable, uuid, jsonb, timestamp } from "drizzle-orm/pg-core";
import { ideaVersions } from "./ideas";

// One judge moment per version: generated on the first POST, then only read.
export const moments = pgTable("moments", {
  versionId: uuid("version_id").primaryKey().references(() => ideaVersions.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
