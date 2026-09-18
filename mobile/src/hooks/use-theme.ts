/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';

// The web app's own login/admin/gestão screens default to dark regardless of the
// visitor's OS preference (getStoredTheme() in the root project's src/lib/theme.ts
// falls back to "dark", not the system scheme) and only change on an explicit
// in-app toggle whose choice is persisted. To look like the same product, the
// mobile app mirrors that: dark-first, independent of device theme, until a
// user-facing toggle (backed by persisted storage, not useColorScheme()) is
// implemented — see the "Em construção" list on each role's Mais tab.
export function useTheme() {
  return { colors: Colors.dark, colorScheme: 'dark' as const };
}
