import { StyleProp, Text, View, ViewStyle } from "react-native";
import { useTheme } from "@/hooks/use-theme";

export interface PageHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
  style,
}: PageHeaderProps) {
  const { isDark, primaryColor } = useTheme();

  return (
    <View style={[{ gap: action ? 12 : 4 }, style]}>
      <View style={{ gap: 2 }}>
        <Text
          style={{
            color: primaryColor,
            fontSize: 11,
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: 0.8,
          }}
        >
          {eyebrow}
        </Text>
        <Text
          style={{
            color: isDark ? "#ffffff" : "#0f172a",
            fontSize: 22,
            fontWeight: "800",
            letterSpacing: -0.4,
            lineHeight: 28,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              color: isDark ? "#94a3b8" : "#64748b",
              fontSize: 13,
              marginTop: 2,
              lineHeight: 18,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action ? <View>{action}</View> : null}
    </View>
  );
}
