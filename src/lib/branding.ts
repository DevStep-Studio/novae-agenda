export type BookingThemeMode = "auto" | "light" | "dark";

export type BrandPalette = {
  brand: string;
  brandHover: string;
  brandActive: string;
  brandSoft: string;
  brandBorder: string;
  brandContrast: string;
  brandContrastMuted: string;
  luminance: number;
  isLight: boolean;
  accessibleOnDark: string;
  accessibleOnLight: string;
  cssVariables: Record<string, string>;
};

export const BRAND_PRESETS = [
  { name: "Lima Nova(e)", hex: "#dcff4c" },
  { name: "Esmeralda", hex: "#10b981" },
  { name: "Azul Royal", hex: "#2563eb" },
  { name: "Roxo", hex: "#7c3aed" },
  { name: "Rosa", hex: "#ec4899" },
  { name: "Laranja", hex: "#f97316" },
  { name: "Dourado", hex: "#eab308" },
  { name: "Grafite", hex: "#334155" },
];

export const DEFAULT_BRAND_COLOR = "#dcff4c";

function parseHex(hex: string): [number, number, number] {
  let clean = hex.replace(/^#/, "").trim();
  if (clean.length === 3) {
    clean = clean
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (clean.length !== 6) {
    return [220, 255, 76]; // Fallback to #dcff4c
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return [220, 255, 76];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Calculates WCAG 2.1 relative luminance (0 to 1)
 */
export function calculateLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  const [rLin, gLin, bLin] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Calculates WCAG contrast ratio between two luminance values (1 to 21)
 */
export function calculateContrastRatio(lum1: number, lum2: number): number {
  const l1 = Math.max(lum1, lum2);
  const l2 = Math.min(lum1, lum2);
  return (l1 + 0.05) / (l2 + 0.05);
}

/**
 * Derives a complete, accessible brand palette from a single brand color hex
 */
export function createBrandPalette(
  colorHex?: string | null,
  themeMode: "light" | "dark" = "dark",
): BrandPalette {
  const [r, g, b] = parseHex(colorHex || DEFAULT_BRAND_COLOR);
  const brand = rgbToHex(r, g, b);
  const luminance = calculateLuminance(brand);
  const isLight = luminance > 0.4;

  // Calculate contrast against dark text (#102118) and white text (#ffffff)
  const contrastWithDarkText = calculateContrastRatio(luminance, 0.015);
  const contrastWithWhiteText = calculateContrastRatio(luminance, 1.0);

  const brandContrast =
    contrastWithDarkText >= contrastWithWhiteText ? "#102118" : "#ffffff";
  const brandContrastMuted =
    brandContrast === "#102118"
      ? "rgba(16, 33, 24, 0.75)"
      : "rgba(255, 255, 255, 0.75)";

  // Derived hover and active colors
  const hoverFactor = isLight ? -0.1 : 0.15;
  const activeFactor = isLight ? -0.2 : 0.25;

  const brandHover = rgbToHex(
    r + (255 - r) * Math.max(0, hoverFactor) + r * Math.min(0, hoverFactor),
    g + (255 - g) * Math.max(0, hoverFactor) + g * Math.min(0, hoverFactor),
    b + (255 - b) * Math.max(0, hoverFactor) + b * Math.min(0, hoverFactor),
  );

  const brandActive = rgbToHex(
    r + (255 - r) * Math.max(0, activeFactor) + r * Math.min(0, activeFactor),
    g + (255 - g) * Math.max(0, activeFactor) + g * Math.min(0, activeFactor),
    b + (255 - b) * Math.max(0, activeFactor) + b * Math.min(0, activeFactor),
  );

  const brandSoft = `rgba(${r}, ${g}, ${b}, 0.14)`;
  const brandBorder = `rgba(${r}, ${g}, ${b}, 0.28)`;

  // Ensure accessible contrast when brand color is placed over background
  const accessibleOnDark =
    luminance < 0.12 ? rgbToHex(r + 60, g + 60, b + 60) : brand;
  const accessibleOnLight =
    luminance > 0.85 ? rgbToHex(r - 50, g - 50, b - 50) : brand;

  const cssVariables: Record<string, string> = {
    "--brand": brand,
    "--brand-hover": brandHover,
    "--brand-active": brandActive,
    "--brand-soft": brandSoft,
    "--brand-border": brandBorder,
    "--brand-contrast": brandContrast,
    "--brand-contrast-muted": brandContrastMuted,
    "--accent": brand,
    "--accent-hover": brandHover,
    "--accent-contrast": brandContrast,
  };

  return {
    brand,
    brandHover,
    brandActive,
    brandSoft,
    brandBorder,
    brandContrast,
    brandContrastMuted,
    luminance,
    isLight,
    accessibleOnDark,
    accessibleOnLight,
    cssVariables,
  };
}

export function isValidHexColor(hex: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex.trim());
}
