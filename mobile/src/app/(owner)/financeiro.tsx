import { BarChart3, ReceiptText, TrendingUp, WalletCards } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";

import { MetricCard } from "@/components/ui/metric-card";
import { Screen } from "@/components/ui/screen";
import { SectionHeading } from "@/components/ui/section-heading";
import { TeamRankRow, type TeamRankRowData } from "@/components/ui/team-rank-row";
import { TopBar } from "@/components/ui/top-bar";
import { colors, typography } from "@/constants/design-tokens";
import { ApiError } from "@/lib/api-client";
import { getAppointments, type AppointmentDTO } from "@/lib/appointments";
import { getEmployees, type EmployeeDTO } from "@/lib/employees";
import { formatBRL } from "@/lib/stats";
import { useSession } from "@/lib/session-context";

const PENDING_STATUSES = new Set(["scheduled", "confirmed", "waiting", "in_progress"]);

function monthRange(): { from: string; to: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(first), to: iso(last) };
}

// Mirrors FinancialPage in app-shell.tsx:2540-2813, "month" period only (the
// web defaults to "month" too) — header, 4-card KPI grid, then the team
// revenue ranking. Computed the same way as the web's primary path: straight
// from the month's real appointments, not the /api/stats aggregate (which
// has no per-period forecast/realized split beyond "today" to fall back to).
//
// Not ported yet (see MOBILE_DESIGN_SYSTEM.md): the today/week/month/all
// period tabs, the 7-day revenue bar chart, the services ranking, and the
// payment-method breakdown.
export default function FinanceiroScreen() {
  const { session } = useSession();
  const [appointments, setAppointments] = useState<AppointmentDTO[] | null>(null);
  const [employees, setEmployees] = useState<EmployeeDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { from, to } = monthRange();
      const [apts, emps] = await Promise.all([getAppointments({ from, to }), getEmployees()]);
      setAppointments(apts);
      setEmployees(emps);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar o financeiro.");
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

  const { completedCount, pendingCount, realizedRevenue, forecastRevenue, teamRanking, totalCommissions } =
    useMemo(() => {
      const list = appointments ?? [];
      const completed = list.filter((a) => a.status === "completed");
      const pending = list.filter((a) => PENDING_STATUSES.has(a.status));

      const byEmployee = new Map<string, TeamRankRowData>();
      for (const emp of employees) {
        byEmployee.set(emp.id, { employeeId: emp.id, name: emp.name, jobTitle: emp.jobTitle, photoUrl: emp.photoUrl, appointments: 0, revenue: 0, commission: 0 });
      }
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
      };
    }, [appointments, employees]);

  const netProfit = Math.max(realizedRevenue - totalCommissions, 0);
  const netMargin = realizedRevenue > 0 ? Math.round((netProfit / realizedRevenue) * 100) : 100;
  const maxRevenue = teamRanking[0]?.revenue ?? 0;

  return (
    <Screen header={<TopBar title="Financeiro" company={session?.company.name} />} style={{ paddingTop: 16 }}>
      <View>
        <Text style={{ color: colors.primary, ...typography.eyebrow }}>VISÃO FINANCEIRA</Text>
        <Text style={{ color: colors.textPrimary, marginTop: 4, ...typography.pageTitle }}>Financeiro</Text>
        <Text style={{ color: colors.textMuted, marginTop: 6, ...typography.pageSubtitle }}>
          Faturamento real calculado a partir dos atendimentos finalizados e comissões da equipe.
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center">
          <Text style={{ color: colors.textSecondary, textAlign: "center" }}>{error}</Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1 mt-4"
          contentContainerClassName="gap-5 pb-6"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          <View className="flex-row flex-wrap gap-3">
            <MetricCard
              icon={WalletCards}
              label="Receita realizada"
              value={formatBRL(realizedRevenue)}
              detail={`${completedCount} atendimentos recebidos`}
            />
            <MetricCard
              icon={TrendingUp}
              label="Receita prevista"
              value={formatBRL(forecastRevenue)}
              detail={`${pendingCount} atendimentos futuros`}
            />
            <MetricCard
              icon={BarChart3}
              label="Comissões a pagar"
              value={formatBRL(totalCommissions)}
              detail={`${teamRanking.length} profissionais comissionados`}
            />
            <MetricCard
              icon={ReceiptText}
              label="Lucro líquido"
              value={formatBRL(netProfit)}
              detail={`${netMargin}% margem de rentabilidade`}
            />
          </View>

          <View className="gap-3">
            <SectionHeading
              title="Profissionais que mais trabalharam"
              description="Volume de atendimentos, faturamento e comissões calculadas"
            />
            {teamRanking.length === 0 ? (
              <View className="items-center gap-1 py-10">
                <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "600" }}>
                  Sem faturamento no período
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: "center" }}>
                  Conclua atendimentos para visualizar o desempenho da equipe.
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                {teamRanking.map((row, index) => (
                  <TeamRankRow key={row.employeeId} row={row} rank={index + 1} maxRevenue={maxRevenue} />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}
