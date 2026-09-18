import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from "react-native";

import { useTheme } from "@/hooks/use-theme";

type ButtonVariant = "primary" | "secondary" | "ghost";

export interface ButtonProps extends Omit<PressableProps, "children"> {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
}

export function Button({ label, variant = "primary", loading, disabled, style, ...rest }: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const backgroundColor =
    variant === "primary" ? colors.primary : variant === "secondary" ? colors.backgroundElement : "transparent";
  const textColor = variant === "primary" ? colors.primaryForeground : colors.text;
  const borderColor = variant === "ghost" ? colors.border : "transparent";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        { backgroundColor, borderColor, borderWidth: variant === "ghost" ? 1 : 0 },
        isDisabled && styles.disabled,
        typeof style === "function" ? style(state) : style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  disabled: { opacity: 0.5 },
  label: { fontSize: 15, fontWeight: "700" },
});
