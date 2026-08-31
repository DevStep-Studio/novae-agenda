import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, employees, users } from "@/db/schema";

export type Role = "owner" | "admin" | "employee";

export type SessionUser = {
  userId: string;
  companyId: string;
  locationId: string | null;
  role: Role;
  name: string;
  employeeId: string | null;
};

const SESSION_COOKIE = "agenda_session";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-insecure-secret-change-me";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

const secretKey = new TextEncoder().encode(SESSION_SECRET);

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });
}

function formatTime(value: string): string {
  return value.length === 8 ? value.slice(0, 5) : value;
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey);
    const userId = payload.sub;
    if (!userId) return null;

    const [user] = await db
      .select({
        id: users.id,
        companyId: users.companyId,
        role: users.role,
        name: users.name,
        active: users.active,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || !user.active) return null;

    const company = await db
      .select({
        id: companies.id,
        timezone: companies.timezone,
        currency: companies.currency,
        name: companies.name,
        businessType: companies.businessType,
        primaryColor: companies.primaryColor,
        secondaryColor: companies.secondaryColor,
        onboarded: companies.onboarded,
        phone: companies.phone,
        whatsapp: companies.whatsapp,
        email: companies.email,
      })
      .from(companies)
      .where(eq(companies.id, user.companyId))
      .limit(1);

    let employeeId: string | null = null;
    const [employee] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.userId, userId))
      .limit(1);
    if (employee) employeeId = employee.id;

    return {
      userId: user.id,
      companyId: user.companyId,
      locationId: null,
      role: (user.role as Role) ?? "employee",
      name: user.name,
      employeeId,
    };
  } catch {
    return null;
  }
}

export type AuthContext = {
  user: SessionUser;
  companyTimezone: string;
  currency: string;
};

export async function requireAuth(): Promise<AuthContext | null> {
  const user = await getSession();
  if (!user) return null;

  const [company] = await db
    .select({ timezone: companies.timezone, currency: companies.currency })
    .from(companies)
    .where(eq(companies.id, user.companyId))
    .limit(1);

  return {
    user,
    companyTimezone: company?.timezone ?? "America/Sao_Paulo",
    currency: company?.currency ?? "BRL",
  };
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: "Sua sessão expirou. Entre novamente." }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

export function forbidden() {
  return new Response(JSON.stringify({ error: "Você não tem permissão para realizar essa ação." }), {
    status: 403,
    headers: { "content-type": "application/json" },
  });
}

export { formatTime as normalizeTimeString };
