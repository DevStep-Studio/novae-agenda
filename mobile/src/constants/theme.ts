/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Reservei brand tokens — copied verbatim from the web app's `--primary`/`.auth-shell`
// tokens in src/app/globals.css (root project) so the mobile app matches the same
// dark + lime identity used on /login, /admin and /gestao. Do not invent new values
// here; if the web tokens change, re-sync from globals.css.
export const Colors = {
  light: {
    text: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#64748b',
    background: '#f8fafc',
    backgroundElement: '#f1f5f9',
    backgroundSelected: '#e2e8f0',
    surface: '#ffffff',
    surfaceElevated: '#ffffff',
    border: '#e2e8f0',
    // Raw lime (#dcff4c) has poor contrast on light backgrounds; the web app swaps
    // to this dark-olive tone for accent text/icons in light mode (see .auth-shell
    // light-mode overrides) while keeping lime as the solid button fill below.
    accentText: '#3f6212',
    primary: '#dcff4c',
    primaryHover: '#c8ed32',
    primarySoft: 'rgba(220, 255, 76, 0.16)',
    primaryForeground: '#0a0a0a',
  },
  dark: {
    text: '#f5f5f5',
    textSecondary: '#a3a3a3',
    textMuted: '#737373',
    background: '#080808',
    backgroundElement: '#181818',
    backgroundSelected: '#222222',
    surface: '#121212',
    surfaceElevated: '#1a1a1a',
    border: '#222222',
    accentText: '#dcff4c',
    primary: '#dcff4c',
    primaryHover: '#c8ed32',
    primarySoft: 'rgba(220, 255, 76, 0.16)',
    primaryForeground: '#0a0a0a',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
