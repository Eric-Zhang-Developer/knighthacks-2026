import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { ideaVersions } from "./ideas";

// A proposed change to one field of one version. Accepting it inserts a new idea_versions row and records that
// row here, so a retried accept returns the same version instead of a duplicate. Rejecting writes nothing.
export const revisionSuggestions = pgTable("revision_suggestions", {
  id: uuid("id").primaryKey(),
  versionId: uuid("version_id").notNull().references(() => ideaVersions.id, { onDelete: "cascade" }),
  field: text("field").$type<"audience" | "problem" | "workflow" | "constraints">().notNull(),
  change: text("change").notNull(), // the field's full replacement text
  reason: text("reason").notNull(),
  acceptedVersionId: uuid("accepted_version_id"), // set in the same statement that inserts that version
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
