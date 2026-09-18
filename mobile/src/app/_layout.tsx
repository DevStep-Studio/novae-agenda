import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import {
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import "@/global.css";
import { SessionProvider, useSession } from "@/lib/session-context";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { loading } = useSession();
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  const ready = !loading && fontsLoaded;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Keep the native splash screen up instead of flashing a blank JS screen while
  // the session cookie (if any) is validated against GET /api/auth/session, or
  // rendering with the wrong fallback font before Plus Jakarta Sans/DM Sans load.
  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(owner)" />
      <Stack.Screen name="(employee)" />
      <Stack.Screen name="(customer)" />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
            <RootNavigator />
          </ThemeProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
