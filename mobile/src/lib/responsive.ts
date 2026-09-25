/**
 * RESERVEI MOBILE — RESPONSIVE CORE ARCHITECTURE
 * 
 * Single source of truth for responsive calculations, breakpoints,
 * layout constraints, container max-widths, dynamic font clamping,
 * and adaptive grids across iOS, Android, and Tablets.
 */

export const BREAKPOINTS = {
  compact: 360,
  phone: 480,
  largePhone: 768,
  tablet: 1024,
  largeTablet: 1440,
} as const;

export type ScreenCategory = "compact" | "phone" | "largePhone" | "tablet" | "largeTablet";

export const CONTENT_MAX_WIDTH = {
  form: 460,
  compactContent: 540,
  content: 680,
  modal: 520,
  card: 560,
  tabletWide: 980,
  dashboard: 1200,
} as const;

export const RESPONSIVE_SPACING = {
  compact: {
    screenPadding: 14,
    cardGap: 10,
    sectionGap: 14,
    itemGap: 8,
  },
  phone: {
    screenPadding: 20,
    cardGap: 12,
    sectionGap: 18,
    itemGap: 10,
  },
  largePhone: {
    screenPadding: 24,
    cardGap: 14,
    sectionGap: 20,
    itemGap: 12,
  },
  tablet: {
    screenPadding: 32,
    cardGap: 16,
    sectionGap: 24,
    itemGap: 14,
  },
  largeTablet: {
    screenPadding: 40,
    cardGap: 20,
    sectionGap: 32,
    itemGap: 16,
  },
} as const;

/**
 * Math clamp utility to restrict a value within [min, max].
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

export interface ScaleFontOptions {
  fontScale?: number;
  min?: number;
  max?: number;
  minFactor?: number;
  maxFactor?: number;
}

/**
 * Calculates responsive font size respecting user fontScale without blowing up layout.
 */
export function scaleFont(
  baseSize: number,
  fontScaleOrOptions?: number | ScaleFontOptions,
  minFactor: number = 0.85,
  maxFactor: number = 1.25
): number {
  if (typeof fontScaleOrOptions === "object" && fontScaleOrOptions !== null) {
    const fontScale = fontScaleOrOptions.fontScale ?? 1;
    const min = fontScaleOrOptions.min ?? baseSize * (fontScaleOrOptions.minFactor ?? 0.85);
    const max = fontScaleOrOptions.max ?? baseSize * (fontScaleOrOptions.maxFactor ?? 1.25);
    const scaled = baseSize * fontScale;
    return Math.round(clamp(scaled, min, max));
  }

  const fontScale = typeof fontScaleOrOptions === "number" ? fontScaleOrOptions : 1;
  const scaled = baseSize * fontScale;
  const min = baseSize * minFactor;
  const max = baseSize * maxFactor;
  return Math.round(clamp(scaled, min, max));
}

/**
 * Determines screen category from width.
 */
export function getScreenCategory(width: number): ScreenCategory {
  if (width < BREAKPOINTS.compact) return "compact";
  if (width < BREAKPOINTS.phone) return "phone";
  if (width < BREAKPOINTS.largePhone) return "largePhone";
  if (width < BREAKPOINTS.tablet) return "tablet";
  return "largeTablet";
}

/**
 * Dynamically calculates the optimal width and gap for a 6-digit PIN input
 * ensuring ZERO overflow on small screens (320px) while maintaining rich look on tablets.
 */
export function calculatePinDimensions(
  availableWidth: number,
  length: number = 6,
  maxBoxWidth: number = 46,
  maxGap: number = 8
): { boxWidth: number; boxHeight: number; gap: number; fontSize: number } {
  const safeAvailableWidth = Math.max(availableWidth - 16, 240);
  
  // Try max gap first
  let gap = maxGap;
  let totalGap = gap * (length - 1);
  let boxWidth = Math.floor((safeAvailableWidth - totalGap) / length);

  if (boxWidth < 36) {
    // Reduce gap to fit on ultra-compact (e.g. 320px)
    gap = 4;
    totalGap = gap * (length - 1);
    boxWidth = Math.floor((safeAvailableWidth - totalGap) / length);
  }

  boxWidth = clamp(boxWidth, 34, maxBoxWidth);
  const boxHeight = Math.round(boxWidth * 1.18);
  const fontSize = clamp(Math.round(boxWidth * 0.45), 16, 22);

  return { boxWidth, boxHeight, gap, fontSize };
}

/**
 * Calculates adaptive column counts for card grids (Dashboard, Financial, Team).
 */
export function getGridColumns(category: ScreenCategory, target: "metrics" | "cards" | "shortcuts"): number {
  switch (category) {
    case "compact":
      return target === "shortcuts" ? 2 : 1;
    case "phone":
      return target === "metrics" ? 2 : target === "shortcuts" ? 3 : 1;
    case "largePhone":
      return target === "metrics" ? 2 : target === "shortcuts" ? 3 : 2;
    case "tablet":
      return target === "metrics" ? 4 : target === "shortcuts" ? 4 : 2;
    case "largeTablet":
      return target === "metrics" ? 4 : target === "shortcuts" ? 5 : 3;
  }
}
