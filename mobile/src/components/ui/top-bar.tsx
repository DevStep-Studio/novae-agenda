import { ArrowLeft } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, typography } from "@/constants/design-tokens";

export interface TopBarProps {
  title: string;
  company?: string | null;
  showBack?: boolean;
  onBack?: () => void;
}

// .topbar / .mobile-topbar-title / .mobile-topbar-company at the mobile
// breakpoint, globals.css:8396-8449. Renders full-bleed above the screen's
// padded content — see Screen's `header` prop.
export function TopBar({ title, company, showBack, onBack }: TopBarProps) {
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(owner)/mais");
    }
  };

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
      {showBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={handleBack}
          hitSlop={10}
          className="mr-3 items-center justify-center rounded-lg p-2"
          style={{ backgroundColor: colors.surfaceSecondary }}
        >
          <ArrowLeft size={18} color={colors.textPrimary} />
        </Pressable>
      ) : null}
      <View className="gap-px flex-1">
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
