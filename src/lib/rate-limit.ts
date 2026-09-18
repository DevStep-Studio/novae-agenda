import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { authRateLimits } from "@/db/schema";

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
 * Safe to call from multiple instances — uses Drizzle queries portable to MySQL.
 */
export async function consumeRateLimit(bucket: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const now = Date.now();

  const [existing] = await db
    .select({ id: authRateLimits.id, blockedUntil: authRateLimits.blockedUntil, hits: authRateLimits.hits, windowStartedAt: authRateLimits.windowStartedAt })
    .from(authRateLimits)
    .where(eq(authRateLimits.bucket, bucket))
    .limit(1);

  const blockedUntil = existing?.blockedUntil ? new Date(existing.blockedUntil).getTime() : 0;
  if (blockedUntil > now) {
    return { ok: false, retryAfterSeconds: Math.ceil((blockedUntil - now) / 1000) };
  }

  const windowThreshold = new Date(now - rule.windowMs);

  if (!existing) {
    try {
      await db.insert(authRateLimits).values({
        id: crypto.randomUUID(),
        bucket,
        hits: 1,
        windowStartedAt: new Date(),
        blockedUntil: null,
      });
      return { ok: true, retryAfterSeconds: 0 };
    } catch (err: any) {
      const isDup =
        err?.code === "ER_DUP_ENTRY" ||
        err?.errno === 1062 ||
        err?.cause?.code === "ER_DUP_ENTRY" ||
        err?.cause?.errno === 1062 ||
        String(err?.message || "").includes("ER_DUP_ENTRY");
      if (isDup) {
        await db
          .update(authRateLimits)
          .set({ hits: sql`${authRateLimits.hits} + 1` })
          .where(eq(authRateLimits.bucket, bucket));
        return { ok: true, retryAfterSeconds: 0 };
      }
      throw err;
    }
  }

  if (new Date(existing.windowStartedAt) < windowThreshold) {
    await db
      .update(authRateLimits)
      .set({ hits: 1, windowStartedAt: new Date(), blockedUntil: null })
      .where(eq(authRateLimits.id, existing.id));
    return { ok: true, retryAfterSeconds: 0 };
  }

  const newHits = existing.hits + 1;
  if (newHits > rule.limit) {
    const blockUntil = new Date(now + rule.blockMs);
    await db
      .update(authRateLimits)
      .set({ hits: newHits, blockedUntil: blockUntil })
      .where(eq(authRateLimits.id, existing.id));
    return { ok: false, retryAfterSeconds: Math.ceil(rule.blockMs / 1000) };
  }

  await db
    .update(authRateLimits)
    .set({ hits: newHits, blockedUntil: null })
    .where(eq(authRateLimits.id, existing.id));

  return { ok: true, retryAfterSeconds: 0 };
}

/** Clear a bucket after a successful, legitimate action (e.g. correct login). */
export async function clearRateLimit(bucket: string): Promise<void> {
  await db.delete(authRateLimits).where(eq(authRateLimits.bucket, bucket));
}

export function tooManyRequests(retryAfterSeconds: number): Response {
  return new Response(
    JSON.stringify({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }),
    { status: 429, headers: { "content-type": "application/json", "retry-after": String(retryAfterSeconds) } },
  );
}
