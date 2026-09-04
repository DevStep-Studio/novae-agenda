import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { appointments, employeeSchedules, scheduleBlocks } from "@/db/schema";
import { addMinutesToTime, dayOfWeek, minutesToTime, normalizeTime, timeToMinutes } from "@/lib/domain";

export type Interval = { start: number; end: number };

type BlockRow = { startsAt: Date; endsAt: Date; allDay: boolean };

export type AvailabilityParams = {
  companyId: string;
  employeeId: string;
  date: string;
  durationMinutes: number;
  timezone: string;
  excludeAppointmentId?: string;
  /** Minimum gap (minutes) kept before and after every existing appointment. */
  bufferMinutes?: number;
};

function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const current = sorted[i];
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }
  return merged;
}

function subtractIntervals(working: Interval[], busy: Interval[]): Interval[] {
  for (const block of busy) {
    const next: Interval[] = [];
    for (const window of working) {
      if (block.end <= window.start || block.start >= window.end) {
        next.push(window);
        continue;
      }
      if (block.start > window.start) next.push({ start: window.start, end: block.start });
      if (block.end < window.end) next.push({ start: block.end, end: window.end });
    }
    working = next;
  }
  return working;
}

/** The professional's working windows for the given weekday (schedule minus lunch break). */
export async function getEmployeeDayWindows(
  employeeId: string,
  date: string,
  timezone: string,
): Promise<{ hasSchedule: boolean; windows: Interval[] }> {
  const dow = dayOfWeek(date, timezone);
  const [schedule] = await db
    .select()
    .from(employeeSchedules)
    .where(and(eq(employeeSchedules.employeeId, employeeId), eq(employeeSchedules.dayOfWeek, dow), eq(employeeSchedules.active, true)))
    .limit(1);

  if (!schedule) return { hasSchedule: false, windows: [] };

  const start = timeToMinutes(normalizeTime(schedule.startTime));
  const end = timeToMinutes(normalizeTime(schedule.endTime));
  if (end <= start) return { hasSchedule: true, windows: [] };

  const windows: Interval[] = [];
  if (schedule.breakStart && schedule.breakEnd) {
    const breakStart = timeToMinutes(normalizeTime(schedule.breakStart));
    const breakEnd = timeToMinutes(normalizeTime(schedule.breakEnd));
    if (breakStart > start) windows.push({ start, end: Math.min(breakStart, end) });
    if (breakEnd < end) windows.push({ start: Math.max(breakEnd, start), end });
  } else {
    windows.push({ start, end });
  }
  return { hasSchedule: true, windows };
}

/** Busy intervals from other appointments on that day, optionally padded by a buffer. */
export async function getAppointmentBusyIntervals(
  companyId: string,
  employeeId: string,
  date: string,
  options: { excludeAppointmentId?: string; bufferMinutes?: number } = {},
): Promise<Interval[]> {
  const buffer = Math.max(0, options.bufferMinutes ?? 0);
  const rows = await db
    .select({ startTime: appointments.startTime, endTime: appointments.endTime })
    .from(appointments)
    .where(
      and(
        eq(appointments.employeeId, employeeId),
        eq(appointments.appointmentDate, date),
        ne(appointments.status, "cancelled"),
        ne(appointments.status, "no_show"),
        options.excludeAppointmentId ? ne(appointments.id, options.excludeAppointmentId) : undefined,
      ),
    );

  return rows.map((apt) => ({
    start: timeToMinutes(normalizeTime(apt.startTime)) - buffer,
    end: timeToMinutes(normalizeTime(apt.endTime)) + buffer,
  }));
}

