import { ArrowLeft, ArrowRight, Bell, Check, CheckCheck, Menu, Moon, Sun, X } from "lucide-react-native";
import { Image } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, typography } from "@/constants/design-tokens";
import { resolveImageUrl, resolveImageUrlWithFallback } from "@/lib/api-client";
import {
  getNotifications,
  markAllNotificationsAsRead,
  type NotificationDTO,
} from "@/lib/notifications";
import { useSession } from "@/lib/session-context";
import { useTheme } from "@/hooks/use-theme";
import { SidebarDrawer } from "@/components/drawer/sidebar-drawer";

export interface TopBarProps {
  title: string;
  company?: string | null;
  showBack?: boolean;
  onBack?: () => void;
  unreadCount?: number;
}

export function TopBar({
  title,
  company,
  showBack,
  onBack,
  unreadCount: propUnreadCount,
}: TopBarProps) {
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const { isDark, toggleTheme, colors: themeColors, primaryColor } = useTheme();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(propUnreadCount ?? 1);
  const [avatarFailedPrimary, setAvatarFailedPrimary] = useState(false);
  const [avatarFailedFallback, setAvatarFailedFallback] = useState(false);

  // Sync prop unreadCount if provided
  useEffect(() => {
    if (propUnreadCount !== undefined) {
      setUnreadCount(propUnreadCount);
    }
  }, [propUnreadCount]);

  // Fetch real notifications and unread count
  const loadNotifications = useCallback(async () => {
    try {
      const res = await getNotifications("all", 10);
      if (res?.notifications) {
        setNotifications(res.notifications);
        if (propUnreadCount === undefined) {
          setUnreadCount(res.unreadCount ?? (res.notifications.length > 0 ? 1 : 0));
        }
      }
    } catch {
      // Fallback gracefully
    }
  }, [propUnreadCount]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(owner)/mais");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      setUnreadCount(0);
    }
  };

  const companyName = company || session?.company?.name || session?.name || "Reservei";
  const rawAvatarUrl = session?.company?.logoUrl || session?.avatarUrl;
  const avatarUris = resolveImageUrlWithFallback(rawAvatarUrl);

  const activeAvatarUrl = !avatarFailedPrimary
    ? avatarUris.primary
    : !avatarFailedFallback
    ? avatarUris.fallback
    : null;

  const initials = (session?.name || companyName || "MO")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  const formatShortDate = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(d);
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      <View
        className="flex-row items-center justify-between border-b"
        style={{
          paddingTop: insets.top,
          height: 60 + insets.top,
          paddingHorizontal: 16,
          backgroundColor: isDark ? "#0a0b0e" : "#ffffff",
          borderBottomColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
          zIndex: 90,
        }}
      >
        {/* Left Side: Back or Hamburger Menu + Title & Company */}
        <View className="flex-row items-center flex-1 min-w-0 pr-2" style={{ gap: 4 }}>
          {showBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              onPress={handleBack}
              hitSlop={10}
              className="items-center justify-center rounded-lg"
              style={{
                width: 40,
                height: 40,
                minWidth: 40,
                minHeight: 40,
                marginRight: 2,
                backgroundColor: "transparent",
              }}
            >
              <ArrowLeft size={20} color={isDark ? "#ffffff" : "#0f172a"} strokeWidth={2.2} />
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Menu"
              onPress={() => setDrawerOpen(true)}
              hitSlop={10}
              className="items-center justify-center rounded-lg"
              style={{
                width: 40,
                height: 40,
                minWidth: 40,
                minHeight: 40,
                marginRight: 2,
                backgroundColor: "transparent",
              }}
            >
              <Menu size={22} color={isDark ? "#ffffff" : "#0f172a"} strokeWidth={2.2} />
            </Pressable>
          )}

          <View className="flex-col justify-center flex-1 min-w-0" style={{ gap: 1 }}>
            <Text
              style={{
                color: isDark ? "#ffffff" : "#0f172a",
                fontSize: 17,
                fontWeight: "700",
                letterSpacing: -0.4,
                lineHeight: 21,
              }}
              numberOfLines={1}
            >
              {title}
            </Text>
            {companyName ? (
              <Text
                style={{
                  color: isDark ? "#9ca3af" : "#64748b",
                  fontSize: 12,
                  fontWeight: "500",
                  lineHeight: 15,
                }}
                numberOfLines={1}
              >
                {companyName}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Right Side Actions: Theme Toggle, Notifications, Avatar */}
        <View className="flex-row items-center" style={{ gap: 8 }}>
          {/* Theme Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Alternar tema"
            hitSlop={8}
            onPress={toggleTheme}
            className="items-center justify-center rounded-lg"
            style={{
              width: 38,
              height: 38,
              minWidth: 38,
              minHeight: 38,
              backgroundColor: "transparent",
            }}
          >
            {isDark ? (
              <Sun size={19} color="#9ca3af" strokeWidth={1.8} />
            ) : (
              <Moon size={19} color="#4b5563" strokeWidth={1.8} />
            )}
          </Pressable>

          {/* Notifications Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notificações"
            hitSlop={8}
            onPress={() => {
              void loadNotifications();
              setNotificationsOpen(true);
            }}
            className="relative items-center justify-center rounded-lg"
            style={{
              width: 38,
              height: 38,
              minWidth: 38,
              minHeight: 38,
              backgroundColor: "transparent",
            }}
          >
            <Bell size={19} color="#9ca3af" strokeWidth={1.8} />
            {unreadCount > 0 && (
              <View
                className="absolute items-center justify-center"
                style={{
                  top: 2,
                  right: 2,
                  minWidth: 16,
                  height: 16,
                  paddingHorizontal: 3,
                  borderRadius: 999,
                  backgroundColor: "#ef4444",
                  borderWidth: 1.5,
                  borderColor: isDark ? "#0a0b0e" : "#ffffff",
                }}
              >
                <Text
                  style={{
                    color: "#ffffff",
                    fontSize: 9,
                    fontWeight: "800",
                    lineHeight: 11,
                    textAlign: "center",
                  }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </Pressable>

          {/* Avatar Profile Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Meu Perfil"
            hitSlop={8}
            onPress={() => router.push("/(owner)/perfil" as any)}
            className="relative"
            style={{ marginLeft: 2 }}
          >
            <View
              className="items-center justify-center overflow-hidden"
              style={{
                width: 36,
                height: 36,
                minWidth: 36,
                minHeight: 36,
                borderRadius: 9,
                backgroundColor: "#181920",
                borderWidth: 1.5,
                borderColor: "rgba(255, 255, 255, 0.15)",
              }}
            >
              {activeAvatarUrl ? (
                <Image
                  source={{ uri: activeAvatarUrl }}
                  style={{ width: 36, height: 36, borderRadius: 8 }}
                  contentFit="cover"
                  priority="high"
                  onError={() => {
                    if (!avatarFailedPrimary && avatarUris.fallback && avatarUris.fallback !== avatarUris.primary) {
                      setAvatarFailedPrimary(true);
                    } else {
                      setAvatarFailedFallback(true);
                    }
                  }}
                />
              ) : (
                <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "700" }}>
                  {initials}
                </Text>
              )}
            </View>
            {/* Online Status Dot */}
            <View
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 9,
                height: 9,
                borderRadius: 4.5,
                backgroundColor: "#10b981",
                borderWidth: 1.5,
                borderColor: isDark ? "#0a0b0e" : "#ffffff",
                zIndex: 2,
              }}
            />
          </Pressable>
        </View>
      </View>

      {/* Notifications Popover Dropdown Modal */}
      <Modal
        visible={notificationsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setNotificationsOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setNotificationsOpen(false)}>
          <View
            className="flex-1"
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.55)",
              paddingTop: insets.top + 64,
              paddingHorizontal: 16,
            }}
          >
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View
                className="rounded-2xl border overflow-hidden"
                style={{
                  backgroundColor: "#121318",
                  borderColor: "rgba(255, 255, 255, 0.12)",
                  shadowColor: "#000000",
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.5,
                  shadowRadius: 16,
                  elevation: 10,
                  maxHeight: 420,
                }}
              >
                {/* Popover Header */}
                <View
                  className="flex-row items-center justify-between px-4 py-3 border-b"
                  style={{
                    backgroundColor: "#16181f",
                    borderBottomColor: "rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "700" }}>
                    Notificações {unreadCount > 0 ? `(${unreadCount} novas)` : ""}
                  </Text>
                  {unreadCount > 0 && (
                    <Pressable
                      onPress={handleMarkAllAsRead}
                      className="px-2 py-1 rounded-md"
                      style={{ backgroundColor: "rgba(255, 255, 255, 0.08)" }}
                    >
                      <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700" }}>
                        Marcar lidas
                      </Text>
                    </Pressable>
                  )}
                </View>

                {/* Popover Body */}
                <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
                  {notifications.length > 0 ? (
                    notifications.slice(0, 6).map((n) => (
                      <Pressable
                        key={n.id}
                        onPress={() => {
                          setNotificationsOpen(false);
                          if (n.entityType === "appointment") {
                            router.push("/(owner)/agenda" as any);
                          } else {
                            router.push("/(owner)/notificacoes" as any);
                          }
                        }}
                        className="p-3.5 border-b"
                        style={{
                          borderBottomColor: "rgba(255, 255, 255, 0.06)",
                          backgroundColor: !n.readAt ? "rgba(220, 255, 76, 0.04)" : "transparent",
                        }}
                      >
                        <View className="flex-row items-center justify-between mb-1">
                          <Text
                            style={{
                              color: !n.readAt ? "#ffffff" : "#d1d5db",
                              fontSize: 13,
                              fontWeight: !n.readAt ? "700" : "500",
                              flex: 1,
                              marginRight: 8,
                            }}
                            numberOfLines={1}
                          >
                            {n.title}
                          </Text>
                          <Text style={{ color: "#6b7280", fontSize: 11 }}>
                            {formatShortDate(n.createdAt)}
                          </Text>
                        </View>
                        {n.body ? (
                          <Text
                            style={{ color: "#9ca3af", fontSize: 12, lineHeight: 16 }}
                            numberOfLines={2}
                          >
                            {n.body}
                          </Text>
                        ) : null}
                      </Pressable>
                    ))
                  ) : (
                    <View className="py-8 items-center justify-center">
                      <Bell size={24} color="#6b7280" />
                      <Text style={{ color: "#9ca3af", fontSize: 13, marginTop: 8 }}>
                        Nenhuma notificação no momento.
                      </Text>
                    </View>
                  )}
                </ScrollView>

                {/* Popover Footer */}
                <Pressable
                  onPress={() => {
                    setNotificationsOpen(false);
                    router.push("/(owner)/notificacoes" as any);
                  }}
                  className="flex-row items-center justify-center gap-2 py-3 px-4 border-t"
                  style={{
                    backgroundColor: "#16181f",
                    borderTopColor: "rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <Text style={{ color: colors.primary, fontSize: 12.5, fontWeight: "700" }}>
                    Ver todas na Central
                  </Text>
                  <ArrowRight size={14} color={colors.primary} />
                </Pressable>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Sidebar Navigation Drawer */}
      <SidebarDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        unreadCount={unreadCount}
      />
    </>
  );
}
