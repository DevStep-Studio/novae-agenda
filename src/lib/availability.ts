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

export async function getAvailabilitySlotGaps(params: AvailabilityParams): Promise<Interval[]> {
  const { companyId, employeeId, date, durationMinutes, timezone, excludeAppointmentId } = params;
  const dow = dayOfWeek(date, timezone);

  const [schedule] = await db
    .select()
    .from(employeeSchedules)
    .where(and(eq(employeeSchedules.employeeId, employeeId), eq(employeeSchedules.dayOfWeek, dow), eq(employeeSchedules.active, true)))
    .limit(1);

  if (!schedule) return [];

  const working: Interval[] = [];
  const start = timeToMinutes(normalizeTime(schedule.startTime));
  const end = timeToMinutes(normalizeTime(schedule.endTime));
  if (end <= start) return [];

  if (schedule.breakStart && schedule.breakEnd) {
    const breakStart = timeToMinutes(normalizeTime(schedule.breakStart));
    const breakEnd = timeToMinutes(normalizeTime(schedule.breakEnd));
    if (breakStart > start) working.push({ start, end: breakStart });
    if (breakEnd < end) working.push({ start: breakEnd, end });
  } else {
    working.push({ start, end });
  }

  const busy: Interval[] = [];

  const existingAppointments = await db
    .select({ startTime: appointments.startTime, endTime: appointments.endTime })
    .from(appointments)
    .where(
      and(
        eq(appointments.employeeId, employeeId),
        eq(appointments.appointmentDate, date),
        ne(appointments.status, "cancelled"),
        ne(appointments.status, "no_show"),
        excludeAppointmentId ? ne(appointments.id, excludeAppointmentId) : undefined,
      ),
    );

  for (const apt of existingAppointments) {
    busy.push({ start: timeToMinutes(normalizeTime(apt.startTime)), end: timeToMinutes(normalizeTime(apt.endTime)) });
  }

  const blocks = await db
    .select({ startsAt: scheduleBlocks.startsAt, endsAt: scheduleBlocks.endsAt, allDay: scheduleBlocks.allDay })
    .from(scheduleBlocks)
    .where(and(eq(scheduleBlocks.employeeId, employeeId), eq(scheduleBlocks.companyId, companyId)));

  const startOfDay = new Date(`${date}T00:00:00Z`);
  const endOfDay = new Date(`${date}T23:59:59Z`);

  for (const block of blocks as BlockRow[]) {
    if (block.allDay) {
      busy.push({ start: 0, end: 24 * 60 });
      continue;
    }
    const blockStart = block.startsAt;
    const blockEnd = block.endsAt;
    const startsBeforeEnd = blockStart < endOfDay;
    const endsAfterStart = blockEnd > startOfDay;
    if (!startsBeforeEnd || !endsAfterStart) continue;
    const s = Math.max(blockStart.getTime(), startOfDay.getTime());
    const e = Math.min(blockEnd.getTime(), endOfDay.getTime());
    busy.push({ start: (s - startOfDay.getTime()) / 60000, end: (e - startOfDay.getTime()) / 60000 });
  }

  const free = subtractIntervals(mergeIntervals(working), busy);
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
