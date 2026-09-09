import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companySettings } from "@/db/schema";

export type CompanySettings = {
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
};

export const DEFAULT_SETTINGS: CompanySettings = {
  openTime: "08:00",
  closeTime: "19:00",
  workingDays: [1, 2, 3, 4, 5, 6], // Seg a Sáb
  slotIntervalMinutes: 30,
  defaultDurationMinutes: 60,
  bufferMinutes: 0,
  maxLeadDays: 60,
  minLeadMinutes: 60,
  cancellationHours: 24,
  rescheduleHours: 12,
  dailyBookingLimit: 0,
  allowHolidayBookings: false,
};

const KEY_MAP: Record<keyof CompanySettings, string> = {
  openTime: "open_time",
  closeTime: "close_time",
  workingDays: "working_days",
  slotIntervalMinutes: "slot_interval_minutes",
  defaultDurationMinutes: "default_duration_minutes",
  bufferMinutes: "appointment_buffer_minutes",
  maxLeadDays: "max_lead_days",
  minLeadMinutes: "min_lead_minutes",
  cancellationHours: "cancellation_hours",
  rescheduleHours: "reschedule_hours",
  dailyBookingLimit: "daily_booking_limit",
  allowHolidayBookings: "allow_holiday_bookings",
};

function toInt(value: string | null | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export async function getCompanySettings(companyId: string, executor: Pick<typeof db, "select"> = db): Promise<CompanySettings> {
  const rows = await executor
    .select({ key: companySettings.key, value: companySettings.value })
    .from(companySettings)
    .where(eq(companySettings.companyId, companyId));

  const byKey = new Map(rows.map((r) => [r.key, r.value]));

  let workingDays = DEFAULT_SETTINGS.workingDays;
  const rawDays = byKey.get(KEY_MAP.workingDays);
  if (rawDays) {
    try {
      const parsed = JSON.parse(rawDays);
      if (Array.isArray(parsed)) workingDays = parsed;
    } catch {
      // fallback
    }
  }

  return {
    openTime: byKey.get(KEY_MAP.openTime) ?? DEFAULT_SETTINGS.openTime,
    closeTime: byKey.get(KEY_MAP.closeTime) ?? DEFAULT_SETTINGS.closeTime,
    workingDays,
    slotIntervalMinutes: toInt(byKey.get(KEY_MAP.slotIntervalMinutes), DEFAULT_SETTINGS.slotIntervalMinutes),
    defaultDurationMinutes: toInt(byKey.get(KEY_MAP.defaultDurationMinutes), DEFAULT_SETTINGS.defaultDurationMinutes),
    bufferMinutes: toInt(byKey.get(KEY_MAP.bufferMinutes), DEFAULT_SETTINGS.bufferMinutes),
    maxLeadDays: toInt(byKey.get(KEY_MAP.maxLeadDays), DEFAULT_SETTINGS.maxLeadDays),
    minLeadMinutes: toInt(byKey.get(KEY_MAP.minLeadMinutes), DEFAULT_SETTINGS.minLeadMinutes),
    cancellationHours: toInt(byKey.get(KEY_MAP.cancellationHours), DEFAULT_SETTINGS.cancellationHours),
    rescheduleHours: toInt(byKey.get(KEY_MAP.rescheduleHours), DEFAULT_SETTINGS.rescheduleHours),
    dailyBookingLimit: toInt(byKey.get(KEY_MAP.dailyBookingLimit), DEFAULT_SETTINGS.dailyBookingLimit),
    allowHolidayBookings: byKey.get(KEY_MAP.allowHolidayBookings) === "true",
  };
}

export async function setCompanySetting(
  companyId: string,
  key: keyof CompanySettings,
  value: string | number | number[],
  executor: Pick<typeof db,"insert"> = db,
): Promise<void> {
  const strVal = typeof value === "object" ? JSON.stringify(value) : String(value);
  await executor
    .insert(companySettings)
    .values({ companyId, key: KEY_MAP[key], value: strVal })
    .onConflictDoUpdate({
      target: [companySettings.companyId, companySettings.key],
      set: { value: strVal, updatedAt: new Date() },
    });
}
