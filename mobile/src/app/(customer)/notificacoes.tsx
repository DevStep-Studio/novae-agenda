import {
  AlertCircle,
  Bell,
  Calendar,
  CheckCheck,
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
import { PageHeader } from "@/components/ui/page-header";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { colors, radius } from "@/constants/design-tokens";
import { ApiError } from "@/lib/api-client";
import {
  getNotifications,
  markAllNotificationsAsRead,
  type NotificationDTO,
} from "@/lib/notifications";

export default function CustomerNotificacoesScreen() {
  const router = useRouter();
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
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      setUnreadCount(0);
    } catch {
      // Non-blocking
    } finally {
      setMarkingRead(false);
    }
  }

  return (
    <Screen
      header={<TopBar title="Notificações" company="Minhas reservas" showBack={true} />}
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
          {/* Header da Página */}
          <PageHeader
            eyebrow="CENTRAL DE ALERTAS"
            title="Notificações"
            subtitle={unreadCount > 0 ? `${unreadCount} nova${unreadCount > 1 ? "s" : ""} mensagem${unreadCount > 1 ? "s" : ""}` : "Todas as suas notificações e avisos em dia."}
          />

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
                Você receberá avisos sobre suas reservas e lembretes 2 horas antes do atendimento.
              </Text>
            </View>
          ) : (
            notifications.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  router.push("/(customer)/" as any);
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
                      {item.type.includes("cancel") ? (
                        <AlertCircle size={18} color={colors.danger} />
                      ) : (
                        <Calendar size={18} color={colors.primary} />
                      )}
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
