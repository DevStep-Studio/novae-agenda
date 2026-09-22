import { BarChart3, CalendarDays, ReceiptText, Tag, TrendingUp, Users, WalletCards } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import { Screen } from "@/components/ui/screen";
import { SectionHeading } from "@/components/ui/section-heading";
import { ServiceRankRow, type ServiceRankRowData } from "@/components/ui/service-rank-row";
import { TeamRankRow, type TeamRankRowData } from "@/components/ui/team-rank-row";
import { TopBar } from "@/components/ui/top-bar";
import { colors, typography } from "@/constants/design-tokens";
import { ApiError } from "@/lib/api-client";
import { getAppointments, type AppointmentDTO } from "@/lib/appointments";
import { getEmployees, type EmployeeDTO } from "@/lib/employees";
import { formatBRL } from "@/lib/stats";
import { useSession } from "@/lib/session-context";

const PENDING_STATUSES = new Set(["scheduled", "confirmed", "waiting", "in_progress"]);
const PAYMENT_LABELS: Record<string, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  debit: "Débito",
  credit: "Crédito",
  other: "Outro",
};

type FinancialPeriod = "today" | "week" | "month" | "all";

const PERIOD_TABS: Array<{ id: FinancialPeriod; label: string }> = [
  { id: "today", label: "Hoje" },
  { id: "week", label: "Esta semana" },
  { id: "month", label: "Este mês" },
  { id: "all", label: "Todo o histórico" },
];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Mirrors FinancialPage's own date-window logic, app-shell.tsx:2562-2582.
function periodRange(period: FinancialPeriod): { from?: string; to?: string } {
  const now = new Date();
  const todayStr = isoDate(now);

  if (period === "today") return { from: todayStr, to: todayStr };

  if (period === "week") {
    const d = new Date(now);
    const day = d.getDay();
    const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diffToMonday));
    return { from: isoDate(monday), to: todayStr };
  }

  if (period === "month") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: isoDate(first), to: isoDate(last) };
  }

  // "all" — no date filter at all, same as the web's own unfiltered store fetch.
  return {};
}

