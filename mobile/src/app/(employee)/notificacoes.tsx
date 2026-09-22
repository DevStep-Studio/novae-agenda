import {
  AlertCircle,
  Bell,
  Calendar,
  CheckCheck,
  CircleDollarSign,
  MessageSquare,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { colors, radius } from "@/constants/design-tokens";
import { ApiError } from "@/lib/api-client";
import {
  getNotifications,
  markAllNotificationsAsRead,
  type NotificationDTO,
} from "@/lib/notifications";

function getNotificationIcon(type: string) {
  switch (type) {
    case "booking_created":
    case "appointment_created":
    case "booking.created":
      return <Calendar size={18} color={colors.primary} />;
    case "booking_cancelled":
    case "appointment_cancelled":
    case "booking.cancelled":
      return <AlertCircle size={18} color={colors.danger} />;
    case "review_received":
      return <MessageSquare size={18} color="#f59e0b" />;
    case "payment_received":
      return <CircleDollarSign size={18} color={colors.success} />;
    default:
      return <Bell size={18} color={colors.primary} />;
  }
}

export default function EmployeeNotificacoesScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "bookings">("all");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getNotifications();
      setNotifications(res?.notifications || []);
      setUnreadCount(res?.unreadCount || 0);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar as notificações."
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      await load();
      if (!cancelled) setLoading(false);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleMarkAllRead() {
    try {
      setMarkingRead(true);
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      setUnreadCount(0);
    } catch {
      // Non-blocking
    } finally {
      setMarkingRead(false);
    }
  }

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.readAt;
    if (filter === "bookings") return n.type.includes("booking") || n.type.includes("appointment");
    return true;
  });

  return (
    <Screen
      header={<TopBar title="Notificações" company="Meus atendimentos" showBack={true} />}
      style={{ paddingTop: 16 }}
    >
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-6 text-center">
          <Text style={{ color: colors.danger, textAlign: "center", marginBottom: 12 }}>
            {error}
          </Text>
          <Button label="Tentar novamente" onPress={load} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40, gap: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {/* Filter Tabs */}
          <View className="flex-row items-center gap-2 pb-1">
            <Pressable
              onPress={() => setFilter("all")}
              style={{
                backgroundColor: filter === "all" ? colors.primary : colors.surfaceSecondary,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: radius.pill,
              }}
            >
              <Text
                style={{
                  color: filter === "all" ? colors.background : colors.textSecondary,
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                Todas ({notifications.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setFilter("unread")}
              style={{
                backgroundColor: filter === "unread" ? colors.primary : colors.surfaceSecondary,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: radius.pill,
              }}
            >
              <Text
                style={{
                  color: filter === "unread" ? colors.background : colors.textSecondary,
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                Não lidas ({unreadCount})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setFilter("bookings")}
              style={{
                backgroundColor: filter === "bookings" ? colors.primary : colors.surfaceSecondary,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: radius.pill,
              }}
            >
              <Text
                style={{
                  color: filter === "bookings" ? colors.background : colors.textSecondary,
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                Agendamentos
              </Text>
            </Pressable>
          </View>

          {/* Action to Mark All as Read */}
          {unreadCount > 0 && (
            <View className="flex-row items-center justify-end pb-1">
              <Pressable
                onPress={handleMarkAllRead}
                disabled={markingRead}
                className="flex-row items-center gap-1.5 py-1 px-2.5 rounded-md"
                style={{ backgroundColor: colors.surfaceSecondary }}
              >
                <CheckCheck size={14} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>
                  Marcar lidas
                </Text>
              </Pressable>
            </View>
          )}

          {/* List */}
          {filteredNotifications.length === 0 ? (
            <View
              className="items-center justify-center rounded-xl border p-8 mt-4"
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            >
              <Bell size={36} color={colors.textMuted} />
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: 16,
                  fontWeight: "600",
                  marginTop: 12,
                }}
              >
                Nenhuma notificação
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 13,
                  textAlign: "center",
                  marginTop: 4,
                }}
              >
                Você receberá avisos a cada novo atendimento atribuído ou remarcado.
              </Text>
            </View>
          ) : (
            filteredNotifications.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  if (item.entityType === "booking" || item.type.includes("booking")) {
                    router.push("/(employee)/" as any);
                  }
                }}
                style={{
                  backgroundColor: item.readAt ? colors.surface : colors.surfaceSecondary,
                  borderColor: item.readAt ? colors.border : colors.primary,
                  borderWidth: item.readAt ? 1 : 1.5,
                  borderRadius: radius.md,
                  padding: 14,
                  gap: 8,
                }}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                    <View
                      style={{
                        backgroundColor: colors.surfaceTertiary,
                        padding: 7,
                        borderRadius: radius.sm,
                        flexShrink: 0,
                      }}
                    >
                      {getNotificationIcon(item.type)}
                    </View>

                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontSize: 14,
                        fontWeight: item.readAt ? "600" : "700",
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                  </View>

                  <Text style={{ color: colors.textMuted, fontSize: 11, flexShrink: 0 }}>
                    {new Date(item.createdAt).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>

                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 13,
                    lineHeight: 18,
                    paddingLeft: 36,
                  }}
                >
                  {item.body}
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
