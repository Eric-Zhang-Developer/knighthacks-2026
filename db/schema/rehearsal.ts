import { pgTable, uuid, jsonb, text, timestamp, unique } from "drizzle-orm/pg-core";
import { ideaVersions } from "./ideas";

// One rehearsal per version and built list (a hash of the sorted list): generated on the first POST, then only read.
export const rehearsals = pgTable("rehearsals", {
  id: uuid("id").primaryKey().defaultRandom(),
  versionId: uuid("version_id").notNull().references(() => ideaVersions.id, { onDelete: "cascade" }),
  builtHash: text("built_hash").notNull(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("rehearsals_version_built").on(t.versionId, t.builtHash)]);
