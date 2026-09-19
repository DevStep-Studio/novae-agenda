import { ActivityIndicator, Pressable, Text, type StyleProp, type ViewStyle } from "react-native";

import { colors } from "@/constants/design-tokens";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

// .auth-split-primary-btn, globals.css:9644-9660: height 48, radius 10,
// font 15px/700 — the one concrete button spec found on the real web app so
// far, used as the app-wide primitive. Also comfortably clears the 44px
// accessible touch-target minimum, unlike the desktop `.button`/`.btn`
// primitives (36-38px) — see MOBILE_DESIGN_SYSTEM.md for why those aren't
// ported as-is to a touch surface.
//
// Note: `style` here is intentionally always a plain array/object, never the
// `(state) => ...` function form Pressable also accepts — NativeWind's babel
// plugin merges `className` into `style` at the props level, and doesn't
// resolve a function-valued `style`, so the background color silently never
// applied when this used that form (Button rendered as a transparent box).
export function Button({ label, variant = "primary", loading, disabled, onPress, style }: ButtonProps) {
  const isDisabled = disabled || loading;

  const backgroundColor =
    variant === "primary"
      ? colors.primary
      : variant === "danger"
        ? colors.danger
        : variant === "secondary"
          ? colors.surfaceSecondary
          : "transparent";
  const textColor =
    variant === "primary"
      ? colors.primaryForeground
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
