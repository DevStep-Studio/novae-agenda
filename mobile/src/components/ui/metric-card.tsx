import type { LucideIcon } from "lucide-react-native";
import { StyleProp, Text, View, ViewStyle } from "react-native";

import { useTheme } from "@/hooks/use-theme";

export interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail?: string;
  variant?: "teal" | "lilac" | "amber" | "rose" | "primary" | "default";
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
}

export function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  style,
  fullWidth = false,
}: MetricCardProps) {
  const { isDark, primaryColor, primarySoft } = useTheme();

  // Standardized Home Card colors & layout
  const cardBg = isDark ? "#111215" : "#ffffff";
  const cardBorder = isDark ? "rgba(255, 255, 255, 0.08)" : "#e2e8f0";
  const textTitle = isDark ? "#ffffff" : "#0f172a";
  const textMuted = isDark ? "#9ca3af" : "#64748b";
  const textDetail = isDark ? "#737373" : "#94a3b8";
  const iconBg = primarySoft || (isDark ? "rgba(220, 255, 76, 0.16)" : "rgba(220, 255, 76, 0.12)");
  const iconColor = primaryColor || "#dcff4c";

  return (
    <View
      style={[
        {
          backgroundColor: cardBg,
          borderColor: cardBorder,
          borderWidth: 1,
          borderRadius: 16,
          padding: 14,
          justifyContent: "space-between",
          minHeight: fullWidth ? 76 : 110,
          flex: 1,
        },
        style,
      ]}
    >
      {/* Top row: Icon badge + Label */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#e2e8f0",
            backgroundColor: iconBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={18} color={iconColor} />
        </View>
        <Text
          style={{
            color: textMuted,
            fontSize: 12.5,
            fontWeight: "500",
            flex: 1,
            lineHeight: 16,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>

      {/* Middle & Bottom: Big Value + Detail */}
      <View style={{ gap: 2, marginTop: 10 }}>
        <Text
          style={{
            color: textTitle,
            fontSize: 22,
            fontWeight: "800",
            letterSpacing: -0.3,
            lineHeight: 28,
          }}
          numberOfLines={1}
        >
          {value}
        </Text>
        {detail ? (
          <Text
            style={{
              color: textDetail,
              fontSize: 11.5,
              lineHeight: 15,
            }}
            numberOfLines={1}
          >
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
