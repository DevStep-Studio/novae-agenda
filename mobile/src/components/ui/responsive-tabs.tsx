import React, { useRef, useEffect } from "react";
import {
  ScrollView,
  Pressable,
  Text,
  View,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useResponsive } from "@/hooks/use-responsive";
import { useTheme } from "@/hooks/use-theme";
import { radius } from "@/constants/design-tokens";

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  count?: number;
  badgeCount?: number;
  icon?: React.ReactNode | React.ComponentType<{ size?: number; color?: string; className?: string }>;
}

export interface ResponsiveTabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange?: (tabId: T) => void;
  onTabChange?: (tabId: T) => void;
  style?: StyleProp<ViewStyle>;
  variant?: "pill" | "underline" | "card";
}

export function ResponsiveTabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  onTabChange,
  style,
  variant = "pill",
}: ResponsiveTabsProps<T>) {
  const { isCompact, isTablet } = useResponsive();
  const { isDark, primaryColor, colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  const handleSelect = (tabId: T) => {
    if (onTabChange) onTabChange(tabId);
    else if (onChange) onChange(tabId);
  };

  // If few tabs and enough space, don't force scroll; otherwise allow horizontal scroll
  const shouldScroll = tabs.length > 3 || isCompact;

  const activeBg = primaryColor;
  const activeTextColor = variant === "underline" ? primaryColor : "#0a0a0a";
  const inactiveBg = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)";
  const inactiveTextColor = isDark ? "#94a3b8" : "#64748b";
  const borderColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)";

  const content = tabs.map((tab) => {
    const isActive = tab.id === activeTab;
    const badgeNum = tab.badgeCount ?? tab.count;

    return (
      <Pressable
        key={tab.id}
        onPress={() => handleSelect(tab.id)}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        style={[
          styles.tabBase,
          variant === "pill" && {
            backgroundColor: isActive ? activeBg : inactiveBg,
            borderColor: isActive ? "transparent" : borderColor,
            borderRadius: radius.pill,
          },
          variant === "card" && {
            backgroundColor: isActive ? activeBg : inactiveBg,
            borderColor: isActive ? "transparent" : borderColor,
            borderRadius: radius.sm,
          },
          variant === "underline" && {
            backgroundColor: "transparent",
            borderBottomWidth: 2,
            borderBottomColor: isActive ? primaryColor : "transparent",
            borderRadius: 0,
            paddingHorizontal: 14,
            paddingVertical: 10,
          },
          !shouldScroll && styles.tabFlex,
        ]}
      >
        {tab.icon ? (
          <View style={{ marginRight: 6 }}>
            {React.isValidElement(tab.icon)
              ? tab.icon
              : typeof tab.icon === "function" || typeof tab.icon === "object"
                ? React.createElement(tab.icon as React.ComponentType<{ size?: number; color?: string }>, {
                    size: 15,
                    color: isActive ? activeTextColor : inactiveTextColor,
                  })
                : null}
          </View>
        ) : null}
        <Text
          numberOfLines={1}
          style={[
            styles.tabText,
            {
              color: isActive ? activeTextColor : inactiveTextColor,
              fontWeight: isActive ? "700" : "500",
            },
          ]}
        >
          {tab.label}
        </Text>
        {typeof badgeNum === "number" && badgeNum > 0 ? (
          <View
            style={[
              styles.countBadge,
              {
                backgroundColor: isActive
                  ? (variant === "underline" ? primaryColor : "rgba(0, 0, 0, 0.18)")
                  : (isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.08)"),
              },
            ]}
          >
            <Text
              style={[
                styles.countText,
                { color: isActive && variant === "underline" ? "#0a0a0a" : isActive ? activeTextColor : inactiveTextColor },
              ]}
            >
              {badgeNum}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  });

  if (shouldScroll) {
    return (
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContainer, style]}
        style={{ flexGrow: 0 }}
      >
        {content}
      </ScrollView>
    );
  }

  return <View style={[styles.flexRowContainer, style]}>{content}</View>;
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  flexRowContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "100%",
    paddingVertical: 4,
  },
  tabBase: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    minHeight: 36,
  },
  tabFlex: {
    flex: 1,
  },
  tabText: {
    fontSize: 13,
    letterSpacing: -0.2,
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 99,
    marginLeft: 6,
  },
  countText: {
    fontSize: 11,
    fontWeight: "700",
  },
});
