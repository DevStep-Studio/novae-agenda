import { isValidTime, timeToMinutes, minutesToTime } from "@/lib/domain";

export interface LunchInterval {
  breakStart: string | null;
  breakEnd: string | null;
}

/**
 * Checks if a lunch break is currently active and validly filled.
 */
export function isLunchActive(breakStart?: string | null, breakEnd?: string | null): boolean {
  if (!breakStart || !breakEnd) return false;
  const bs = breakStart.trim();
  const be = breakEnd.trim();
  return bs.length > 0 && be.length > 0 && isValidTime(bs.slice(0, 5)) && isValidTime(be.slice(0, 5));
}

/**
 * Generates a guaranteed valid default lunch break inside the given working hours.
 * Defaults to 12:00-13:00 if the shift covers that period.
 * Otherwise, calculates a 1-hour (or 30-minute) window around the midpoint of the shift.
 */
export function getDefaultLunch(startTime: string, endTime: string): { breakStart: string; breakEnd: string } {
  const normStart = startTime.length > 5 ? startTime.slice(0, 5) : startTime;
  const normEnd = endTime.length > 5 ? endTime.slice(0, 5) : endTime;

  // Standard case: standard workday covering 12:00 to 13:00
  if (normStart <= "12:00" && normEnd >= "13:00") {
    return { breakStart: "12:00", breakEnd: "13:00" };
  }

  const startMins = timeToMinutes(normStart);
  const endMins = timeToMinutes(normEnd);
  const duration = endMins - startMins;

  // Shift is 4 hours or longer: 1-hour lunch around the midpoint
  if (duration >= 240) {
    const mid = startMins + Math.floor(duration / 2);
    // Align to nearest 30 minutes
    const roundedMid = Math.round(mid / 30) * 30;
    const bStartMins = Math.max(startMins + 30, roundedMid - 30);
    const bEndMins = Math.min(endMins - 30, bStartMins + 60);
    return {
      breakStart: minutesToTime(bStartMins),
      breakEnd: minutesToTime(bEndMins),
    };
  }

  // Shift is between 2 and 4 hours: 30-minute break around the midpoint
  if (duration >= 120) {
    const mid = startMins + Math.floor(duration / 2);
    const roundedMid = Math.round(mid / 15) * 15;
    const bStartMins = Math.max(startMins + 15, roundedMid - 15);
    const bEndMins = Math.min(endMins - 15, bStartMins + 30);
    return {
      breakStart: minutesToTime(bStartMins),
      breakEnd: minutesToTime(bEndMins),
    };
  }

  // Very short shift (< 2 hours): 15-minute break if needed, or fallback
  if (duration > 30) {
    const bStartMins = startMins + Math.floor(duration / 3);
    const bEndMins = bStartMins + 15;
    return {
      breakStart: minutesToTime(bStartMins),
      breakEnd: minutesToTime(bEndMins),
    };
  }

  // Fallback default
  return { breakStart: "12:00", breakEnd: "13:00" };
}

/**
 * Sanitizes lunch break values.
 * - Empty strings, whitespace, or partial inputs normalize to null (no lunch).
 * - If workday ends at or before breakStart, lunch is automatically cleared to null.
 * - If lunch extends past workday end, clamps or clears it cleanly.
 */
export function sanitizeLunch(
  startTime: string,
  endTime: string,
  breakStart?: string | null,
  breakEnd?: string | null,
): LunchInterval {
  const normStart = (startTime || "08:00").slice(0, 5);
  const normEnd = (endTime || "18:00").slice(0, 5);

  let bs = breakStart?.trim() || null;
  let be = breakEnd?.trim() || null;

  if (bs) bs = bs.slice(0, 5);
  if (be) be = be.slice(0, 5);

  // If either field is missing, invalid or empty: consider as NO lunch
  if (!bs || !be || !isValidTime(bs) || !isValidTime(be)) {
    return { breakStart: null, breakEnd: null };
  }

  // If the shift ends at or before lunch start (e.g. employee works only until 12:00)
  if (normEnd <= bs) {
    return { breakStart: null, breakEnd: null };
  }

  // If lunch starts before shift starts
  if (bs < normStart) {
    bs = normStart;
  }

  // If lunch ends after shift ends
  if (be > normEnd) {
    be = normEnd;
  }

  // If start is after or equal to end after clamping
  if (bs >= be) {
    return { breakStart: null, breakEnd: null };
  }

  return { breakStart: bs, breakEnd: be };
}

/**
 * Validates lunch break values against shift boundaries.
 */
export function validateLunch(
  startTime: string,
  endTime: string,
  breakStart?: string | null,
  breakEnd?: string | null,
): { valid: boolean; message?: string } {
  if (!breakStart && !breakEnd) {
    return { valid: true };
  }

  if (Boolean(breakStart) !== Boolean(breakEnd)) {
    return {
      valid: false,
      message: "Preencha o início e o fim do almoço, ou desmarque o intervalo.",
    };
  }

  const bs = breakStart!.slice(0, 5);
  const be = breakEnd!.slice(0, 5);

  if (!isValidTime(bs) || !isValidTime(be)) {
    return {
      valid: false,
      message: "Horário de almoço inválido.",
    };
  }

  if (bs >= be) {
    return {
      valid: false,
      message: "O término do almoço deve ser posterior ao início.",
    };
  }

  if (bs < startTime.slice(0, 5)) {
    return {
      valid: false,
      message: "O almoço não pode iniciar antes do horário de entrada.",
    };
  }

  if (be > endTime.slice(0, 5)) {
    return {
      valid: false,
      message: "O almoço não pode terminar após o horário de saída.",
    };
  }

  return { valid: true };
}
