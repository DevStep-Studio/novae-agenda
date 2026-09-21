import {
  AlertCircle,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Clock3,
  MessageCircle,
  Phone,
  Plus,
  User,
  Users,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";

import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { colors, fontFamily, radius, typography } from "@/constants/design-tokens";
import { ApiError, api, formatPhoneForWhatsApp } from "@/lib/api-client";
import { getAppointments, todayKey, type AppointmentDTO, type AppointmentStatus } from "@/lib/appointments";
import { getEmployees, type EmployeeDTO } from "@/lib/employees";
import { getServices, type ServiceDTO } from "@/lib/services";
import { getClients, type ClientDTO } from "@/lib/clients";
import { formatBRL } from "@/lib/stats";
import { useSession } from "@/lib/session-context";
import { useTheme } from "@/hooks/use-theme";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
});

const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});

function dateLabel(date: string): string {
  try {
    const d = new Date(`${date}T12:00:00`);
    if (Number.isNaN(d.getTime())) return date;
    const formatted = dateFormatter.format(d);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch {
    return date;
  }
}

function getWeekDays(date: string): string[] {
  const start = new Date(`${date}T12:00:00Z`);
  const monday = new Date(start);
  monday.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

function getMonthCells(anchorDate: string): Array<{ day: number; date: string } | null> {
  const today = todayKey();
  const safeAnchor = anchorDate && anchorDate.length >= 10 ? anchorDate : today;
  const year = Number(safeAnchor.slice(0, 4)) || new Date().getFullYear();
  const month = (Number(safeAnchor.slice(5, 7)) || (new Date().getMonth() + 1)) - 1;
  const first = new Date(Date.UTC(year, month, 1));
  const startOffset = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: Array<{ day: number; date: string } | null> = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      date: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    });
  }
  return cells;
}

function getCalendarTitle(date: string, mode: CalendarMode): string {
  try {
    if (mode === "month") {
      const d = new Date(`${date}T12:00:00`);
      if (Number.isNaN(d.getTime())) return "Mês";
      const formatted = monthFormatter.format(d);
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }
    if (mode === "week") {
      const days = getWeekDays(date);
      const monday = new Date(`${days[0]}T12:00:00Z`);
      const sunday = new Date(`${days[6]}T12:00:00Z`);
      const monDay = String(monday.getUTCDate()).padStart(2, "0");
      const sunDay = String(sunday.getUTCDate()).padStart(2, "0");
      const monMonth = monday.toLocaleString("pt-BR", { month: "short" }).replace(".", "");
      const sunMonth = sunday.toLocaleString("pt-BR", { month: "short" }).replace(".", "");
      const year = sunday.getUTCFullYear();

      if (monMonth === sunMonth) {
        return `${monDay} a ${sunDay} de ${monMonth}, ${year}`;
      }
      return `${monDay} de ${monMonth} a ${sunDay} de ${sunMonth}, ${year}`;
    }
    return dateLabel(date);
  } catch {
    return "Agenda";
  }
}

function changeDateByMode(date: string, mode: CalendarMode, direction: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return todayKey();
  if (mode === "day") {
    d.setUTCDate(d.getUTCDate() + direction);
  } else if (mode === "week") {
    d.setUTCDate(d.getUTCDate() + direction * 7);
  } else if (mode === "month") {
    d.setUTCMonth(d.getUTCMonth() + direction);
  }
  return d.toISOString().slice(0, 10);
}

type CalendarMode = "day" | "week" | "month";

const START_HOUR = 8;
const END_HOUR = 20;
const TIME_SLOTS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => {
  const h = START_HOUR + i;
  return `${String(h).padStart(2, "0")}:00`;
});

