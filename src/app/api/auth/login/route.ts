import { eq, isNotNull, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { clients, users } from "@/db/schema";
import { createSession, hashPassword, normalizeEmail, verifyPassword } from "@/lib/auth";
import { AUTH_RULES, clearRateLimit, consumeRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

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
    const digits = rawPhone.replace(/\D/g, "");
    if (digits.length < 8) {
      return NextResponse.json(
        { error: "Informe um número de celular válido com DDD." },
        { status: 400 },
      );
    }

    const ipBucket = `login:ip:${clientIp(request)}`;
    const phoneBucket = `login:phone:${digits}`;

    for (const bucket of [ipBucket, phoneBucket]) {
      const limit = await consumeRateLimit(bucket, AUTH_RULES.login);
      if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);
    }

    // 1. Busca usuário existente com este telefone
    const allUsersWithPhone = await db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        phone: users.phone,
        isSuperadmin: users.isSuperadmin,
        active: users.active,
      })
      .from(users)
      .where(isNotNull(users.phone));

    let matchedUser = allUsersWithPhone.find((u) => {
      if (!u.phone) return false;
      const uDigits = u.phone.replace(/\D/g, "");
      return (
        uDigits === digits ||
        (digits.length >= 8 && uDigits.endsWith(digits.slice(-8))) ||
        (uDigits.length >= 8 && digits.endsWith(uDigits.slice(-8)))
      );
    });

    // 2. Se não encontrou em users, verifica na tabela de clients CRM vinculada a um userId
    if (!matchedUser) {
      const allClients = await db
        .select({
          id: clients.id,
          userId: clients.userId,
          phone: clients.phone,
        })
        .from(clients)
        .where(isNotNull(clients.userId));

      const matchedClient = allClients.find((c) => {
        if (!c.phone) return false;
        const cDigits = c.phone.replace(/\D/g, "");
        return (
          cDigits === digits ||
          (digits.length >= 8 && cDigits.endsWith(digits.slice(-8)))
        );
      });

      if (matchedClient?.userId) {
        const [foundUser] = await db
          .select({
            id: users.id,
            name: users.name,
            role: users.role,
            phone: users.phone,
            isSuperadmin: users.isSuperadmin,
            active: users.active,
          })
          .from(users)
          .where(eq(users.id, matchedClient.userId))
          .limit(1);

        if (foundUser) matchedUser = foundUser;
      }
    }

    // 3. Se ainda não existir usuário cadastrado com este telefone, provisiona conta de cliente
    if (!matchedUser) {
      const newUserId = crypto.randomUUID();
      const defaultEmail = `cliente-${digits}@novae.local`;
      const passwordHash = await hashPassword(crypto.randomUUID());
      const formattedPhone =
        digits.length === 11
          ? `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
          : rawPhone;

      await db.insert(users).values({
        id: newUserId,
        name: "Cliente",
        email: defaultEmail,
        phone: formattedPhone,
        passwordHash,
        role: "customer",
        active: true,
        emailVerified: true,
      });

      // Vincula quaisquer registros de CRM órfãos com este número
      const unassignedClients = await db
        .select({ id: clients.id, phone: clients.phone })
        .from(clients)
        .where(isNull(clients.userId));

      for (const unassigned of unassignedClients) {
        if (unassigned.phone?.replace(/\D/g, "") === digits) {
          await db
            .update(clients)
            .set({ userId: newUserId, updatedAt: new Date() })
            .where(eq(clients.id, unassigned.id));
        }
      }

      matchedUser = {
        id: newUserId,
        name: "Cliente",
        phone: formattedPhone,
        role: "customer",
        isSuperadmin: false,
        active: true,
      };
    }

    if (!matchedUser.active) {
      return NextResponse.json(
        { error: "Esta conta está desativada. Entre em contato com o suporte." },
        { status: 403 },
      );
    }

    await Promise.all([clearRateLimit(ipBucket), clearRateLimit(phoneBucket)]);
    await createSession(matchedUser.id);

    return NextResponse.json({
      data: {
        userId: matchedUser.id,
        name: matchedUser.name,
        role: matchedUser.role,
        targetPortal: "/cliente",
      },
    });
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

  for (const bucket of [ipBucket, emailBucket]) {
    const limit = await consumeRateLimit(bucket, AUTH_RULES.login);
    if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);
  }

  const [user] = await db
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

  const valid = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !valid || !user.active) {
    return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
  }

  await Promise.all([clearRateLimit(ipBucket), clearRateLimit(emailBucket)]);
  await createSession(user.id);

  let targetPortal = "/cliente";
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
