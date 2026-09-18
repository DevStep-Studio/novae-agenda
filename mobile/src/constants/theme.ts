/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

import { colors as darkTokens } from './design-tokens';

// Reservei brand tokens, re-exported from design-tokens.ts (the shared source
// also consumed by tailwind.config.ts) for call sites that need a raw value
// instead of a NativeWind className — icon `color=`, ActivityIndicator,
// StatusBar. See MOBILE_DESIGN_SYSTEM.md for what each token maps to on the
// web. Single palette — lime is the app-wide primary, confirmed by the
// product owner (see the comment on `colors.primary` in design-tokens.ts).
export const Colors = {
  dark: {
    text: darkTokens.textPrimary,
    textSecondary: darkTokens.textSecondary,
    textMuted: darkTokens.textMuted,
    background: darkTokens.background,
    backgroundElement: darkTokens.surfaceSecondary,
    backgroundSelected: darkTokens.surfaceHover,
    surface: darkTokens.surface,
    surfaceElevated: darkTokens.surfaceTertiary,
    border: darkTokens.border,
    primary: darkTokens.primary,
    primaryHover: darkTokens.primaryHover,
    primarySoft: darkTokens.primarySoft,
    primaryForeground: darkTokens.primaryForeground,
    danger: darkTokens.danger,
  },
} as const;

export type ThemeColor = keyof typeof Colors.dark;

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
