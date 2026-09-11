import { format, getDaysInMonth, parseISO } from "date-fns";
import type { MembershipFrequencyType, MonthSlotDay } from "@/shared/types";

const WEEKDAY_NAMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

const WEEKDAY_SHORT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const MONTH_SHORT = [
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
];

/**
 * Returns month start and end formatted as YYYY-MM-DD
 */
export function getMonthDateRange(year: number, month: number): { periodStart: string; periodEnd: string } {
  const padMonth = String(month).padStart(2, "0");
  const days = getDaysInMonth(new Date(year, month - 1, 1, 12, 0, 0));
  const periodStart = `${year}-${padMonth}-01`;
  const periodEnd = `${year}-${padMonth}-${String(days).padStart(2, "0")}`;
  return { periodStart, periodEnd };
}

/**
 * Returns all real dates (YYYY-MM-DD) for specific weekdays (0-6) within a month.
 * Does NOT do `days / 7`, but inspects real calendar days.
 */
export function getWeekdayDatesInMonth(
  year: number,
  month: number, // 1 to 12
  targetWeekdays: number[], // 0 = Sun, 1 = Mon ... 6 = Sat
): string[] {
  const daysCount = getDaysInMonth(new Date(year, month - 1, 1, 12, 0, 0));
  const dates: string[] = [];
  const padMonth = String(month).padStart(2, "0");

  for (let day = 1; day <= daysCount; day++) {
    const d = new Date(year, month - 1, day, 12, 0, 0);
    const dayOfWeek = d.getDay();
    if (targetWeekdays.includes(dayOfWeek)) {
      dates.push(`${year}-${padMonth}-${String(day).padStart(2, "0")}`);
    }
  }

  return dates;
}

/**
 * Calculates session allowance for a period based on plan type and calendar.
 */
export function calculatePeriodAllowance(
  frequencyType: MembershipFrequencyType,
  year: number,
  month: number,
  preferredWeekdays: number[] = [],
  sessionsPerPeriod = 4,
  weeklyFrequency = 1,
): { allowance: number; expectedDates: string[] } {
  if (frequencyType === "FIXED_MONTHLY_QUOTA") {
    // Fixed quota (e.g. 4 sessions / month).
    const candidateDates =
      preferredWeekdays.length > 0
        ? getWeekdayDatesInMonth(year, month, preferredWeekdays)
        : [];
    return {
      allowance: sessionsPerPeriod,
      expectedDates: candidateDates.slice(0, sessionsPerPeriod),
    };
  }

  // If weekly or multi-weekly calendar based:
  const weekdays =
    preferredWeekdays.length > 0
      ? preferredWeekdays
      : [4]; // Default to Thursday if none specified

  const dates = getWeekdayDatesInMonth(year, month, weekdays);

  return {
    allowance: dates.length,
    expectedDates: dates,
  };
}

/**
 * Formats date metadata for clean UI rendering.
 */
export function formatDaySlotMeta(dateStr: string): {
  date: string;
  weekday: number;
  weekdayLabel: string;
  dateLabel: string;
  shortDateLabel: string;
} {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d, 12, 0, 0);
  const weekday = dateObj.getDay();

  const weekdayLabel = WEEKDAY_NAMES[weekday];
  const shortWeekday = WEEKDAY_SHORT[weekday];
  const monthName = MONTH_NAMES[m - 1];
  const shortMonth = MONTH_SHORT[m - 1];
  const padDay = String(d).padStart(2, "0");

  return {
    date: dateStr,
    weekday,
    weekdayLabel,
    dateLabel: `${padDay} de ${monthName}`,
    shortDateLabel: `${shortWeekday}, ${padDay} ${shortMonth}`,
  };
}
