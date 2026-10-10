import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { snapshots } from "./snapshots";
export const shares = pgTable("shares", {
  tokenHash: text("token_hash").primaryKey(),
  snapshotId: uuid("snapshot_id").notNull().references(() => snapshots.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});
