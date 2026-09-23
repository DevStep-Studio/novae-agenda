import { useAppTheme, hexToRgba } from "@/lib/theme-context";

export { hexToRgba };

export function useTheme() {
  const {
    colors,
    resolvedTheme,
    isDark,
    primaryColor,
    primaryForeground,
    primarySoft,
    themeMode,
    toggleTheme,
    setThemeMode,
    setPrimaryColorOverride,
  } = useAppTheme();

  return {
    colors,
    colorScheme: resolvedTheme,
    isDark,
    primaryColor,
    primaryForeground,
    primarySoft,
    themeMode,
    toggleTheme,
    setThemeMode,
    setPrimaryColorOverride,
  };
}
