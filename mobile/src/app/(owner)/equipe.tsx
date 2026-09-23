import {
  ArrowUpDown,
  CalendarCheck,
  CalendarDays,
  CheckCircle,
  CircleDollarSign,
  Clock,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
  X,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { Button } from "@/components/ui/button";
import { EmployeeCard, type EmployeeMetrics } from "@/components/ui/employee-card";
import { EmployeeEditorModal } from "@/components/employee/employee-editor-modal";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { Screen } from "@/components/ui/screen";
import { TimePickerModal } from "@/components/ui/time-picker-modal";
import { TopBar } from "@/components/ui/top-bar";
import { colors, radius, typography } from "@/constants/design-tokens";
import { useTheme, hexToRgba } from "@/hooks/use-theme";
import { ApiError } from "@/lib/api-client";
import { getAppointments, todayKey, type AppointmentDTO } from "@/lib/appointments";
import {
  createEmployee,
  deleteEmployee,
  getEmployeeSchedules,
  getEmployees,
  updateEmployee,
  updateEmployeeSchedules,
  type EmployeeDTO,
  type EmployeeScheduleDTO,
} from "@/lib/employees";
import { getServices, type ServiceDTO } from "@/lib/services";
import { useSession } from "@/lib/session-context";
import { formatBRL } from "@/lib/stats";

type TeamTab = "all" | "active" | "with_today" | "top";
type TeamSort = "appointments-desc" | "name-asc" | "commission-desc" | "services-desc";

const SORT_LABELS: Record<TeamSort, string> = {
  "appointments-desc": "Mais atendimentos",
  "name-asc": "Nome (A–Z)",
  "commission-desc": "Maior comissão",
  "services-desc": "Mais serviços",
};

const DAYS_NAMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

function monthRange(): { from: string; to: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(first), to: iso(last) };
}

