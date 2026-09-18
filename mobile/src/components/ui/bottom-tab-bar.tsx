import type { BottomTabBarProps } from "expo-router/tabs";
import { Pressable, Text, View } from "react-native";

import { bottomNav } from "@/constants/design-tokens";

// .mobile-bottom-nav / .mobile-nav-item / .mobile-nav-indicator,
// globals.css:8589-8648. Note this bar is NOT tinted with the app's
// `--primary` at all — active state on the web is plain white text/icon plus
// a small white underline bar, on an always-dark background regardless of
// the rest of the app's theme. See MOBILE_DESIGN_SYSTEM.md.
//
// Início/Agenda/Clientes/Mais are wired up so far, in the web's left-to-right
// order — only the center "Novo" FAB (appointment creation) is still
// missing, since that flow doesn't exist in the mobile app yet. Adding a
// button with nowhere to navigate would be a fake affordance, so this
// renders honestly with the real routes and is built to take the FAB once
// appointment creation lands (see MOBILE_DESIGN_SYSTEM.md).
export function BottomTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  return (
    <View
      className="flex-row items-center justify-around border-t"
      style={{
        height: bottomNav.height + insets.bottom,
        paddingBottom: insets.bottom,
        backgroundColor: bottomNav.background,
        borderTopColor: bottomNav.borderTopColor,
      }}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const focused = state.index === index;
        const color = focused ? bottomNav.itemActiveColor : bottomNav.itemInactiveColor;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            className="flex-1 items-center justify-center gap-[3px] py-1.5"
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
                  backgroundColor: bottomNav.itemActiveColor,
                  borderRadius: 99,
                  marginTop: 2,
                }}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
