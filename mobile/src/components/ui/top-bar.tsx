import { ArrowLeft, Bell, Menu, Sun } from "lucide-react-native";
import { Image, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, typography } from "@/constants/design-tokens";
import { useSession } from "@/lib/session-context";
import { SidebarDrawer } from "@/components/drawer/sidebar-drawer";

export interface TopBarProps {
  title: string;
  company?: string | null;
  showBack?: boolean;
  onBack?: () => void;
  unreadCount?: number;
}

export function TopBar({ title, company, showBack, onBack, unreadCount = 1 }: TopBarProps) {
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(owner)/mais");
    }
  };

  const companyName = company || session?.company?.name || "Moa Tattoo";
  const avatarUrl = session?.company?.logoUrl || session?.avatarUrl;
  const initials = (session?.name || companyName || "MO")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <>
      <View
        className="flex-row items-center justify-between border-b px-3.5"
        style={{
          paddingTop: insets.top,
          height: 64 + insets.top,
          backgroundColor: "#0d0e11",
          borderBottomColor: "rgba(255, 255, 255, 0.08)",
        }}
      >
        {/* Left side: Back button OR Hamburger Menu + Title */}
        <View className="flex-row items-center gap-2.5 flex-1 min-w-0 pr-2">
          {showBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              onPress={handleBack}
              hitSlop={10}
              className="mr-1 items-center justify-center rounded-lg p-2"
              style={{ backgroundColor: colors.surfaceSecondary }}
            >
              <ArrowLeft size={18} color={colors.textPrimary} />
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abrir menu"
              onPress={() => setDrawerOpen(true)}
              hitSlop={10}
              className="mr-1 items-center justify-center rounded-lg p-1.5"
              style={{ backgroundColor: "transparent" }}
            >
              <Menu size={22} color="#ffffff" />
            </Pressable>
          )}

          <View className="gap-0.5 flex-1 min-w-0">
            <Text style={{ color: "#ffffff", ...typography.topbarTitle }} numberOfLines={1}>
              {title}
            </Text>
            {companyName ? (
              <Text style={{ color: colors.textMuted, ...typography.topbarCompany }} numberOfLines={1}>
                {companyName}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Right side actions: Theme toggle, Notifications with red badge, Avatar with online dot */}
        <View className="flex-row items-center gap-1.5">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Alternar tema"
            hitSlop={8}
            className="items-center justify-center rounded-lg"
            style={{ width: 36, height: 36, backgroundColor: "transparent" }}
          >
            <Sun size={18} color={colors.textSecondary} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notificações"
            hitSlop={8}
            onPress={() => router.push("/(owner)/notificacoes")}
            className="relative items-center justify-center rounded-lg"
            style={{ width: 36, height: 36, backgroundColor: "transparent" }}
          >
            <Bell size={18} color={colors.textSecondary} />
            {unreadCount > 0 && (
              <View
                className="absolute items-center justify-center"
                style={{
                  top: 2,
                  right: 2,
                  minWidth: 15,
                  height: 15,
                  paddingHorizontal: 3,
                  borderRadius: 999,
                  backgroundColor: "#ef4444",
                  borderWidth: 1.5,
                  borderColor: "#0d0e11",
                }}
              >
                <Text style={{ color: "#ffffff", fontSize: 9, fontWeight: "800", lineHeight: 10 }}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Perfil e configurações"
            hitSlop={8}
            onPress={() => router.push("/(owner)/perfil" as any)}
            className="relative ml-1"
          >
            <View
              className="items-center justify-center rounded-full overflow-hidden"
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: "#222328",
                borderWidth: 1.5,
                borderColor: "rgba(255, 255, 255, 0.15)",
              }}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={{ width: 34, height: 34 }} resizeMode="cover" />
              ) : (
                <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "700" }}>
                  {initials}
                </Text>
              )}
            </View>
            {/* Online green indicator dot */}
            <View
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: "#10b981",
                borderWidth: 1.5,
                borderColor: "#0d0e11",
              }}
            />
          </Pressable>
        </View>
      </View>

      <SidebarDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        unreadCount={unreadCount}
      />
    </>
  );
}
