import type { LucideIcon } from "lucide-react-native";
import { Text, View } from "react-native";

import { colors, metricIcon, typography } from "@/constants/design-tokens";

export interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
}

// .metric-card / .metric-icon / .metric-teal / .metric-copy, globals.css:644-668
// and 853-866, at the mobile breakpoint (globals.css:8832-8864).
export function MetricCard({ icon: Icon, label, value, detail }: MetricCardProps) {
  return (
    <View
      className="flex-row items-start gap-3 rounded-md border p-3.5"
      style={{ backgroundColor: colors.surface, borderColor: colors.border, minHeight: 84, flexBasis: "47%", flexGrow: 1 }}
    >
      <View
        className="items-center justify-center rounded-sm border"
        style={{
          width: metricIcon.size,
          height: metricIcon.size,
          backgroundColor: colors.primarySoft,
          borderColor: colors.border,
        }}
      >
        <Icon size={16} color={colors.primary} />
      </View>
      <View className="shrink gap-1">
        <Text style={{ color: colors.textSecondary, ...typography.metricLabel }}>{label}</Text>
        <Text style={{ color: colors.textPrimary, ...typography.metricValue }} numberOfLines={1}>
          {value}
        </Text>
        {detail ? <Text style={{ color: colors.textMuted, ...typography.metricDetail }}>{detail}</Text> : null}
      </View>
    </View>
  );
}
