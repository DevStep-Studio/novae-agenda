import type { LucideIcon } from "lucide-react-native";
import { StyleProp, Text, View, ViewStyle } from "react-native";

import { useTheme, hexToRgba } from "@/hooks/use-theme";

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
  const iconBg = primarySoft || hexToRgba(primaryColor, isDark ? 0.16 : 0.12);
  const iconColor = primaryColor;

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
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 11,
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
            flexShrink: 0,
          }}
        >
          <Icon size={17} color={iconColor} />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text
            style={{
              color: textMuted,
              fontSize: 11.5,
              fontWeight: "500",
              lineHeight: 15,
            }}
            numberOfLines={1}
          >
            {label}
          </Text>
          <Text
            style={{
              color: textTitle,
              fontSize: 20,
              fontWeight: "800",
              letterSpacing: -0.3,
            }}
            numberOfLines={1}
          >
            {value}
          </Text>
          {detail ? (
            <Text
              style={{
                color: textDetail,
                fontSize: 10.5,
                lineHeight: 14,
              }}
              numberOfLines={1}
            >
              {detail}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
