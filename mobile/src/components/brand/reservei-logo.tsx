import { Image } from "expo-image";
import { StyleProp, View, ViewStyle } from "react-native";

import { useTheme } from "@/hooks/use-theme";

export interface ReserveiLogoProps {
  variant?: "full" | "symbol";
  height?: number;
  color?: "white" | "black" | "auto";
  style?: StyleProp<ViewStyle>;
}

export function ReserveiLogo({
  variant = "full",
  height = 30,
  color = "auto",
  style,
}: ReserveiLogoProps) {
  const { isDark } = useTheme();

  const isWhite = color === "white" || (color === "auto" && isDark);

  if (variant === "symbol") {
    const symbolSource = isWhite
      ? require("../../../assets/images/symbol-white.png")
      : require("../../../assets/images/symbol.png");

    return (
      <View style={[{ width: height, height: height }, style]}>
        <Image
          source={symbolSource}
          style={{ width: height, height: height }}
          contentFit="contain"
        />
      </View>
    );
  }

  // Official Full Logo: 1947 x 822 (aspect ratio = 2.3686)
  const width = Math.round(height * 2.3686);
  const logoSource = isWhite
    ? require("../../../assets/images/reservei-logo.png")
    : require("../../../assets/images/logo-black.png");

  return (
    <View style={[{ width, height, justifyContent: "center" }, style]}>
      <Image
        source={logoSource}
        style={{ width, height }}
        contentFit="contain"
      />
    </View>
  );
}
