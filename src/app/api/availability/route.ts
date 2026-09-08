import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { employees, employeeServices, services } from "@/db/schema";
import { getAvailabilitySlots } from "@/lib/availability";
import { requireAuth, unauthorized } from "@/lib/auth";
import { isUuid, isValidDateKey } from "@/lib/domain";
import { getCompanySettings } from "@/lib/settings";
import { bookingError, BookingError } from "@/lib/booking/errors";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (!auth) return unauthorized();
    const q = new URL(request.url).searchParams,
      employeeId = q.get("employeeId") ?? "",
      date = q.get("date") ?? "",
      locationId = q.get("locationId") || undefined;
    if (
      !isUuid(employeeId) ||
      !isValidDateKey(date) ||
      (locationId && !isUuid(locationId))
    )
      throw new BookingError("Profissional, data ou unidade inválida.");
    if (auth.user.role === "employee" && auth.user.employeeId !== employeeId)
      return unauthorized();
    const [employee] = await db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.id, employeeId),
          eq(employees.companyId, auth.user.companyId),
          eq(employees.active, true),
        ),
      );
    if (!employee) throw new BookingError("Profissional não encontrado.", 404);
    const settings = await getCompanySettings(auth.user.companyId);
    let durationMinutes = Number(q.get("duration")),
      bufferMinutes = settings.bufferMinutes;
    const ids = (q.get("serviceIds") ?? q.get("serviceId") ?? "")
      .split(",")
      .filter(Boolean);
    if (ids.length) {
      if (
        ids.length > 8 ||
        ids.some((id) => !isUuid(id)) ||
        new Set(ids).size !== ids.length
      )
        throw new BookingError("Serviços inválidos.");
      const rows = await db
        .select()
        .from(services)
        .where(
          and(
            eq(services.companyId, auth.user.companyId),
            eq(services.active, true),
            inArray(services.id, ids),
          ),
        );
      const links = await db
        .select()
        .from(employeeServices)
        .where(eq(employeeServices.employeeId, employeeId));
      if (
        rows.length !== ids.length ||
        ids.some((id) => !links.some((l) => l.serviceId === id))
      )
        throw new BookingError(
          "Este profissional não realiza todos os serviços.",
        );
      const ordered = ids.map((id) => rows.find((s) => s.id === id)!);
      durationMinutes = ordered.reduce(
        (sum, s, i) =>
          sum +
          s.durationMinutes +
          (i < ordered.length - 1
            ? Math.max(settings.bufferMinutes, s.bufferMinutes)
            : 0),
        0,
      );
      bufferMinutes = Math.max(
        settings.bufferMinutes,
        ordered.at(-1)!.bufferMinutes,
      );
    }
    // Legacy callers may request duration-only previews. All writes still recalculate from service IDs.
    if (
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 1 ||
      durationMinutes > 1440
    )
      throw new BookingError("Duração inválida.");
    const slots = await getAvailabilitySlots(
      {
        companyId: auth.user.companyId,
        employeeId,
        date,
        durationMinutes,
        timezone: auth.companyTimezone,
        bufferMinutes,
        locationId,
      },
      settings.slotIntervalMinutes,
    );
    return Response.json(
      { data: { date, employeeId, durationMinutes, slots } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return bookingError(error);
  }
}