export default function EquipeScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { isDark, primaryColor, primaryForeground, colors } = useTheme();

  const [employees, setEmployees] = useState<EmployeeDTO[] | null>(null);
  const [appointments, setAppointments] = useState<AppointmentDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TeamTab>("all");
  const [sortBy, setSortBy] = useState<TeamSort>("appointments-desc");
  const [showSortModal, setShowSortModal] = useState(false);

  // Services
  const [services, setServices] = useState<ServiceDTO[]>([]);

  // Employee Editor Modal
  const [editorModalVisible, setEditorModalVisible] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDTO | null>(null);

  // Schedule Modal
  const [scheduleEmployee, setScheduleEmployee] = useState<EmployeeDTO | null>(null);
  const [schedules, setSchedules] = useState<EmployeeScheduleDTO[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);

  // TimePicker Modal State
  const [timePickerState, setTimePickerState] = useState<{
    visible: boolean;
    title: string;
    subtitle?: string;
    value: string;
    allowClear?: boolean;
    onSelect: (time: string) => void;
    onClear?: () => void;
  }>({
    visible: false,
    title: "Selecionar Horário",
    value: "",
    onSelect: () => {},
  });

  const openTimePicker = (opts: {
    title: string;
    subtitle?: string;
    value?: string | null;
    allowClear?: boolean;
    onSelect: (time: string) => void;
    onClear?: () => void;
  }) => {
    setTimePickerState({
      visible: true,
      title: opts.title,
      subtitle: opts.subtitle,
      value: opts.value || "09:00",
      allowClear: opts.allowClear,
      onSelect: opts.onSelect,
      onClear: opts.onClear,
    });
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      const { from, to } = monthRange();
      const [emp, apts, svcs] = await Promise.all([
        getEmployees(),
        getAppointments({ from, to }),
        getServices(),
      ]);
      setEmployees(emp);
      setAppointments(apts);
      setServices(svcs);
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

  // Calculate stats and metrics per employee
  const metricsByEmployee = useMemo(() => {
    const today = todayKey();
    const monthPrefix = today.slice(0, 7);
    const map = new Map<string, EmployeeMetrics & { commissionTotal: number }>();
    (employees ?? []).forEach((e) =>
      map.set(e.id, { todayCount: 0, monthCount: 0, monthRevenue: 0, commissionTotal: 0 })
    );

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

  const { totalEmployees, activeEmployees, totalMonthApts, totalRevenue, totalCommissions, avgPerEmployee } =
    useMemo(() => {
      const values = Array.from(metricsByEmployee.values());
      const monthApts = values.reduce((sum, m) => sum + m.monthCount, 0);
      const total = employees?.length ?? 0;
      const activeList = employees?.filter((e) => e.active) ?? [];
      return {
        totalEmployees: total,
        activeEmployees: activeList,
        totalMonthApts: monthApts,
        totalRevenue: values.reduce((sum, m) => sum + m.monthRevenue, 0),
        totalCommissions: values.reduce((sum, m) => sum + m.commissionTotal, 0),
        avgPerEmployee: total > 0 ? Math.round(monthApts / total) : 0,
      };
    }, [employees, metricsByEmployee]);

  // Tab counts
  const withTodayCount = useMemo(() => {
    return (employees ?? []).filter((e) => (metricsByEmployee.get(e.id)?.todayCount ?? 0) > 0).length;
  }, [employees, metricsByEmployee]);

  const topCount = useMemo(() => {
    return (employees ?? []).filter((e) => {
      const m = metricsByEmployee.get(e.id);
      return Boolean(m && (m.monthCount >= 2 || m.monthRevenue > 0));
    }).length;
  }, [employees, metricsByEmployee]);

  // Filtered
  const filtered = useMemo(() => {
    return (employees ?? []).filter((emp) => {
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const matchName = emp.name.toLowerCase().includes(q);
        const matchRole = (emp.jobTitle ?? "").toLowerCase().includes(q);
        const matchService = emp.services.some((s) => s.toLowerCase().includes(q));
        if (!matchName && !matchRole && !matchService) return false;
      }

      if (activeTab === "active") {
        return emp.active;
      }
      if (activeTab === "with_today") {
        const m = metricsByEmployee.get(emp.id);
        return Boolean(m && m.todayCount > 0);
      }
      if (activeTab === "top") {
        const m = metricsByEmployee.get(emp.id);
        return Boolean(m && (m.monthCount >= 2 || m.monthRevenue > 0));
      }
      return true;
    });
  }, [employees, searchQuery, activeTab, metricsByEmployee]);

  // Sorted
  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sortBy) {
      case "appointments-desc":
        return list.sort((a, b) => {
          const mA = metricsByEmployee.get(a.id)?.monthCount ?? 0;
          const mB = metricsByEmployee.get(b.id)?.monthCount ?? 0;
          return mB - mA;
        });
      case "name-asc":
        return list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      case "commission-desc":
        return list.sort((a, b) => (b.commissionValue || 0) - (a.commissionValue || 0));
      case "services-desc":
        return list.sort((a, b) => b.services.length - a.services.length);
      default:
        return list;
    }
  }, [filtered, sortBy, metricsByEmployee]);

  // Delete / Inactivate Employee
  const handleDeleteEmployee = (emp: EmployeeDTO) => {
    return new Promise<void>((resolve, reject) => {
      Alert.alert(
        "Desativar Profissional",
        `Deseja desativar o acesso de ${emp.name}? Ele não aparecerá mais nos novos agendamentos.`,
        [
          { text: "Cancelar", style: "cancel", onPress: () => resolve() },
          {
            text: "Desativar",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteEmployee(emp.id);
                setEditorModalVisible(false);
                setSelectedEmployee(null);
                await load();
                Alert.alert("Sucesso", `${emp.name} foi desativado.`);
                resolve();
              } catch (err: any) {
                Alert.alert("Erro", err?.message || "Não foi possível desativar o profissional.");
                reject(err);
              }
            },
          },
        ]
      );
    });
  };

  // Open Schedule Modal
  const handleOpenSchedule = async (emp: EmployeeDTO) => {
    setScheduleEmployee(emp);
    setLoadingSchedule(true);
    try {
      const data = await getEmployeeSchedules(emp.id);
      // Ensure all 7 days exist
      const fullSchedules: EmployeeScheduleDTO[] = Array.from({ length: 7 }, (_, day) => {
        const existing = data.find((s) => s.dayOfWeek === day);
        if (existing) {
          return {
            ...existing,
            startTime: existing.startTime.slice(0, 5),
            endTime: existing.endTime.slice(0, 5),
            breakStart: existing.breakStart ? existing.breakStart.slice(0, 5) : "12:00",
            breakEnd: existing.breakEnd ? existing.breakEnd.slice(0, 5) : "13:00",
          };
        }
        return {
          employeeId: emp.id,
          dayOfWeek: day,
          startTime: "09:00",
          endTime: "19:00",
          breakStart: "12:00",
          breakEnd: "13:00",
          active: day >= 1 && day <= 6, // Seg a Sáb active by default
        };
      });
      setSchedules(fullSchedules);
    } catch {
      Alert.alert("Aviso", "Não foi possível carregar os horários configurados.");
    } finally {
      setLoadingSchedule(false);
    }
  };

  // Save Schedules
  const handleSaveSchedules = async () => {
    if (!scheduleEmployee) return;
    setSavingSchedule(true);
    try {
      await updateEmployeeSchedules(scheduleEmployee.id, schedules);
      setScheduleEmployee(null);
      Alert.alert("Sucesso", "Horários de trabalho salvos com sucesso!");
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível salvar os horários.");
    } finally {
      setSavingSchedule(false);
    }
  };

  const updateScheduleDay = (dayIndex: number, patch: Partial<EmployeeScheduleDTO>) => {
    setSchedules((prev) =>
      prev.map((item, idx) => (idx === dayIndex ? { ...item, ...patch } : item))
    );
  };

  return (
    <Screen
      header={<TopBar title="Equipe" company={session?.company.name} showBack={true} />}
      style={{ paddingTop: 14 }}
    >
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 16, paddingBottom: 36 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />}
      >
        {/* 1. Header Section */}
        <PageHeader
          eyebrow="PESSOAS E PERMISSÕES"
          title="Equipe"
          subtitle={`${totalEmployees} profissionais cadastrados no seu estabelecimento.`}
          action={
            <Pressable
              onPress={() => {
                setSelectedEmployee(null);
                setEditorModalVisible(true);
              }}
              className="flex-row items-center gap-2 px-4 rounded-xl self-start"
              style={{
                backgroundColor: primaryColor,
                height: 40,
              }}
            >
              <UserPlus size={16} color={primaryForeground} strokeWidth={2.4} />
              <Text style={{ color: primaryForeground, fontSize: 13.5, fontWeight: "700" }}>
                Adicionar profissional
              </Text>
            </Pressable>
          }
        />

        {/* 2. 2x2 KPI Metric Cards matching Web */}
        <View className="gap-2.5">
          <View className="flex-row gap-2.5">
            <View className="flex-1">
              <MetricCard
                icon={Users}
                label="Total de profissionais"
                value={String(totalEmployees)}
                detail={`${activeEmployees.length} ativos na equipe`}
              />
            </View>
            <View className="flex-1">
              <MetricCard
                icon={CalendarDays}
                label="Atendimentos no mês"
                value={String(totalMonthApts)}
                detail={`méd. ${avgPerEmployee} por profissional`}
              />
            </View>
          </View>
          <View className="flex-row gap-2.5">
            <View className="flex-1">
              <MetricCard
                icon={CircleDollarSign}
                label="Faturamento da equipe"
                value={formatBRL(totalRevenue)}
                detail="gerado este mês"
              />
            </View>
            <View className="flex-1">
              <MetricCard
                icon={TrendingUp}
                label="Comissões calculadas"
                value={formatBRL(totalCommissions)}
                detail="a repassar à equipe"
              />
            </View>
          </View>
        </View>

        {/* 3. Filter Tabs + Search Toolbar */}
        <View
          className="rounded-2xl border p-3 gap-3"
          style={{
            backgroundColor: "#0d0e12",
            borderColor: "rgba(255, 255, 255, 0.08)",
          }}
        >
          {/* Filter Tabs — mirrors Web .client-segment-tabs with bottom active indicator */}
          <View
            style={{
              borderBottomWidth: 1,
              borderBottomColor: "rgba(255, 255, 255, 0.08)",
              paddingBottom: 2,
            }}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingHorizontal: 2 }}
            >
              {(
                [
                  { id: "all" as const, label: "Todos os profissionais", icon: null, count: totalEmployees },
                  { id: "active" as const, label: "Ativos", icon: CheckCircle, count: activeEmployees.length },
                  { id: "with_today" as const, label: "Com agenda hoje", icon: CalendarDays, count: withTodayCount },
                  { id: "top" as const, label: "Mais produtivos", icon: Sparkles, count: topCount },
                ]
              ).map((tab) => {
                const isActive = activeTab === tab.id;
                const TabIcon = tab.icon;
                return (
                  <Pressable
                    key={tab.id}
                    onPress={() => setActiveTab(tab.id)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingVertical: 8,
                      paddingHorizontal: 6,
                      borderBottomWidth: 2,
                      borderBottomColor: isActive ? primaryColor : "transparent",
                    }}
                  >
                    {TabIcon && <TabIcon size={14} color={isActive ? primaryColor : "#9ca3af"} />}
                    <Text
                      style={{
                        color: isActive ? "#ffffff" : "#9ca3af",
                        fontSize: 13,
                        fontWeight: isActive ? "700" : "500",
                      }}
                    >
                      {tab.label}
                    </Text>
                    <View
                      style={{
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 6,
                        paddingVertical: 1.5,
                        borderRadius: 999,
                        backgroundColor: isActive
                          ? hexToRgba(primaryColor, 0.22)
                          : "rgba(255, 255, 255, 0.07)",
                      }}
                    >
                      <Text
                        style={{
                          color: isActive ? primaryColor : "#71717a",
                          fontSize: 11,
                          fontWeight: "700",
                        }}
                      >
                        {tab.count}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Search Box */}
          <View
            className="flex-row items-center px-3 rounded-xl border"
            style={{
              backgroundColor: "#16171c",
              borderColor: "rgba(255, 255, 255, 0.08)",
              height: 42,
            }}
          >
            <Search size={16} color="#71717a" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Buscar por nome, cargo ou serviço..."
              placeholderTextColor="#71717a"
              style={{
                flex: 1,
                color: "#ffffff",
                fontSize: 13.5,
                paddingHorizontal: 8,
                height: "100%",
              }}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")} className="p-1">
                <X size={15} color="#a1a1aa" />
              </Pressable>
            )}
          </View>

          {/* Sort & Count Row */}
          <View className="flex-row items-center justify-between pt-1">
            <Pressable
              onPress={() => setShowSortModal(true)}
              className="flex-row items-center gap-1.5 py-1.5 px-2.5 rounded-lg border"
              style={{
                backgroundColor: "#1a1b20",
                borderColor: "rgba(255, 255, 255, 0.1)",
              }}
            >
              <ArrowUpDown size={12} color="#a1a1aa" />
              <Text style={{ color: "#71717a", fontSize: 12 }}>Ordenar:</Text>
              <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "700" }}>
                {SORT_LABELS[sortBy]}
              </Text>
            </Pressable>

            <Text style={{ color: "#71717a", fontSize: 12 }}>
              Exibindo <Text style={{ color: "#ffffff", fontWeight: "700" }}>{sorted.length}</Text> de {totalEmployees}
            </Text>
          </View>
        </View>

        {/* 4. Employee Cards List */}
        {loading ? (
          <View className="py-16 items-center justify-center">
            <ActivityIndicator color={primaryColor} />
          </View>
        ) : error ? (
          <View className="py-12 items-center justify-center p-6 gap-3">
            <Text style={{ color: colors.textSecondary, textAlign: "center" }}>{error}</Text>
            <Button label="Tentar novamente" onPress={load} />
          </View>
        ) : sorted.length === 0 ? (
          <View className="items-center gap-3 py-16">
            <Users size={32} color={colors.textMuted} />
            <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "600" }}>
              {searchQuery || activeTab !== "all" ? "Nenhum profissional encontrado" : "Nenhum profissional cadastrado"}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: "center" }}>
              {searchQuery || activeTab !== "all"
                ? "Tente ajustar os filtros ou termo de busca."
                : "Adicione profissionais para atribuir atendimentos e horários."}
            </Text>
            {searchQuery || activeTab !== "all" ? (
              <Button
                label="Limpar filtros"
                variant="secondary"
                onPress={() => {
                  setSearchQuery("");
                  setActiveTab("all");
                }}
              />
            ) : (
              <Button
                label="Adicionar profissional"
                onPress={() => {
                  setSelectedEmployee(null);
                  setEditorModalVisible(true);
                }}
              />
            )}
          </View>
        ) : (
          <View className="gap-4">
            {sorted.map((emp) => (
              <EmployeeCard
                key={emp.id}
                employee={emp}
                metrics={metricsByEmployee.get(emp.id) || { todayCount: 0, monthCount: 0, monthRevenue: 0 }}
                onNewAppointment={() => router.push("/(owner)/agenda")}
                onOpenSchedule={handleOpenSchedule}
                onGoToAgenda={() => router.push("/(owner)/agenda")}
                onEdit={(targetEmp) => {
                  setSelectedEmployee(targetEmp);
                  setEditorModalVisible(true);
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal: Ordenação */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <Pressable
          onPress={() => setShowSortModal(false)}
          className="flex-1 items-center justify-center p-5"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.75)" }}
        >
          <View
            className="w-full max-w-sm rounded-2xl border p-4 gap-2"
            style={{
              backgroundColor: "#131418",
              borderColor: "rgba(255, 255, 255, 0.12)",
            }}
          >
            <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "800", marginBottom: 6 }}>
              Ordenar Profissionais
            </Text>
            {(Object.keys(SORT_LABELS) as TeamSort[]).map((key) => (
              <Pressable
                key={key}
                onPress={() => {
                  setSortBy(key);
                  setShowSortModal(false);
                }}
                className="py-3 px-3.5 rounded-xl flex-row items-center justify-between"
                style={{
                  backgroundColor: sortBy === key ? "#27272a" : "transparent",
                }}
              >
                <Text
                  style={{
                    color: sortBy === key ? "#ffffff" : "#a1a1aa",
                    fontSize: 14,
                    fontWeight: sortBy === key ? "700" : "500",
                  }}
                >
                  {SORT_LABELS[key]}
                </Text>
                {sortBy === key && <CheckCircle size={16} color="#4ade80" />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Modal: Adicionar / Editar Profissional */}
      <EmployeeEditorModal
        visible={editorModalVisible}
        employee={selectedEmployee}
        services={services}
        onClose={() => {
          setEditorModalVisible(false);
          setSelectedEmployee(null);
        }}
        onSaved={async () => {
          await load();
        }}
        onDeleteEmployee={handleDeleteEmployee}
      />

      {/* Modal: Horários de Trabalho */}
      <Modal
        visible={Boolean(scheduleEmployee)}
        transparent
        animationType="slide"
        onRequestClose={() => setScheduleEmployee(null)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0, 0, 0, 0.75)" }}>
          <View
            className="w-full max-h-[85%] rounded-t-3xl border-t p-5 gap-4"
            style={{
              backgroundColor: "#111215",
              borderColor: "rgba(255, 255, 255, 0.12)",
            }}
          >
            <View className="flex-row items-center justify-between pb-2 border-b" style={{ borderBottomColor: "rgba(255, 255, 255, 0.08)" }}>
              <View>
                <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "800" }}>
                  Horários de Atendimento
                </Text>
                <Text style={{ color: "#a1a1aa", fontSize: 12 }}>
                  {scheduleEmployee?.name}
                </Text>
              </View>
              <Pressable onPress={() => setScheduleEmployee(null)} className="p-1 rounded-lg">
                <X size={20} color="#ffffff" />
              </Pressable>
            </View>

            {loadingSchedule ? (
              <View className="py-12 items-center justify-center">
                <ActivityIndicator color={primaryColor} />
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 20 }}>
                {schedules.map((sch, idx) => (
                  <View
                    key={sch.dayOfWeek}
                    className="p-3 rounded-xl border gap-2.5"
                    style={{
                      backgroundColor: sch.active ? "#18191e" : "#131417",
                      borderColor: sch.active ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.04)",
                      opacity: sch.active ? 1 : 0.6,
                    }}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text
                        style={{
                          color: sch.active ? "#ffffff" : "#71717a",
                          fontSize: 14,
                          fontWeight: "700",
                        }}
                      >
                        {DAYS_NAMES[sch.dayOfWeek]}
                      </Text>
                      <Switch
                        value={sch.active}
                        onValueChange={(val) => updateScheduleDay(idx, { active: val })}
                        trackColor={{ false: "#27272a", true: primaryColor || "#22c55e" }}
                        thumbColor="#ffffff"
                      />
                    </View>

                    {sch.active && (
                      <View className="gap-2.5 pt-2 border-t" style={{ borderTopColor: "rgba(255, 255, 255, 0.06)" }}>
                        {/* Turno */}
                        <View className="gap-1.5">
                          <Text style={{ color: "#a1a1aa", fontSize: 10.5, fontWeight: "700" }}>TURNO</Text>
                          <View className="flex-row items-center gap-2">
                            <Pressable
                              onPress={() =>
                                openTimePicker({
                                  title: `Início • ${DAYS_NAMES[sch.dayOfWeek]}`,
                                  subtitle: `Entrada para ${scheduleEmployee?.name}`,
                                  value: sch.startTime,
                                  onSelect: (time) => updateScheduleDay(idx, { startTime: time }),
                                })
                              }
                              className="flex-1 flex-row items-center justify-between py-2 px-3 rounded-xl border"
                              style={{ backgroundColor: "#202127", borderColor: "rgba(255, 255, 255, 0.1)" }}
                            >
                              <View className="gap-0.5">
                                <Text style={{ color: "#71717a", fontSize: 9, fontWeight: "700" }}>ENTRADA</Text>
                                <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "700" }}>
                                  {sch.startTime || "09:00"}
                                </Text>
                              </View>
                              <Clock size={14} color={primaryColor} />
                            </Pressable>

                            <Text style={{ color: "#71717a", fontSize: 12 }}>até</Text>

                            <Pressable
                              onPress={() =>
                                openTimePicker({
                                  title: `Término • ${DAYS_NAMES[sch.dayOfWeek]}`,
                                  subtitle: `Saída para ${scheduleEmployee?.name}`,
                                  value: sch.endTime,
                                  onSelect: (time) => updateScheduleDay(idx, { endTime: time }),
                                })
                              }
                              className="flex-1 flex-row items-center justify-between py-2 px-3 rounded-xl border"
                              style={{ backgroundColor: "#202127", borderColor: "rgba(255, 255, 255, 0.1)" }}
                            >
                              <View className="gap-0.5">
                                <Text style={{ color: "#71717a", fontSize: 9, fontWeight: "700" }}>SAÍDA</Text>
                                <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "700" }}>
                                  {sch.endTime || "19:00"}
                                </Text>
                              </View>
                              <Clock size={14} color="#f97316" />
                            </Pressable>
                          </View>
                        </View>

                        {/* Intervalo */}
                        <View className="gap-1.5 pt-1">
                          <View className="flex-row items-center justify-between">
                            <Text style={{ color: "#a1a1aa", fontSize: 10.5, fontWeight: "700" }}>INTERVALO DE ALMOÇO</Text>
                            <Pressable
                              onPress={() =>
                                updateScheduleDay(idx, {
                                  breakStart: sch.breakStart ? null : "12:00",
                                  breakEnd: sch.breakEnd ? null : "13:00",
                                })
                              }
                              className="px-2 py-0.5 rounded-md border"
                              style={{
                                backgroundColor: sch.breakStart ? "rgba(245, 158, 11, 0.15)" : "#202127",
                                borderColor: sch.breakStart ? "rgba(245, 158, 11, 0.4)" : "rgba(255, 255, 255, 0.1)",
                              }}
                            >
                              <Text style={{ color: sch.breakStart ? "#fbbf24" : "#71717a", fontSize: 10.5, fontWeight: "600" }}>
                                {sch.breakStart ? "Com almoço" : "Sem almoço"}
                              </Text>
                            </Pressable>
                          </View>

                          {sch.breakStart && (
                            <View className="flex-row items-center gap-2">
                              <Pressable
                                onPress={() =>
                                  openTimePicker({
                                    title: `Início Almoço • ${DAYS_NAMES[sch.dayOfWeek]}`,
                                    value: sch.breakStart,
                                    allowClear: true,
                                    onSelect: (time) => updateScheduleDay(idx, { breakStart: time }),
                                    onClear: () => updateScheduleDay(idx, { breakStart: null, breakEnd: null }),
                                  })
                                }
                                className="flex-1 flex-row items-center justify-between py-1.5 px-3 rounded-xl border"
                                style={{ backgroundColor: "#202127", borderColor: "rgba(255, 255, 255, 0.08)" }}
                              >
                                <View className="gap-0.5">
                                  <Text style={{ color: "#71717a", fontSize: 8.5, fontWeight: "700" }}>INÍCIO</Text>
                                  <Text style={{ color: "#fbbf24", fontSize: 12.5, fontWeight: "700" }}>
                                    {sch.breakStart || "12:00"}
                                  </Text>
                                </View>
                                <Clock size={13} color="#fbbf24" />
                              </Pressable>

                              <Text style={{ color: "#71717a", fontSize: 11.5 }}>até</Text>

                              <Pressable
                                onPress={() =>
                                  openTimePicker({
                                    title: `Fim Almoço • ${DAYS_NAMES[sch.dayOfWeek]}`,
                                    value: sch.breakEnd,
                                    allowClear: true,
                                    onSelect: (time) => updateScheduleDay(idx, { breakEnd: time }),
                                    onClear: () => updateScheduleDay(idx, { breakStart: null, breakEnd: null }),
                                  })
                                }
                                className="flex-1 flex-row items-center justify-between py-1.5 px-3 rounded-xl border"
                                style={{ backgroundColor: "#202127", borderColor: "rgba(255, 255, 255, 0.08)" }}
                              >
                                <View className="gap-0.5">
                                  <Text style={{ color: "#71717a", fontSize: 8.5, fontWeight: "700" }}>FIM</Text>
                                  <Text style={{ color: "#fbbf24", fontSize: 12.5, fontWeight: "700" }}>
                                    {sch.breakEnd || "13:00"}
                                  </Text>
                                </View>
                                <Clock size={13} color="#fbbf24" />
                              </Pressable>
                            </View>
                          )}
                        </View>
                      </View>
                    )}
                  </View>
                ))}

                <Button
                  label={savingSchedule ? "Salvando horários..." : "Salvar Horários"}
                  onPress={handleSaveSchedules}
                  disabled={savingSchedule}
                />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Time Picker Modal */}
      <TimePickerModal
        visible={timePickerState.visible}
        title={timePickerState.title}
        subtitle={timePickerState.subtitle}
        value={timePickerState.value}
        allowClear={timePickerState.allowClear}
        onSelect={timePickerState.onSelect}
        onClear={timePickerState.onClear}
        onClose={() => setTimePickerState((prev) => ({ ...prev, visible: false }))}
      />
    </Screen>
  );
}
