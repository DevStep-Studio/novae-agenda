import { ActivityIndicator, Pressable, Text, type StyleProp, type ViewStyle } from "react-native";

import { useTheme } from "@/hooks/use-theme";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, variant = "primary", loading, disabled, onPress, style }: ButtonProps) {
  const { colors, primaryColor, primaryForeground } = useTheme();
  const isDisabled = disabled || loading;

  const backgroundColor =
    variant === "primary"
      ? primaryColor
      : variant === "danger"
        ? colors.danger
        : variant === "secondary"
          ? colors.surfaceSecondary
          : "transparent";

  const textColor =
    variant === "primary"
      ? primaryForeground
      : variant === "danger"
        ? "#ffffff"
        : colors.textPrimary;

  const borderColor = variant === "ghost" ? colors.border : "transparent";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      className="h-12 flex-row items-center justify-center gap-2 rounded-[10px] px-4"
      style={[
        { backgroundColor, borderColor, borderWidth: variant === "ghost" ? 1 : 0 },
        isDisabled ? { opacity: 0.55 } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={{ color: textColor, fontSize: 15, fontWeight: "700" }}>{label}</Text>
      )}
    </Pressable>
  );
}
