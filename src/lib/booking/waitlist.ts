import { and, asc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { bookingWaitlist, companies, locations, users } from "@/db/schema";
import type { DbExecutor } from "@/lib/availability";
import { BookingError } from "./errors";
import { loadAvailability } from "./engine";
import { localDate } from "./time";

export function matchesPeriod(time: string, period: string) {
  const hour = Number(time.slice(0, 2));
  return period === "any" || (period === "morning" && hour < 12) || (period === "afternoon" && hour >= 12 && hour < 18) || (period === "evening" && hour >= 18);
}

export async function waitlistMatches(companyId: string, executor: DbExecutor = db, date?: string) {
  const [company] = await executor.select().from(companies).where(eq(companies.id, companyId));
  if (!company) return [];
  const rows = await executor.select({ entry: bookingWaitlist, clientName: users.name, clientPhone: users.phone }).from(bookingWaitlist).innerJoin(users, eq(bookingWaitlist.userId, users.id)).where(and(eq(bookingWaitlist.companyId, companyId), eq(bookingWaitlist.status, "waiting"), date ? eq(bookingWaitlist.requestedDate, date) : gte(bookingWaitlist.requestedDate, localDate(new Date(), company.timezone)))).orderBy(asc(bookingWaitlist.requestedDate), asc(bookingWaitlist.createdAt)).limit(30);
  const units = await executor.select().from(locations).where(and(eq(locations.companyId, companyId), eq(locations.active, true)));
  const result = [];
  for (const { entry, clientName, clientPhone } of rows) {
    const locationId = entry.locationId || units[0]?.id;
    let available: { startTime: string; employeeId: string } | null = null;
    let serviceNames: string[] = [];
    if (locationId) {
      try {
        const engine = await loadAvailability(company, locationId, entry.serviceIds.map(serviceId => ({ serviceId, employeeId: entry.employeeId })), entry.requestedDate, entry.requestedDate, executor);
        const slot = engine.slots(entry.requestedDate).find(s => matchesPeriod(s.startTime, entry.period));
        if (slot) { available = { startTime: slot.startTime, employeeId: slot.items[0].employeeId }; serviceNames = slot.items.map(i => i.name); }
      } catch (error) {
        // Removed services or professionals make an interest temporarily incompatible.
        if (!(error instanceof BookingError)) throw error;
      }
    }
    result.push({ ...entry, locationId, clientName, clientPhone, available, serviceNames });
  }
  return result;
}
