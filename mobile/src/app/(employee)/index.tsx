import {
  Calendar,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  MapPin,
  Scissors,
  User,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { colors, fontFamily, radius, typography } from "@/constants/design-tokens";
import { ApiError } from "@/lib/api-client";
import { getAppointments, statusLabel, todayKey, type AppointmentDTO } from "@/lib/appointments";
import { formatBRL } from "@/lib/stats";
import { useSession } from "@/lib/session-context";

export default function EmployeeAgendaScreen() {
  const { session } = useSession();
  const [appointments, setAppointments] = useState<AppointmentDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const today = todayKey();
      const res = await getAppointments({ from: today, to: today });
      setAppointments(res || []);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar sua agenda."
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      async function run() {
        await load();
        if (!cancelled) setLoading(false);
      }
      run();
      return () => {
        cancelled = true;
      };
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const todayRevenue = appointments
    .filter((a) => a.status === "completed" || a.status === "confirmed")
    .reduce((acc, a) => acc + (Number(a.total) || 0), 0);

  return (
    <Screen header={<TopBar title="Minha Agenda" company={session?.company?.name} />}>
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
        <FlatList
          data={appointments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 32, gap: 14 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            <View style={{ gap: 12, marginBottom: 8 }}>
              <PageHeader
                eyebrow="AGENDA DO PROFISSIONAL"
                title="Meus Atendimentos"
                subtitle="Consulte sua programação diária e valores previstos."
              />
              <View className="flex-row gap-2.5">
                <View className="flex-1">
                  <MetricCard
                    label="Atendimentos Hoje"
                    value={String(appointments.length)}
                    detail="Agendados"
                    icon={CalendarDays}
                    variant="teal"
                  />
                </View>
                <View className="flex-1">
                  <MetricCard
                    label="Faturamento Estimado"
                    value={formatBRL(todayRevenue)}
                    detail="Previsto hoje"
                    icon={CircleDollarSign}
                    variant="teal"
                  />
                </View>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View
              className="items-center justify-center rounded-xl border p-8 mt-2"
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            >
              <CalendarDays size={36} color={colors.textMuted} />
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: 16,
                  fontWeight: "600",
                  marginTop: 12,
                }}
              >
                Nenhum atendimento para hoje
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 13,
                  textAlign: "center",
                  marginTop: 4,
                }}
              >
                Novos agendamentos marcados para você aparecerão aqui automaticamente.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: radius.md,
                padding: 16,
                gap: 12,
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2.5 flex-1 pr-2" style={{ flex: 1, flexShrink: 1 }}>
                  <View
                    style={{
                      backgroundColor: colors.primarySoft,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: radius.sm,
                      flexShrink: 0,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.primary,
                        fontSize: 13,
                        fontWeight: "800",
                      }}
                    >
                      {item.startTime}
                    </Text>
                  </View>

                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontSize: 16,
                      fontWeight: "600",
                      flexShrink: 1,
                    }}
                    numberOfLines={1}
                  >
                    {item.clientName}
                  </Text>
                </View>

                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 15,
                    fontFamily: fontFamily.display,
                    flexShrink: 0,
                  }}
                >
                  {formatBRL(item.total)}
                </Text>
              </View>

              <View
                className="flex-row items-center justify-between rounded-lg p-2.5"
                style={{ backgroundColor: colors.surfaceSecondary }}
              >
                <View className="flex-row items-center gap-2 flex-1 pr-2" style={{ flex: 1, flexShrink: 1 }}>
                  <Scissors size={14} color={colors.textMuted} />
                  <Text style={{ color: colors.textSecondary, fontSize: 13, flexShrink: 1 }} numberOfLines={1}>
                    {item.serviceName}
                  </Text>
                </View>

                <Text style={{ color: colors.textMuted, fontSize: 12, flexShrink: 0 }}>
                  {statusLabel(item.status)}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </Screen>
  );
}
