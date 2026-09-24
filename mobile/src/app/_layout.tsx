import "../global.css";
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
import { LogBox, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import * as Linking from "expo-linking";
import { AppThemeProvider, useAppTheme } from "@/lib/theme-context";
import { SessionProvider, useSession } from "@/lib/session-context";
import { setupNotificationListeners } from "@/lib/push-notifications";
import { OfflineBanner } from "@/components/ui/offline-banner";

// Suppress intrusive development warning / LogBox toast overlays in Expo Go
LogBox.ignoreAllLogs(true);
if (typeof console !== "undefined") {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    const msg = typeof args[0] === "string" ? args[0] : "";
    if (
      msg.includes("expo-notifications") ||
      msg.includes("Android Push") ||
      msg.includes("development build")
    ) {
      return;
    }
    originalWarn(...args);
  };
}

SplashScreen.preventAutoHideAsync();

function RootThemeContainer({ children }: { children: React.ReactNode }) {
  const { isDark } = useAppTheme();
  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      {children}
    </ThemeProvider>
  );
}

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

  // Handle incoming Universal Links & Deep Links (e.g. https://usereservei.com.br/agendar/:slug or reservei://agendar/:slug)
  useEffect(() => {
    function handleIncomingUrl(rawUrl: string | null) {
      if (!rawUrl) return;
      try {
        const parsed = Linking.parse(rawUrl);
        const path = (parsed.path || "").replace(/^\/+/, "");
        if (path.startsWith("agendar/")) {
          const slugPart = path.replace(/^agendar\//, "");
          if (slugPart) {
            router.push(`/agendar/${encodeURIComponent(slugPart)}` as any);
          }
        } else if (path.startsWith("r/")) {
          const slugPart = path.replace(/^r\//, "");
          if (slugPart) {
            router.push(`/agendar/${encodeURIComponent(slugPart)}` as any);
          }
        } else if (path && !path.startsWith("(") && !path.includes("api/")) {
          const knownAppRoutes = ["login", "register", "gestao", "minhas-reservas", "verify-email"];
          const firstSegment = path.split("/")[0];
          if (!knownAppRoutes.includes(firstSegment)) {
            router.push(`/agendar/${encodeURIComponent(firstSegment)}` as any);
          }
        }
      } catch (err) {
        console.warn("[Deep Link Parse Error]:", err);
      }
    }

    Linking.getInitialURL().then(handleIncomingUrl);
    const sub = Linking.addEventListener("url", (event) => handleIncomingUrl(event.url));
    return () => {
      sub.remove();
    };
  }, [router]);

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
        <Stack.Screen name="agendar/[slug]" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <AppThemeProvider>
            <RootThemeContainer>
              <RootNavigator />
            </RootThemeContainer>
          </AppThemeProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
