import type { LucideIcon } from "lucide-react-native";
import { Text, View } from "react-native";

import { colors, metricIcon, typography } from "@/constants/design-tokens";

export interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
  /** .metric-{teal,lilac,amber,rose} — see metricIcon.variants in design-tokens.ts. */
  variant?: keyof typeof metricIcon.variants;
}

// .metric-card / .metric-icon / .metric-copy, globals.css:644-668 and
// 853-866, at the mobile breakpoint (globals.css:8832-8864).
export function MetricCard({ icon: Icon, label, value, detail, variant = "teal" }: MetricCardProps) {
  const tone = metricIcon.variants[variant];

  return (
    <View
      className="flex-row items-start gap-3 rounded-md border p-3.5"
      style={{ backgroundColor: colors.surface, borderColor: colors.border, minHeight: 84, flexBasis: "47%", flexGrow: 1 }}
    >
      <View
        className="items-center justify-center rounded-sm"
        style={{
          width: metricIcon.size,
          height: metricIcon.size,
          backgroundColor: tone.background,
          borderWidth: tone.border ? 1 : 0,
          borderColor: tone.border,
        }}
      >
        <Icon size={16} color={tone.color} />
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
