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
import { PageHeader } from "@/components/ui/page-header";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { fontFamily, radius, typography } from "@/constants/design-tokens";
import { useTheme } from "@/hooks/use-theme";
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
  const { colors, primaryColor, primaryForeground, isDark } = useTheme();
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
      <PageHeader
        eyebrow="ANÁLISES & INDICADORES"
        title="Relatórios"
        subtitle="Acompanhe métricas detalhadas de desempenho, clientes e serviços."
        style={{ marginBottom: 16 }}
      />

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
              className="p-4 rounded-2xl border gap-3.5"
              style={{
                backgroundColor: "#111216",
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              {/* Header */}
              <View
                className="flex-row items-center justify-between pb-3 border-b"
                style={{ borderBottomColor: "rgba(255, 255, 255, 0.06)" }}
              >
                <View className="flex-row items-center gap-2">
                  <UserCheck size={16} color="#a1a1aa" />
                  <Text
                    style={{
                      color: "#ffffff",
                      fontSize: 15,
                      fontWeight: "700",
                    }}
                  >
                    Faturamento por Profissional
                  </Text>
                </View>
                <View
                  className="px-2.5 py-0.5 rounded-full border"
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.04)",
                    borderColor: "rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <Text style={{ color: "#a1a1aa", fontSize: 11, fontWeight: "600" }}>
                    {data.byEmployee.length} {data.byEmployee.length === 1 ? "profissional" : "profissionais"}
                  </Text>
                </View>
              </View>

              {/* Lista de Profissionais */}
              <View className="gap-2.5">
                {data.byEmployee.map((emp, idx) => {
                  const isTop1 = idx === 0;
                  const isTop2 = idx === 1;

                  return (
                    <View
                      key={emp.employeeId}
                      className="p-3 rounded-xl border flex-row items-center justify-between"
                      style={{
                        backgroundColor: "#181920",
                        borderColor: isTop1
                          ? "rgba(234, 179, 8, 0.2)"
                          : "rgba(255, 255, 255, 0.07)",
                      }}
                    >
                      {/* Left: Rank + Avatar + Name + Appointments */}
                      <View className="flex-row items-center gap-2.5 flex-1 pr-2" style={{ flexShrink: 1 }}>
                        <View
                          className="w-6 h-6 rounded-lg items-center justify-center border"
                          style={{
                            backgroundColor: isTop1
                              ? "rgba(234, 179, 8, 0.12)"
                              : isTop2
                              ? "rgba(148, 163, 184, 0.12)"
                              : "rgba(255, 255, 255, 0.04)",
                            borderColor: isTop1
                              ? "rgba(234, 179, 8, 0.28)"
                              : isTop2
                              ? "rgba(148, 163, 184, 0.2)"
                              : "rgba(255, 255, 255, 0.08)",
                          }}
                        >
                          <Text
                            style={{
                              color: isTop1 ? "#eab308" : isTop2 ? "#94a3b8" : "#71717a",
                              fontSize: 11,
                              fontWeight: "800",
                            }}
                          >
                            {idx + 1}º
                          </Text>
                        </View>

                        <Avatar name={emp.name} photoUrl={emp.photoUrl} size="md" />

                        <View className="gap-0.5 flex-1" style={{ flexShrink: 1 }}>
                          <Text
                            style={{ color: "#ffffff", fontSize: 14, fontWeight: "700" }}
                            numberOfLines={1}
                          >
                            {emp.name}
                          </Text>
                          <Text style={{ color: "#a1a1aa", fontSize: 12 }}>
                            {emp.appointments} {emp.appointments === 1 ? "atendimento" : "atendimentos"}
                          </Text>
                        </View>
                      </View>

                      {/* Right: Faturamento + Comissão */}
                      <View className="items-end gap-0.5" style={{ flexShrink: 0 }}>
                        <Text style={{ color: "#ffffff", fontSize: 14.5, fontWeight: "800", letterSpacing: 0.2 }}>
                          {formatBRL(emp.revenue)}
                        </Text>
                        <Text
                          style={{
                            color: emp.commission > 0 ? "#34d399" : "#71717a",
                            fontSize: 11.5,
                            fontWeight: emp.commission > 0 ? "600" : "500",
                          }}
                        >
                          Comissão: {formatBRL(emp.commission)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Formas de Pagamento */}
          {data?.byMethod && data.byMethod.length > 0 && (
            <View
              className="p-4 rounded-2xl border gap-3.5"
              style={{
                backgroundColor: "#111216",
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <View
                className="flex-row items-center gap-2 pb-3 border-b"
                style={{ borderBottomColor: "rgba(255, 255, 255, 0.06)" }}
              >
                <CreditCard size={16} color="#a1a1aa" />
                <Text
                  style={{
                    color: "#ffffff",
                    fontSize: 15,
                    fontWeight: "700",
                  }}
                >
                  Meios de Pagamento
                </Text>
              </View>

              <View className="gap-2.5">
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
                    <View
                      key={item.method}
                      className="p-3 rounded-xl border gap-2"
                      style={{
                        backgroundColor: "#181920",
                        borderColor: "rgba(255, 255, 255, 0.07)",
                      }}
                    >
                      <View className="flex-row items-center justify-between">
                        <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "600" }}>
                          {methodName}
                        </Text>
                        <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "700" }}>
                          {formatBRL(item.total)}{" "}
                          <Text style={{ color: "#a1a1aa", fontSize: 12, fontWeight: "500" }}>
                            ({percent}%)
                          </Text>
                        </Text>
                      </View>

                      {/* Barra de Progresso */}
                      <View
                        style={{
                          backgroundColor: "rgba(255, 255, 255, 0.06)",
                          height: 5,
                          borderRadius: 3,
                          overflow: "hidden",
                        }}
                      >
                        <View
                          style={{
                            backgroundColor: colors.primary || "#38bdf8",
                            height: "100%",
                            borderRadius: 3,
                            width: `${Math.min(100, Math.max(5, percent))}%`,
                          }}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
