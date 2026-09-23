import { api } from "./api-client";

export type CommissionType = "none" | "percentage" | "fixed";

export type EmployeeScheduleDTO = {
  id?: string;
  employeeId?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakStart?: string | null;
  breakEnd?: string | null;
  active: boolean;
};

// Mirrors EmployeeDTO in src/shared/types.ts (root project).
export type EmployeeDTO = {
  id: string;
  name: string;
  jobTitle: string | null;
  phone: string | null;
  email?: string | null;
  photoUrl?: string | null;
  bannerUrl?: string | null;
  active: boolean;
  commissionType: CommissionType;
  commissionValue: number;
  services: string[];
  serviceIds?: string[];
};

export async function getEmployees(): Promise<EmployeeDTO[]> {
  return api<EmployeeDTO[]>("/api/employees");
}

export async function createEmployee(data: {
  name: string;
  jobTitle?: string;
  phone?: string;
  email?: string;
  commissionType?: CommissionType;
  commissionValue?: number;
  serviceIds?: string[];
  active?: boolean;
}): Promise<{ id: string }> {
  return api<{ id: string }>("/api/employees", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateEmployee(
  id: string,
  data: Partial<{
    name: string;
    jobTitle: string | null;
    phone: string | null;
    email: string;
    commissionType: CommissionType;
    commissionValue: number;
    active: boolean;
    serviceIds: string[];
    photoUrl: string | null;
    bannerUrl: string | null;
  }>
): Promise<{ id: string }> {
  return api<{ id: string }>(`/api/employees/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteEmployee(id: string): Promise<void> {
  await api(`/api/employees/${id}`, {
    method: "DELETE",
  });
}

export async function getEmployeeSchedules(id: string): Promise<EmployeeScheduleDTO[]> {
  const res = await api<EmployeeScheduleDTO[] | { data: EmployeeScheduleDTO[] }>(`/api/employees/${id}/schedules`);
  if (Array.isArray(res)) return res;
  return (res as any)?.data ?? [];
}

export async function updateEmployeeSchedules(
  id: string,
  schedules: EmployeeScheduleDTO[]
): Promise<void> {
  await api(`/api/employees/${id}/schedules`, {
    method: "PUT",
    body: JSON.stringify({ schedules }),
  });
}

// BANNER_PRESETS[0].url in src/lib/theme-utils.ts (root project) — the same
// fallback the web falls back to when neither the employee nor the company
// has a cover image set.
export const DEFAULT_COVER_URL =
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80";

