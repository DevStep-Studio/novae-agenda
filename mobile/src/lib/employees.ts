import { api } from "./api-client";

export type CommissionType = "none" | "percentage" | "fixed";

// Mirrors EmployeeDTO in src/shared/types.ts (root project).
export type EmployeeDTO = {
  id: string;
  name: string;
  jobTitle: string | null;
  phone: string | null;
  photoUrl?: string | null;
  bannerUrl?: string | null;
  active: boolean;
  commissionType: CommissionType;
  commissionValue: number;
  services: string[];
};

export async function getEmployees() {
  return api<EmployeeDTO[]>("/api/employees");
}

// BANNER_PRESETS[0].url in src/lib/theme-utils.ts (root project) — the same
// fallback the web falls back to when neither the employee nor the company
// has a cover image set.
export const DEFAULT_COVER_URL =
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80";
