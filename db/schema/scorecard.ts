import { pgTable, uuid, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { ideaVersions } from "./ideas";

// Insert-only: every POST adds a scorecard; GET reads the newest for the version.
export const scorecards = pgTable("scorecards", {
  id: uuid("id").primaryKey().defaultRandom(),
  versionId: uuid("version_id").notNull().references(() => ideaVersions.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("scorecards_version_created").on(t.versionId, t.createdAt)]);
