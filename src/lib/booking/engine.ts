import { and, eq, gte, inArray, isNull, lte, ne, or } from "drizzle-orm";
import { db } from "@/db";
import {
  appointmentServices,
  appointments,
  companies,
  employeeLocations,
  employeeSchedules,
  employees,
  employeeServices,
  locations,
  scheduleBlocks,
  services,
} from "@/db/schema";
import {
  blockIntervals,
  scheduleWindows,
  subtractIntervals,
  type DbExecutor,
  type Interval,
} from "@/lib/availability";
import { getCompanySettings } from "@/lib/settings";
import { dayOfWeek, minutesToTime, timeToMinutes } from "@/lib/domain";
import { BookingError } from "./errors";
import { localDate, localInstant, shiftDate } from "./time";
import type { Selection } from "./validation";
async function readQueries<T extends readonly (() => PromiseLike<unknown>)[]>(
  queries: T,
  sequential: boolean,
): Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
  if (!sequential)
    return Promise.all(queries.map((q) => q())) as Promise<{
      [K in keyof T]: Awaited<ReturnType<T[K]>>;
    }>;
  const rows = [];
  for (const query of queries) rows.push(await query());
  return rows as { [K in keyof T]: Awaited<ReturnType<T[K]>> };
}
export type PlannedItem = {
  serviceId: string;
  employeeId: string;
  name: string;
  employeeName: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  bufferMinutes: number;
  price: string;
  commissionType: string;
  commissionValue: string;
};
export type AvailableSlot = {
  startTime: string;
  endTime: string;
  items: PlannedItem[];
};
export async function loadAvailability(
  company: typeof companies.$inferSelect,
  locationId: string | undefined | null,
  selection: Selection,
  from: string,
  to: string,
  executor: DbExecutor = db,
  excludeBookingId?: string,
) {
  const settings = await getCompanySettings(company.id, executor);
  let location: typeof locations.$inferSelect | undefined;
  if (locationId) {
    const [found] = await executor
      .select()
      .from(locations)
      .where(
        and(
          eq(locations.id, locationId),
          eq(locations.companyId, company.id),
          eq(locations.active, true),
        ),
      );
    if (!found) throw new BookingError("Unidade não encontrada.", 404);
    location = found;
  } else {
    const [first] = await executor
      .select()
      .from(locations)
      .where(
        and(
          eq(locations.companyId, company.id),
          eq(locations.active, true),
        ),
      )
      .limit(1);
    location = first;
  }
  if (!location) {
    location = {
      id: "default",
      companyId: company.id,
      name: "Unidade Principal",
      address: company.address || "Endereço Principal",
      phone: company.phone || null,
      openTime: "08:00:00",
      closeTime: "19:00:00",
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  const effectiveLocationId = location.id;
  const defs = await executor
    .select()
    .from(services)
    .where(
      and(
        eq(services.companyId, company.id),
        inArray(
          services.id,
          selection.map((i) => i.serviceId),
        ),
        eq(services.active, true),
      ),
    );
  if (defs.length !== selection.length)
    throw new BookingError("Um dos serviços não está mais disponível.");
  if (defs.some((s) => s.paymentType !== "PAY_LATER"))
    throw new BookingError(
      "Este serviço exige pagamento online, ainda indisponível.",
      422,
    );
  if (excludeBookingId) {
    const snapshots = await executor
      .select({
        serviceId: appointmentServices.serviceId,
        duration: appointmentServices.durationMinutes,
        price: appointmentServices.price,
        buffer: appointments.bufferMinutes,
      })
      .from(appointments)
      .innerJoin(
        appointmentServices,
        eq(appointmentServices.appointmentId, appointments.id),
      )
      .where(
        and(
          eq(appointments.bookingId, excludeBookingId),
          eq(appointments.companyId, company.id),
        ),
      );
    for (const service of defs) {
      const snapshot = snapshots.find((s) => s.serviceId === service.id);
      if (snapshot) {
        service.durationMinutes = snapshot.duration;
        service.price = snapshot.price;
        service.bufferMinutes = snapshot.buffer;
      }
    }
  }
  const team = await executor
    .select()
    .from(employees)
    .where(
      and(eq(employees.companyId, company.id), eq(employees.active, true)),
    );
  const empIds = team.map((e) => e.id);
  const [links, unitLinks, schedules, busy, blocks] = empIds.length
    ? await readQueries(
        [
          () =>
            executor
              .select()
              .from(employeeServices)
              .where(
                and(
                  inArray(employeeServices.employeeId, empIds),
                  inArray(
                    employeeServices.serviceId,
                    defs.map((s) => s.id),
                  ),
                ),
              ),
          () =>
            executor
              .select()
              .from(employeeLocations)
              .where(
                and(
                  inArray(employeeLocations.employeeId, empIds),
                  eq(employeeLocations.locationId, effectiveLocationId),
                ),
              ),
          () =>
            executor
              .select()
              .from(employeeSchedules)
              .where(
                and(
                  inArray(employeeSchedules.employeeId, empIds),
                  eq(employeeSchedules.active, true),
                  or(
                    eq(employeeSchedules.locationId, effectiveLocationId),
                    isNull(employeeSchedules.locationId),
                  ),
                ),
              ),
          () => {
            const query = executor
              .select()
              .from(appointments)
              .where(
                and(
                  eq(appointments.companyId, company.id),
                  gte(appointments.appointmentDate, from),
                  lte(appointments.appointmentDate, to),
                  ne(appointments.status, "cancelled"),
                  ne(appointments.status, "no_show"),
                  excludeBookingId
                    ? or(
                        isNull(appointments.bookingId),
                        ne(appointments.bookingId, excludeBookingId),
                      )
                    : undefined,
                ),
              );
            return executor !== db ? query.for("update") : query;
          },
          () =>
            executor
              .select()
              .from(scheduleBlocks)
              .where(
                and(
                  eq(scheduleBlocks.companyId, company.id),
                  lte(
                    scheduleBlocks.startsAt,
                    localInstant(shiftDate(to, 1), "00:00", company.timezone),
                  ),
                  gte(
                    scheduleBlocks.endsAt,
                    localInstant(from, "00:00", company.timezone),
                  ),
                  or(
                    isNull(scheduleBlocks.locationId),
                    eq(scheduleBlocks.locationId, effectiveLocationId),
                  ),
                ),
              ),
        ] as const,
        executor !== db,
      )
    : [[], [], [], [], []];
  const ordered = selection.map((item) => {
    const service = defs.find((s) => s.id === item.serviceId)!;
    const hasServiceLinks = links.some((l) => l.serviceId === service.id);
    const candidates = team.filter(
      (e) =>
        (!item.employeeId || e.id === item.employeeId) &&
        (!e.locationId ||
          e.locationId === effectiveLocationId ||
          unitLinks.some(
            (l) =>
              l.employeeId === e.id && l.locationId === effectiveLocationId,
          )) &&
        (!hasServiceLinks ||
          links.some((l) => l.employeeId === e.id && l.serviceId === service.id)),
    );
    if (!candidates.length) {
      if (item.employeeId) {
        throw new BookingError(
          "Nenhum profissional disponível para este serviço.",
          422,
        );
      }
      throw new BookingError(
        `Nenhum profissional disponível para ${service.name} nesta unidade.`,
        422,
      );
    }
    return { service, candidates };
  });
  const today = localDate(new Date(), company.timezone),
    lastDate = shiftDate(today, settings.maxLeadDays);
  const open = Math.max(
      timeToMinutes(settings.openTime),
      timeToMinutes(location.openTime),
    ),
    close = Math.min(
      timeToMinutes(settings.closeTime),
      timeToMinutes(location.closeTime),
    );
  function slots(date: string): AvailableSlot[] {
    if (
      date < today ||
      date > lastDate ||
      !settings.workingDays.includes(dayOfWeek(date, company.timezone))
    )
      return [];

    if (settings.dailyBookingLimit > 0) {
      const busyForDay = busy.filter((a) => a.appointmentDate === date);
      if (busyForDay.length >= settings.dailyBookingLimit) return [];
    }

    const gaps = new Map<string, Interval[]>();
    for (const e of team) {
      const work = scheduleWindows(
        schedules.filter(
          (s) =>
            s.employeeId === e.id &&
            s.dayOfWeek === dayOfWeek(date, company.timezone),
        ),
      )
        .map((w) => ({
          start: Math.max(w.start, open),
          end: Math.min(w.end, close),
        }))
        .filter((w) => w.end > w.start);
      const taken = busy
        .filter((a) => a.employeeId === e.id && a.appointmentDate === date)
        .map((a) => ({
          start: timeToMinutes(a.startTime),
          end:
            timeToMinutes(a.endTime) +
            Math.max(a.bufferMinutes, settings.bufferMinutes),
        }));
      taken.push(
        ...blockIntervals(
          blocks.filter((b) => !b.employeeId || b.employeeId === e.id),
          date,
          company.timezone,
        ),
      );
      gaps.set(e.id, subtractIntervals(work, taken));
    }
    const result: AvailableSlot[] = [];
    const step = Math.max(1, settings.slotIntervalMinutes);
    const minLeadMs = (settings.minLeadMinutes ?? 0) * 60 * 1000;
    const now = Date.now();

    for (
      let start = Math.ceil(open / step) * step;
      start < close;
      start += step
    ) {
      let instant: Date;
      try {
        instant = localInstant(date, minutesToTime(start), company.timezone);
      } catch {
        continue;
      }
      if (instant.getTime() - now < minLeadMs) continue;
      let cursor = start;
      const items: PlannedItem[] = [];
      for (const { service, candidates } of ordered) {
        const end = cursor + service.durationMinutes,
          buffer = Math.max(settings.bufferMinutes, service.bufferMinutes);
        const emp = candidates.find((e) =>
          gaps
            .get(e.id)
            ?.some((w) => cursor >= w.start && end + buffer <= w.end),
        );
        if (!emp || end >= 1440) break;
        const link = links.find(
          (l) => l.employeeId === emp.id && l.serviceId === service.id,
        );
        items.push({
          serviceId: service.id,
          employeeId: emp.id,
          name: service.name,
          employeeName: emp.name,
          startTime: minutesToTime(cursor),
          endTime: minutesToTime(end),
          durationMinutes: service.durationMinutes,
          bufferMinutes: buffer,
          price: service.price,
          commissionType: link?.commissionType ?? emp.commissionType,
          commissionValue: link?.commissionValue ?? emp.commissionValue,
        });
        cursor = end + buffer;
      }
      if (items.length === ordered.length)
        result.push({
          startTime: minutesToTime(start),
          endTime: items.at(-1)!.endTime,
          items,
        });
    }
    return result;
  }
  return { slots, settings, location };
}
