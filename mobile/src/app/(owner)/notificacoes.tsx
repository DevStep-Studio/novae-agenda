import {
  AlertCircle,
  Bell,
  Calendar,
  CheckCheck,
  CircleDollarSign,
  MessageSquare,
  Sparkles,
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

import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { colors, radius, typography } from "@/constants/design-tokens";
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
      return <Calendar size={18} color={colors.primary} />;
    case "booking_cancelled":
    case "appointment_cancelled":
      return <AlertCircle size={18} color={colors.danger} />;
    case "review_received":
      return <MessageSquare size={18} color="#f59e0b" />;
    case "payment_received":
      return <CircleDollarSign size={18} color={colors.success} />;
    default:
      return <Bell size={18} color={colors.primary} />;
  }
}

export default function NotificacoesScreen() {
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
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
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      // Non-blocking
    } finally {
      setMarkingRead(false);
    }
  }

  return (
    <Screen style={{ paddingHorizontal: 0, paddingBottom: 0 }}>
      <View style={{ paddingHorizontal: 16 }}>
        <TopBar
          title="Notificações"
          company="Central de avisos"
        />
      </View>

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
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {/* Ação de Marcar Todas como Lidas */}
          {unreadCount > 0 && (
            <View className="flex-row items-center justify-between pb-1">
              <View className="flex-row items-center gap-2">
                <View
                  style={{
                    backgroundColor: colors.primary,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                  }}
                />
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  {unreadCount} não {unreadCount === 1 ? "lida" : "lidas"}
                </Text>
              </View>

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

          {/* Lista de Notificações */}
          {notifications.length === 0 ? (
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
                Tudo limpo por aqui!
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 13,
                  textAlign: "center",
                  marginTop: 4,
                }}
              >
                Você receberá notificações instantâneas a cada novo agendamento, avaliação ou lembrete.
              </Text>
            </View>
          ) : (
            notifications.map((item) => (
              <View
                key={item.id}
                style={{
                  backgroundColor: item.read ? colors.surface : colors.surfaceSecondary,
                  borderColor: item.read ? colors.border : colors.primary,
                  borderWidth: item.read ? 1 : 1.5,
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
                      }}
                    >
                      {getNotificationIcon(item.type)}
                    </View>

                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontSize: 14,
                        fontWeight: item.read ? "600" : "700",
                        flex: 1,
                      }}
                    >
                      {item.title}
                    </Text>
                  </View>

                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
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
              </View>
            ))
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
