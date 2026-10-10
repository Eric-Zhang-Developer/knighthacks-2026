import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { workspaces, members } from "./workspace";
import { ideaVersions } from "./ideas";

// One vote per member. Votes are never deleted, so a workspace is revealed for good once both members have one.
export const votes = pgTable("votes", {
  memberId: uuid("member_id").primaryKey().references(() => members.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  versionId: uuid("version_id").notNull().references(() => ideaVersions.id, { onDelete: "cascade" }),
  concern: text("concern"),
  changedAfterReveal: boolean("changed_after_reveal").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
