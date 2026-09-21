import type { ReactNode } from "react";
import { View, type ViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { useTheme } from "@/hooks/use-theme";

export interface ScreenProps extends ViewProps {
  /**
   * Full-bleed content rendered above the padded body, e.g. <TopBar />. When
   * present, TopBar owns the top safe-area inset itself (it renders edge to
   * edge like the web's `.topbar`), so the SafeAreaView here skips the top
   * edge to avoid double-padding.
   */
  header?: ReactNode;
  /** Opt out of the default 20px horizontal padding for full-bleed content (e.g. login's banner image). */
  noPadding?: boolean;
  /**
   * Explicit edges for SafeAreaView. Defaults to skipping top when header is present,
   * and skipping bottom because BottomTabBar and scroll views manage their own bottom insets,
   * avoiding double-padding / black bar above the navbar.
   */
  edges?: readonly Edge[];
}

export function Screen({ header, noPadding, edges, style, children, ...rest }: ScreenProps) {
  const { colors } = useTheme();

  const resolvedEdges: readonly Edge[] =
    edges ?? (header ? ["left", "right"] : ["top", "left", "right"]);

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
            paddingHorizontal: noPadding ? 0 : 20,
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