/** Busy intervals from schedule blocks (day-off, holidays, custom blocks) on that day. */
export async function getBlockBusyIntervals(companyId: string, employeeId: string, date: string): Promise<Interval[]> {
  const blocks = (await db
    .select({ startsAt: scheduleBlocks.startsAt, endsAt: scheduleBlocks.endsAt, allDay: scheduleBlocks.allDay })
    .from(scheduleBlocks)
    .where(and(eq(scheduleBlocks.employeeId, employeeId), eq(scheduleBlocks.companyId, companyId)))) as BlockRow[];

  const startOfDay = new Date(`${date}T00:00:00Z`);
  const endOfDay = new Date(`${date}T23:59:59Z`);
  const busy: Interval[] = [];

  for (const block of blocks) {
    if (block.allDay) {
      busy.push({ start: 0, end: 24 * 60 });
      continue;
    }
    if (block.startsAt >= endOfDay || block.endsAt <= startOfDay) continue;
    const s = Math.max(block.startsAt.getTime(), startOfDay.getTime());
    const e = Math.min(block.endsAt.getTime(), endOfDay.getTime());
    busy.push({ start: (s - startOfDay.getTime()) / 60000, end: (e - startOfDay.getTime()) / 60000 });
  }
  return busy;
}

export async function getAvailabilitySlotGaps(params: AvailabilityParams): Promise<Interval[]> {
  const { companyId, employeeId, date, durationMinutes, timezone, excludeAppointmentId, bufferMinutes } = params;

  const { windows } = await getEmployeeDayWindows(employeeId, date, timezone);
  if (windows.length === 0) return [];

  const busy = [
    ...(await getAppointmentBusyIntervals(companyId, employeeId, date, { excludeAppointmentId, bufferMinutes })),
    ...(await getBlockBusyIntervals(companyId, employeeId, date)),
  ];

  const free = subtractIntervals(mergeIntervals(windows), busy);
  return free.filter((window) => window.end - window.start >= durationMinutes);
}

export async function getAvailabilitySlots(
  params: AvailabilityParams,
  stepMinutes = 30,
): Promise<Array<{ startTime: string; endTime: string }>> {
  const gaps = await getAvailabilitySlotGaps(params);
  const slots: Array<{ startTime: string; endTime: string }> = [];
  for (const gap of gaps) {
    let cursor = gap.start;
    while (cursor + params.durationMinutes <= gap.end) {
      slots.push({ startTime: minutesToTime(cursor), endTime: addMinutesToTime(minutesToTime(cursor), params.durationMinutes) });
      cursor += stepMinutes;
    }
  }
  return slots;
}

export type BookableCheck =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * Server-side guard for creating/rescheduling an appointment. Confirms the requested
 * span fits the professional's working hours, does not fall inside a schedule block,
 * and does not overlap another appointment (respecting the configured buffer).
 */
export async function assertBookable(
  params: AvailabilityParams & { startMinutes: number; endMinutes: number },
): Promise<BookableCheck> {
  const { companyId, employeeId, date, timezone, startMinutes, endMinutes, excludeAppointmentId, bufferMinutes } = params;

  if (endMinutes <= startMinutes) {
    return { ok: false, status: 400, error: "Horário de término inválido." };
  }

  const { hasSchedule, windows } = await getEmployeeDayWindows(employeeId, date, timezone);
  if (!hasSchedule) {
    return { ok: false, status: 422, error: "O profissional não atende nesse dia." };
  }
  const insideWorkingHours = windows.some((w) => startMinutes >= w.start && endMinutes <= w.end);
  if (!insideWorkingHours) {
    return { ok: false, status: 422, error: "Esse horário está fora da jornada do profissional." };
  }

  const blocks = await getBlockBusyIntervals(companyId, employeeId, date);
  if (blocks.some((b) => startMinutes < b.end && endMinutes > b.start)) {
    return { ok: false, status: 422, error: "Há um bloqueio na agenda do profissional nesse horário." };
  }

  const busy = await getAppointmentBusyIntervals(companyId, employeeId, date, { excludeAppointmentId, bufferMinutes });
  if (busy.some((b) => startMinutes < b.end && endMinutes > b.start)) {
    return { ok: false, status: 409, error: "Este profissional já possui um atendimento nesse horário." };
  }

  return { ok: true };
}
