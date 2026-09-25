import type { ReactNode } from "react";
import { View, type ViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { useResponsive } from "@/hooks/use-responsive";
import { useTheme } from "@/hooks/use-theme";

export interface ScreenProps extends ViewProps {
  /**
   * Full-bleed content rendered above the padded body, e.g. <TopBar />. When
   * present, TopBar owns the top safe-area inset itself (it renders edge to
   * edge like the web's `.topbar`), so the SafeAreaView here skips the top
   * edge to avoid double-padding.
   */
  header?: ReactNode;
  /** Opt out of default responsive horizontal padding for full-bleed content (e.g. login banner). */
  noPadding?: boolean;
  /**
   * Explicit edges for SafeAreaView. Defaults to skipping top when header is present,
   * and skipping bottom because BottomTabBar and scroll views manage their own bottom insets,
   * avoiding double-padding / black bar above the navbar.
   */
  edges?: readonly Edge[];
  /** Custom max width override for content container. */
  maxWidth?: number;
}

export function Screen({
  header,
  noPadding,
  edges,
  maxWidth,
  style,
  children,
  ...rest
}: ScreenProps) {
  const { colors } = useTheme();
  const { horizontalPadding, isAnyTablet, contentMaxWidth } = useResponsive();

  const resolvedEdges: readonly Edge[] =
    edges ?? (header ? ["left", "right"] : ["top", "left", "right"]);

  const appliedMaxWidth = maxWidth ?? (isAnyTablet ? contentMaxWidth : undefined);
  const appliedPadding = noPadding ? 0 : horizontalPadding;

  return (
    <SafeAreaView
      edges={resolvedEdges}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      {header}
      <View
        style={[
          {
            flex: 1,
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
    </SafeAreaView>
  );
}
