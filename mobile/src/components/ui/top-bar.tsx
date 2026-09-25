import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarPlus,
  Check,
  CheckCheck,
  CheckCircle2,
  DollarSign,
  Menu,
  Moon,
  Sparkles,
  Sun,
  X,
  XCircle,
} from "lucide-react-native";
import { Image } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
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
import { useTheme, hexToRgba } from "@/hooks/use-theme";
import { SidebarDrawer } from "@/components/drawer/sidebar-drawer";

import { useResponsive } from "@/hooks/use-responsive";
import { scaleFont } from "@/lib/responsive";

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
  const { isDark, toggleTheme, colors: themeColors, primaryColor, companyName: brandingCompanyName, ownerAvatarUrl, logoUrl } = useTheme();
  const { isCompact, isTablet, horizontalPadding, contentMaxWidth } = useResponsive();

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

  const companyName = company || brandingCompanyName || session?.company?.name || session?.name || "Reservei";
  const rawAvatarUrl = ownerAvatarUrl || logoUrl || session?.company?.logoUrl || session?.avatarUrl;
  const avatarUris = resolveImageUrlWithFallback(rawAvatarUrl);

  const activeAvatarUrl = !avatarFailedPrimary
    ? avatarUris.primary
    : !avatarFailedFallback
    ? avatarUris.fallback
    : null;

  const initials = (session?.name || companyName || "RE")
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
          paddingHorizontal: horizontalPadding,
          backgroundColor: isDark ? "#0a0b0e" : "#ffffff",
          borderBottomColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
          zIndex: 90,
        }}
      >
        {/* Left Side: Back or Hamburger Menu + Title & Company */}
        <View className="flex-row items-center flex-1 min-w-0 pr-2" style={{ gap: isCompact ? 4 : 8 }}>
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
                fontSize: scaleFont(17, { min: 14.5, max: 18 }),
                fontWeight: "700",
                letterSpacing: -0.4,
                lineHeight: isCompact ? 18 : 21,
              }}
              numberOfLines={1}
            >
              {title}
            </Text>
            {companyName ? (
              <Text
                style={{
                  color: isDark ? "#9ca3af" : "#64748b",
                  fontSize: scaleFont(12, { min: 10.5, max: 13 }),
                  fontWeight: "500",
                  lineHeight: isCompact ? 13 : 15,
                }}
                numberOfLines={1}
              >
                {companyName}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Right Side Actions: Theme Toggle, Notifications, Avatar */}
        <View className="flex-row items-center" style={{ gap: isCompact ? 4 : 8 }}>
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
            style={{
              flex: 1,
              backgroundColor: "rgba(0, 0, 0, 0.65)",
              paddingTop: insets.top + 58,
              paddingHorizontal: 16,
            }}
          >
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View
                style={{
                  backgroundColor: "#111217",
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.1)",
                  shadowColor: "#000000",
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.55,
                  shadowRadius: 20,
                  elevation: 12,
                  overflow: "hidden",
                  maxHeight: 460,
                }}
              >
                {/* Popover Header */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: 16,
                    paddingVertical: 13,
                    backgroundColor: "#16171f",
                    borderBottomWidth: 1,
                    borderBottomColor: "rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        backgroundColor: hexToRgba(primaryColor, 0.16),
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Bell size={14} color={primaryColor} />
                    </View>
                    <Text style={{ color: "#ffffff", fontSize: 14.5, fontWeight: "700" }}>
                      Notificações
                    </Text>
                    {unreadCount > 0 && (
                      <View
                        style={{
                          backgroundColor: hexToRgba(primaryColor, 0.18),
                          paddingHorizontal: 7,
                          paddingVertical: 1.5,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: hexToRgba(primaryColor, 0.3),
                        }}
                      >
                        <Text style={{ color: primaryColor, fontSize: 11, fontWeight: "700" }}>
                          {unreadCount} novas
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {unreadCount > 0 && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={handleMarkAllAsRead}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          paddingHorizontal: 9,
                          paddingVertical: 4.5,
                          borderRadius: 8,
                          backgroundColor: hexToRgba(primaryColor, 0.14),
                          borderWidth: 1,
                          borderColor: hexToRgba(primaryColor, 0.3),
                        }}
                      >
                        <CheckCheck size={13} color={primaryColor} strokeWidth={2.2} />
                        <Text style={{ color: primaryColor, fontSize: 11.5, fontWeight: "700" }}>
                          Marcar lidas
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setNotificationsOpen(false)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        backgroundColor: "rgba(255, 255, 255, 0.06)",
                        alignItems: "center",
                        justifyContent: "center",
                        marginLeft: 2,
                      }}
                    >
                      <X size={15} color="#a1a1aa" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Popover Body */}
                <ScrollView style={{ maxHeight: 310 }} showsVerticalScrollIndicator={false}>
                  {notifications.length > 0 ? (
                    notifications.slice(0, 6).map((n) => {
                      const isUnread = !n.readAt;
                      const textCombined = `${n.title} ${n.body} ${n.type}`.toLowerCase();
                      const isSuccess =
                        textCombined.includes("finalizado") ||
                        textCombined.includes("recebido") ||
                        textCombined.includes("pix") ||
                        textCombined.includes("pagamento");
                      const isCancel =
                        textCombined.includes("cancelad") ||
                        textCombined.includes("recusad");
                      const isBooking =
                        textCombined.includes("agendamento") ||
                        textCombined.includes("reserva") ||
                        n.entityType === "appointment";

                      const IconComp = isSuccess
                        ? CheckCircle2
                        : isCancel
                        ? XCircle
                        : isBooking
                        ? CalendarPlus
                        : Bell;

                      const iconColor = isSuccess
                        ? "#10b981"
                        : isCancel
                        ? "#ef4444"
                        : isBooking
                        ? primaryColor
                        : "#94a3b8";

                      const iconBg = isSuccess
                        ? "rgba(16, 185, 129, 0.14)"
                        : isCancel
                        ? "rgba(239, 68, 68, 0.14)"
                        : isBooking
                        ? hexToRgba(primaryColor, 0.15)
                        : "rgba(148, 163, 184, 0.12)";

                      const iconBorder = isSuccess
                        ? "rgba(16, 185, 129, 0.28)"
                        : isCancel
                        ? "rgba(239, 68, 68, 0.28)"
                        : isBooking
                        ? hexToRgba(primaryColor, 0.3)
                        : "rgba(148, 163, 184, 0.2)";

                      return (
                        <TouchableOpacity
                          key={n.id}
                          activeOpacity={0.7}
                          onPress={() => {
                            setNotificationsOpen(false);
                            if (n.entityType === "appointment") {
                              router.push("/(owner)/agenda" as any);
                            } else {
                              router.push("/(owner)/notificacoes" as any);
                            }
                          }}
                          style={{
                            flexDirection: "row",
                            alignItems: "flex-start",
                            gap: 12,
                            paddingHorizontal: 14,
                            paddingVertical: 12,
                            borderBottomWidth: 1,
                            borderBottomColor: "rgba(255, 255, 255, 0.06)",
                            backgroundColor: isUnread ? hexToRgba(primaryColor, 0.05) : "transparent",
                          }}
                        >
                          {/* Notification Type Icon Badge */}
                          <View
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 10,
                              backgroundColor: iconBg,
                              borderWidth: 1,
                              borderColor: iconBorder,
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              marginTop: 1,
                            }}
                          >
                            <IconComp size={17} color={iconColor} strokeWidth={2} />
                          </View>

                          {/* Text Info */}
                          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                              <Text
                                style={{
                                  color: isUnread ? "#ffffff" : "#cbd5e1",
                                  fontSize: 13.5,
                                  fontWeight: isUnread ? "700" : "600",
                                  flex: 1,
                                  marginRight: 6,
                                }}
                                numberOfLines={1}
                              >
                                {n.title}
                              </Text>
                              <Text style={{ color: "#71717a", fontSize: 11, fontWeight: "500" }}>
                                {formatShortDate(n.createdAt)}
                              </Text>
                            </View>

                            {n.body ? (
                              <Text
                                style={{
                                  color: "#9ca3af",
                                  fontSize: 12,
                                  lineHeight: 16,
                                }}
                                numberOfLines={2}
                              >
                                {n.body}
                              </Text>
                            ) : null}
                          </View>

                          {/* Unread dot */}
                          {isUnread && (
                            <View
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: 3.5,
                                backgroundColor: primaryColor,
                                marginTop: 6,
                                flexShrink: 0,
                              }}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <View style={{ paddingVertical: 36, alignItems: "center", justifyContent: "center", gap: 10 }}>
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          backgroundColor: "rgba(255, 255, 255, 0.05)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Bell size={20} color="#71717a" />
                      </View>
                      <Text style={{ color: "#9ca3af", fontSize: 13, fontWeight: "500" }}>
                        Nenhuma notificação no momento.
                      </Text>
                    </View>
                  )}
                </ScrollView>

                {/* Popover Footer */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    setNotificationsOpen(false);
                    router.push("/(owner)/notificacoes" as any);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    backgroundColor: "#15171f",
                    borderTopWidth: 1,
                    borderTopColor: "rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <Text style={{ color: primaryColor, fontSize: 13, fontWeight: "700" }}>
                    Ver todas na Central
                  </Text>
                  <ArrowRight size={14} color={primaryColor} strokeWidth={2.4} />
                </TouchableOpacity>
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
