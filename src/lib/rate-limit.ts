import { sql } from "drizzle-orm";
import { db } from "@/db";

export type RateLimitRule = {
  /** Max attempts allowed inside the window before the bucket is blocked. */
  limit: number;
  /** Rolling window length in milliseconds. */
  windowMs: number;
  /** How long to block once the limit is exceeded, in milliseconds. */
  blockMs: number;
};

export type RateLimitResult = {
  ok: boolean;
  /** Seconds the caller should wait before retrying (only when ok === false). */
  retryAfterSeconds: number;
};

export const AUTH_RULES = {
  login: { limit: 8, windowMs: 10 * 60_000, blockMs: 15 * 60_000 },
  register: { limit: 5, windowMs: 60 * 60_000, blockMs: 60 * 60_000 },
  // Requesting a reset e-mail: keep tight — one address should not be spammed.
  passwordReset: { limit: 5, windowMs: 60 * 60_000, blockMs: 60 * 60_000 },
  // Submitting the new password: more lenient so honest typos/retries don't lock the user out.
  passwordResetConfirm: { limit: 15, windowMs: 60 * 60_000, blockMs: 30 * 60_000 },
  emailVerify: { limit: 15, windowMs: 60 * 60_000, blockMs: 30 * 60_000 },
} as const satisfies Record<string, RateLimitRule>;

/**
 * Sliding-window rate limiter backed by the `auth_rate_limits` table.
 * Safe to call from multiple instances — the counter update is a single atomic upsert.
 */
export async function consumeRateLimit(bucket: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const now = Date.now();

  const existing = await db.execute<{ blocked_until: string | null }>(sql`
    SELECT blocked_until FROM auth_rate_limits WHERE bucket = ${bucket} LIMIT 1
  `);
  const blockedUntil = existing.rows[0]?.blocked_until ? new Date(existing.rows[0].blocked_until).getTime() : 0;
  if (blockedUntil > now) {
    return { ok: false, retryAfterSeconds: Math.ceil((blockedUntil - now) / 1000) };
  }

  const windowThreshold = new Date(now - rule.windowMs).toISOString();
  const updated = await db.execute<{ hits: number }>(sql`
    INSERT INTO auth_rate_limits (bucket, hits, window_started_at, blocked_until)
    VALUES (${bucket}, 1, now(), NULL)
    ON CONFLICT (bucket) DO UPDATE SET
      hits = CASE WHEN auth_rate_limits.window_started_at < ${windowThreshold} THEN 1 ELSE auth_rate_limits.hits + 1 END,
      window_started_at = CASE WHEN auth_rate_limits.window_started_at < ${windowThreshold} THEN now() ELSE auth_rate_limits.window_started_at END,
      blocked_until = NULL
    RETURNING hits
  `);

  const hits = Number(updated.rows[0]?.hits ?? 1);
  if (hits > rule.limit) {
    const blockUntilIso = new Date(now + rule.blockMs).toISOString();
    await db.execute(sql`UPDATE auth_rate_limits SET blocked_until = ${blockUntilIso} WHERE bucket = ${bucket}`);
    return { ok: false, retryAfterSeconds: Math.ceil(rule.blockMs / 1000) };
  }

  return { ok: true, retryAfterSeconds: 0 };
}

/** Clear a bucket after a successful, legitimate action (e.g. correct login). */
export async function clearRateLimit(bucket: string): Promise<void> {
  await db.execute(sql`DELETE FROM auth_rate_limits WHERE bucket = ${bucket}`);
}

export function tooManyRequests(retryAfterSeconds: number): Response {
  return new Response(
    JSON.stringify({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }),
    { status: 429, headers: { "content-type": "application/json", "retry-after": String(retryAfterSeconds) } },
  );
}
