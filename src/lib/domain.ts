import type { AppointmentStatus, CommissionType, PaymentMethod } from "@/shared/types";

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

// "HH:MM:SS" or "HH:MM" -> "HH:MM"
export function normalizeTime(value: string): string {
  return value.length > 5 ? value.slice(0, 5) : value;
}

export function addMinutesToTime(time: string, minutes: number): string {
  return minutesToTime(timeToMinutes(time) + minutes);
}

export function todayKey(timezone: string): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

export function dayOfWeek(dateKey: string, timezone: string): number {
  const date = new Date(`${dateKey}T12:00:00Z`);
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" });
  const index = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(formatter.format(date));
  return index === -1 ? 0 : index;
}

export function startOfDay(dateKey: string, timezone: string): Date {
  return new Date(`${dateKey}T00:00:00-03:00`);
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function isValidDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function centsToNumber(amount: string | number | null | undefined): number {
  if (amount == null) return 0;
  const numeric = typeof amount === "number" ? amount : Number(amount);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function isValidStatus(value: string): value is AppointmentStatus {
  return ["scheduled", "confirmed", "waiting", "in_progress", "completed", "cancelled", "no_show"].includes(value);
}

export function isValidCommissionType(value: string): value is CommissionType {
  return ["none", "percentage", "fixed"].includes(value);
}

export function isValidPaymentMethod(value: string): value is PaymentMethod {
  return ["pix", "cash", "debit", "credit", "other"].includes(value);
}

export const COMMISSION_LABELS: Record<CommissionType, string> = {
  none: "Sem comissão",
  percentage: "Percentual",
  fixed: "Valor fixo",
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  debit: "Débito",
  credit: "Crédito",
  other: "Outro",
};
