/**
 * Utilities to apply dynamic primary brand color across the entire app
 * replacing the default neon green (#dcff4c) with the user's selected primary color.
 */

export type ColorPreset = {
  id: string;
  name: string;
  hex: string;
};

export const PRIMARY_COLOR_PRESETS: ColorPreset[] = [
  { id: "blue", name: "Azul Elétrico (Padrão)", hex: "#3b82f6" },
  { id: "emerald", name: "Esmeralda", hex: "#10b981" },
  { id: "lime", name: "Verde Neon", hex: "#dcff4c" },
  { id: "violet", name: "Violeta / Roxo", hex: "#8b5cf6" },
  { id: "gold", name: "Dourado / Âmbar", hex: "#eab308" },
  { id: "pink", name: "Rosa / Magenta", hex: "#ec4899" },
  { id: "coral", name: "Coral / Laranja", hex: "#f97316" },
  { id: "cyan", name: "Ciano / Turquesa", hex: "#06b6d4" },
  { id: "mono", name: "Monocromático / Branco", hex: "#f5f5f5" },
];

export type ImagePreset = {
  id: string;
  name: string;
  url: string;
};

export const BANNER_PRESETS: ImagePreset[] = [
  { id: "dark-minimal", name: "Minimal Escuro", url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80" },
  { id: "studio-noir", name: "Studio Noir", url: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80" },
  { id: "slate-flat", name: "Ardósia Flat", url: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1200&q=80" },
  { id: "abstract-grid", name: "Linhas Modernas", url: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1200&q=80" },
];

export const AVATAR_PRESETS: ImagePreset[] = [
  { id: "avatar-1", name: "Profissional", url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80" },
  { id: "avatar-2", name: "Especialista", url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80" },
  { id: "avatar-3", name: "Criativo", url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80" },
];

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return { r, g, b };
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

export function getBrightness(r: number, g: number, b: number): number {
  return (r * 299 + g * 587 + b * 114) / 1000;
}

export function isLightHex(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  return getBrightness(rgb.r, rgb.g, rgb.b) > 140;
}

export function applyPrimaryColor(hex: string) {
  if (typeof document === "undefined") return;

  const rgb = hexToRgb(hex);
  if (!rgb) return;

  const { r, g, b } = rgb;
  const brightness = getBrightness(r, g, b);
  const isLightColor = brightness > 140;

  const isDarkMode = document.documentElement.dataset.theme === "dark";

  const foreground = isLightColor ? "#0a0a0a" : "#ffffff";
  const soft = isDarkMode ? `rgba(${r}, ${g}, ${b}, 0.15)` : `rgba(${r}, ${g}, ${b}, 0.10)`;
  const softHover = isDarkMode ? `rgba(${r}, ${g}, ${b}, 0.25)` : `rgba(${r}, ${g}, ${b}, 0.18)`;
  const borderSubtle = isDarkMode ? `rgba(${r}, ${g}, ${b}, 0.3)` : `rgba(${r}, ${g}, ${b}, 0.22)`;
  const borderFocus = `rgba(${r}, ${g}, ${b}, 0.45)`;
  const submetricIconBg = isLightColor ? "rgba(0, 0, 0, 0.10)" : "rgba(255, 255, 255, 0.22)";

  // Generate slightly darker/lighter hover tone
  const hoverR = Math.max(0, Math.min(255, isLightColor ? Math.round(r * 0.88) : Math.round(r * 1.15)));
  const hoverG = Math.max(0, Math.min(255, isLightColor ? Math.round(g * 0.88) : Math.round(g * 1.15)));
  const hoverB = Math.max(0, Math.min(255, isLightColor ? Math.round(b * 0.88) : Math.round(b * 1.15)));
  const hoverHex = `#${((1 << 24) + (hoverR << 16) + (hoverG << 8) + hoverB).toString(16).slice(1)}`;

  const root = document.documentElement;
  root.style.setProperty("--primary", hex);
  root.style.setProperty("--primary-hover", hoverHex);
  root.style.setProperty("--primary-soft", soft);
  root.style.setProperty("--primary-soft-hover", softHover);
  root.style.setProperty("--primary-foreground", foreground);
  root.style.setProperty("--primary-rgb", `${r}, ${g}, ${b}`);
  root.style.setProperty("--submetric-icon-bg", submetricIconBg);
  root.style.setProperty("--brand-lime", hex);
  root.style.setProperty("--brand-lime-hover", hoverHex);
  root.style.setProperty("--brand-accent", hex);
  root.style.setProperty("--brand-accent-text", hex);
  root.style.setProperty("--brand-border-subtle", borderSubtle);
  root.style.setProperty("--brand-border-focus", borderFocus);

  // Save to localStorage for instant non-flicker restoration on page load
  try {
    localStorage.setItem("novae_primary_color", hex);
  } catch {}
}

