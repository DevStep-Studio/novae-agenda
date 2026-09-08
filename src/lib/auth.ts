import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, employees, users } from "@/db/schema";

export type Role = "owner" | "admin" | "manager" | "employee";

/** Higher number = more privilege. Used for hierarchical permission checks. */
export const ROLE_RANK: Record<Role, number> = { owner: 4, admin: 3, manager: 2, employee: 1 };

export function isRole(value: string): value is Role {
  return value === "owner" || value === "admin" || value === "manager" || value === "employee";
}

export function hasMinRole(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export type SessionUser = {
  userId: string;
  companyId: string;
  locationId: string | null;
  role: Role;
  isSuperadmin: boolean;
  name: string;
  email: string;
  emailVerified: boolean;
  employeeId: string | null;
};

const SESSION_COOKIE = "agenda_session";
const isProd = process.env.NODE_ENV === "production";
const rawSecret = process.env.SESSION_SECRET;
if (isProd && (!rawSecret || rawSecret.length < 16)) {
  throw new Error("SESSION_SECRET must be set to a strong value in production");
}
const SESSION_SECRET = rawSecret ?? "dev-insecure-secret-change-me";
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

/** Shared identity for staff and customers; the same signed session cookie is used. */
export async function getIdentity() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
    return user?.active ? user : null;
  } catch { return null; }
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const user = await getIdentity();
    if (!user || !user.companyId || !isRole(user.role)) return null;
    const userId = user.id;
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
      role: isRole(user.role) ? user.role : "employee",
      isSuperadmin: Boolean(user.isSuperadmin),
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
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

export function forbidden(message = "Você não tem permissão para realizar essa ação.") {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Route guard: returns an { auth } context when the session meets `minRole`,
 * or a ready-to-return Response (401/403) otherwise.
 *
 *   const gate = await requireRole("manager");
 *   if (gate.response) return gate.response;
 *   const { auth } = gate;
 */
export async function requireRole(
  minRole: Role,
): Promise<{ auth: AuthContext; response: null } | { auth: null; response: Response }> {
  const auth = await requireAuth();
  if (!auth) return { auth: null, response: unauthorized() };
  if (!hasMinRole(auth.user.role, minRole)) return { auth: null, response: forbidden() };
  return { auth, response: null };
}

export async function requireSuperadmin(): Promise<{ auth: AuthContext; response: null } | { auth: null; response: Response }> {
  const auth = await requireAuth();
  if (!auth) return { auth: null, response: unauthorized() };
  if (!auth.user.isSuperadmin) return { auth: null, response: forbidden("Acesso restrito ao Superadmin da plataforma.") };
  return { auth, response: null };
}

export { formatTime as normalizeTimeString };