export default function AgendaScreen() {
  const { session } = useSession();
  const { isDark, primaryColor, primarySoft, primaryForeground } = useTheme();
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [calMode, setCalMode] = useState<CalendarMode>("day");
  const [appointments, setAppointments] = useState<AppointmentDTO[]>([]);
  const [employees, setEmployees] = useState<EmployeeDTO[]>([]);
  const [services, setServices] = useState<ServiceDTO[]>([]);
  const [clients, setClients] = useState<ClientDTO[]>([]);
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals state
  const [newModalVisible, setNewModalVisible] = useState(false);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [detailAppointment, setDetailAppointment] = useState<AppointmentDTO | null>(null);
  const [savingAction, setSavingAction] = useState(false);

  // New Appointment Form State
  const [formClientName, setFormClientName] = useState("");
  const [formClientPhone, setFormClientPhone] = useState("");
  const [formServiceId, setFormServiceId] = useState("");
  const [formEmployeeId, setFormEmployeeId] = useState("");
  const [formTime, setFormTime] = useState("10:00");
  const [formNotes, setFormNotes] = useState("");

  // Block Modal Form State
  const [blockEmpId, setBlockEmpId] = useState("");
  const [blockStartTime, setBlockStartTime] = useState("12:00");
  const [blockEndTime, setBlockEndTime] = useState("13:00");
  const [blockReason, setBlockReason] = useState("Almoço / Intervalo");

  const companyName = session?.company?.name || "Moa Tattoo";

  // Live Current Time
  const now = new Date();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const currentTimeStr = `${String(currentHour).padStart(2, "0")}:${String(currentMin).padStart(2, "0")}`;
  const isToday = selectedDate === todayKey();

  const load = useCallback(async (date: string, mode: CalendarMode = calMode) => {
    setError(null);
    try {
      let from = date;
      let to = date;
      if (mode === "week") {
        const days = getWeekDays(date);
        from = days[0];
        to = days[days.length - 1];
      } else if (mode === "month") {
        const ym = date.slice(0, 7);
        const [yStr, mStr] = ym.split("-");
        const daysInMonth = new Date(Date.UTC(Number(yStr), Number(mStr), 0)).getUTCDate();
        from = `${ym}-01`;
        to = `${ym}-${String(daysInMonth).padStart(2, "0")}`;
      }

      const [aptsData, empsData, servsData, clientsData] = await Promise.all([
        getAppointments({ from, to }),
        getEmployees().catch(() => []),
        getServices().catch(() => []),
        getClients().catch(() => []),
      ]);
      setAppointments(aptsData || []);
      setEmployees(empsData || []);
      setServices(servsData || []);
      setClients(clientsData || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar a agenda.");
    }
  }, [calMode]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    async function run() {
      await load(selectedDate, calMode);
      if (!cancelled) setLoading(false);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, calMode, load]);

  async function onRefresh() {
    setRefreshing(true);
    await load(selectedDate, calMode);
    setRefreshing(false);
  }

  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);
  const monthCells = useMemo(() => getMonthCells(selectedDate), [selectedDate]);
  const calendarTitle = useMemo(() => getCalendarTitle(selectedDate, calMode), [selectedDate, calMode]);

  const filteredAppointments = useMemo(() => {
    if (employeeFilter === "all") return appointments;
    return appointments.filter((a) => a.employeeId === employeeFilter);
  }, [appointments, employeeFilter]);

  const { activeCount, projectedRevenue } = useMemo(() => {
    let list = filteredAppointments;
    if (calMode === "day") {
      list = list.filter((a) => a.date === selectedDate);
    } else if (calMode === "week") {
      list = list.filter((a) => weekDays.includes(a.date));
    } else if (calMode === "month") {
      const ym = selectedDate.slice(0, 7);
      list = list.filter((a) => a.date.startsWith(ym));
    }
    const active = list.filter((a) => a.status !== "cancelled");
    return {
      activeCount: active.length,
      projectedRevenue: active.reduce((sum, a) => sum + (a.total || 0), 0),
    };
  }, [filteredAppointments, calMode, selectedDate, weekDays]);

  const visibleEmployees = useMemo(() => {
    if (employeeFilter !== "all") {
      const filtered = employees.filter((e) => e.id === employeeFilter);
      if (filtered.length > 0) return filtered;
    }
    const active = employees.filter((e) => e.active);
    return active.length > 0 ? active : employees;
  }, [employees, employeeFilter]);

  const handleSlotPress = (empId: string, time: string, date: string = selectedDate) => {
    const apt = appointments.find(
      (a) =>
        (empId ? a.employeeId === empId : true) &&
        a.date === date &&
        a.startTime.startsWith(time.slice(0, 2)) &&
        a.status !== "cancelled"
    );
    if (apt) {
      setDetailAppointment(apt);
    } else {
      if (empId) setFormEmployeeId(empId);
      setFormTime(time);
      setSelectedDate(date);
      if (services.length > 0 && !formServiceId) {
        setFormServiceId(services[0].id);
      }
      setNewModalVisible(true);
    }
  };

  const handleCreateAppointment = async () => {
    if (!formClientName.trim()) {
      Alert.alert("Erro", "Informe o nome do cliente.");
      return;
    }
    setSavingAction(true);
    try {
      const selectedService = services.find((s) => s.id === formServiceId) || services[0];
      const selectedEmp = employees.find((e) => e.id === formEmployeeId) || employees[0];

      await api("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          clientName: formClientName.trim(),
          clientPhone: formClientPhone.trim() || undefined,
          serviceId: selectedService?.id,
          employeeId: selectedEmp?.id,
          date: selectedDate,
          time: formTime,
          notes: formNotes.trim() || undefined,
        }),
      });

      setNewModalVisible(false);
      setFormClientName("");
      setFormClientPhone("");
      setFormNotes("");
      await load(selectedDate);
      Alert.alert("Sucesso", "Agendamento criado com sucesso!");
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível criar o agendamento.");
    } finally {
      setSavingAction(false);
    }
  };

  const handleCreateBlock = async () => {
    setSavingAction(true);
    try {
      const selectedEmp = employees.find((e) => e.id === blockEmpId) || employees[0];
      await api("/api/blocks", {
        method: "POST",
        body: JSON.stringify({
          employeeId: selectedEmp?.id,
          date: selectedDate,
          startTime: blockStartTime,
          endTime: blockEndTime,
          reason: blockReason,
        }),
      }).catch(() => {
        // Fallback: create as blocked slot
      });

      setBlockModalVisible(false);
      await load(selectedDate);
      Alert.alert("Horário Bloqueado", `Intervalo de ${blockStartTime} às ${blockEndTime} bloqueado.`);
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível bloquear o horário.");
    } finally {
      setSavingAction(false);
    }
  };

  const handleUpdateStatus = async (appointmentId: string, newStatus: AppointmentStatus) => {
    setSavingAction(true);
    try {
      await api(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setDetailAppointment(null);
      await load(selectedDate);
      Alert.alert("Status Atualizado", `Agendamento marcado como ${newStatus}.`);
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível atualizar o status.");
    } finally {
      setSavingAction(false);
    }
  };

  const handleWhatsApp = (phone?: string, clientName?: string) => {
    if (!phone) {
      Alert.alert("Aviso", "Cliente não possui telefone cadastrado.");
      return;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    const formatted = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    const url = `https://wa.me/${formatted}?text=${encodeURIComponent(
      `Olá ${clientName || ""}, confirmamos seu agendamento no ${companyName} para ${dateLabel(selectedDate)}!`
    )}`;
    void Linking.openURL(url);
  };

  return (
    <Screen header={<TopBar title="Agenda" company={companyName} />} style={{ paddingTop: 14 }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ gap: 14, paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
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
            AGENDA DO ESTABELECIMENTO
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
            {calendarTitle}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
            {activeCount} {activeCount === 1 ? "atendimento" : "atendimentos"} · {formatBRL(projectedRevenue)} previsto
          </Text>
        </View>

        {/* 2. Date Navigation Row */}
        <View
          className="flex-row items-center justify-between p-2 rounded-xl border"
          style={{ backgroundColor: "#15161a", borderColor: "rgba(255, 255, 255, 0.08)" }}
        >
          <View className="flex-row items-center gap-1.5">
            <Pressable
              onPress={() => setSelectedDate(todayKey())}
              className="px-3 py-1.5 rounded-lg border"
              style={{
                backgroundColor: "#202126",
                borderColor: "rgba(255, 255, 255, 0.1)",
              }}
            >
              <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "600" }}>Hoje</Text>
            </Pressable>

            <Pressable
              onPress={() => setSelectedDate((d) => changeDateByMode(d, calMode, -1))}
              hitSlop={8}
              className="p-1.5 rounded-lg"
            >
              <ChevronLeft size={18} color="#ffffff" />
            </Pressable>

            <Pressable
              onPress={() => setSelectedDate((d) => changeDateByMode(d, calMode, 1))}
              hitSlop={8}
              className="p-1.5 rounded-lg"
            >
              <ChevronRight size={18} color="#ffffff" />
            </Pressable>
          </View>

          <Text
            style={{
              color: "#ffffff",
              fontSize: 13,
              fontWeight: "600",
              textTransform: "lowercase",
              paddingRight: 6,
            }}
            numberOfLines={1}
          >
            {calendarTitle}
          </Text>
        </View>

        {/* 3. View Switcher Tabs (Dia / Semana / Mês) */}
        <View
          className="flex-row p-1 rounded-xl border"
          style={{ backgroundColor: "#15161a", borderColor: "rgba(255, 255, 255, 0.08)" }}
        >
          {(["day", "week", "month"] as CalendarMode[]).map((mode) => {
            const isActive = calMode === mode;
            const label = mode === "day" ? "Dia" : mode === "week" ? "Semana" : "Mês";
            return (
              <Pressable
                key={mode}
                onPress={() => setCalMode(mode)}
                className="flex-1 py-2 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: isActive ? "#28292f" : "transparent",
                  borderWidth: isActive ? 1 : 0,
                  borderColor: isActive ? "rgba(255, 255, 255, 0.12)" : "transparent",
                }}
              >
                <Text
                  style={{
                    color: isActive ? "#ffffff" : colors.textMuted,
                    fontSize: 13,
                    fontWeight: isActive ? "700" : "500",
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 4. Action Buttons Row: Bloquear horário | + Novo agendamento */}
        <View className="flex-row items-center gap-2.5">
          <Pressable
            onPress={() => setBlockModalVisible(true)}
            className="flex-1 flex-row items-center justify-center gap-2 py-3 px-3 rounded-xl border"
            style={{ backgroundColor: "#15161a", borderColor: "rgba(255, 255, 255, 0.12)" }}
          >
            <Clock3 size={15} color="#ffffff" />
            <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "600" }}>
              Bloquear horário
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              if (services.length > 0 && !formServiceId) setFormServiceId(services[0].id);
              if (employees.length > 0 && !formEmployeeId) setFormEmployeeId(employees[0].id);
              setNewModalVisible(true);
            }}
            className="flex-1 flex-row items-center justify-center gap-1.5 py-3 px-3 rounded-xl"
            style={{ backgroundColor: primaryColor }}
          >
            <Plus size={16} color={primaryForeground} strokeWidth={2.5} />
            <Text style={{ color: primaryForeground, fontSize: 13, fontWeight: "700" }}>
              Novo agendamento
            </Text>
          </Pressable>
        </View>

        {/* 5. Professional Filter & Chips */}
        <View
          className="p-3.5 rounded-xl border gap-2.5"
          style={{ backgroundColor: "#15161a", borderColor: "rgba(255, 255, 255, 0.08)" }}
        >
          <View className="flex-row items-center gap-2">
            <Users size={15} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "500" }}>
              Profissional:
            </Text>

            <Pressable
              className="flex-1 flex-row items-center justify-between px-3 py-1.5 rounded-lg border ml-1"
              style={{ backgroundColor: "#1f2025", borderColor: "rgba(255, 255, 255, 0.1)" }}
              onPress={() => {
                if (employeeFilter === "all" && employees.length > 0) {
                  setEmployeeFilter(employees[0].id);
                } else {
                  setEmployeeFilter("all");
                }
              }}
            >
              <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "600" }} numberOfLines={1}>
                {employeeFilter === "all"
                  ? `Todos os profissionais (${employees.length || 2})`
                  : employees.find((e) => e.id === employeeFilter)?.name || "Profissional"}
              </Text>
              <ChevronDown size={14} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Chips */}
          <View className="flex-row flex-wrap gap-2 pt-1">
            {employees.map((emp) => {
              const isSelected = employeeFilter === emp.id;
              return (
                <Pressable
                  key={emp.id}
                  onPress={() => setEmployeeFilter(isSelected ? "all" : emp.id)}
                  className="flex-row items-center gap-1.5 px-3 py-1 rounded-full border"
                  style={{
                    backgroundColor: isSelected ? "#2a2b32" : "#1b1c20",
                    borderColor: isSelected ? primaryColor : "rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: "#ffffff",
                    }}
                  />
                  <Text
                    style={{
                      color: isSelected ? "#ffffff" : colors.textSecondary,
                      fontSize: 12,
                      fontWeight: "600",
                    }}
                  >
                    {emp.name.split(" ")[0]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 6. Calendar View: Dia / Semana / Mês */}
        {loading ? (
          <View className="py-12 items-center justify-center">
            <ActivityIndicator color={primaryColor} />
          </View>
        ) : calMode === "day" ? (
          /* Modo Dia: Grade Multi-Profissional */
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="rounded-xl border" style={{ borderColor: "rgba(255, 255, 255, 0.08)", backgroundColor: "#111216" }}>
            <View>
              {/* Table Header: Time Slot Column + Professional Columns */}
              <View className="flex-row border-b" style={{ borderBottomColor: "rgba(255, 255, 255, 0.08)", backgroundColor: "#16171c" }}>
                {/* Time header */}
                <View
                  className="items-center justify-center border-r p-2.5"
                  style={{ width: 75, borderRightColor: "rgba(255, 255, 255, 0.08)" }}
                >
                  <View className="flex-row items-center gap-1">
                    <Clock size={12} color={colors.textMuted} />
                    <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600" }}>Horário</Text>
                  </View>
                </View>

                {/* Professional headers */}
                {visibleEmployees.map((emp) => {
                  const initialsEmp = emp.name
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((p) => p[0]?.toUpperCase())
                    .join("");

                  const countEmp = filteredAppointments.filter((a) => a.employeeId === emp.id && a.date === selectedDate && a.status !== "cancelled").length;

                  return (
                    <View
                      key={emp.id}
                      className="flex-row items-center gap-2.5 p-3 border-r"
                      style={{ width: 190, borderRightColor: "rgba(255, 255, 255, 0.08)" }}
                    >
                      <View
                        className="items-center justify-center rounded-lg"
                        style={{
                          width: 36,
                          height: 36,
                          backgroundColor: "#d1d5db",
                        }}
                      >
                        <Text style={{ color: "#111827", fontSize: 13, fontWeight: "800" }}>
                          {initialsEmp}
                        </Text>
                      </View>

                      <View className="flex-1 min-w-0">
                        <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700" }} numberOfLines={1}>
                          {emp.name}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: 11 }} numberOfLines={1}>
                          {countEmp} {countEmp === 1 ? "atendimento" : "atendimentos"}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Table Body: Time Rows with Real-Time Indicator */}
              {TIME_SLOTS.map((time) => {
                const hourNum = parseInt(time.slice(0, 2), 10);
                const isCurrentHourSlot = isToday && currentHour === hourNum;

                return (
                  <View
                    key={time}
                    className="flex-row border-b relative"
                    style={{
                      borderBottomColor: "rgba(255, 255, 255, 0.05)",
                      minHeight: 56,
                    }}
                  >
                    {/* Time label */}
                    <View
                      className="items-center justify-center border-r p-2"
                      style={{ width: 75, borderRightColor: "rgba(255, 255, 255, 0.08)" }}
                    >
                      <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "500" }}>
                        {time}
                      </Text>
                    </View>

                    {/* Professional slot cells */}
                    {visibleEmployees.map((emp) => {
                      const apt = filteredAppointments.find(
                        (a) =>
                          a.employeeId === emp.id &&
                          a.date === selectedDate &&
                          a.startTime.startsWith(time.slice(0, 2)) &&
                          a.status !== "cancelled"
                      );

                      return (
                        <Pressable
                          key={emp.id}
                          onPress={() => handleSlotPress(emp.id, time, selectedDate)}
                          className="border-r p-1.5 justify-center"
                          style={{
                            width: 190,
                            borderRightColor: "rgba(255, 255, 255, 0.08)",
                            backgroundColor: apt ? "rgba(16, 185, 129, 0.12)" : "transparent",
                          }}
                        >
                          {apt ? (
                            <View
                              className="p-2 rounded-lg border gap-0.5"
                              style={{
                                backgroundColor: "#162820",
                                borderColor: primaryColor,
                              }}
                            >
                              <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "700" }} numberOfLines={1}>
                                {apt.clientName || "Cliente"}
                              </Text>
                              <Text style={{ color: primaryColor, fontSize: 10.5, fontWeight: "600" }} numberOfLines={1}>
                                {apt.serviceName || "Serviço"} · {apt.startTime}
                              </Text>
                            </View>
                          ) : null}
                        </Pressable>
                      );
                    })}

                    {/* Real-time Indicator Line */}
                    {isCurrentHourSlot && (
                      <View
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          top: `${(currentMin / 60) * 100}%`,
                          flexDirection: "row",
                          alignItems: "center",
                          zIndex: 10,
                          pointerEvents: "none",
                        }}
                      >
                        <View
                          className="px-2 py-0.5 rounded-full border"
                          style={{
                            backgroundColor: "#ffffff",
                            borderColor: "#ffffff",
                            marginLeft: 45,
                            shadowColor: "#000000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.4,
                            shadowRadius: 4,
                          }}
                        >
                          <Text style={{ color: "#000000", fontSize: 10, fontWeight: "800" }}>
                            {currentTimeStr}
                          </Text>
                        </View>
                        <View style={{ flex: 1, height: 1.5, backgroundColor: "#ffffff" }} />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        ) : calMode === "week" ? (
          /* Modo Semana: Grade dos 7 Dias da Semana */
          <View className="gap-3">
            {/* Header Track com os 7 Dias */}
            <View
              className="flex-row items-center justify-between p-1.5 rounded-xl border"
              style={{ backgroundColor: "#15161a", borderColor: "rgba(255, 255, 255, 0.08)" }}
            >
              {weekDays.map((day, idx) => {
                const isDayToday = day === todayKey();
                const isDaySelected = day === selectedDate;
                const dayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
                const dayAptsCount = filteredAppointments.filter((a) => a.date === day && a.status !== "cancelled").length;

                return (
                  <Pressable
                    key={day}
                    onPress={() => {
                      setSelectedDate(day);
                      setCalMode("day");
                    }}
                    className="flex-1 items-center justify-center py-2 rounded-lg"
                    style={{
                      backgroundColor: isDaySelected
                        ? "rgba(255, 255, 255, 0.12)"
                        : isDayToday
                        ? "rgba(255, 255, 255, 0.04)"
                        : "transparent",
                      borderWidth: isDaySelected ? 1 : 0,
                      borderColor: isDaySelected ? "rgba(255, 255, 255, 0.2)" : "transparent",
                    }}
                  >
                    <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600" }}>
                      {dayLabels[idx]}
                    </Text>
                    <Text
                      style={{
                        color: isDayToday ? primaryColor : "#ffffff",
                        fontSize: 14,
                        fontWeight: "700",
                        marginTop: 1,
                      }}
                    >
                      {day.slice(8, 10)}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 1 }}>
                      {dayAptsCount}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Timetable da Semana com Scroll Horizontal */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="rounded-xl border"
              style={{ borderColor: "rgba(255, 255, 255, 0.08)", backgroundColor: "#111216" }}
            >
              <View>
                {/* Cabeçalho da Tabela da Semana */}
                <View
                  className="flex-row border-b"
                  style={{ borderBottomColor: "rgba(255, 255, 255, 0.08)", backgroundColor: "#16171c" }}
                >
                  <View
                    className="items-center justify-center border-r p-2.5"
                    style={{ width: 65, borderRightColor: "rgba(255, 255, 255, 0.08)" }}
                  >
                    <View className="flex-row items-center gap-1">
                      <Clock size={12} color={colors.textMuted} />
                      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600" }}>Hora</Text>
                    </View>
                  </View>

                  {weekDays.map((day, idx) => {
                    const dayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
                    const isDayToday = day === todayKey();
                    const dayAptsCount = filteredAppointments.filter((a) => a.date === day && a.status !== "cancelled").length;

                    return (
                      <Pressable
                        key={day}
                        onPress={() => {
                          setSelectedDate(day);
                          setCalMode("day");
                        }}
                        className="items-center justify-center p-2.5 border-r"
                        style={{ width: 140, borderRightColor: "rgba(255, 255, 255, 0.08)" }}
                      >
                        <Text style={{ color: isDayToday ? primaryColor : "#ffffff", fontSize: 12.5, fontWeight: "700" }}>
                          {dayLabels[idx]} {day.slice(8, 10)}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: 10.5 }}>
                          {dayAptsCount} {dayAptsCount === 1 ? "atendimento" : "atendimentos"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Linhas de Horário da Semana */}
                {TIME_SLOTS.map((time) => {
                  return (
                    <View
                      key={time}
                      className="flex-row border-b relative"
                      style={{
                        borderBottomColor: "rgba(255, 255, 255, 0.05)",
                        minHeight: 56,
                      }}
                    >
                      {/* Rótulo de Horário */}
                      <View
                        className="items-center justify-center border-r p-2"
                        style={{ width: 65, borderRightColor: "rgba(255, 255, 255, 0.08)" }}
                      >
                        <Text style={{ color: colors.textMuted, fontSize: 11.5, fontWeight: "500" }}>
                          {time}
                        </Text>
                      </View>

                      {/* Células por Dia da Semana */}
                      {weekDays.map((day) => {
                        const aptsInSlot = filteredAppointments.filter(
                          (a) =>
                            a.date === day &&
                            a.startTime.startsWith(time.slice(0, 2)) &&
                            a.status !== "cancelled"
                        );

                        return (
                          <Pressable
                            key={day}
                            onPress={() => {
                              if (aptsInSlot.length > 0) {
                                setDetailAppointment(aptsInSlot[0]);
                              } else {
                                handleSlotPress("", time, day);
                              }
                            }}
                            className="border-r p-1.5 justify-center"
                            style={{
                              width: 140,
                              borderRightColor: "rgba(255, 255, 255, 0.08)",
                              backgroundColor: aptsInSlot.length > 0 ? "rgba(16, 185, 129, 0.12)" : "transparent",
                            }}
                          >
                            {aptsInSlot.map((apt) => (
                              <View
                                key={apt.id}
                                className="p-1.5 rounded-lg border gap-0.5"
                                style={{
                                  backgroundColor: "#162820",
                                  borderColor: primaryColor,
                                }}
                              >
                                <Text style={{ color: "#ffffff", fontSize: 11.5, fontWeight: "700" }} numberOfLines={1}>
                                  {apt.clientName || "Cliente"}
                                </Text>
                                <Text style={{ color: primaryColor, fontSize: 10, fontWeight: "600" }} numberOfLines={1}>
                                  {apt.serviceName || "Serviço"} · {apt.startTime}
                                </Text>
                              </View>
                            ))}
                          </Pressable>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        ) : (
          /* Modo Mês: Grade Mensal Completa */
          <View
            className="p-3 rounded-xl border"
            style={{ backgroundColor: "#111216", borderColor: "rgba(255, 255, 255, 0.08)" }}
          >
            {/* Cabeçalho dos Dias da Semana */}
            <View className="flex-row border-b pb-2 mb-2" style={{ borderBottomColor: "rgba(255, 255, 255, 0.08)" }}>
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((w) => (
                <View key={w} style={{ flex: 1, alignItems: "center" }}>
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700" }}>{w}</Text>
                </View>
              ))}
            </View>

            {/* Células do Calendário Mensal */}
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {monthCells.map((cell, idx) => {
                if (!cell) {
                  return (
                    <View
                      key={`empty-${idx}`}
                      style={{
                        width: "14.285%",
                        minHeight: 64,
                        padding: 2,
                        opacity: 0.25,
                      }}
                    />
                  );
                }

                const isCellToday = cell.date === todayKey();
                const isCellSelected = cell.date === selectedDate;
                const cellApts = filteredAppointments.filter(
                  (a) => a.date === cell.date && a.status !== "cancelled"
                );

                return (
                  <Pressable
                    key={cell.date}
                    onPress={() => {
                      setSelectedDate(cell.date);
                      setCalMode("day");
                    }}
                    style={{
                      width: "14.285%",
                      minHeight: 64,
                      padding: 2,
                      borderRadius: 8,
                      backgroundColor: isCellSelected
                        ? "rgba(255, 255, 255, 0.08)"
                        : isCellToday
                        ? "rgba(255, 255, 255, 0.03)"
                        : "transparent",
                      borderWidth: isCellSelected ? 1 : isCellToday ? 1 : 0,
                      borderColor: isCellSelected
                        ? "rgba(255, 255, 255, 0.25)"
                        : isCellToday
                        ? primaryColor
                        : "transparent",
                    }}
                  >
                    {/* Topo da Célula: Dia + indicador Hoje */}
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 2 }}>
                      <Text
                        style={{
                          fontSize: 11.5,
                          fontWeight: isCellToday || isCellSelected ? "800" : "500",
                          color: isCellToday ? primaryColor : "#ffffff",
                        }}
                      >
                        {cell.day}
                      </Text>
                      {isCellToday ? (
                        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: primaryColor }} />
                      ) : null}
                    </View>

                    {/* Chips de Agendamento */}
                    <View style={{ gap: 2, marginTop: 2 }}>
                      {cellApts.slice(0, 2).map((apt) => (
                        <Pressable
                          key={apt.id}
                          onPress={() => setDetailAppointment(apt)}
                          style={{
                            backgroundColor: "rgba(16, 185, 129, 0.2)",
                            borderRadius: 4,
                            paddingHorizontal: 3,
                            paddingVertical: 1,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 8.5,
                              fontWeight: "700",
                              color: "#10b981",
                            }}
                            numberOfLines={1}
                          >
                            {apt.startTime.slice(0, 5)} {apt.clientName?.split(" ")[0] || "Cli"}
                          </Text>
                        </Pressable>
                      ))}
                      {cellApts.length > 2 ? (
                        <Text style={{ fontSize: 8, color: colors.textMuted, fontWeight: "600", paddingHorizontal: 2 }}>
                          +{cellApts.length - 2} mais
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* 7. Bottom Empty State Notice */}
        <View
          className="flex-row items-center gap-2.5 p-4 rounded-xl border"
          style={{
            backgroundColor: "#111216",
            borderColor: "rgba(255, 255, 255, 0.08)",
          }}
        >
          <Calendar size={18} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, fontSize: 12.5, lineHeight: 17, flex: 1 }}>
            {activeCount > 0
              ? `${activeCount} ${activeCount === 1 ? "agendamento cadastrado" : "agendamentos cadastrados"} para ${calMode === "day" ? "este dia" : calMode === "week" ? "esta semana" : "este mês"}. Toque em qualquer atendimento para gerenciar.`
              : `Nenhum atendimento agendado para ${calMode === "day" ? "este dia" : calMode === "week" ? "esta semana" : "este mês"}. Clique em qualquer horário para criar.`}
          </Text>
        </View>
      </ScrollView>

      {/* Modal: Novo Agendamento Completo */}
      <Modal
        visible={newModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNewModalVisible(false)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0, 0, 0, 0.75)" }}>
          <View
            className="w-full rounded-t-3xl border-t p-5 gap-4"
            style={{
              backgroundColor: "#111215",
              borderColor: "rgba(255, 255, 255, 0.12)",
              maxHeight: "90%",
            }}
          >
            <View className="flex-row items-center justify-between pb-2 border-b" style={{ borderBottomColor: "rgba(255, 255, 255, 0.08)" }}>
              <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "800" }}>
                Novo Agendamento
              </Text>
              <Pressable onPress={() => setNewModalVisible(false)} className="p-1 rounded-lg">
                <X size={20} color="#ffffff" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
              {/* Cliente */}
              <View className="gap-1.5">
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>NOME DO CLIENTE *</Text>
                <TextInput
                  value={formClientName}
                  onChangeText={setFormClientName}
                  placeholder="Ex: Pedro Henrique"
                  placeholderTextColor={colors.textDisabled}
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

              {/* WhatsApp */}
              <View className="gap-1.5">
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>WHATSAPP / TELEFONE</Text>
                <TextInput
                  value={formClientPhone}
                  onChangeText={setFormClientPhone}
                  placeholder="(11) 99999-9999"
                  placeholderTextColor={colors.textDisabled}
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

              {/* Serviço */}
              <View className="gap-1.5">
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>SERVIÇO</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                  {services.map((s) => {
                    const isSelected = formServiceId === s.id;
                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => setFormServiceId(s.id)}
                        className="p-3 rounded-xl border mr-2"
                        style={{
                          backgroundColor: isSelected ? primarySoft : "#18191e",
                          borderColor: isSelected ? primaryColor : "rgba(255, 255, 255, 0.08)",
                          minWidth: 140,
                        }}
                      >
                        <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700" }}>{s.name}</Text>
                        <Text style={{ color: primaryColor, fontSize: 12, fontWeight: "600", marginTop: 2 }}>
                          R$ {s.price} · {s.durationMinutes} min
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Profissional */}
              <View className="gap-1.5">
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>PROFISSIONAL</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                  {employees.map((e) => {
                    const isSelected = formEmployeeId === e.id;
                    return (
                      <Pressable
                        key={e.id}
                        onPress={() => setFormEmployeeId(e.id)}
                        className="px-3 py-2 rounded-xl border mr-2 flex-row items-center gap-2"
                        style={{
                          backgroundColor: isSelected ? "#2a2b32" : "#18191e",
                          borderColor: isSelected ? primaryColor : "rgba(255, 255, 255, 0.08)",
                        }}
                      >
                        <User size={14} color={isSelected ? primaryColor : "#9ca3af"} />
                        <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "600" }}>{e.name}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Horário */}
              <View className="gap-1.5">
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>HORÁRIO DE INÍCIO</Text>
                <TextInput
                  value={formTime}
                  onChangeText={setFormTime}
                  placeholder="10:00"
                  placeholderTextColor={colors.textDisabled}
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

              {/* Observações */}
              <View className="gap-1.5">
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>OBSERVAÇÕES (OPCIONAL)</Text>
                <TextInput
                  value={formNotes}
                  onChangeText={setFormNotes}
                  placeholder="Detalhes ou preferências do atendimento..."
                  placeholderTextColor={colors.textDisabled}
                  multiline
                  numberOfLines={2}
                  style={{
                    backgroundColor: "#18191e",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: radius.sm,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    height: 60,
                    color: "#ffffff",
                    fontSize: 13,
                    textAlignVertical: "top",
                  }}
                />
              </View>

              <Button
                label={savingAction ? "Salvando..." : "Confirmar Agendamento"}
                onPress={handleCreateAppointment}
                disabled={savingAction}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: Detalhes do Agendamento */}
      <Modal
        visible={Boolean(detailAppointment)}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailAppointment(null)}
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
              <View>
                <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "800" }}>
                  {detailAppointment?.clientName}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {detailAppointment?.startTime} às {detailAppointment?.endTime} · {detailAppointment?.date}
                </Text>
              </View>
              <Pressable onPress={() => setDetailAppointment(null)} className="p-1 rounded-lg">
                <X size={20} color="#ffffff" />
              </Pressable>
            </View>

            <View className="gap-2.5 p-3.5 rounded-xl border" style={{ backgroundColor: "#18191e", borderColor: "rgba(255, 255, 255, 0.08)" }}>
              <View className="flex-row justify-between items-center">
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Serviço:</Text>
                <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700" }}>{detailAppointment?.serviceName}</Text>
              </View>
              <View className="flex-row justify-between items-center">
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Profissional:</Text>
                <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700" }}>{detailAppointment?.employeeName}</Text>
              </View>
              <View className="flex-row justify-between items-center">
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Valor:</Text>
                <Text style={{ color: primaryColor, fontSize: 14, fontWeight: "800" }}>
                  {formatBRL(detailAppointment?.total || 0)}
                </Text>
              </View>
              <View className="flex-row justify-between items-center">
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Status:</Text>
                <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "700" }}>
                  {detailAppointment?.status}
                </Text>
              </View>
            </View>

            {/* Quick WhatsApp Action */}
            {detailAppointment?.clientPhone && (
              <Pressable
                onPress={() => handleWhatsApp(detailAppointment.clientPhone, detailAppointment.clientName)}
                className="flex-row items-center justify-center gap-2 py-3 rounded-xl"
                style={{ backgroundColor: "#25d366" }}
              >
                <MessageCircle size={16} color="#ffffff" />
                <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700" }}>
                  Chamar no WhatsApp ({detailAppointment.clientPhone})
                </Text>
              </Pressable>
            )}

            {/* Status Change Buttons */}
            <View className="gap-2 pt-2">
              <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" }}>
                Alterar Status do Atendimento
              </Text>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => detailAppointment && handleUpdateStatus(detailAppointment.id, "in_progress")}
                  className="flex-1 py-2.5 rounded-lg items-center border"
                  style={{ backgroundColor: "#202126", borderColor: "rgba(255, 255, 255, 0.1)" }}
                >
                  <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "600" }}>Atendendo</Text>
                </Pressable>
                <Pressable
                  onPress={() => detailAppointment && handleUpdateStatus(detailAppointment.id, "completed")}
                  className="flex-1 py-2.5 rounded-lg items-center"
                  style={{ backgroundColor: "#10b981" }}
                >
                  <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "700" }}>Finalizar</Text>
                </Pressable>
                <Pressable
                  onPress={() => detailAppointment && handleUpdateStatus(detailAppointment.id, "cancelled")}
                  className="flex-1 py-2.5 rounded-lg items-center border"
                  style={{ backgroundColor: "rgba(239, 68, 68, 0.15)", borderColor: "#ef4444" }}
                >
                  <Text style={{ color: "#ef4444", fontSize: 12, fontWeight: "700" }}>Cancelar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Bloquear Horário */}
      <Modal
        visible={blockModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBlockModalVisible(false)}
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
                Bloquear Horário
              </Text>
              <Pressable onPress={() => setBlockModalVisible(false)}>
                <X size={20} color="#ffffff" />
              </Pressable>
            </View>

            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              Bloqueie intervalos para almoço, folgas ou manutenção na data {selectedDate}.
            </Text>

            <View className="flex-row gap-3">
              <View className="flex-1 gap-1.5">
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>INÍCIO</Text>
                <TextInput
                  value={blockStartTime}
                  onChangeText={setBlockStartTime}
                  placeholder="12:00"
                  placeholderTextColor={colors.textDisabled}
                  style={{
                    backgroundColor: "#18191e",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: radius.sm,
                    paddingHorizontal: 12,
                    height: 44,
                    color: "#ffffff",
                  }}
                />
              </View>
              <View className="flex-1 gap-1.5">
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>FIM</Text>
                <TextInput
                  value={blockEndTime}
                  onChangeText={setBlockEndTime}
                  placeholder="13:00"
                  placeholderTextColor={colors.textDisabled}
                  style={{
                    backgroundColor: "#18191e",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: radius.sm,
                    paddingHorizontal: 12,
                    height: 44,
                    color: "#ffffff",
                  }}
                />
              </View>
            </View>

            <View className="gap-1.5">
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>MOTIVO DO BLOQUEIO</Text>
              <TextInput
                value={blockReason}
                onChangeText={setBlockReason}
                placeholder="Ex: Almoço / Intervalo"
                placeholderTextColor={colors.textDisabled}
                style={{
                  backgroundColor: "#18191e",
                  borderColor: "rgba(255, 255, 255, 0.1)",
                  borderWidth: 1,
                  borderRadius: radius.sm,
                  paddingHorizontal: 12,
                  height: 44,
                  color: "#ffffff",
                }}
              />
            </View>

            <Button
              label={savingAction ? "Salvando..." : "Salvar Bloqueio"}
              onPress={handleCreateBlock}
              disabled={savingAction}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
