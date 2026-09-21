import type { BottomTabBarProps } from "expo-router/tabs";
import { Plus } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";

import { bottomNav } from "@/constants/design-tokens";
import { useTheme } from "@/hooks/use-theme";
import { useSession } from "@/lib/session-context";

// .mobile-bottom-nav / .mobile-nav-item / .mobile-nav-indicator / .mobile-nav-add-btn
// globals.css:8589-8706. Pixel perfect match with web responsive bottom bar.
export function BottomTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { session } = useSession();
  const { primaryColor, primaryForeground } = useTheme();

  const visibleRoutes = state.routes.filter((route) => {
    const { options } = descriptors[route.key];
    if ((options as any).href === null) return false;
    if (typeof options.tabBarIcon !== "function") return false;
    return true;
  });

  const renderRoute = (route: (typeof visibleRoutes)[0]) => {
    const { options } = descriptors[route.key];
    const label = options.title ?? route.name;
    const focused = state.routes[state.index]?.key === route.key;
    const color = focused ? primaryColor : bottomNav.itemInactiveColor;

    return (
      <Pressable
        key={route.key}
        accessibilityRole="button"
        accessibilityState={focused ? { selected: true } : {}}
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          paddingVertical: 6,
        }}
        onPress={() => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        }}
      >
        {options.tabBarIcon?.({ focused, color, size: bottomNav.iconSize })}
        <Text style={{ color, fontSize: 11, fontWeight: focused ? "600" : "500" }}>{label}</Text>
        {focused ? (
          <View
            style={{
              width: bottomNav.indicatorWidth,
              height: bottomNav.indicatorHeight,
              backgroundColor: primaryColor,
              borderRadius: 99,
              marginTop: 2,
            }}
          />
        ) : null}
      </Pressable>
    );
  };

  // Split routes around center FAB
  const leftRoutes = visibleRoutes.slice(0, 2);
  const rightRoutes = visibleRoutes.slice(2);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
        borderTopWidth: 1,
        height: bottomNav.height + insets.bottom,
        paddingBottom: insets.bottom,
        backgroundColor: bottomNav.background,
        borderTopColor: bottomNav.borderTopColor,
      }}
    >
      {leftRoutes.map(renderRoute)}

      {/* Center Elevated "+" FAB */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Novo agendamento"
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          marginTop: -14,
        }}
        onPress={() => {
          if (session?.role === "employee") {
            router.push("/(employee)");
          } else {
            router.push("/(owner)/agenda");
          }
        }}
      >
        <View
          style={{
            width: bottomNav.addButtonSize,
            height: bottomNav.addButtonSize,
            borderRadius: bottomNav.addButtonSize / 2,
            backgroundColor: primaryColor,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          <Plus size={24} color={primaryForeground} strokeWidth={2.5} />
        </View>
        <Text style={{ color: bottomNav.itemInactiveColor, fontSize: 11, fontWeight: "500" }}>Novo</Text>
      </Pressable>

      {rightRoutes.map(renderRoute)}
    </View>
  );
}
