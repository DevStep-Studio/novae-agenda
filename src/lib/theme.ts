export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const THEME_KEY = "agenda-theme";

let mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;

export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === "system") {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme === "dark" ? "dark" : "light";
}

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";

  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "dark" || stored === "light" || stored === "system") {
    return stored;
  }
  return "dark"; // Default dark theme for Novae
}

export function applyTheme(theme: Theme) {
  if (typeof window === "undefined") return;

  const resolved = resolveTheme(theme);

  // Apply to documentElement
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themeMode = theme;

  // Persist preference
  window.localStorage.setItem(THEME_KEY, theme);

  // Clean up any existing media query listener
  if (mediaQueryListener) {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    mql.removeEventListener("change", mediaQueryListener);
    mediaQueryListener = null;
  }

  // If system mode, attach dynamic listener for OS changes
  if (theme === "system") {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQueryListener = (e: MediaQueryListEvent) => {
      const nextResolved = e.matches ? "dark" : "light";
      document.documentElement.dataset.theme = nextResolved;
    };
    mql.addEventListener("change", mediaQueryListener);
  }
}
