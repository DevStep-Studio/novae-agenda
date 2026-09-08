import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { isValidDateKey, isValidTime } from "@/lib/domain";

export function localInstant(
  date: string,
  time: string,
  timezone: string,
): Date {
  if (!isValidDateKey(date) || !isValidTime(time))
    throw new Error("Data ou horário inválido.");
  const instant = fromZonedTime(`${date}T${time}:00`, timezone);
  if (
    !Number.isFinite(instant.getTime()) ||
    formatInTimeZone(instant, timezone, "yyyy-MM-dd HH:mm") !==
      `${date} ${time}`
  ) {
    throw new Error("Horário inexistente neste fuso horário.");
  }
  return instant;
}
export function localDate(instant: Date, timezone: string) {
  return formatInTimeZone(instant, timezone, "yyyy-MM-dd");
}
export function localTime(instant: Date, timezone: string) {
  return formatInTimeZone(instant, timezone, "HH:mm");
}
export function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function canCustomerChange(
  startsAt: Date,
  hours: number,
  now = new Date(),
) {
  return (
    hours >= 0 &&
    startsAt.getTime() > now.getTime() &&
    startsAt.getTime() - now.getTime() >= hours * 3600000
  );
}
