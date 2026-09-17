import { and, eq, gte, isNull, lt, ne, or } from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  companies,
  employeeSchedules,
  employees,
  locations,
  scheduleBlocks,
} from "@/db/schema";
import { dayOfWeek, minutesToTime, timeToMinutes } from "@/lib/domain";
import {
  localDate,
  localInstant,
  localTime,
  shiftDate,
} from "@/lib/booking/time";
import { getCompanySettings } from "@/lib/settings";
export type DbExecutor = Pick<
  typeof db,
  "select" | "insert" | "update" | "delete" | "execute"
>;
export type Interval = { start: number; end: number };
export type AvailabilityParams = {
  companyId: string;
  employeeId: string;
  date: string;
  durationMinutes: number;
  timezone: string;
  locationId?: string;
  excludeAppointmentId?: string;
  excludeBookingId?: string;
  bufferMinutes?: number;
  executor?: DbExecutor;
};
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const merged: Interval[] = [];
  for (const current of [...intervals].sort((a, b) => a.start - b.start)) {
    const last = merged.at(-1);
    if (last && current.start <= last.end)
      last.end = Math.max(last.end, current.end);
    else merged.push({ ...current });
  }
  return merged;
}
export function subtractIntervals(
  working: Interval[],
  busy: Interval[],
): Interval[] {
  let free = working;
  for (const b of busy)
    free = free.flatMap((w) =>
      b.end <= w.start || b.start >= w.end
        ? [w]
        : [
            ...(b.start > w.start ? [{ start: w.start, end: b.start }] : []),
            ...(b.end < w.end ? [{ start: b.end, end: w.end }] : []),
          ],
    );
  return free;
}
export function scheduleWindows(
  rows: Array<{
    startTime: string;
    endTime: string;
    breakStart: string | null;
    breakEnd: string | null;
  }>,
) {
  return mergeIntervals(
    rows.flatMap((s) =>
      subtractIntervals(
        [{ start: timeToMinutes(s.startTime), end: timeToMinutes(s.endTime) }],
        s.breakStart && s.breakEnd
          ? [
              {
                start: timeToMinutes(s.breakStart),
                end: timeToMinutes(s.breakEnd),
              },
            ]
          : [],
      ),
    ),
  );
}
export function blockIntervals(
  rows: Array<{ startsAt: Date; endsAt: Date }>,
  date: string,
  timezone: string,
): Interval[] {
  const start = localInstant(date, "00:00", timezone),
    end = localInstant(shiftDate(date, 1), "00:00", timezone);
  return rows
    .filter((b) => b.startsAt < end && b.endsAt > start)
    .map((b) => ({
      start:
        b.startsAt <= start
          ? 0
          : timeToMinutes(localTime(b.startsAt, timezone)),
      end:
        b.endsAt >= end ? 1440 : timeToMinutes(localTime(b.endsAt, timezone)),
    }));
}
export async function getEmployeeDayWindows(
  employeeId: string,
  date: string,
  timezone: string,
  executor: DbExecutor = db,
  locationId?: string,
) {
  const allRows = await executor
    .select()
    .from(employeeSchedules)
    .where(
      and(
        eq(employeeSchedules.employeeId, employeeId),
        eq(employeeSchedules.active, true),
        locationId
          ? or(
              eq(employeeSchedules.locationId, locationId),
              isNull(employeeSchedules.locationId),
            )
          : undefined,
      ),
    );
  if (allRows.length === 0) {
    return { hasSchedule: false, hasCustomConfig: false, windows: [] };
  }
  const targetDay = dayOfWeek(date, timezone);
  const dayRows = allRows.filter((s) => s.dayOfWeek === targetDay);
  return {
    hasSchedule: dayRows.length > 0,
    hasCustomConfig: true,
    windows: scheduleWindows(dayRows),
  };
}
export async function getAppointmentBusyIntervals(
  companyId: string,
  employeeId: string,
  date: string,
  options: {
    excludeAppointmentId?: string;
    excludeBookingId?: string;
    bufferMinutes?: number;
    executor?: DbExecutor;
  } = {},
) {
  const rows = await (options.executor ?? db)
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.companyId, companyId),
        eq(appointments.employeeId, employeeId),
        eq(appointments.appointmentDate, date),
        ne(appointments.status, "cancelled"),
        ne(appointments.status, "no_show"),
        options.excludeAppointmentId
          ? ne(appointments.id, options.excludeAppointmentId)
          : undefined,
        options.excludeBookingId
          ? or(
              isNull(appointments.bookingId),
              ne(appointments.bookingId, options.excludeBookingId),
            )
          : undefined,
      ),
    );
  return rows.map((a) => ({
    start: timeToMinutes(a.startTime),
    end:
      timeToMinutes(a.endTime) +
      Math.max(a.bufferMinutes, options.bufferMinutes ?? 0),
  }));
}
export async function getBlockBusyIntervals(
  companyId: string,
  employeeId: string,
  date: string,
  timezone?: string,
  executor: DbExecutor = db,
  locationId?: string,
) {
  const tz =
    timezone ??
    (
      await executor
        .select({ timezone: companies.timezone })
        .from(companies)
        .where(eq(companies.id, companyId))
    )[0]?.timezone ??
    "America/Sao_Paulo";
  const rows = await executor
    .select()
    .from(scheduleBlocks)
    .where(
      and(
        eq(scheduleBlocks.companyId, companyId),
        or(
          eq(scheduleBlocks.employeeId, employeeId),
          isNull(scheduleBlocks.employeeId),
        ),
        locationId
          ? or(
              eq(scheduleBlocks.locationId, locationId),
              isNull(scheduleBlocks.locationId),
            )
          : undefined,
        lt(
          scheduleBlocks.startsAt,
          localInstant(shiftDate(date, 1), "00:00", tz),
        ),
        gte(scheduleBlocks.endsAt, localInstant(date, "00:00", tz)),
      ),
    );
  return blockIntervals(rows, date, tz);
}
export async function getAvailabilitySlotGaps(
  params: AvailabilityParams,
): Promise<Interval[]> {
  const {
    companyId,
    employeeId,
    date,
    timezone,
    executor = db,
    locationId,
  } = params;
  const settings = await getCompanySettings(companyId, executor);
  const today = localDate(new Date(), timezone);
  if (
    date < today ||
    date > shiftDate(today, settings.maxLeadDays) ||
    !settings.workingDays.includes(dayOfWeek(date, timezone))
  )
    return [];
  const [employee] = await executor
    .select()
    .from(employees)
    .where(
      and(
        eq(employees.id, employeeId),
        eq(employees.companyId, companyId),
        eq(employees.active, true),
      ),
    );
  if (!employee) return [];
  const { hasSchedule, hasCustomConfig, windows } =
    await getEmployeeDayWindows(
      employeeId,
      date,
      timezone,
      executor,
      locationId,
    );
  let open = timeToMinutes(settings.openTime),
    close = timeToMinutes(settings.closeTime);
  const targetLocation = locationId ?? employee.locationId;
  if (targetLocation) {
    const [loc] = await executor
      .select()
      .from(locations)
      .where(
        and(
          eq(locations.id, targetLocation),
          eq(locations.companyId, companyId),
          eq(locations.active, true),
        ),
      );
    if (!loc) return [];
    open = Math.max(open, timeToMinutes(loc.openTime));
    close = Math.min(close, timeToMinutes(loc.closeTime));
  }
  const rawWindows = hasCustomConfig
    ? (hasSchedule ? windows : [])
    : [{ start: open, end: close }];
  const working = rawWindows
    .map((w) => ({
      start: Math.max(w.start, open),
      end: Math.min(w.end, close),
    }))
    .filter((w) => w.end > w.start);
  const busy = [
    ...(await getAppointmentBusyIntervals(companyId, employeeId, date, params)),
    ...(await getBlockBusyIntervals(
      companyId,
      employeeId,
      date,
      timezone,
      executor,
      locationId,
    )),
  ];
  return subtractIntervals(working, busy);
}
export async function getAvailabilitySlots(
  params: AvailabilityParams,
  stepMinutes = 30,
) {
  if (!Number.isInteger(stepMinutes) || stepMinutes < 1)
    throw new Error("Intervalo inválido.");

  if (!params.employeeId) {
    const activeEmployees = await (params.executor ?? db)
      .select({ id: employees.id })
      .from(employees)
      .where(
        and(
          eq(employees.companyId, params.companyId),
          eq(employees.active, true),
          params.locationId ? eq(employees.locationId, params.locationId) : undefined,
        ),
      );

    const slotMap = new Map<string, { startTime: string; endTime: string }>();
    for (const emp of activeEmployees) {
      const empSlots = await getAvailabilitySlots(
        { ...params, employeeId: emp.id },
        stepMinutes,
      );
      for (const slot of empSlots) {
        if (!slotMap.has(slot.startTime)) {
          slotMap.set(slot.startTime, slot);
        }
      }
    }
    return Array.from(slotMap.values()).sort((a, b) =>
      a.startTime.localeCompare(b.startTime),
    );
  }

  const gaps = await getAvailabilitySlotGaps(params),
    slots: Array<{ startTime: string; endTime: string }> = [];
  for (const gap of gaps)
    for (
      let cursor = Math.ceil(gap.start / stepMinutes) * stepMinutes;
      cursor + params.durationMinutes + (params.bufferMinutes ?? 0) <= gap.end;
      cursor += stepMinutes
    ) {
      const startTime = minutesToTime(cursor);
      if (localInstant(params.date, startTime, params.timezone) > new Date())
        slots.push({
          startTime,
          endTime: minutesToTime(cursor + params.durationMinutes),
        });
    }
  return slots;
}
export type BookableCheck =
  { ok: true } | { ok: false; status: number; error: string };
