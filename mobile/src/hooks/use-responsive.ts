import { useWindowDimensions } from "react-native";
import {
  BREAKPOINTS,
  CONTENT_MAX_WIDTH,
  RESPONSIVE_SPACING,
  ScreenCategory,
  clamp,
  getGridColumns,
  getScreenCategory,
  scaleFont,
} from "@/lib/responsive";

export interface ResponsiveInfo {
  width: number;
  height: number;
  fontScale: number;
  scale: number;

  category: ScreenCategory;
  isCompact: boolean;
  isPhone: boolean;
  isLargePhone: boolean;
  isTablet: boolean;
  isLargeTablet: boolean;
  isAnyTablet: boolean;
  isLandscape: boolean;

  horizontalPadding: number;
  cardGap: number;
  sectionGap: number;
  itemGap: number;

  formMaxWidth: number;
  contentMaxWidth: number;
  dashboardMaxWidth: number;

  metricColumns: number;
  cardColumns: number;
  shortcutColumns: number;

  scaleFont: (baseSize: number, minFactor?: number, maxFactor?: number) => number;
  clamp: (val: number, min: number, max: number) => number;
}

export function useResponsive(): ResponsiveInfo {
  const { width, height, fontScale, scale } = useWindowDimensions();

  const category = getScreenCategory(width);
  const isCompact = category === "compact";
  const isPhone = category === "phone";
  const isLargePhone = category === "largePhone";
  const isTablet = category === "tablet";
  const isLargeTablet = category === "largeTablet";
  const isAnyTablet = isTablet || isLargeTablet;
  const isLandscape = width > height;

  const spacing = RESPONSIVE_SPACING[category];

  const metricColumns = getGridColumns(category, "metrics");
  const cardColumns = getGridColumns(category, "cards");
  const shortcutColumns = getGridColumns(category, "shortcuts");

  return {
    width,
    height,
    fontScale,
    scale,

    category,
    isCompact,
    isPhone,
    isLargePhone,
    isTablet,
    isLargeTablet,
    isAnyTablet,
    isLandscape,

    horizontalPadding: spacing.screenPadding,
    cardGap: spacing.cardGap,
    sectionGap: spacing.sectionGap,
    itemGap: spacing.itemGap,

    formMaxWidth: CONTENT_MAX_WIDTH.form,
    contentMaxWidth: isAnyTablet ? CONTENT_MAX_WIDTH.tabletWide : width,
    dashboardMaxWidth: CONTENT_MAX_WIDTH.dashboard,

    metricColumns,
    cardColumns,
    shortcutColumns,

    scaleFont: (baseSize: number, minFactor?: number, maxFactor?: number) =>
      scaleFont(baseSize, fontScale, minFactor, maxFactor),
    clamp,
  };
}
