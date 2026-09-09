import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, employees, users } from "@/db/schema";

export type Role = "superadmin" | "owner" | "admin" | "manager" | "employee" | "client";

/** Higher number = more privilege. Used for hierarchical permission checks. */
export const ROLE_RANK: Record<Role, number> = {
  superadmin: 5,
  owner: 4,
  admin: 3,
  manager: 2,
  employee: 1,
  client: 0,
};

export function isRole(value: string): value is Role {
  return (
    value === "superadmin" ||
    value === "owner" ||
    value === "admin" ||
    value === "manager" ||
    value === "employee" ||
    value === "client" ||
    value === "customer" // alias for client
  );
}

export function normalizeRole(roleStr: string): Role {
  if (roleStr === "customer") return "client";
  if (isRole(roleStr)) return roleStr as Role;
  return "client";
}

export function hasMinRole(role: Role, min: Role): boolean {
  return (ROLE_RANK[role] ?? 0) >= (ROLE_RANK[min] ?? 0);
}

export type TargetPortal = "/cliente" | "/gestao" | "/profissional" | "/admin";

export type SessionUser = {
  userId: string;
  companyId: string;
  locationId: string | null;
  role: Role;
  primaryRole: Role;
  targetPortal: TargetPortal;
  isSuperadmin: boolean;
  name: string;
  email: string;
  phone?: string | null;
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
    if (!user) return null;

    const normalizedRole = normalizeRole(user.role);
    const userId = user.id;

    let employeeId: string | null = null;
    const [employee] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.userId, userId))
      .limit(1);
    if (employee) employeeId = employee.id;

    // Resolve target portal based on authenticated roles
    let targetPortal: TargetPortal = "/cliente";
    let effectiveRole: Role = normalizedRole;

    if (user.isSuperadmin) {
      targetPortal = "/admin";
      effectiveRole = "superadmin";
    } else if (normalizedRole === "owner" || normalizedRole === "admin" || normalizedRole === "manager") {
      targetPortal = "/gestao";
    } else if (normalizedRole === "employee" || employeeId) {
      targetPortal = "/profissional";
      effectiveRole = "employee";
    } else {
      targetPortal = "/cliente";
      effectiveRole = "client";
    }

    return {
      userId: user.id,
      companyId: user.companyId ?? "",
      locationId: null,
      role: effectiveRole,
      primaryRole: effectiveRole,
      targetPortal,
      isSuperadmin: Boolean(user.isSuperadmin),
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
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

  let timezone = "America/Sao_Paulo";
  let currency = "BRL";

  if (user.companyId) {
    const [company] = await db
      .select({ timezone: companies.timezone, currency: companies.currency })
      .from(companies)
      .where(eq(companies.id, user.companyId))
      .limit(1);
    if (company) {
      timezone = company.timezone;
      currency = company.currency;
    }
  }

  return {
    user,
    companyTimezone: timezone,
    currency,
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
 */
export async function requireRole(
  minRole: Role,
): Promise<{ auth: AuthContext; response: null } | { auth: null; response: Response }> {
  const auth = await requireAuth();
  if (!auth) return { auth: null, response: unauthorized() };
  if (!hasMinRole(auth.user.role, minRole)) return { auth: null, response: forbidden() };
  if (!auth.user.companyId && minRole !== "client") {
    return { auth: null, response: forbidden("Nenhuma empresa associada a esta conta.") };
  }
  return { auth, response: null };
}

export async function requireEmployee(): Promise<{ auth: AuthContext; response: null } | { auth: null; response: Response }> {
  const auth = await requireAuth();
  if (!auth) return { auth: null, response: unauthorized() };
  if (!auth.user.employeeId && !hasMinRole(auth.user.role, "manager")) {
    return { auth: null, response: forbidden("Acesso restrito aos profissionais da equipe.") };
  }
  return { auth, response: null };
}

export async function requireClient(): Promise<{ auth: AuthContext; response: null } | { auth: null; response: Response }> {
  const auth = await requireAuth();
  if (!auth) return { auth: null, response: unauthorized() };
  return { auth, response: null };
}

export async function requireSuperadmin(): Promise<{ auth: AuthContext; response: null } | { auth: null; response: Response }> {
  const auth = await requireAuth();
  if (!auth) return { auth: null, response: unauthorized() };
  if (!auth.user.isSuperadmin) return { auth: null, response: forbidden("Acesso restrito ao Superadmin da plataforma.") };
  return { auth, response: null };
}

export { formatTime as normalizeTimeString };
