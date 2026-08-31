import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { companies, users } from "@/db/schema";
import { createSession, hashPassword, normalizeEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(2, "Informe seu nome.").max(120),
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(72),
  confirmPassword: z.string(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const { name, email, password, confirmPassword } = parsed.data;
  if (password !== confirmPassword) {
    return NextResponse.json({ error: "As senhas não coincidem." }, { status: 400 });
  }

  const normalizedEmail = normalizeEmail(email);
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (existing) {
    return NextResponse.json({ error: "Este e-mail já está em uso." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  const [company] = await db.insert(companies).values({ name: name.trim(), onboarded: false }).returning();
  const [user] = await db
    .insert(users)
    .values({ companyId: company.id, name: name.trim(), email: normalizedEmail, passwordHash, role: "owner", active: true })
    .returning();

  await createSession(user.id);

  return NextResponse.json({ data: { userId: user.id, onboarded: false } }, { status: 201 });
}
