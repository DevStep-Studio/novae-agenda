import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'background' | 'surface' | 'surfaceSecondary' | 'primary';
};

export function ThemedView({ style, lightColor, darkColor, type, ...otherProps }: ThemedViewProps) {
  const { colors, isDark, primaryColor } = useTheme();

  const customColor = isDark ? darkColor : lightColor;
  const bg =
    customColor ||
    (type === 'surface'
      ? colors.surface
      : type === 'surfaceSecondary'
        ? colors.surfaceSecondary
        : type === 'primary'
          ? primaryColor
          : colors.background);

  return <View style={[{ backgroundColor: bg }, style]} {...otherProps} />;
}
