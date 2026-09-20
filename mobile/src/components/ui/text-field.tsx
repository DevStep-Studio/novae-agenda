import type { LucideIcon } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";

import { authSplit, colors } from "@/constants/design-tokens";

export interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
  /** .auth-split-input-icon, globals.css:9529-9534 */
  icon?: LucideIcon;
  /** Rendered where .auth-split-input-eye sits (password visibility toggle). */
  rightElement?: ReactNode;
  /** .auth-split-asterisk, globals.css:9514-9521 */
  required?: boolean;
}

// .auth-split-label / .auth-split-input-wrap / .auth-split-input,
// globals.css:9501-9563 — the only concrete input spec found on the real web
// app so far, used as the app-wide primitive (see Button's citation comment
// for the same reasoning). If a later screen's real input looks different,
// extend from that citation rather than guessing a variant here.
export function TextField({
  label,
  error,
  icon: Icon,
  rightElement,
  required,
  style,
  onFocus,
  onBlur,
  ...rest
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "600" }}>
        {label} {required ? <Text style={{ color: colors.primary, fontWeight: "700" }}>*</Text> : null}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", position: "relative" }}>
        {Icon ? (
          <View style={{ position: "absolute", left: 14, zIndex: 10, pointerEvents: "none" }}>
            <Icon size={17} color={authSplit.mutedIcon} />
          </View>
        ) : null}
        <TextInput
          placeholderTextColor={colors.textMuted}
          style={[
            {
              height: 48,
              flex: 1,
              borderRadius: 10,
              borderWidth: 1,
              backgroundColor: authSplit.inputBackground,
              borderColor: error ? colors.danger : focused ? colors.primary : authSplit.inputBorder,
              color: colors.textPrimary,
              fontSize: 14,
              paddingLeft: Icon ? 42 : 14,
              paddingRight: rightElement ? 40 : 14,
            },
            style,
          ]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {rightElement ? (
          <View style={{ position: "absolute", right: 12, zIndex: 10 }}>
            {rightElement}
          </View>
        ) : null}
      </View>
      {error ? <Text style={{ fontSize: 12, color: colors.danger, marginTop: 2 }}>{error}</Text> : null}
    </View>
  );
}