export async function assertBookable(
  params: AvailabilityParams & { startMinutes: number; endMinutes: number },
): Promise<BookableCheck> {
  const {
    startMinutes,
    endMinutes,
    date,
    timezone,
    employeeId,
    companyId,
    executor = db,
  } = params;
  if (
    endMinutes <= startMinutes ||
    endMinutes >= 1440 ||
    localInstant(date, minutesToTime(startMinutes), timezone) <= new Date()
  )
    return {
      ok: false,
      status: 400,
      error: "Data ou horário inválido ou no passado.",
    };
  const { hasSchedule, windows } = await getEmployeeDayWindows(
    employeeId,
    date,
    timezone,
    executor,
    params.locationId,
  );
  if (!hasSchedule)
    return {
      ok: false,
      status: 422,
      error: "O profissional não atende nesse dia.",
    };
  if (!windows.some((w) => startMinutes >= w.start && endMinutes <= w.end))
    return {
      ok: false,
      status: 422,
      error: "Esse horário está fora da jornada do profissional.",
    };
  const buffer = params.bufferMinutes ?? 0;
  const blocks = await getBlockBusyIntervals(
    companyId,
    employeeId,
    date,
    timezone,
    executor,
    params.locationId,
  );
  if (blocks.some((b) => startMinutes < b.end && endMinutes + buffer > b.start))
    return {
      ok: false,
      status: 422,
      error: "Há um bloqueio na agenda do profissional nesse horário.",
    };
  const busy = await getAppointmentBusyIntervals(
    companyId,
    employeeId,
    date,
    params,
  );
  if (busy.some((b) => startMinutes < b.end && endMinutes + buffer > b.start))
    return {
      ok: false,
      status: 409,
      error: "Este profissional já possui um atendimento nesse horário.",
    };
  const gaps = await getAvailabilitySlotGaps(params);
  if (
    !gaps.some((w) => startMinutes >= w.start && endMinutes + buffer <= w.end)
  )
    return {
      ok: false,
      status: 422,
      error: "Esse horário está fora da jornada do profissional.",
    };
  return { ok: true };
}
