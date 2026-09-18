import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, typography } from "@/constants/design-tokens";

export interface TopBarProps {
  title: string;
  company?: string | null;
}

// .topbar / .mobile-topbar-title / .mobile-topbar-company at the mobile
// breakpoint, globals.css:8396-8449. Renders full-bleed above the screen's
// padded content — see Screen's `header` prop.
export function TopBar({ title, company }: TopBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-row items-center border-b px-4"
      style={{
        paddingTop: insets.top,
        height: 64 + insets.top,
        backgroundColor: colors.surface,
        borderBottomColor: colors.border,
      }}
    >
      <View className="gap-px">
        <Text style={{ color: colors.textPrimary, ...typography.topbarTitle }} numberOfLines={1}>
          {title}
        </Text>
        {company ? (
          <Text style={{ color: colors.textMuted, ...typography.topbarCompany }} numberOfLines={1}>
            {company}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
