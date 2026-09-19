import { api } from "./api-client";

export type WaitlistEntryDTO = {
  id: string;
  companyId: string;
  userId: string;
  requestedDate: string;
  locationId?: string | null;
  employeeId?: string | null;
  period: "any" | "morning" | "afternoon" | "evening";
  serviceIds: string[];
  status: "waiting" | "notified" | "booked" | "cancelled";
  createdAt: string;
  clientName: string;
  clientPhone: string | null;
  available?: { startTime: string; employeeId: string } | null;
  serviceNames?: string[];
};

export async function getCompanyWaitlist() {
  return api<WaitlistEntryDTO[]>("/api/waitlist");
}
