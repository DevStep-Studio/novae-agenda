import type { LucideIcon } from "lucide-react-native";
import { Text, View } from "react-native";

import { metricIcon, typography } from "@/constants/design-tokens";
import { useTheme } from "@/hooks/use-theme";

export interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
  variant?: keyof typeof metricIcon.variants;
}

export function MetricCard({ icon: Icon, label, value, detail, variant = "teal" }: MetricCardProps) {
  const { colors } = useTheme();
  const tone = metricIcon.variants[variant];

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        borderRadius: 12,
        borderWidth: 1,
        padding: 14,
        backgroundColor: colors.surface,
        borderColor: colors.border,
        minHeight: 84,
        flexBasis: "47%",
        flexGrow: 1,
      }}
    >
      <View
        style={{
          width: metricIcon.size,
          height: metricIcon.size,
          borderRadius: 8,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: tone.background,
          borderWidth: tone.border ? 1 : 0,
          borderColor: tone.border,
        }}
      >
        <Icon size={16} color={tone.color} />
      </View>
      <View style={{ flex: 1, flexShrink: 1, gap: 4 }}>
        <Text style={{ color: colors.textSecondary, ...typography.metricLabel }} numberOfLines={1}>
          {label}
        </Text>
        <Text style={{ color: colors.textPrimary, ...typography.metricValue }} numberOfLines={1}>
          {value}
        </Text>
        {detail ? (
          <Text style={{ color: colors.textMuted, ...typography.metricDetail }} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
