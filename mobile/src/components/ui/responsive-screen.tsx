import React, { type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { useResponsive } from "@/hooks/use-responsive";
import { useTheme } from "@/hooks/use-theme";

export interface ResponsiveScreenProps extends ViewProps {
  /** Top bar or header component rendered outside the padded/scrollable body. */
  header?: ReactNode;
  /** Disable responsive horizontal padding for full-bleed screens (e.g. login banner). */
  noPadding?: boolean;
  /** Automatically wrap body in a vertical ScrollView. Default is false. */
  scrollable?: boolean;
  /** Automatically wrap with KeyboardAvoidingView on iOS/Android. Default is false. */
  keyboardAvoiding?: boolean;
  /** Custom max width override for content container (defaults to responsive contentMaxWidth on tablets). */
  maxWidth?: number;
  /** Custom styles for the scroll content container (when scrollable=true). */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Custom edges for SafeAreaView. */
  edges?: readonly Edge[];
  children?: ReactNode;
}

export function ResponsiveScreen({
  header,
  noPadding = false,
  scrollable = false,
  keyboardAvoiding = false,
  maxWidth,
  edges,
  contentContainerStyle,
  style,
  children,
  ...rest
}: ResponsiveScreenProps) {
  const { colors } = useTheme();
  const { horizontalPadding, isAnyTablet, contentMaxWidth } = useResponsive();

  const resolvedEdges: readonly Edge[] =
    edges ?? (header ? ["left", "right"] : ["top", "left", "right"]);

  const appliedMaxWidth = maxWidth ?? (isAnyTablet ? contentMaxWidth : undefined);
  const appliedPadding = noPadding ? 0 : horizontalPadding;

  const innerBody = (
    <View
      style={[
        styles.innerContainer,
        {
          paddingHorizontal: appliedPadding,
          maxWidth: appliedMaxWidth,
          alignSelf: appliedMaxWidth ? "center" : undefined,
          width: appliedMaxWidth ? "100%" : undefined,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );

  let content = innerBody;

  if (scrollable) {
    content = (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContainer,
          {
            alignItems: appliedMaxWidth ? "center" : undefined,
          },
          contentContainerStyle,
        ]}
        style={styles.flexOne}
      >
        {innerBody}
      </ScrollView>
    );
  }

  if (keyboardAvoiding) {
    content = (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flexOne}
      >
        {content}
      </KeyboardAvoidingView>
    );
  }

  return (
    <SafeAreaView
      edges={resolvedEdges}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      {header}
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flexOne: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  innerContainer: {
    flex: 1,
  },
});
