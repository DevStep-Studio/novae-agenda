import {
  Bell,
  BellRing,
  Calendar,
  CalendarClock,
  CalendarPlus,
  CalendarX,
  Check,
  CheckCheck,
  CircleDollarSign,
  Clock,
  ExternalLink,
  Info,
  ShieldCheck,
  Sparkles,
  Star,
  UserCheck,
  Users,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { colors } from "@/constants/design-tokens";
import { ApiError } from "@/lib/api-client";
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationRead,
  simulateNotification,
  type NotificationDTO,
} from "@/lib/notifications";
import { useSession } from "@/lib/session-context";

type CategoryFilter = "all" | "unread" | "agendamentos" | "financeiro" | "sistema";

type NotificationMeta = {
  icon: React.ReactNode;
  badgeLabel: string;
  badgeColor: string;
  badgeBg: string;
  badgeBorder: string;
  iconColor: string;
  iconBg: string;
};

interface NotificationGroup {
  label: string;
  items: NotificationDTO[];
}

function isBookingType(n: NotificationDTO) {
  return (
    n.type.startsWith("booking.") ||
    n.type.startsWith("waitlist.") ||
    n.type.startsWith("customer.") ||
    n.type.startsWith("appointment_") ||
    n.type.startsWith("reminder") ||
    n.entityType === "appointment" ||
    n.entityType === "waitlist"
  );
}

function isFinanceType(n: NotificationDTO) {
  return (
    n.type.startsWith("payment.") ||
    n.type.startsWith("financial.") ||
    n.type.startsWith("subscription.") ||
    n.type === "appointment_completed" ||
    n.entityType === "financial" ||
    n.entityType === "subscription"
  );
}

function getNotificationMeta(item: NotificationDTO): NotificationMeta {
  const t = item.type.toLowerCase();
  const title = item.title.toLowerCase();
  const entity = item.entityType?.toLowerCase() || "";

  if (t.startsWith("review.") || title.includes("avaliação") || title.includes("estrelas") || title.includes("nota")) {
    return {
      icon: <Star size={16} color="#f59e0b" />,
      badgeLabel: "Avaliação",
      badgeColor: "#f59e0b",
      badgeBg: "rgba(245, 158, 11, 0.1)",
      badgeBorder: "rgba(245, 158, 11, 0.2)",
      iconColor: "#f59e0b",
      iconBg: "rgba(245, 158, 11, 0.12)",
    };
  }

  if (t.startsWith("payment.") || t.startsWith("financial.") || entity === "financial" || title.includes("pagamento") || title.includes("recebimento") || title.includes("pix")) {
    return {
      icon: <CircleDollarSign size={16} color="#10b981" />,
      badgeLabel: "Financeiro",
      badgeColor: "#10b981",
      badgeBg: "rgba(16, 185, 129, 0.1)",
      badgeBorder: "rgba(16, 185, 129, 0.2)",
      iconColor: "#10b981",
      iconBg: "rgba(16, 185, 129, 0.12)",
    };
  }

  if (t === "booking.rescheduled" || title.includes("remarcad") || title.includes("horário")) {
    return {
      icon: <CalendarClock size={16} color="#c084fc" />,
      badgeLabel: "Remarcação",
      badgeColor: "#c084fc",
      badgeBg: "rgba(168, 85, 247, 0.1)",
      badgeBorder: "rgba(168, 85, 247, 0.2)",
      iconColor: "#c084fc",
      iconBg: "rgba(168, 85, 247, 0.12)",
    };
  }

  if (t === "booking.cancelled" || title.includes("cancelad")) {
    return {
      icon: <CalendarX size={16} color="#f87171" />,
      badgeLabel: "Cancelamento",
      badgeColor: "#f87171",
      badgeBg: "rgba(239, 68, 68, 0.1)",
      badgeBorder: "rgba(239, 68, 68, 0.2)",
      iconColor: "#f87171",
      iconBg: "rgba(239, 68, 68, 0.12)",
    };
  }

  if (t.startsWith("reminder") || t === "booking.reminder" || title.includes("lembrete")) {
    return {
      icon: <BellRing size={16} color="#f59e0b" />,
      badgeLabel: "Lembrete",
      badgeColor: "#f59e0b",
      badgeBg: "rgba(245, 158, 11, 0.1)",
      badgeBorder: "rgba(245, 158, 11, 0.2)",
      iconColor: "#f59e0b",
      iconBg: "rgba(245, 158, 11, 0.12)",
    };
  }

  if (t === "booking.created" || t.startsWith("booking.") || entity === "appointment" || title.includes("agendamento")) {
    return {
      icon: <CalendarPlus size={16} color="#60a5fa" />,
      badgeLabel: "Agendamento",
      badgeColor: "#60a5fa",
      badgeBg: "rgba(59, 130, 246, 0.1)",
      badgeBorder: "rgba(59, 130, 246, 0.2)",
      iconColor: "#60a5fa",
      iconBg: "rgba(59, 130, 246, 0.12)",
    };
  }

  if (t.startsWith("subscription.") || t.startsWith("plan.") || entity === "subscription" || title.includes("assinatura") || title.includes("plano")) {
    return {
      icon: <ShieldCheck size={16} color="#22d3ee" />,
      badgeLabel: "Assinatura",
      badgeColor: "#22d3ee",
      badgeBg: "rgba(6, 182, 212, 0.1)",
      badgeBorder: "rgba(6, 182, 212, 0.2)",
      iconColor: "#22d3ee",
      iconBg: "rgba(6, 182, 212, 0.12)",
    };
  }

  if (t.startsWith("waitlist.") || entity === "waitlist" || title.includes("espera")) {
    return {
      icon: <Users size={16} color="#818cf8" />,
      badgeLabel: "Fila de Espera",
      badgeColor: "#818cf8",
      badgeBg: "rgba(99, 102, 241, 0.1)",
      badgeBorder: "rgba(99, 102, 241, 0.2)",
      iconColor: "#818cf8",
      iconBg: "rgba(99, 102, 241, 0.12)",
    };
  }

  if (t === "customer.arrived" || title.includes("recepção") || title.includes("chegou")) {
    return {
      icon: <UserCheck size={16} color="#4ade80" />,
      badgeLabel: "Recepção",
      badgeColor: "#4ade80",
      badgeBg: "rgba(34, 197, 94, 0.1)",
      badgeBorder: "rgba(34, 197, 94, 0.2)",
      iconColor: "#4ade80",
      iconBg: "rgba(34, 197, 94, 0.12)",
    };
  }

  return {
    icon: <Info size={16} color={colors.textSecondary} />,
    badgeLabel: "Sistema",
    badgeColor: colors.textMuted,
    badgeBg: colors.surfaceTertiary,
    badgeBorder: colors.border,
    iconColor: colors.textSecondary,
    iconBg: colors.surfaceTertiary,
  };
}

