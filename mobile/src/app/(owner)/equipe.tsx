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
import { MetricCard } from "@/components/ui/metric-card";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { colors, radius, typography } from "@/constants/design-tokens";
import { useTheme } from "@/hooks/use-theme";
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

  // New Employee Modal
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [newName, setNewName] = useState("");
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCommission, setNewCommission] = useState("30");

  // Edit Employee Modal
  const [editingEmployee, setEditingEmployee] = useState<EmployeeDTO | null>(null);
  const [editName, setEditName] = useState("");
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCommission, setEditCommission] = useState("30");
  const [editActive, setEditActive] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);

  // Schedule Modal
  const [scheduleEmployee, setScheduleEmployee] = useState<EmployeeDTO | null>(null);
  const [schedules, setSchedules] = useState<EmployeeScheduleDTO[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);

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

  // Create Employee
  const handleCreateEmployee = async () => {
    if (!newName.trim()) {
      Alert.alert("Erro", "O nome do profissional é obrigatório.");
      return;
    }
    const commVal = parseInt(newCommission, 10) || 30;

    setSavingEmployee(true);
    try {
      await createEmployee({
        name: newName.trim(),
        jobTitle: newJobTitle.trim() || "Profissional",
        phone: newPhone.trim() || undefined,
        email: newEmail.trim() || undefined,
        commissionType: "percentage",
        commissionValue: commVal,
        active: true,
      });

      setCreateModalVisible(false);
      setNewName("");
      setNewJobTitle("");
      setNewPhone("");
      setNewEmail("");
      setNewCommission("30");
      await load();
      Alert.alert("Sucesso", "Profissional cadastrado com sucesso!");
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível cadastrar o profissional.");
    } finally {
      setSavingEmployee(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (emp: EmployeeDTO) => {
    setEditingEmployee(emp);
    setEditName(emp.name);
    setEditJobTitle(emp.jobTitle || "");
    setEditPhone(emp.phone || "");
    setEditCommission(String(emp.commissionValue || "30"));
    setEditActive(emp.active);
  };

  // Save Edit Employee
  const handleSaveEdit = async () => {
    if (!editingEmployee) return;
    if (!editName.trim()) {
      Alert.alert("Erro", "O nome do profissional é obrigatório.");
      return;
    }
    const commVal = parseInt(editCommission, 10) || 0;

    setSavingEdit(true);
    try {
      await updateEmployee(editingEmployee.id, {
        name: editName.trim(),
        jobTitle: editJobTitle.trim() || null,
        phone: editPhone.trim() || null,
        commissionValue: commVal,
        active: editActive,
      });

      setEditingEmployee(null);
      await load();
      Alert.alert("Sucesso", "Profissional atualizado com sucesso!");
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível atualizar o profissional.");
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete / Inactivate Employee
  const handleDeleteEmployee = (emp: EmployeeDTO) => {
    Alert.alert(
      "Desativar Profissional",
      `Deseja desativar o acesso de ${emp.name}? Ele não aparecerá mais nos novos agendamentos.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Desativar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteEmployee(emp.id);
              setEditingEmployee(null);
              await load();
              Alert.alert("Sucesso", `${emp.name} foi desativado.`);
            } catch (err: any) {
              Alert.alert("Erro", err?.message || "Não foi possível desativar o profissional.");
            }
          },
        },
      ]
    );
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
        <View className="gap-1">
          <Text
            style={{
              color: primaryColor,
              fontSize: 11,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 0.8,
            }}
          >
            PESSOAS E PERMISSÕES
          </Text>
          <Text
            style={{
              color: isDark ? "#ffffff" : "#0f172a",
              fontSize: 22,
              fontWeight: "800",
              letterSpacing: -0.4,
              lineHeight: 28,
            }}
          >
            Equipe
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
            {totalEmployees} profissionais cadastrados no seu estabelecimento.
          </Text>

          {/* Action Button: + Adicionar profissional */}
          <View className="mt-3 flex-row">
            <Pressable
              onPress={() => setCreateModalVisible(true)}
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
          </View>
        </View>

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
          {/* Filter Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
          >
            <Pressable
              onPress={() => setActiveTab("all")}
              className="flex-row items-center gap-1.5 py-2 px-3 rounded-xl border"
              style={{
                backgroundColor: activeTab === "all" ? "#27272a" : "transparent",
                borderColor: activeTab === "all" ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.06)",
              }}
            >
              <Text
                style={{
                  color: activeTab === "all" ? "#ffffff" : "#71717a",
                  fontSize: 13,
                  fontWeight: activeTab === "all" ? "700" : "500",
                }}
              >
                Todos os profissionais
              </Text>
              <View
                className="px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: activeTab === "all" ? "#3f3f46" : "#1f2024" }}
              >
                <Text style={{ color: activeTab === "all" ? "#ffffff" : "#71717a", fontSize: 11, fontWeight: "700" }}>
                  {totalEmployees}
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("active")}
              className="flex-row items-center gap-1.5 py-2 px-3 rounded-xl border"
              style={{
                backgroundColor: activeTab === "active" ? "#27272a" : "transparent",
                borderColor: activeTab === "active" ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.06)",
              }}
            >
              <CheckCircle size={13} color={activeTab === "active" ? "#4ade80" : "#71717a"} />
              <Text
                style={{
                  color: activeTab === "active" ? "#ffffff" : "#71717a",
                  fontSize: 13,
                  fontWeight: activeTab === "active" ? "700" : "500",
                }}
              >
                Ativos
              </Text>
              <View
                className="px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: activeTab === "active" ? "#3f3f46" : "#1f2024" }}
              >
                <Text style={{ color: activeTab === "active" ? "#ffffff" : "#71717a", fontSize: 11, fontWeight: "700" }}>
                  {activeEmployees.length}
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("with_today")}
              className="flex-row items-center gap-1.5 py-2 px-3 rounded-xl border"
              style={{
                backgroundColor: activeTab === "with_today" ? "#27272a" : "transparent",
                borderColor: activeTab === "with_today" ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.06)",
              }}
            >
              <CalendarDays size={13} color={activeTab === "with_today" ? "#38bdf8" : "#71717a"} />
              <Text
                style={{
                  color: activeTab === "with_today" ? "#ffffff" : "#71717a",
                  fontSize: 13,
                  fontWeight: activeTab === "with_today" ? "700" : "500",
                }}
              >
                Com agenda
              </Text>
              <View
                className="px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: activeTab === "with_today" ? "#3f3f46" : "#1f2024" }}
              >
                <Text style={{ color: activeTab === "with_today" ? "#ffffff" : "#71717a", fontSize: 11, fontWeight: "700" }}>
                  {withTodayCount}
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("top")}
              className="flex-row items-center gap-1.5 py-2 px-3 rounded-xl border"
              style={{
                backgroundColor: activeTab === "top" ? "#27272a" : "transparent",
                borderColor: activeTab === "top" ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.06)",
              }}
            >
              <Sparkles size={13} color={activeTab === "top" ? "#fbbf24" : "#71717a"} />
              <Text
                style={{
                  color: activeTab === "top" ? "#ffffff" : "#71717a",
                  fontSize: 13,
                  fontWeight: activeTab === "top" ? "700" : "500",
                }}
              >
                Mais produtivos
              </Text>
              <View
                className="px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: activeTab === "top" ? "#3f3f46" : "#1f2024" }}
              >
                <Text style={{ color: activeTab === "top" ? "#ffffff" : "#71717a", fontSize: 11, fontWeight: "700" }}>
                  {topCount}
                </Text>
              </View>
            </Pressable>
          </ScrollView>

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
          <View className="items-center gap-2 py-16">
            <Users size={32} color={colors.textMuted} />
            <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "600" }}>Nenhum profissional encontrado</Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: "center" }}>
              Cadastre sua equipe para gerenciar a agenda e serviços.
            </Text>
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
                onEdit={handleOpenEdit}
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

      {/* Modal: Cadastro de Novo Profissional */}
      <Modal
        visible={createModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0, 0, 0, 0.75)" }}>
          <View
            className="w-full rounded-t-3xl border-t p-5 gap-4"
            style={{
              backgroundColor: "#111215",
              borderColor: "rgba(255, 255, 255, 0.12)",
            }}
          >
            <View className="flex-row items-center justify-between pb-2 border-b" style={{ borderBottomColor: "rgba(255, 255, 255, 0.08)" }}>
              <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "800" }}>
                Cadastrar Novo Profissional
              </Text>
              <Pressable onPress={() => setCreateModalVisible(false)} className="p-1 rounded-lg">
                <X size={20} color="#ffffff" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 20 }}>
              <View className="gap-1.5">
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>NOME COMPLETO *</Text>
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Ex: Carlos Oliveira"
                  placeholderTextColor={colors.textMuted}
                  style={{
                    backgroundColor: "#18191e",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: radius.sm,
                    paddingHorizontal: 12,
                    height: 44,
                    color: "#ffffff",
                    fontSize: 14,
                  }}
                />
              </View>

              <View className="gap-1.5">
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>CARGO / ESPECIALIDADE</Text>
                <TextInput
                  value={newJobTitle}
                  onChangeText={setNewJobTitle}
                  placeholder="Ex: Barbeiro Especialista, Tatuador"
                  placeholderTextColor={colors.textMuted}
                  style={{
                    backgroundColor: "#18191e",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: radius.sm,
                    paddingHorizontal: 12,
                    height: 44,
                    color: "#ffffff",
                    fontSize: 14,
                  }}
                />
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1 gap-1.5">
                  <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>WHATSAPP</Text>
                  <TextInput
                    value={newPhone}
                    onChangeText={setNewPhone}
                    placeholder="(11) 98888-7777"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    style={{
                      backgroundColor: "#18191e",
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      borderWidth: 1,
                      borderRadius: radius.sm,
                      paddingHorizontal: 12,
                      height: 44,
                      color: "#ffffff",
                      fontSize: 14,
                    }}
                  />
                </View>

                <View className="flex-1 gap-1.5">
                  <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>COMISSÃO (%)</Text>
                  <TextInput
                    value={newCommission}
                    onChangeText={setNewCommission}
                    placeholder="30"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    style={{
                      backgroundColor: "#18191e",
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      borderWidth: 1,
                      borderRadius: radius.sm,
                      paddingHorizontal: 12,
                      height: 44,
                      color: "#ffffff",
                      fontSize: 14,
                    }}
                  />
                </View>
              </View>

              <View className="gap-1.5">
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>E-MAIL (LOGIN DO PROFISSIONAL)</Text>
                <TextInput
                  value={newEmail}
                  onChangeText={setNewEmail}
                  placeholder="carlos@exemplo.com"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={{
                    backgroundColor: "#18191e",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: radius.sm,
                    paddingHorizontal: 12,
                    height: 44,
                    color: "#ffffff",
                    fontSize: 14,
                  }}
                />
              </View>

              <Button
                label={savingEmployee ? "Cadastrando..." : "Cadastrar Profissional"}
                onPress={handleCreateEmployee}
                disabled={savingEmployee}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: Editar Profissional */}
      <Modal
        visible={Boolean(editingEmployee)}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingEmployee(null)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0, 0, 0, 0.75)" }}>
          <View
            className="w-full rounded-t-3xl border-t p-5 gap-4"
            style={{
              backgroundColor: "#111215",
              borderColor: "rgba(255, 255, 255, 0.12)",
            }}
          >
            <View className="flex-row items-center justify-between pb-2 border-b" style={{ borderBottomColor: "rgba(255, 255, 255, 0.08)" }}>
              <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "800" }}>
                Editar Profissional
              </Text>
              <Pressable onPress={() => setEditingEmployee(null)} className="p-1 rounded-lg">
                <X size={20} color="#ffffff" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 20 }}>
              <View className="gap-1.5">
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>NOME COMPLETO *</Text>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Nome do profissional"
                  placeholderTextColor={colors.textMuted}
                  style={{
                    backgroundColor: "#18191e",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: radius.sm,
                    paddingHorizontal: 12,
                    height: 44,
                    color: "#ffffff",
                    fontSize: 14,
                  }}
                />
              </View>

              <View className="gap-1.5">
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>CARGO / ESPECIALIDADE</Text>
                <TextInput
                  value={editJobTitle}
                  onChangeText={setEditJobTitle}
                  placeholder="Ex: Barbeiro Especialista"
                  placeholderTextColor={colors.textMuted}
                  style={{
                    backgroundColor: "#18191e",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: radius.sm,
                    paddingHorizontal: 12,
                    height: 44,
                    color: "#ffffff",
                    fontSize: 14,
                  }}
                />
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1 gap-1.5">
                  <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>WHATSAPP</Text>
                  <TextInput
                    value={editPhone}
                    onChangeText={setEditPhone}
                    placeholder="(11) 98888-7777"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    style={{
                      backgroundColor: "#18191e",
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      borderWidth: 1,
                      borderRadius: radius.sm,
                      paddingHorizontal: 12,
                      height: 44,
                      color: "#ffffff",
                      fontSize: 14,
                    }}
                  />
                </View>

                <View className="flex-1 gap-1.5">
                  <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>COMISSÃO (%)</Text>
                  <TextInput
                    value={editCommission}
                    onChangeText={setEditCommission}
                    placeholder="30"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    style={{
                      backgroundColor: "#18191e",
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      borderWidth: 1,
                      borderRadius: radius.sm,
                      paddingHorizontal: 12,
                      height: 44,
                      color: "#ffffff",
                      fontSize: 14,
                    }}
                  />
                </View>
              </View>

              {/* Active Toggle Switch */}
              <View
                className="flex-row items-center justify-between p-3.5 rounded-xl border"
                style={{ backgroundColor: "#18191e", borderColor: "rgba(255, 255, 255, 0.1)" }}
              >
                <View>
                  <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "700" }}>Profissional Ativo</Text>
                  <Text style={{ color: "#71717a", fontSize: 12 }}>Disponível para novos agendamentos</Text>
                </View>
                <Switch
                  value={editActive}
                  onValueChange={setEditActive}
                  trackColor={{ false: "#27272a", true: primaryColor || "#22c55e" }}
                  thumbColor="#ffffff"
                />
              </View>

              <Button
                label={savingEdit ? "Salvando..." : "Salvar Alterações"}
                onPress={handleSaveEdit}
                disabled={savingEdit}
              />

              {editingEmployee && (
                <Pressable
                  onPress={() => handleDeleteEmployee(editingEmployee)}
                  className="py-3 flex-row items-center justify-center gap-2 rounded-xl border"
                  style={{
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    borderColor: "rgba(239, 68, 68, 0.3)",
                  }}
                >
                  <Trash2 size={16} color="#ef4444" />
                  <Text style={{ color: "#ef4444", fontSize: 13.5, fontWeight: "700" }}>
                    Desativar Profissional
                  </Text>
                </Pressable>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
                      <View className="gap-2 pt-1 border-t" style={{ borderTopColor: "rgba(255, 255, 255, 0.06)" }}>
                        <View className="flex-row items-center gap-2">
                          <Text style={{ color: "#a1a1aa", fontSize: 11, width: 60 }}>Turno:</Text>
                          <TextInput
                            value={sch.startTime}
                            onChangeText={(val) => updateScheduleDay(idx, { startTime: val })}
                            placeholder="09:00"
                            placeholderTextColor="#71717a"
                            style={{
                              backgroundColor: "#202127",
                              borderColor: "rgba(255, 255, 255, 0.1)",
                              borderWidth: 1,
                              borderRadius: 6,
                              paddingHorizontal: 8,
                              height: 32,
                              color: "#ffffff",
                              fontSize: 12,
                              width: 70,
                              textAlign: "center",
                            }}
                          />
                          <Text style={{ color: "#71717a", fontSize: 12 }}>até</Text>
                          <TextInput
                            value={sch.endTime}
                            onChangeText={(val) => updateScheduleDay(idx, { endTime: val })}
                            placeholder="19:00"
                            placeholderTextColor="#71717a"
                            style={{
                              backgroundColor: "#202127",
                              borderColor: "rgba(255, 255, 255, 0.1)",
                              borderWidth: 1,
                              borderRadius: 6,
                              paddingHorizontal: 8,
                              height: 32,
                              color: "#ffffff",
                              fontSize: 12,
                              width: 70,
                              textAlign: "center",
                            }}
                          />
                        </View>

                        <View className="flex-row items-center gap-2">
                          <Text style={{ color: "#a1a1aa", fontSize: 11, width: 60 }}>Intervalo:</Text>
                          <TextInput
                            value={sch.breakStart || ""}
                            onChangeText={(val) => updateScheduleDay(idx, { breakStart: val || null })}
                            placeholder="12:00"
                            placeholderTextColor="#71717a"
                            style={{
                              backgroundColor: "#202127",
                              borderColor: "rgba(255, 255, 255, 0.1)",
                              borderWidth: 1,
                              borderRadius: 6,
                              paddingHorizontal: 8,
                              height: 32,
                              color: "#ffffff",
                              fontSize: 12,
                              width: 70,
                              textAlign: "center",
                            }}
                          />
                          <Text style={{ color: "#71717a", fontSize: 12 }}>até</Text>
                          <TextInput
                            value={sch.breakEnd || ""}
                            onChangeText={(val) => updateScheduleDay(idx, { breakEnd: val || null })}
                            placeholder="13:00"
                            placeholderTextColor="#71717a"
                            style={{
                              backgroundColor: "#202127",
                              borderColor: "rgba(255, 255, 255, 0.1)",
                              borderWidth: 1,
                              borderRadius: 6,
                              paddingHorizontal: 8,
                              height: 32,
                              color: "#ffffff",
                              fontSize: 12,
                              width: 70,
                              textAlign: "center",
                            }}
                          />
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
    </Screen>
  );
}
