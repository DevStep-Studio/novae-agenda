import { CalendarDays, CircleDollarSign, TrendingUp, Users } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";

import { EmployeeCard, type EmployeeMetrics } from "@/components/ui/employee-card";
import { MetricCard } from "@/components/ui/metric-card";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { colors, typography } from "@/constants/design-tokens";
import { ApiError } from "@/lib/api-client";
import { getAppointments, todayKey, type AppointmentDTO } from "@/lib/appointments";
import { getEmployees, type EmployeeDTO } from "@/lib/employees";
import { formatBRL } from "@/lib/stats";
import { useSession } from "@/lib/session-context";

function monthRange(): { from: string; to: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(first), to: iso(last) };
}

// Mirrors TeamPage in app-shell.tsx:2101-2260's header + metrics grid, then
// the real `.modern-team-card` grid (see EmployeeCard). Per-employee metrics
// (today/month counts, month revenue, commission) match `employeeMetrics` in
// app-shell.tsx:2121-2154 exactly, including the 30% default commission rate
// when an employee has no explicit commission rule.
//
// Not ported yet (see MOBILE_DESIGN_SYSTEM.md): the tabs/search/sort toolbar
// and every card footer action (Agendar/Horários/Agenda/Editar) — each opens
// a flow (appointment creation, schedule editor, employee-filtered agenda,
// employee edit form) that doesn't exist in mobile yet.
export default function EquipeScreen() {
  const { session } = useSession();
  const [employees, setEmployees] = useState<EmployeeDTO[] | null>(null);
  const [appointments, setAppointments] = useState<AppointmentDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { from, to } = monthRange();
      const [emp, apts] = await Promise.all([getEmployees(), getAppointments({ from, to })]);
      setEmployees(emp);
      setAppointments(apts);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar a equipe.");
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

  const metricsByEmployee = useMemo(() => {
    const today = todayKey();
    const monthPrefix = today.slice(0, 7);
    const map = new Map<string, EmployeeMetrics & { commissionTotal: number }>();
    (employees ?? []).forEach((e) => map.set(e.id, { todayCount: 0, monthCount: 0, monthRevenue: 0, commissionTotal: 0 }));

    for (const apt of appointments) {
      if (apt.status === "cancelled") continue;
      const entry = map.get(apt.employeeId);
      if (!entry) continue;
      if (apt.date === today) entry.todayCount += 1;
      if (apt.date.startsWith(monthPrefix) && apt.status === "completed") {
        entry.monthCount += 1;
        entry.monthRevenue += apt.total || 0;
        const emp = employees?.find((e) => e.id === apt.employeeId);
        const commission =
          emp?.commissionType === "percentage"
            ? Math.round(((apt.total || 0) * (emp.commissionValue || 0)) / 100)
            : emp?.commissionType === "fixed"
              ? emp.commissionValue || 0
              : Math.round(((apt.total || 0) * 30) / 100);
        entry.commissionTotal += commission;
      }
    }
    return map;
  }, [employees, appointments]);

  const { totalEmployees, activeCount, totalMonthApts, totalRevenue, totalCommissions, avgPerEmployee } =
    useMemo(() => {
      const values = Array.from(metricsByEmployee.values());
      const monthApts = values.reduce((sum, m) => sum + m.monthCount, 0);
      const total = employees?.length ?? 0;
      return {
        totalEmployees: total,
        activeCount: employees?.filter((e) => e.active).length ?? 0,
        totalMonthApts: monthApts,
        totalRevenue: values.reduce((sum, m) => sum + m.monthRevenue, 0),
        totalCommissions: values.reduce((sum, m) => sum + m.commissionTotal, 0),
        avgPerEmployee: total > 0 ? Math.round(monthApts / total) : 0,
      };
    }, [employees, metricsByEmployee]);

  return (
    <Screen header={<TopBar title="Equipe" company={session?.company.name} />} style={{ paddingTop: 16 }}>
      <View>
        <Text style={{ color: colors.primary, ...typography.eyebrow }}>PESSOAS E PERMISSÕES</Text>
        <Text style={{ color: colors.textPrimary, marginTop: 4, ...typography.pageTitle }}>Equipe</Text>
        <Text style={{ color: colors.textMuted, marginTop: 6, ...typography.pageSubtitle }}>
          {totalEmployees} profissionais cadastrados no seu estabelecimento.
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
          contentContainerClassName="gap-4 pb-6"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          <View className="flex-row flex-wrap gap-3">
            <MetricCard
              icon={Users}
              label="Total de profissionais"
              value={String(totalEmployees)}
              detail={`${activeCount} ativos na equipe`}
            />
            <MetricCard
              icon={CalendarDays}
              label="Atendimentos no mês"
              value={String(totalMonthApts)}
              detail={`méd. ${avgPerEmployee} por profissional`}
            />
            <MetricCard
              icon={CircleDollarSign}
              label="Faturamento da equipe"
              value={formatBRL(totalRevenue)}
              detail="gerado este mês"
            />
            <MetricCard
              icon={TrendingUp}
              label="Comissões calculadas"
              value={formatBRL(totalCommissions)}
              detail="a repassar à equipe"
              variant="rose"
            />
          </View>

          {employees && employees.length === 0 ? (
            <View className="items-center gap-1 py-16">
              <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}>
                Nenhum profissional cadastrado
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              {employees?.map((employee) => (
                <EmployeeCard
                  key={employee.id}
                  employee={employee}
                  metrics={
                    metricsByEmployee.get(employee.id) ?? { todayCount: 0, monthCount: 0, monthRevenue: 0 }
                  }
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