function formatTimestamp(dateStr: string) {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Agora mesmo";
    if (diffMins < 60) return `Há ${diffMins} min`;
    if (diffHours < 24)
      return `Hoje às ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    if (diffDays === 1)
      return `Ontem às ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return dateStr;
  }
}

export default function NotificacoesScreen() {
  const { session } = useSession();
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>("all");

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getNotifications("all", 50);
      setNotifications(res?.notifications || []);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não foi possível carregar as notificações."
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

  const counts = useMemo(() => {
    let unread = 0;
    let agendamentos = 0;
    let financeiro = 0;
    let sistema = 0;

    for (const n of notifications) {
      if (!n.readAt) unread++;
      if (isBookingType(n)) agendamentos++;
      else if (isFinanceType(n)) financeiro++;
      else sistema++;
    }

    return { total: notifications.length, unread, agendamentos, financeiro, sistema };
  }, [notifications]);

  const filteredList = useMemo(() => {
    if (activeFilter === "unread") return notifications.filter((n) => !n.readAt);
    if (activeFilter === "agendamentos") return notifications.filter(isBookingType);
    if (activeFilter === "financeiro") return notifications.filter(isFinanceType);
    if (activeFilter === "sistema") return notifications.filter((n) => !isBookingType(n) && !isFinanceType(n));
    return notifications;
  }, [notifications, activeFilter]);

  const groupedNotifications = useMemo<NotificationGroup[]>(() => {
    if (filteredList.length === 0) return [];

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const startOfThisWeek = startOfToday - 6 * 24 * 60 * 60 * 1000;

    const hoje: NotificationDTO[] = [];
    const ontem: NotificationDTO[] = [];
    const estaSemana: NotificationDTO[] = [];
    const anteriores: NotificationDTO[] = [];

    for (const item of filteredList) {
      const d = new Date(item.createdAt).getTime();
      if (isNaN(d)) {
        anteriores.push(item);
        continue;
      }
      if (d >= startOfToday) hoje.push(item);
      else if (d >= startOfYesterday) ontem.push(item);
      else if (d >= startOfThisWeek) estaSemana.push(item);
      else anteriores.push(item);
    }

    const result: NotificationGroup[] = [];
    if (hoje.length > 0) result.push({ label: "Hoje", items: hoje });
    if (ontem.length > 0) result.push({ label: "Ontem", items: ontem });
    if (estaSemana.length > 0) result.push({ label: "Esta semana", items: estaSemana });
    if (anteriores.length > 0) result.push({ label: "Anteriores", items: anteriores });
    return result;
  }, [filteredList]);

  async function handleMarkAllRead() {
    if (counts.unread === 0) return;
    setMarkingRead(true);
    try {
      await markAllNotificationsAsRead();
      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? now })));
    } catch {
      Alert.alert("Erro", "Não foi possível marcar as notificações como lidas.");
    } finally {
      setMarkingRead(false);
    }
  }

  async function handleSingleMarkRead(item: NotificationDTO) {
    try {
      await markNotificationRead(item.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n))
      );
    } catch {
      Alert.alert("Erro", "Não foi possível atualizar a notificação.");
    }
  }

  async function handleNotificationPress(item: NotificationDTO) {
    if (!item.readAt) {
      void handleSingleMarkRead(item);
    }
    if (item.entityType === "appointment") {
      router.push("/(owner)/agenda" as any);
    }
  }

  async function handleSimulate() {
    setSimulating(true);
    try {
      await simulateNotification("reminder_2h");
      await load();
    } catch (err) {
      Alert.alert("Erro", err instanceof Error ? err.message : "Erro ao simular notificação.");
    } finally {
      setSimulating(false);
    }
  }

  const filters: Array<{ key: CategoryFilter; label: string; icon?: React.ReactNode; count: number; highlight?: boolean }> = [
    { key: "all", label: "Todas", count: counts.total },
    { key: "unread", label: "Não lidas", count: counts.unread, highlight: true },
    { key: "agendamentos", label: "Agendamentos", icon: <Calendar size={12} color={colors.textSecondary} />, count: counts.agendamentos },
    { key: "financeiro", label: "Financeiro", icon: <CircleDollarSign size={12} color={colors.textSecondary} />, count: counts.financeiro },
    { key: "sistema", label: "Sistema", icon: <Info size={12} color={colors.textSecondary} />, count: counts.sistema },
  ];

  return (
    <Screen
      header={<TopBar title="Notificações" company={session?.company?.name || "Barbearia Pelly"} showBack={true} />}
      style={{ paddingTop: 16 }}
    >
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text style={{ color: colors.danger, textAlign: "center", marginBottom: 12 }}>{error}</Text>
          <Button label="Tentar novamente" onPress={load} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40, gap: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {/* Page Header */}
          <PageHeader
            eyebrow="CENTRAL DE AVISOS"
            title="Notificações"
            subtitle="Histórico completo de eventos, agendamentos, clientes e novidades da sua empresa."
            action={
              counts.unread > 0 ? (
                <View
                  className="py-1 px-2.5 rounded-full items-center justify-center self-start"
                  style={{ backgroundColor: colors.primary }}
                >
                  <Text style={{ color: colors.primaryForeground, fontSize: 11, fontWeight: "700" }}>
                    {counts.unread} {counts.unread === 1 ? "não lida" : "não lidas"}
                  </Text>
                </View>
              ) : null
            }
          />

            <View className="flex-row flex-wrap gap-2">
              {__DEV__ && (
                <Pressable
                  onPress={handleSimulate}
                  disabled={simulating}
                  className="flex-row items-center gap-1.5 py-2 px-3 rounded-lg border"
                  style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border, opacity: simulating ? 0.6 : 1 }}
                >
                  {simulating ? (
                    <ActivityIndicator size="small" color={colors.textSecondary} />
                  ) : (
                    <Sparkles size={13} color={colors.textSecondary} />
                  )}
                  <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>
                    {simulating ? "Simulando..." : "Simular Lembrete"}
                  </Text>
                </Pressable>
              )}

              {counts.unread > 0 && (
                <Pressable
                  onPress={handleMarkAllRead}
                  disabled={markingRead}
                  className="flex-row items-center gap-1.5 py-2 px-3 rounded-lg border"
                  style={{ backgroundColor: colors.primarySoft, borderColor: "rgba(220, 255, 76, 0.3)", opacity: markingRead ? 0.6 : 1 }}
                >
                  {markingRead ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <CheckCheck size={14} color={colors.primary} />
                  )}
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>
                    Marcar todas como lidas
                  </Text>
                </Pressable>
              )}
            </View>

          {/* Filter Tabs */}
          <View
            className="rounded-xl border p-1"
            style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
              {filters.map((f) => {
                const isActive = activeFilter === f.key;
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => setActiveFilter(f.key)}
                    className="flex-row items-center gap-1.5 py-2 px-3 rounded-lg"
                    style={{
                      backgroundColor: isActive ? colors.surface : "transparent",
                      borderWidth: isActive ? 1 : 0,
                      borderColor: colors.borderStrong,
                    }}
                  >
                    {f.icon}
                    <Text
                      style={{
                        color: isActive ? colors.textPrimary : colors.textSecondary,
                        fontSize: 12.5,
                        fontWeight: isActive ? "700" : "500",
                      }}
                    >
                      {f.label}
                    </Text>
                    {f.count > 0 && (
                      <View
                        className="px-1.5 rounded-full items-center justify-center"
                        style={{
                          backgroundColor: f.highlight ? colors.primary : "rgba(255, 255, 255, 0.08)",
                          minWidth: 18,
                          height: 16,
                        }}
                      >
                        <Text
                          style={{
                            color: f.highlight ? colors.primaryForeground : colors.textMuted,
                            fontSize: 10,
                            fontWeight: f.highlight ? "700" : "600",
                          }}
                        >
                          {f.count}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Notification Stream */}
          {groupedNotifications.length > 0 ? (
            <View className="gap-5">
              {groupedNotifications.map((group) => (
                <View key={group.label} className="gap-2">
                  <View className="flex-row items-center justify-between px-1">
                    <Text
                      style={{
                        color: colors.textMuted,
                        fontSize: 11,
                        fontWeight: "700",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      {group.label}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                      {group.items.length} {group.items.length === 1 ? "notificação" : "notificações"}
                    </Text>
                  </View>

                  <View className="gap-2">
                    {group.items.map((item) => {
                      const isUnread = !item.readAt;
                      const meta = getNotificationMeta(item);

                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => handleNotificationPress(item)}
                          className="flex-row items-start gap-3 p-3.5 rounded-xl border overflow-hidden"
                          style={{
                            backgroundColor: isUnread ? colors.surface : colors.surfaceSecondary,
                            borderColor: isUnread ? colors.borderStrong : colors.border,
                            opacity: isUnread ? 1 : 0.84,
                          }}
                        >
                          {isUnread && (
                            <View
                              style={{
                                position: "absolute",
                                left: 0,
                                top: 14,
                                bottom: 14,
                                width: 3,
                                borderRadius: 3,
                                backgroundColor: colors.primary,
                              }}
                            />
                          )}

                          <View
                            className="w-9 h-9 rounded-lg items-center justify-center"
                            style={{ backgroundColor: meta.iconBg }}
                          >
                            {meta.icon}
                          </View>

                          <View className="flex-1 gap-0.5">
                            <View className="flex-row items-center flex-wrap gap-1.5">
                              <Text style={{ color: colors.textPrimary, fontSize: 13.5, fontWeight: "600", flexShrink: 1 }}>
                                {item.title}
                              </Text>
                              <View
                                className="py-0.5 px-1.5 rounded border"
                                style={{ backgroundColor: meta.badgeBg, borderColor: meta.badgeBorder }}
                              >
                                <Text style={{ color: meta.badgeColor, fontSize: 9.5, fontWeight: "700", textTransform: "uppercase" }}>
                                  {meta.badgeLabel}
                                </Text>
                              </View>
                            </View>

                            {item.body ? (
                              <Text style={{ color: colors.textSecondary, fontSize: 12.5, lineHeight: 17 }}>
                                {item.body}
                              </Text>
                            ) : null}

                            <View className="flex-row items-center gap-3.5 mt-1">
                              <View className="flex-row items-center gap-1">
                                <Clock size={11} color={colors.textMuted} />
                                <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                                  {formatTimestamp(item.createdAt)}
                                </Text>
                              </View>

                              {item.entityType === "appointment" && item.entityId && (
                                <View className="flex-row items-center gap-1">
                                  <ExternalLink size={11} color={colors.primary} />
                                  <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "600" }}>
                                    Ver agendamento
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>

                          {isUnread && (
                            <Pressable
                              onPress={() => handleSingleMarkRead(item)}
                              className="w-7 h-7 rounded-md border items-center justify-center"
                              style={{ backgroundColor: colors.surfaceTertiary, borderColor: colors.border }}
                            >
                              <Check size={13} color={colors.textSecondary} />
                            </Pressable>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View
              className="items-center justify-center rounded-xl border border-dashed p-8 gap-2"
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            >
              <View
                className="w-11 h-11 rounded-full items-center justify-center"
                style={{ backgroundColor: colors.surfaceSecondary }}
              >
                <Bell size={20} color={colors.textMuted} />
              </View>
              <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700" }}>
                {activeFilter === "unread" ? "Tudo em dia!" : "Nenhuma notificação encontrada"}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12.5, textAlign: "center", lineHeight: 18 }}>
                {activeFilter === "unread"
                  ? "Você já visualizou todas as notificações recentes."
                  : "Quando ocorrerem agendamentos, pagamentos ou novidades no sistema, eles aparecerão aqui."}
              </Text>
              {__DEV__ && (
                <Pressable
                  onPress={handleSimulate}
                  disabled={simulating}
                  className="flex-row items-center gap-1.5 py-2 px-3 rounded-lg border mt-1"
                  style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}
                >
                  <Sparkles size={13} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>
                    Simular Notificação de Teste
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
