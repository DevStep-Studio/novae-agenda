import { useAppTheme, useCompanyBranding, hexToRgba, type CompanyBranding } from "@/lib/theme-context";

export { hexToRgba, useCompanyBranding, type CompanyBranding };

export function useTheme() {
  const {
    colors,
    resolvedTheme,
    isDark,
    primaryColor,
    primaryForeground,
    primarySoft,
    companyId,
    companyName,
    slug,
    logoUrl,
    coverUrl,
    ownerAvatarUrl,
    dashboardPreferences,
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
    companyId,
    companyName,
    slug,
    logoUrl,
    coverUrl,
    ownerAvatarUrl,
    dashboardPreferences,
    themeMode,
    toggleTheme,
    setThemeMode,
    setPrimaryColorOverride,
  };
}
