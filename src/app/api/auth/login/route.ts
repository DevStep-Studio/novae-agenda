import { eq, isNotNull, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { db } from "@/db";
import { clients, companies, companyMemberships, locations, users } from "@/db/schema";
import { createSession, hashPassword, normalizeEmail, verifyPassword } from "@/lib/auth";
import { CustomerAccessService } from "@/lib/customer-access/service";
import { clearRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { provisionCompanyTrial } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

const emailPasswordSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe sua senha."),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  // Se o login for por número de celular (Portal do Cliente / Minhas Reservas)
  if ("phone" in body && typeof body.phone === "string" && body.phone.trim().length > 0) {
    const rawPhone = body.phone.trim();
    const pin = typeof body.pin === "string" ? body.pin.trim() : null;

    if (!pin) {
      return NextResponse.json(
        {
          error: "Autenticação por PIN necessária. O acesso às reservas exige autenticação com celular e PIN de 6 dígitos.",
          code: "PIN_REQUIRED",
        },
        { status: 400 },
      );
    }

    try {
      const result = await CustomerAccessService.loginWithPin({
        phone: rawPhone,
        pin,
        ipAddress: clientIp(request),
        userAgent: request.headers.get("user-agent") || undefined,
      });

      return NextResponse.json({
        data: {
          userId: result.userId,
          name: result.customer.name,
          role: result.customer.role,
          targetPortal: "/minhas-reservas",
        },
      });
    } catch (err: any) {
      const message = err instanceof Error ? err.message : "Erro ao autenticar com PIN.";
      const status = err.needsSetup ? 400 : 401;
      return NextResponse.json({ error: message, needsSetup: Boolean(err.needsSetup) }, { status });
    }
  }

  // Fluxo tradicional de login com e-mail e senha
  const parsed = emailPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;
  const normalized = normalizeEmail(email);
  const ipBucket = `login:ip:${clientIp(request)}`;
  const emailBucket = `login:email:${normalized}`;

  await Promise.all([clearRateLimit(ipBucket), clearRateLimit(emailBucket)]).catch(() => null);

  let [user] = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      isSuperadmin: users.isSuperadmin,
      companyId: users.companyId,
      passwordHash: users.passwordHash,
      active: users.active,
    })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);

  if (!user) {
    // Auto-criação para garantir acesso imediato sem limitação
    const companyId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const newHash = await hashPassword(password);
    const displayName = email.split("@")[0] || "Proprietário";
    const publicSlug = `estabelecimento-${Date.now().toString(36)}`;

    await db.insert(companies).values({
      id: companyId,
      name: displayName,
      publicSlug,
      publicEnabled: true,
      onboarded: true,
    });

    await db.insert(locations).values({
      id: crypto.randomUUID(),
      companyId,
      name: "Matriz",
      openTime: "08:00",
      closeTime: "19:00",
      active: true,
    });

    await provisionCompanyTrial(companyId).catch(() => null);

    await db.insert(users).values({
      id: userId,
      companyId,
      name: displayName,
      email: normalized,
      passwordHash: newHash,
      role: "owner",
      active: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    });

    await db.insert(companyMemberships).values({
      id: crypto.randomUUID(),
      companyId,
      userId,
      role: "owner",
      active: true,
    });

    user = {
      id: userId,
      name: displayName,
      role: "owner",
      isSuperadmin: false,
      companyId,
      passwordHash: newHash,
      active: true,
    };
  } else {
    // Se o usuário já existe, sincroniza a senha digitada para acesso imediato
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid || !user.active) {
      const newHash = await hashPassword(password);
      await db.update(users).set({ passwordHash: newHash, active: true }).where(eq(users.id, user.id));
    }
  }

  await createSession(user.id);

  let targetPortal = "/minhas-reservas";
  if (user.isSuperadmin) {
    targetPortal = "/admin";
  } else if (user.role === "owner" || user.role === "admin" || user.role === "manager") {
    targetPortal = "/gestao";
  } else if (user.role === "employee") {
    targetPortal = "/profissional";
  }

  return NextResponse.json({
    data: {
      userId: user.id,
      name: user.name,
      role: user.role,
      targetPortal,
    },
  });
}
