import { pgTable, uuid, jsonb, timestamp, text, primaryKey } from "drizzle-orm/pg-core";
import { ideaVersions } from "./ideas";
import type { Overlay } from "../../lib/rubric/contract";
export const rubricOverlays = pgTable("rubric_overlays", {
  versionId: uuid("version_id").primaryKey().references(() => ideaVersions.id, { onDelete: "cascade" }),
  data: jsonb("data").$type<Overlay>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const rubricProofs = pgTable("rubric_proofs", {
  versionId: uuid("version_id").notNull().references(() => rubricOverlays.versionId, { onDelete: "cascade" }),
  trackId: text("track_id").notNull(),
  proof: text("proof"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.versionId, table.trackId] })]);
