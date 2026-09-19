import { api } from "./api-client";

export type CompanyDTO = {
  id: string;
  name: string;
  businessType?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  instagram?: string | null;
  website?: string | null;
  timezone?: string;
  currency?: string;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  publicSlug?: string;
  onboarded?: boolean;
};

export type CompanySettingsDTO = {
  openTime: string;
  closeTime: string;
  workingDays: number[];
  slotIntervalMinutes: number;
  defaultDurationMinutes: number;
  bufferMinutes: number;
  maxLeadDays: number;
  minLeadMinutes: number;
  cancellationHours: number;
  rescheduleHours: number;
  dailyBookingLimit: number;
  allowHolidayBookings: boolean;
  timezone: string;
};

export async function getCompanyProfile() {
  return api<CompanyDTO>("/api/company");
}

export async function updateCompanyProfile(data: Partial<CompanyDTO>) {
  return api<{ ok: boolean }>("/api/company", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function getCompanySettings() {
  return api<CompanySettingsDTO>("/api/settings");
}

export async function updateCompanySettings(data: Partial<CompanySettingsDTO>) {
  return api<CompanySettingsDTO>("/api/settings", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
