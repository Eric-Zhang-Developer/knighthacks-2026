import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const TOKEN_LIMIT = 10;
export const TOKEN_WINDOW_SECONDS = 60;

export async function reserveVoiceToken(memberId: string): Promise<boolean> {
  // The member's unique row serializes concurrent serverless requests. PostgreSQL
  // rechecks the WHERE condition after the conflicting writer releases its lock.
  // Use the database clock, never a caller-supplied time or an in-process counter.
  const result = await db().execute(sql`
    insert into voice_token_limits(member_id, window_started_at, attempts)
    values (${memberId}::uuid, statement_timestamp(), 1)
    on conflict (member_id) do update set
      window_started_at = case
        when voice_token_limits.window_started_at <= statement_timestamp() - interval '60 seconds'
        then statement_timestamp() else voice_token_limits.window_started_at end,
      attempts = case
        when voice_token_limits.window_started_at <= statement_timestamp() - interval '60 seconds'
        then 1 else voice_token_limits.attempts + 1 end
    where voice_token_limits.window_started_at <= statement_timestamp() - interval '60 seconds'
       or voice_token_limits.attempts < ${TOKEN_LIMIT}
    returning member_id
  `);
  return result.rows.length === 1;
}
