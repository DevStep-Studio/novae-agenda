import {
  Calendar,
  CircleDollarSign,
  CreditCard,
  Percent,
  PieChart,
  TrendingUp,
  UserCheck,
  Users,
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

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { colors, fontFamily, radius, typography } from "@/constants/design-tokens";
import { ApiError } from "@/lib/api-client";
import { getCompanyReports, type ReportsDataDTO } from "@/lib/reports";
import { formatBRL } from "@/lib/stats";

const RANGES = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 Dias" },
  { key: "month", label: "Este Mês" },
  { key: "prev_month", label: "Mês Anterior" },
] as const;

export default function RelatoriosScreen() {
  const [range, setRange] = useState<"today" | "7d" | "month" | "prev_month">("month");
  const [data, setData] = useState<ReportsDataDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getCompanyReports(range);
      setData(res);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar os relatórios."
      );
    }
  }, [range]);

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

  const m = data?.metrics;
  const totalMethods =
    data?.byMethod?.reduce((acc, curr) => acc + curr.total, 0) || 1;

  return (
    <Screen
      header={<TopBar title="Relatórios & Analytics" company="Performance do negócio" showBack={true} />}
      style={{ paddingTop: 16 }}
    >
      {/* Seletor de Período */}
      <View style={{ marginBottom: 12 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {RANGES.map((r) => {
            const active = range === r.key;
            return (
              <Pressable
                key={r.key}
                onPress={() => setRange(r.key)}
                style={{
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderColor: active ? colors.primary : colors.border,
                  borderWidth: 1,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: radius.pill,
                }}
              >
                <Text
                  style={{
                    color: active ? colors.primaryForeground : colors.textSecondary,
                    fontSize: 13,
                    fontWeight: active ? "700" : "500",
                  }}
                >
                  {r.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
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
          contentContainerStyle={{ paddingBottom: 40, gap: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {/* Grid de KPIs Financeiros e Operacionais */}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <MetricCard
                label="Faturamento Realizado"
                value={formatBRL(m?.realizedRevenue ?? 0)}
                detail={`${m?.completedAppointments ?? 0} concluídos`}
                icon={CircleDollarSign}
                variant="teal"
              />
            </View>
            <View className="flex-1">
              <MetricCard
                label="Ticket Médio"
                value={formatBRL(m?.averageTicket ?? 0)}
                detail="Por atendimento"
                icon={TrendingUp}
                variant="teal"
              />
            </View>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <MetricCard
                label="Novos Clientes"
                value={String(m?.newClients ?? 0)}
                detail={`${m?.recurringClients ?? 0} recorrentes`}
                icon={Users}
                variant="teal"
              />
            </View>
            <View className="flex-1">
              <MetricCard
                label="Taxa de Ocupação"
                value={`${Math.round(m?.occupancyRate ?? 0)}%`}
                detail="Agenda preenchida"
                icon={Percent}
                variant="teal"
              />
            </View>
          </View>

          {/* Performance da Equipe */}
          {data?.byEmployee && data.byEmployee.length > 0 && (
            <View
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: radius.md,
                padding: 16,
                gap: 14,
              }}
            >
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: 16,
                  fontFamily: fontFamily.display,
                }}
              >
                Faturamento por Profissional
              </Text>

              {data.byEmployee.map((emp, idx) => (
                <View
                  key={emp.employeeId}
                  className="flex-row items-center justify-between py-1 border-b border-neutral-800 last:border-0"
                >
                  <View className="flex-row items-center gap-2.5 flex-1 pr-2" style={{ flex: 1, flexShrink: 1 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: "700", width: 18, flexShrink: 0 }}>
                      #{idx + 1}
                    </Text>
                    <Avatar name={emp.name} photoUrl={emp.photoUrl} size="md" />
                    <View className="gap-0.5" style={{ flex: 1, flexShrink: 1 }}>
                      <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "600", flexShrink: 1 }} numberOfLines={1}>
                        {emp.name}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                        {emp.appointments} {emp.appointments === 1 ? "atendimento" : "atendimentos"}
                      </Text>
                    </View>
                  </View>

                  <View className="items-end gap-0.5" style={{ flexShrink: 0 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "700" }}>
                      {formatBRL(emp.revenue)}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      Comissão: {formatBRL(emp.commission)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Formas de Pagamento */}
          {data?.byMethod && data.byMethod.length > 0 && (
            <View
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: radius.md,
                padding: 16,
                gap: 14,
              }}
            >
              <View className="flex-row items-center gap-2">
                <CreditCard size={18} color={colors.primary} />
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: 16,
                    fontFamily: fontFamily.display,
                  }}
                >
                  Meios de Pagamento
                </Text>
              </View>

              {data.byMethod.map((item) => {
                const percent = Math.round((item.total / totalMethods) * 100);
                const methodName =
                  item.method === "pix"
                    ? "Pix Instantâneo"
                    : item.method === "card"
                    ? "Cartão de Crédito / Débito"
                    : item.method === "cash"
                    ? "Dinheiro"
                    : item.method.toUpperCase();

                return (
                  <View key={item.method} className="gap-2">
                    <View className="flex-row items-center justify-between">
                      <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "500" }}>
                        {methodName}
                      </Text>
                      <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "700" }}>
                        {formatBRL(item.total)} ({percent}%)
                      </Text>
                    </View>

                    {/* Barra de Progresso */}
                    <View
                      style={{
                        backgroundColor: colors.surfaceSecondary,
                        height: 6,
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: colors.primary,
                          height: "100%",
                          width: `${Math.min(100, Math.max(5, percent))}%`,
                        }}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
