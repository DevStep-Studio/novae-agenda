import { timingSafeEqual } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession } from "@/lib/auth";
import { AUTH_RULES, clearRateLimit, consumeRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

export const dynamic = "force-dynamic";

const schema = z.object({
  password: z.string().min(1, "Informe a senha de administrador."),
});

// Fallback used only when ADMIN_PASSWORD isn't set in the environment.
// Set ADMIN_PASSWORD in production to override this.
const DEFAULT_ADMIN_PASSWORD = "Reservei2026";

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still run a comparison so failure timing doesn't leak the expected length.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export async function POST(request: Request) {
  const adminPassword = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const ipBucket = `admin-login:ip:${clientIp(request)}`;
  const limit = await consumeRateLimit(ipBucket, AUTH_RULES.login);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const valid = timingSafeStringEqual(parsed.data.password, adminPassword);
  if (!valid) {
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
  }

  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.isSuperadmin, true), eq(users.active, true)))
    .orderBy(asc(users.createdAt))
    .limit(1);

  if (!admin) {
    return NextResponse.json({ error: "Nenhuma conta de Super Admin ativa foi encontrada." }, { status: 503 });
  }

  await clearRateLimit(ipBucket);
  await createSession(admin.id);
  return NextResponse.json({ data: { userId: admin.id } });
}
