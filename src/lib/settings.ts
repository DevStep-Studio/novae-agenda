import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companySettings } from "@/db/schema";

/**
 * Company-level operational settings, stored as key/value rows in `company_settings`.
 * Every field has a safe default so callers never deal with `undefined`.
 */
export type CompanySettings = {
  /** Grid granularity when suggesting slots, in minutes. */
  slotIntervalMinutes: number;
  /** Fallback service duration when none is known, in minutes. */
  defaultDurationMinutes: number;
  /** Mandatory gap kept before/after each appointment, in minutes. */
  bufferMinutes: number;
  /** How far ahead a booking may be created, in days (0 = no limit). */
  maxLeadDays: number;
};

export const DEFAULT_SETTINGS: CompanySettings = {
  slotIntervalMinutes: 30,
  defaultDurationMinutes: 60,
  bufferMinutes: 0,
  maxLeadDays: 0,
};

const KEY_MAP: Record<keyof CompanySettings, string> = {
  slotIntervalMinutes: "slot_interval_minutes",
  defaultDurationMinutes: "default_duration_minutes",
  bufferMinutes: "appointment_buffer_minutes",
  maxLeadDays: "max_lead_days",
};

function toInt(value: string | null | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export async function getCompanySettings(companyId: string): Promise<CompanySettings> {
  const rows = await db
    .select({ key: companySettings.key, value: companySettings.value })
    .from(companySettings)
    .where(eq(companySettings.companyId, companyId));

  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return {
    slotIntervalMinutes: toInt(byKey.get(KEY_MAP.slotIntervalMinutes), DEFAULT_SETTINGS.slotIntervalMinutes),
    defaultDurationMinutes: toInt(byKey.get(KEY_MAP.defaultDurationMinutes), DEFAULT_SETTINGS.defaultDurationMinutes),
    bufferMinutes: toInt(byKey.get(KEY_MAP.bufferMinutes), DEFAULT_SETTINGS.bufferMinutes),
    maxLeadDays: toInt(byKey.get(KEY_MAP.maxLeadDays), DEFAULT_SETTINGS.maxLeadDays),
  };
}

export async function setCompanySetting(companyId: string, key: keyof CompanySettings, value: number): Promise<void> {
  await db
    .insert(companySettings)
    .values({ companyId, key: KEY_MAP[key], value: String(value) })
    .onConflictDoUpdate({ target: [companySettings.companyId, companySettings.key], set: { value: String(value), updatedAt: new Date() } });
}