// Mirrors FinancialPage in app-shell.tsx:2555-3004: header, period tabs, 4-card
// KPI grid, 7-day revenue bar chart, team ranking, services ranking, and the
// payment-method breakdown. Computed the same way as the web's primary path —
// straight from real appointments for the selected window, not the /api/stats
// aggregate. One intentional adaptation: the web loads the company's entire
// unfiltered appointment list once (its global store) and re-filters it
// client-side per period/chart; mobile instead asks the server for exactly the
// date range each section needs (period window here, a fixed last-7-days
// window for the chart) — same results, without pulling "Todo o histórico"
// onto the phone just to draw a 7-bar chart.
export default function FinanceiroScreen() {
  const { session } = useSession();
  const [period, setPeriod] = useState<FinancialPeriod>("month");
  const [appointments, setAppointments] = useState<AppointmentDTO[] | null>(null);
  const [last7DaysApts, setLast7DaysApts] = useState<AppointmentDTO[] | null>(null);
  const [employees, setEmployees] = useState<EmployeeDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (p: FinancialPeriod) => {
    setError(null);
    try {
      const { from, to } = periodRange(p);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

      const [apts, emps, last7] = await Promise.all([
        getAppointments({ from, to }),
        getEmployees(),
        getAppointments({ from: isoDate(sevenDaysAgo), to: isoDate(new Date()) }),
      ]);
      setAppointments(apts);
      setEmployees(emps);
      setLast7DaysApts(last7);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar o financeiro.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      await load(period);
      if (!cancelled) setLoading(false);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [load, period]);

  async function onRefresh() {
    setRefreshing(true);
    await load(period);
    setRefreshing(false);
  }

  const {
    completedCount,
    pendingCount,
    realizedRevenue,
    forecastRevenue,
    teamRanking,
    totalCommissions,
    topServices,
    paymentBreakdown,
  } = useMemo(() => {
    const list = appointments ?? [];
    const completed = list.filter((a) => a.status === "completed");
    const pending = list.filter((a) => PENDING_STATUSES.has(a.status));

    const byEmployee = new Map<string, TeamRankRowData>();
    for (const emp of employees) {
      byEmployee.set(emp.id, { employeeId: emp.id, name: emp.name, jobTitle: emp.jobTitle, photoUrl: emp.photoUrl, appointments: 0, revenue: 0, commission: 0 });
    }
    const byService = new Map<string, ServiceRankRowData>();
    const byPayment = new Map<string, { method: string; count: number; total: number }>();

    for (const apt of completed) {
      const emp = employees.find((e) => e.id === apt.employeeId);
      const commission =
        emp?.commissionType === "percentage"
          ? Math.round(((apt.total || 0) * (emp.commissionValue || 0)) / 100)
          : emp?.commissionType === "fixed"
            ? emp.commissionValue || 0
            : Math.round(((apt.total || 0) * 30) / 100);

      const entry =
        byEmployee.get(apt.employeeId) ??
        ({ employeeId: apt.employeeId, name: apt.employeeName, jobTitle: null, appointments: 0, revenue: 0, commission: 0 } as TeamRankRowData);
      entry.appointments += 1;
      entry.revenue += apt.total || 0;
      entry.commission += commission;
      byEmployee.set(apt.employeeId, entry);

      const serviceName = apt.serviceName || "Serviço";
      const svcEntry = byService.get(serviceName) ?? { name: serviceName, count: 0, revenue: 0 };
      svcEntry.count += 1;
      svcEntry.revenue += apt.total || 0;
      byService.set(serviceName, svcEntry);

      const method = apt.paymentMethod || "pix";
      const payEntry = byPayment.get(method) ?? { method, count: 0, total: 0 };
      payEntry.count += 1;
      payEntry.total += apt.total || 0;
      byPayment.set(method, payEntry);
    }

    const ranking = Array.from(byEmployee.values())
      .filter((r) => r.appointments > 0 || r.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);

    const realized = completed.reduce((sum, a) => sum + (a.total || 0), 0);
    const forecast = pending.reduce((sum, a) => sum + (a.total || 0), 0);

    return {
      completedCount: completed.length,
      pendingCount: pending.length,
      realizedRevenue: realized,
      forecastRevenue: forecast,
      teamRanking: ranking,
      totalCommissions: ranking.reduce((sum, r) => sum + r.commission, 0),
      topServices: Array.from(byService.values()).sort((a, b) => b.count - a.count),
      paymentBreakdown: Array.from(byPayment.values()).sort((a, b) => b.total - a.total),
    };
  }, [appointments, employees]);

  const last7DaysData = useMemo(() => {
    const weekdayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const todayStr = isoDate(new Date());
    const list = last7DaysApts ?? [];

    const days: Array<{ date: string; label: string; weekday: string; revenue: number; count: number; isToday: boolean }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = isoDate(d);
      const dayCompleted = list.filter((a) => a.date === dateStr && a.status === "completed");
      const dayRevenue = dayCompleted.reduce((acc, a) => acc + (a.total || 0), 0);

      days.push({
        date: dateStr,
        label: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
        weekday: weekdayNames[d.getDay()],
        revenue: dayRevenue,
        count: dayCompleted.length,
        isToday: dateStr === todayStr,
      });
    }

    const maxDayRevenue = Math.max(...days.map((d) => d.revenue), 100);
    const total7Days = days.reduce((acc, d) => acc + d.revenue, 0);
    return { days, maxDayRevenue, dailyAverage: Math.round(total7Days / 7) };
  }, [last7DaysApts]);

  const netProfit = Math.max(realizedRevenue - totalCommissions, 0);
  const netMargin = realizedRevenue > 0 ? Math.round((netProfit / realizedRevenue) * 100) : 100;
  const maxRevenue = teamRanking[0]?.revenue ?? 0;
  const maxServiceCount = topServices[0]?.count ?? 0;
  const totalPaymentAll = paymentBreakdown.reduce((acc, p) => acc + p.total, 0) || 1;

  return (
    <Screen header={<TopBar title="Financeiro" company={session?.company?.name || "Barbearia Pelly"} showBack={true} />} style={{ paddingTop: 16 }}>
      <View>
        <Text style={{ color: colors.primary, ...typography.eyebrow }}>VISÃO FINANCEIRA</Text>
        <Text style={{ color: colors.textPrimary, marginTop: 4, ...typography.pageTitle }}>Financeiro</Text>
        <Text style={{ color: colors.textMuted, marginTop: 6, ...typography.pageSubtitle }}>
          Faturamento real calculado a partir dos atendimentos finalizados e comissões da equipe.
        </Text>
      </View>

      {/* Period Tabs */}
      <View
        className="mt-4 rounded-xl border p-1"
        style={{ backgroundColor: "#0f1014", borderColor: "rgba(255, 255, 255, 0.08)" }}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {PERIOD_TABS.map((tab) => {
            const isActive = period === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setPeriod(tab.id)}
                className="flex-row items-center gap-1.5 py-2.5 px-3.5 rounded-lg"
                style={{
                  backgroundColor: isActive ? "#27272a" : "transparent",
                  borderWidth: isActive ? 1 : 0,
                  borderColor: "rgba(255, 255, 255, 0.15)",
                }}
              >
                <CalendarDays size={13} color={isActive ? "#ffffff" : "#71717a"} />
                <Text style={{ color: isActive ? "#ffffff" : "#71717a", fontSize: 12.5, fontWeight: isActive ? "700" : "500" }}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center py-16">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-6 gap-3">
          <Text style={{ color: colors.textSecondary, textAlign: "center" }}>{error}</Text>
          <Button label="Tentar novamente" onPress={() => load(period)} />
        </View>
      ) : (
        <ScrollView
          className="flex-1 mt-4"
          contentContainerClassName="gap-5 pb-6"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {/* 2x2 Metrics Grid */}
          <View className="gap-2.5">
            <View className="flex-row gap-2.5">
              <View className="flex-1">
                <MetricCard
                  icon={WalletCards}
                  label="Receita realizada"
                  value={formatBRL(realizedRevenue)}
                  detail={`${completedCount} atendimentos recebidos`}
                />
              </View>
              <View className="flex-1">
                <MetricCard
                  icon={TrendingUp}
                  label="Receita prevista"
                  value={formatBRL(forecastRevenue)}
                  detail={`${pendingCount} atendimentos futuros`}
                />
              </View>
            </View>
            <View className="flex-row gap-2.5">
              <View className="flex-1">
                <MetricCard
                  icon={BarChart3}
                  label="Comissões a pagar"
                  value={formatBRL(totalCommissions)}
                  detail={`${teamRanking.length} profissionais comissionados`}
                />
              </View>
              <View className="flex-1">
                <MetricCard
                  icon={ReceiptText}
                  label="Lucro líquido"
                  value={formatBRL(netProfit)}
                  detail={`${netMargin}% margem de rentabilidade`}
                />
              </View>
            </View>
          </View>

          {/* 7-Day Revenue Evolution Bar Chart */}
          <View
            className="p-5 rounded-2xl border gap-4"
            style={{ backgroundColor: "#111216", borderColor: "rgba(255, 255, 255, 0.09)" }}
          >
            <View className="flex-row items-start justify-between gap-3 flex-wrap">
              <View className="flex-1 gap-0.5">
                <Text style={{ color: colors.textPrimary, fontSize: 15.5, fontWeight: "800" }}>
                  Evolução de faturamento (últimos 7 dias)
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Receita diária obtida de atendimentos concluídos
                </Text>
              </View>
              <View
                className="items-end gap-0.5 py-1.5 px-3 rounded-lg border"
                style={{ backgroundColor: "#181920", borderColor: "rgba(255, 255, 255, 0.08)" }}
              >
                <Text style={{ color: colors.textMuted, fontSize: 10 }}>Média diária dos 7 dias:</Text>
                <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "700" }}>
                  {formatBRL(last7DaysData.dailyAverage)}
                </Text>
              </View>
            </View>

            <View
              className="flex-row items-end justify-between gap-2 pt-3 border-b"
              style={{ height: 190, borderBottomColor: "rgba(255, 255, 255, 0.08)" }}
            >
              {last7DaysData.days.map((day) => {
                const heightPct = Math.max(Math.round((day.revenue / last7DaysData.maxDayRevenue) * 100), 6);
                return (
                  <View key={day.date} className="flex-1 items-center justify-end gap-1.5" style={{ height: "100%" }}>
                    <Text
                      style={{
                        color: day.isToday ? colors.primary : colors.textSecondary,
                        fontSize: 9,
                        fontWeight: day.isToday ? "700" : "600",
                      }}
                      numberOfLines={1}
                    >
                      {day.revenue > 0 ? formatBRL(day.revenue) : "R$ 0"}
                    </Text>
                    <View
                      className="w-full items-center justify-end rounded-t-md overflow-hidden"
                      style={{ maxWidth: 40, height: 130, backgroundColor: "rgba(255, 255, 255, 0.03)" }}
                    >
                      <View
                        className="w-full rounded-t-md"
                        style={{
                          height: `${heightPct}%`,
                          minHeight: 6,
                          backgroundColor: colors.primary,
                          borderWidth: day.isToday ? 1 : 0,
                          borderColor: "rgba(220, 255, 76, 0.5)",
                        }}
                      />
                    </View>
                    <Text style={{ color: colors.textPrimary, fontSize: 11, fontWeight: "600", marginTop: 2 }}>
                      {day.weekday}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 9 }}>{day.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Rankings: Team & Services */}
          <View className="gap-5">
            <View
              className="p-5 rounded-2xl border gap-1"
              style={{ backgroundColor: "#111216", borderColor: "rgba(255, 255, 255, 0.09)" }}
            >
              <SectionHeading
                title="Profissionais que mais trabalharam"
                description="Volume de atendimentos, faturamento e comissões calculadas"
              />
              {teamRanking.length === 0 ? (
                <EmptyRankState icon={Users} title="Sem faturamento no período" description="Conclua atendimentos para visualizar o desempenho da equipe." />
              ) : (
                <View className="gap-3 mt-4">
                  {teamRanking.map((row, index) => (
                    <TeamRankRow key={row.employeeId} row={row} rank={index + 1} maxRevenue={maxRevenue} />
                  ))}
                </View>
              )}
            </View>

            <View
              className="p-5 rounded-2xl border gap-1"
              style={{ backgroundColor: "#111216", borderColor: "rgba(255, 255, 255, 0.09)" }}
            >
              <SectionHeading
                title="Serviços mais realizados"
                description="Serviços com maior volume e faturamento no período"
              />
              {topServices.length === 0 ? (
                <EmptyRankState icon={Tag} title="Nenhum serviço finalizado" description="Nenhum atendimento foi concluído no período selecionado." />
              ) : (
                <View className="gap-3 mt-4">
                  {topServices.map((row, index) => (
                    <ServiceRankRow key={row.name} row={row} rank={index + 1} maxCount={maxServiceCount} />
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Payment Methods Breakdown */}
          {paymentBreakdown.length > 0 && (
            <View
              className="p-5 rounded-2xl border gap-1"
              style={{ backgroundColor: "#111216", borderColor: "rgba(255, 255, 255, 0.09)" }}
            >
              <SectionHeading title="Por forma de pagamento" description="Distribuição dos valores recebidos no período" />
              <View className="flex-row flex-wrap gap-2.5 mt-4">
                {paymentBreakdown.map((row) => {
                  const pct = Math.round((row.total / totalPaymentAll) * 100);
                  return (
                    <View
                      key={row.method}
                      className="p-3 rounded-xl border gap-2"
                      style={{ flexBasis: "48%", flexGrow: 1, backgroundColor: "#181920", borderColor: "rgba(255, 255, 255, 0.08)" }}
                    >
                      <View className="flex-row items-center justify-between">
                        <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: "600", textTransform: "capitalize" }}>
                          {PAYMENT_LABELS[row.method] || row.method}
                        </Text>
                        <View className="py-0.5 px-1.5 rounded-md border" style={{ backgroundColor: "rgba(255, 255, 255, 0.05)", borderColor: "rgba(255, 255, 255, 0.08)" }}>
                          <Text style={{ color: colors.primary, fontSize: 10, fontWeight: "700" }}>{pct}%</Text>
                        </View>
                      </View>
                      <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700" }}>{formatBRL(row.total)}</Text>
                      <View className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255, 255, 255, 0.08)" }}>
                        <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: colors.primary }} />
                      </View>
                      <Text style={{ color: colors.textMuted, fontSize: 10 }}>{row.count} recebimentos</Text>
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

function EmptyRankState({ icon: Icon, title, description }: { icon: typeof Users; title: string; description: string }) {
  return (
    <View className="items-center gap-2 py-9 mt-2">
      <View className="w-11 h-11 rounded-full items-center justify-center" style={{ backgroundColor: colors.surfaceSecondary }}>
        <Icon size={20} color={colors.textMuted} />
      </View>
      <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "700" }}>{title}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: "center", lineHeight: 17, maxWidth: 260 }}>
        {description}
      </Text>
    </View>
  );
}
