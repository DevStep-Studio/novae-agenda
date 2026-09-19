import React, { useRef, useState, useEffect } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { authSplit, colors, fontFamily } from "@/constants/design-tokens";

export interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  mask?: boolean;
  error?: boolean;
  onComplete?: (code: string) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * 6-box Native PIN input matching the web's .pin-input-container & .pin-digit-box
 * (src/components/booking/pin-input.tsx).
 *
 * Uses a single native numeric TextInput overlay for fluid auto-advance,
 * backspace, paste support, and SMS autofill, while rendering 6 discrete
 * styled boxes with active lime outlines (#dcff4c).
 */
export function PinInput({
  value = "",
  onChange,
  length = 6,
  disabled = false,
  autoFocus = false,
  mask = true,
  error = false,
  onComplete,
  style,
}: PinInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (autoFocus) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  const digits = value.slice(0, length).split("");
  while (digits.length < length) {
    digits.push("");
  }

  const handleChangeText = (text: string) => {
    const cleaned = text.replace(/\D/g, "").slice(0, length);
    onChange(cleaned);
    if (cleaned.length === length) {
      onComplete?.(cleaned);
    }
  };

  const handleBoxPress = () => {
    if (disabled) return;
    inputRef.current?.focus();
  };

  const activeIndex = Math.min(value.length, length - 1);

  return (
    <Pressable
      onPress={handleBoxPress}
      style={[styles.container, style]}
      accessibilityRole="none"
      accessibilityLabel="Entrada de PIN de 6 dígitos"
    >
      {/* Invisible Native Input covering for keyboard & one-time-code autofill */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChangeText}
        maxLength={length}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        editable={!disabled}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={styles.hiddenInput}
        caretHidden
        aria-hidden={true}
      />

      <View style={styles.boxesRow}>
        {Array.from({ length }).map((_, index) => {
          const char = digits[index] || "";
          const isFilled = Boolean(char);
          const isCurrent = isFocused && (index === value.length || (index === length - 1 && value.length === length));

          let borderColor: string = authSplit.inputBorder;
          if (error) {
            borderColor = colors.danger;
          } else if (isCurrent || isFilled) {
            borderColor = colors.primary;
          }


          return (
            <View
              key={index}
              style={[
                styles.box,
                {
                  borderColor,
                  backgroundColor: authSplit.inputBackground,
                  borderWidth: isCurrent || isFilled || error ? 1.5 : 1,
                },
              ]}
            >
              {isFilled ? (
                <Text
                  style={[
                    styles.digitText,
                    mask ? styles.maskedBullet : styles.plainDigit,
                  ]}
                >
                  {mask ? "●" : char}
                </Text>
              ) : isCurrent ? (
                <View style={styles.activeCursor} />
              ) : null}
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  boxesRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  box: {
    width: 46,
    height: 54,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  digitText: {
    color: "#fafafa",
    textAlign: "center",
  },
  maskedBullet: {
    fontSize: 16,
    lineHeight: 20,
    color: colors.primary,
  },
  plainDigit: {
    fontSize: 22,
    fontFamily: fontFamily.display,
    fontWeight: "700",
  },
  activeCursor: {
    width: 2,
    height: 22,
    backgroundColor: colors.primary,
    borderRadius: 1,
  },
  hiddenInput: {
    position: "absolute",
    width: "100%",
    height: "100%",
    opacity: 0,
    zIndex: -1,
  },
});
