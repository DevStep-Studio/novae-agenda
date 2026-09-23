import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";

import { useSession } from "./session-context";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export interface ColorPreset {
  id: string;
  name: string;
  hex: string;
}

export const PRIMARY_COLOR_PRESETS: ColorPreset[] = [
  { id: "blue", name: "Azul Elétrico (Padrão)", hex: "#3b82f6" },
  { id: "emerald", name: "Esmeralda", hex: "#10b981" },
  { id: "lime", name: "Verde Neon", hex: "#dcff4c" },
  { id: "violet", name: "Violeta / Roxo", hex: "#8b5cf6" },
  { id: "gold", name: "Dourado / Âmbar", hex: "#f59e0b" },
  { id: "pink", name: "Rosa / Magenta", hex: "#ec4899" },
  { id: "coral", name: "Coral / Laranja", hex: "#f97316" },
  { id: "cyan", name: "Ciano / Turquesa", hex: "#06b6d4" },
  { id: "mono", name: "Monocromático / Branco", hex: "#f5f5f5" },
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

export function isLightHex(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return brightness > 140;
}

export function hexToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(220, 255, 76, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

const THEME_MODE_KEY = "reservei_theme_mode_v1";
const PRIMARY_COLOR_KEY = "reservei_primary_color_v1";

interface ThemeContextValue {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  isDark: boolean;
  primaryColor: string;
  primaryForeground: string;
  primarySoft: string;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
  setPrimaryColorOverride: (hex: string) => Promise<void>;
  colors: {
    background: string;
    backgroundSecondary: string;
    surface: string;
    surfaceSecondary: string;
    surfaceTertiary: string;
    surfaceHover: string;
    border: string;
    borderHover: string;
    borderStrong: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    textDisabled: string;
    primary: string;
    primaryForeground: string;
    primarySoft: string;
    success: string;
    successSoft: string;
    warning: string;
    warningSoft: string;
    danger: string;
    dangerSoft: string;
    info: string;
    infoSoft: string;
  };
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const { session } = useSession();

  const [themeMode, setThemeModeState] = useState<ThemeMode>("dark");
  const [localPrimaryColor, setLocalPrimaryColor] = useState<string | null>(null);

  // Load saved theme mode from SecureStore
  useEffect(() => {
    async function loadThemePrefs() {
      try {
        const savedMode = await SecureStore.getItemAsync(THEME_MODE_KEY);
        if (savedMode === "light" || savedMode === "dark" || savedMode === "system") {
          setThemeModeState(savedMode);
        }
        const savedColor = await SecureStore.getItemAsync(PRIMARY_COLOR_KEY);
        if (savedColor) {
          setLocalPrimaryColor(savedColor);
        }
      } catch {
        // use defaults
      }
    }
    void loadThemePrefs();
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await SecureStore.setItemAsync(THEME_MODE_KEY, mode);
    } catch {
      // ignore
    }
  }, []);

  const toggleTheme = useCallback(async () => {
    const nextMode: ThemeMode = themeMode === "dark" ? "light" : "dark";
    await setThemeMode(nextMode);
  }, [themeMode, setThemeMode]);

  const setPrimaryColorOverride = useCallback(async (hex: string) => {
    setLocalPrimaryColor(hex);
    try {
      await SecureStore.setItemAsync(PRIMARY_COLOR_KEY, hex);
    } catch {
      // ignore
    }
  }, []);

  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (themeMode === "system") {
      return systemScheme === "light" ? "light" : "dark";
    }
    return themeMode === "light" ? "light" : "dark";
  }, [themeMode, systemScheme]);

  const isDark = resolvedTheme === "dark";

  // Reset local override when company context changes so backend MySQL primary color is authoritative
  useEffect(() => {
    setLocalPrimaryColor(null);
  }, [session?.company?.id]);

  // Determine active primary color (Session DB config from MySQL > Local preview override > Default)
  const activePrimaryColor = useMemo(() => {
    if (localPrimaryColor) {
      return localPrimaryColor;
    }
    if (session?.company?.primaryColor) {
      return session.company.primaryColor;
    }
    return "#dcff4c"; // Brand lime default
  }, [localPrimaryColor, session?.company?.primaryColor]);

  const primaryForeground = useMemo(() => {
    return isLightHex(activePrimaryColor) ? "#0a0a0a" : "#ffffff";
  }, [activePrimaryColor]);

  const primarySoft = useMemo(() => {
    const rgb = hexToRgb(activePrimaryColor);
    if (!rgb) return isDark ? "rgba(220, 255, 76, 0.16)" : "rgba(220, 255, 76, 0.12)";
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${isDark ? 0.16 : 0.12})`;
  }, [activePrimaryColor, isDark]);

  const themeTokens = useMemo(() => {
    if (isDark) {
      return {
        background: "#080808",
        backgroundSecondary: "#0d0d0d",
        surface: "#111215",
        surfaceSecondary: "#18191e",
        surfaceTertiary: "#202228",
        surfaceHover: "#22242a",
        border: "rgba(255, 255, 255, 0.08)",
        borderHover: "rgba(255, 255, 255, 0.15)",
        borderStrong: "rgba(255, 255, 255, 0.2)",
        textPrimary: "#ffffff",
        textSecondary: "#9ca3af",
        textMuted: "#737373",
        textDisabled: "#52525b",
        primary: activePrimaryColor,
        primaryForeground,
        primarySoft,
        success: "#10b981",
        successSoft: "rgba(16, 185, 129, 0.15)",
        warning: "#f2c26d",
        warningSoft: "rgba(242, 194, 109, 0.15)",
        danger: "#ef4444",
        dangerSoft: "rgba(239, 68, 68, 0.15)",
        info: "#3b82f6",
        infoSoft: "rgba(59, 130, 246, 0.15)",
      };
    } else {
      return {
        background: "#f8f9fa",
        backgroundSecondary: "#ffffff",
        surface: "#ffffff",
        surfaceSecondary: "#f3f4f6",
        surfaceTertiary: "#e5e7eb",
        surfaceHover: "#f1f2f4",
        border: "#e2e8f0",
        borderHover: "#cbd5e1",
        borderStrong: "#94a3b8",
        textPrimary: "#0f172a",
        textSecondary: "#475569",
        textMuted: "#64748b",
        textDisabled: "#94a3b8",
        primary: activePrimaryColor,
        primaryForeground,
        primarySoft,
        success: "#10b981",
        successSoft: "rgba(16, 185, 129, 0.1)",
        warning: "#d97706",
        warningSoft: "rgba(217, 119, 6, 0.1)",
        danger: "#ef4444",
        dangerSoft: "rgba(239, 68, 68, 0.1)",
        info: "#3b82f6",
        infoSoft: "rgba(59, 130, 246, 0.1)",
      };
    }
  }, [isDark, activePrimaryColor, primaryForeground, primarySoft]);

  const value = useMemo(
    () => ({
      themeMode,
      resolvedTheme,
      isDark,
      primaryColor: activePrimaryColor,
      primaryForeground,
      primarySoft,
      setThemeMode,
      toggleTheme,
      setPrimaryColorOverride,
      colors: themeTokens,
    }),
    [
      themeMode,
      resolvedTheme,
      isDark,
      activePrimaryColor,
      primaryForeground,
      primarySoft,
      setThemeMode,
      toggleTheme,
      setPrimaryColorOverride,
      themeTokens,
    ]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme must be used within an AppThemeProvider");
  }
  return ctx;
}
