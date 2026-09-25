import { api, clearSession } from "./api-client";

/**
 * Thin wrappers around the real Reservei auth endpoints (src/app/api/auth/*,
 * src/app/api/customer-access/* in the root project). No new backend routes —
 * this file only calls what already exists.
 */

// Mirrors src/shared/types.ts in the root project (Role, SessionInfo, Company,
// LocationDTO, CompanyMembershipDTO) verbatim — keep in sync if that file changes.
export type Role = "owner" | "admin" | "manager" | "employee" | "client" | "superadmin";

export type CompanyMembershipDTO = {
  id: string;
  companyId: string;
  companyName: string;
  role: Role;
  isPrimary?: boolean;
};

export type DashboardPreferences = {
  showBanner?: boolean;
  showChecklist?: boolean;
  showKpis?: boolean;
  showSubmetrics?: boolean;
  showNextAppointment?: boolean;
  showDaySummary?: boolean;
  showQuickSlots?: boolean;
  showTodayAppointments?: boolean;
  order?: string[];
};

export type Company = {
  id: string;
  name: string;
  businessType: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  instagram: string | null;
  website: string | null;
  timezone: string;
  currency: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  publicSlug?: string | null;
  slug?: string | null;
  dashboardPreferences?: DashboardPreferences;
  onboarded: boolean;
};

export type LocationDTO = {
  id: string;
  companyId: string;
  name: string;
  address: string | null;
  phone: string | null;
  openTime: string;
  closeTime: string;
  active: boolean;
};

export type TargetPortal = "/minhas-reservas" | "/cliente" | "/gestao" | "/profissional" | "/admin";

export type SessionInfo = {
  userId: string;
  companyId: string;
  role: Role;
  primaryRole?: Role;
  targetPortal?: TargetPortal;
  name: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  photoUrl?: string | null;
  bannerUrl?: string | null;
  emailVerified: boolean;
  isSuperadmin: boolean;
  createdAt: string;
  employeeId: string | null;
  memberships?: CompanyMembershipDTO[];
  company: Company;
  locations: LocationDTO[];
};

export interface StaffLoginResult {
  userId: string;
  name: string;
  role: Role;
  targetPortal: TargetPortal;
}

export async function loginStaff(email: string, password: string) {
  return api<StaffLoginResult>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function registerStaff(input: {
  name: string;
  email: string;
  password: string;
  confirmPassword?: string;
  accountType?: string;
}) {
  return api<{ ok: boolean }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      accountType: input.accountType || "professional",
    }),
  });
}

export async function requestPasswordReset(email: string) {
  return api<{ success: boolean; message: string }>("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

/** GET /api/auth/session — returns null (not a 401) when logged out. */
export async function getStaffSession() {

  return api<SessionInfo | null>("/api/auth/session");
}

export async function logout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } finally {
    await clearSession();
  }
}

// ---------------------------------------------------------------------------
// Customer PIN flow (src/lib/customer-access/service.ts on the backend)
// ---------------------------------------------------------------------------

export type PhoneCheckStatus = "HAS_PIN" | "NEEDS_PIN_SETUP" | "NOT_FOUND";

export async function checkCustomerPhone(phone: string) {
  return api<{
    exists: boolean;
    status: PhoneCheckStatus;
    maskedPhone: string;
    hasEmail: boolean;
    emailHint?: string;
  }>("/api/customer-access/check-phone", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export async function identifyCustomer(input: {
  name: string;
  phone: string;
  email: string;
  photoUrl?: string;
}) {
  return api<{ hasPin: boolean; userId?: string }>("/api/customer-access/identify", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function setupCustomerPin(input: {
  pin: string;
  confirmPin: string;
  phone?: string;
  customerId?: string;
}) {
  return api<{ ok: true }>("/api/customer-access/pin/setup", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface CustomerLoginResult {
  userId: string;
  customer: { id: string; name: string; phone: string; role: string; hasPin: boolean };
  targetPortal: string;
}

export async function loginCustomerWithPin(pin: string, phone?: string) {
  return api<CustomerLoginResult>("/api/customer-access/pin/login", {
    method: "POST",
    body: JSON.stringify({ pin, phone }),
  });
}

export async function requestCustomerPinReset(phone: string) {
  return api<{
    success: boolean;
    message: string;
    channel: "email" | "whatsapp" | "console";
    destination: string;
  }>("/api/customer-access/pin/reset/request", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export async function confirmCustomerPinReset(input: {
  phone: string;
  otp: string;
  newPin: string;
  confirmNewPin: string;
}) {
  return api<{
    userId: string;
    customer: { id: string; name: string; phone: string; role: string };
    targetPortal: string;
    message: string;
  }>("/api/customer-access/pin/reset/confirm", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface CustomerSession {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  photoUrl: string | null;
  emailVerified: boolean;
  hasPin: boolean;
}

/** GET /api/my/session — returns null (not a 401) when logged out. */
export async function getCustomerSession() {
  return api<CustomerSession | null>("/api/my/session");
}

