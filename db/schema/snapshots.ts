import { pgTable, uuid, jsonb, timestamp } from "drizzle-orm/pg-core";
import { workspaces } from "./workspace";
import type { SnapshotData } from "../../lib/snapshots/contract";
export const snapshots = pgTable("snapshots", {
  id: uuid("id").primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  data: jsonb("data").$type<SnapshotData>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
