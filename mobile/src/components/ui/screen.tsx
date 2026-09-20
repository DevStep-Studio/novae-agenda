import type { ReactNode } from "react";
import { View, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
}

export function Screen({ header, noPadding, style, children, ...rest }: ScreenProps) {
  const { colors } = useTheme();

  return (
    <SafeAreaView
      edges={header ? ["left", "right", "bottom"] : ["top", "left", "right", "bottom"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      {header}
      <View className={noPadding ? "flex-1" : "flex-1 px-5"} style={style} {...rest}>
        {children}
      </View>
    </SafeAreaView>
  );
}
