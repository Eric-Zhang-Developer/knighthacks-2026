import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { reserveVoiceToken } from "@/lib/voice/rate-limit";

// Opt in against a dedicated test branch, never the application's default DB.
test.skipIf(process.env.VOICE_DB_TEST !== "1")("durable reservations serialize concurrent callers, expire, isolate sessions and cascade", async () => {
  if (!process.env.TEST_DATABASE_URL || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
    throw new Error("Voice persistence validation requires the dedicated TEST_DATABASE_URL");
  }
  const workspace = randomUUID();
  const member = randomUUID();
  const teammate = randomUUID();
  try {
    await db().execute(sql`insert into workspaces(id, member_count) values (${workspace}::uuid, 2)`);
    await db().execute(sql`insert into members(id, workspace_id, seat, session_hash) values
      (${member}::uuid, ${workspace}::uuid, 1, ${randomUUID()}),
      (${teammate}::uuid, ${workspace}::uuid, 2, ${randomUUID()})`);
    const reservations = await Promise.all(Array.from({ length: 20 }, () => reserveVoiceToken(member)));
    expect(reservations.filter(Boolean)).toHaveLength(10);
    expect(await reserveVoiceToken(member)).toBe(false);
    expect(await reserveVoiceToken(teammate)).toBe(true);
    const stored = await db().execute(sql`select attempts from voice_token_limits where member_id = ${member}::uuid`);
    expect(stored.rows[0].attempts).toBe(10);
    await db().execute(sql`update voice_token_limits set window_started_at = now() - interval '61 seconds' where member_id = ${member}::uuid`);
    const nextWindow = await Promise.all(Array.from({ length: 20 }, () => reserveVoiceToken(member)));
    expect(nextWindow.filter(Boolean)).toHaveLength(10);
  } finally {
    await db().execute(sql`delete from workspaces where id = ${workspace}::uuid`);
  }
  const remaining = await db().execute(sql`select member_id from voice_token_limits where member_id in (${member}::uuid, ${teammate}::uuid)`);
  expect(remaining.rows).toHaveLength(0);
}, 30000);
