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
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import "@/global.css";
import { SessionProvider, useSession } from "@/lib/session-context";
import { setupNotificationListeners } from "@/lib/push-notifications";
import { OfflineBanner } from "@/components/ui/offline-banner";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const router = useRouter();
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

  useEffect(() => {
    const cleanup = setupNotificationListeners(
      (notification) => {
        console.log("[Push Notification Foreground]:", notification.request.content.title);
      },
      (response) => {
        const data = response.notification.request.content.data;
        const targetUrl = data?.url;
        if (typeof targetUrl === "string") {
          const ALLOWED_PREFIXES = [
            "/(owner)/",
            "/(employee)/",
            "/(customer)/",
          ];
          const isAllowed = ALLOWED_PREFIXES.some((prefix) => targetUrl.startsWith(prefix));
          if (isAllowed) {
            try {
              router.push(targetUrl as any);
            } catch (err) {
              console.warn("[Deep Link Error]:", err);
            }
          }
        }
      }
    );
    return cleanup;
  }, [router]);


  // Keep the native splash screen up instead of flashing a blank JS screen while
  // the session cookie (if any) is validated against GET /api/auth/session, or
  // rendering with the wrong fallback font before Plus Jakarta Sans/DM Sans load.
  if (!ready) return null;

  return (
    <>
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(owner)" />
        <Stack.Screen name="(employee)" />
        <Stack.Screen name="(customer)" />
      </Stack>
    </>
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
