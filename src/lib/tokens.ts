import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { authTokens } from "@/db/schema";

export type TokenKind = "email_verification" | "password_reset";

export const TOKEN_TTL_MS: Record<TokenKind, number> = {
  email_verification: 24 * 60 * 60_000, // 24h
  password_reset: 60 * 60_000, // 1h
};

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Issues a fresh one-time token, invalidating any previous unconsumed token of the
 * same kind for that user. Returns the RAW token — store only its hash, send only the raw.
 */
export async function issueToken(userId: string, kind: TokenKind): Promise<string> {
  await db
    .update(authTokens)
    .set({ consumedAt: new Date() })
    .where(and(eq(authTokens.userId, userId), eq(authTokens.kind, kind), isNull(authTokens.consumedAt)));

  const raw = randomBytes(32).toString("base64url");
  await db.insert(authTokens).values({
    userId,
    kind,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS[kind]),
  });

  return raw;
}

/**
 * Validates and consumes a token. Returns the owning userId, or null when the token
 * is unknown, of the wrong kind, already used, or expired.
 */
export async function consumeToken(raw: string, kind: TokenKind): Promise<{ userId: string } | null> {
  if (!raw || raw.length < 20) return null;

  const [row] = await db
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.tokenHash, hashToken(raw)), eq(authTokens.kind, kind)))
    .limit(1);

  if (!row || row.consumedAt || row.expiresAt.getTime() < Date.now()) return null;

  await db.update(authTokens).set({ consumedAt: new Date() }).where(eq(authTokens.id, row.id));
  return { userId: row.userId };
}
