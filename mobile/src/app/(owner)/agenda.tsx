import {
  AlertCircle,
  Ban,
  Building2,
  Calendar,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Clock3,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Scissors,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  User,
  UserCheck,
  UserPlus,
  UserRound,
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
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { router } from "expo-router";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
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
import { useTheme, hexToRgba } from "@/hooks/use-theme";
import { useResponsive } from "@/hooks/use-responsive";
import { scaleFont } from "@/lib/responsive";

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

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)})${digits.slice(2)}`;
  return `(${digits.slice(0, 2)})${digits.slice(2, 7)}-${digits.slice(7)}`;
}

type CalendarMode = "day" | "week" | "month";

const START_HOUR = 8;
const END_HOUR = 20;
const TIME_SLOTS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => {
  const h = START_HOUR + i;
  return `${String(h).padStart(2, "0")}:00`;
});

export default function AgendaScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const { isCompact, isTablet } = useResponsive();
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
  const [formClientId, setFormClientId] = useState("");
  const [formClientName, setFormClientName] = useState("");
  const [formClientPhone, setFormClientPhone] = useState("");
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [creatingClientBusy, setCreatingClientBusy] = useState(false);

  const [formServiceIds, setFormServiceIds] = useState<string[]>([]);
  const [formEmployeeId, setFormEmployeeId] = useState("");
  const [formTime, setFormTime] = useState("09:00");
  const [formNotes, setFormNotes] = useState("");
  const [availableSlots, setAvailableSlots] = useState<Array<{ startTime: string; endTime: string }>>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Block Modal Form State
  const [blockEmpId, setBlockEmpId] = useState("all");
  const [blockLocationId, setBlockLocationId] = useState("");
  const [blockType, setBlockType] = useState<"hours" | "allDay" | "period">("hours");
  const [blockStartDate, setBlockStartDate] = useState(todayKey());
  const [blockEndDate, setBlockEndDate] = useState(todayKey());
  const [blockStartTime, setBlockStartTime] = useState("12:00");
  const [blockEndTime, setBlockEndTime] = useState("13:00");
  const [blockReason, setBlockReason] = useState("");
  const [empPickerOpen, setEmpPickerOpen] = useState(false);
  const [locPickerOpen, setLocPickerOpen] = useState(false);
  const [typePickerOpen, setTypePickerOpen] = useState(false);

  const companyName = session?.company?.name || "";

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

  // Responsive calendar dimensions
  const timeColWidth = isCompact ? 54 : 68;
  const calendarAvailableWidth = Math.max(windowWidth - (isCompact ? 28 : 42), 260);
  const employeeAreaWidth = Math.max(calendarAvailableWidth - timeColWidth, 180);

  const colWidth = useMemo(() => {
    if (visibleEmployees.length <= 1) {
      return employeeAreaWidth;
    }
    return Math.max(Math.floor(employeeAreaWidth / visibleEmployees.length), isCompact ? 140 : 175);
  }, [visibleEmployees.length, employeeAreaWidth, isCompact]);

  const weekColWidth = useMemo(() => {
    const cols = isTablet ? 7 : 3;
    return Math.max(Math.floor((calendarAvailableWidth - (isCompact ? 50 : 65)) / cols), isCompact ? 100 : 130);
  }, [calendarAvailableWidth, isTablet, isCompact]);

  // Appointment Modal Helpers
  const selectedServices = useMemo(
    () => services.filter((s) => formServiceIds.includes(s.id)),
    [services, formServiceIds]
  );
  const totalServiceDuration = useMemo(
    () => selectedServices.reduce((sum, s) => sum + (s.durationMinutes || 0), 0),
    [selectedServices]
  );
  const totalServicePrice = useMemo(
    () => selectedServices.reduce((sum, s) => sum + (s.price || 0), 0),
    [selectedServices]
  );

  const eligibleEmployees = useMemo(() => {
    const matched = employees.filter((employee) => {
      if (!employee.active) return false;
      if (formServiceIds.length === 0) return true;
      return !employee.serviceIds?.length || formServiceIds.every((sid) => employee.serviceIds?.includes(sid));
    });
    if (matched.length > 0) return matched;
    return employees.filter((e) => e.active);
  }, [employees, formServiceIds]);

  useEffect(() => {
    if (formEmployeeId && eligibleEmployees.some((e) => e.id === formEmployeeId)) return;
    setFormEmployeeId(eligibleEmployees.length === 1 ? eligibleEmployees[0].id : (eligibleEmployees[0]?.id || ""));
  }, [eligibleEmployees, formEmployeeId]);

  const toggleService = (id: string) => {
    setFormServiceIds((current) =>
      current.includes(id) ? current.filter((s) => s !== id) : [...current, id]
    );
  };

  const serviceSelectionKey = formServiceIds.join(",");
  useEffect(() => {
    if (!newModalVisible || !formEmployeeId || !selectedDate || totalServiceDuration <= 0) {
      setAvailableSlots([]);
      return;
    }
    let active = true;
    setLoadingSlots(true);
    api<{ slots: Array<{ startTime: string; endTime: string }> }>(
      `/api/availability?employeeId=${formEmployeeId}&date=${selectedDate}&serviceIds=${serviceSelectionKey}`
    )
      .then((res) => {
        if (active) {
          const slots = res.slots || [];
          setAvailableSlots(slots);
          if (slots.length > 0 && !slots.some((s) => s.startTime === formTime)) {
            setFormTime(slots[0].startTime);
          }
        }
      })
      .catch(() => {
        if (active) setAvailableSlots([]);
      })
      .finally(() => {
        if (active) setLoadingSlots(false);
      });
    return () => {
      active = false;
    };
  }, [newModalVisible, formEmployeeId, selectedDate, totalServiceDuration, serviceSelectionKey]);

  const matchingClients = useMemo(() => {
    if (!clientSearchQuery.trim() || clientSearchQuery.trim().length < 2) return [];
    const q = clientSearchQuery.toLowerCase();
    return clients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [clients, clientSearchQuery]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === formClientId) || null,
    [clients, formClientId]
  );

  const handleCreateNewClient = async () => {
    if (!newClientName.trim() || newClientPhone.replace(/\D/g, "").length < 8) {
      Alert.alert("Erro", "Informe ao menos nome e telefone válidos.");
      return;
    }
    setCreatingClientBusy(true);
    try {
      const res = await api<{ id: string; name: string; phone?: string; email?: string }>("/api/clients", {
        method: "POST",
        body: JSON.stringify({
          name: newClientName.trim(),
          phone: newClientPhone.trim(),
          email: newClientEmail.trim() || undefined,
        }),
      });
      const createdClient: ClientDTO = {
        id: res.id,
        name: res.name,
        phone: res.phone || newClientPhone.trim(),
        email: res.email || newClientEmail.trim() || null,
        notes: null,
        photoUrl: null,
        active: true,
        visits: 0,
        spent: 0,
        lastVisit: null,
        nextVisit: null,
        createdAt: new Date().toISOString(),
      };
      setClients((prev) => [createdClient, ...prev]);
      setFormClientId(res.id);
      setIsCreatingClient(false);
      setNewClientName("");
      setNewClientPhone("");
      setNewClientEmail("");
      setClientSearchQuery("");
    } catch (err: any) {
      Alert.alert("Erro ao criar cliente", err?.message || "Não foi possível cadastrar o cliente.");
    } finally {
      setCreatingClientBusy(false);
    }
  };

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
      setFormTime(time || "09:00");
      setSelectedDate(date);
      if (services.length > 0 && formServiceIds.length === 0) {
        setFormServiceIds([services[0].id]);
      }
      setNewModalVisible(true);
    }
  };

  const handleCreateAppointment = async (forceConflict = false) => {
    const clientName = selectedClient?.name || formClientName.trim();
    const clientPhone = selectedClient?.phone || formClientPhone.trim();

    if (!formClientId && !clientName) {
      Alert.alert("Erro", "Selecione ou informe o nome do cliente.");
      return;
    }
    if (formServiceIds.length === 0) {
      Alert.alert("Erro", "Selecione ao menos um serviço.");
      return;
    }
    if (!formEmployeeId) {
      Alert.alert("Erro", "Selecione um profissional.");
      return;
    }

    setSavingAction(true);
    try {
      await api("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          clientId: formClientId || undefined,
          clientName: clientName || undefined,
          clientPhone: clientPhone || undefined,
          serviceId: formServiceIds[0],
          serviceIds: formServiceIds,
          employeeId: formEmployeeId,
          date: selectedDate,
          startTime: formTime,
          time: formTime,
          notes: formNotes.trim() || undefined,
          allowConflict: forceConflict,
        }),
      });

      setNewModalVisible(false);
      setFormClientId("");
      setFormClientName("");
      setFormClientPhone("");
      setClientSearchQuery("");
      setIsCreatingClient(false);
      setFormNotes("");
      await load(selectedDate);
      Alert.alert("Sucesso", "Agendamento criado com sucesso!");
    } catch (err: any) {
      const isConflict =
        err instanceof ApiError &&
        (err.status === 409 ||
          err.message?.toLowerCase().includes("atendimento") ||
          err.message?.toLowerCase().includes("bloqueio") ||
          err.message?.toLowerCase().includes("jornada") ||
          err.message?.toLowerCase().includes("conflito"));
      if (isConflict && !forceConflict) {
        Alert.alert(
          "Aviso de Conflito",
          `${err.message}\n\nDeseja realizar o encaixe manual forçado para este horário?`,
          [
            { text: "Cancelar", style: "cancel" },
            {
              text: "Forçar Encaixe",
              style: "destructive",
              onPress: () => handleCreateAppointment(true),
            },
          ]
        );
      } else {
        Alert.alert("Erro", err?.message || "Não foi possível criar o agendamento.");
      }
    } finally {
      setSavingAction(false);
    }
  };

  const handleCreateBlock = async () => {
    setSavingAction(true);
    try {
      await api("/api/blocks", {
        method: "POST",
        body: JSON.stringify({
          employeeId: blockEmpId === "all" ? null : blockEmpId,
          locationId: blockLocationId || null,
          date: blockStartDate,
          endDate: blockType === "period" ? blockEndDate : blockStartDate,
          startsAt: blockType === "hours" ? blockStartTime : undefined,
          endsAt: blockType === "hours" ? blockEndTime : undefined,
          allDay: blockType !== "hours",
          reason: blockReason.trim() || (blockType === "period" ? "Férias" : blockType === "allDay" ? "Feriado" : "Bloqueio"),
        }),
      });

      setBlockModalVisible(false);
      setBlockReason("");
      await load(selectedDate);
      Alert.alert("Sucesso", "Período bloqueado com sucesso!");
    } catch (err: any) {
      Alert.alert("Erro", err instanceof ApiError ? err.message : "Não foi possível bloquear o período.");
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
        <PageHeader
          eyebrow="AGENDA DO ESTABELECIMENTO"
          title={calendarTitle}
          subtitle={`${activeCount} ${activeCount === 1 ? "atendimento" : "atendimentos"} · ${formatBRL(projectedRevenue)} previsto`}
        />

        {/* 2. Date Navigation Row */}
        <View
          className="flex-row items-center justify-between p-2 rounded-xl border"
          style={{ backgroundColor: "#111215", borderColor: "rgba(255, 255, 255, 0.08)" }}
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
          style={{ backgroundColor: "#111215", borderColor: "rgba(255, 255, 255, 0.08)" }}
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
          <TouchableOpacity
            onPress={() => {
              setBlockStartDate(selectedDate);
              setBlockEndDate(selectedDate);
              setBlockStartTime("12:00");
              setBlockEndTime("13:00");
              setBlockType("hours");
              setBlockEmpId(employeeFilter !== "all" ? employeeFilter : "all");
              setBlockLocationId("");
              setBlockReason("");
              setEmpPickerOpen(false);
              setLocPickerOpen(false);
              setTypePickerOpen(false);
              setBlockModalVisible(true);
            }}
            activeOpacity={0.7}
            className="flex-1 flex-row items-center justify-center gap-2 py-3 px-3 rounded-xl border"
            style={{ backgroundColor: "#111215", borderColor: "rgba(255, 255, 255, 0.12)" }}
          >
            <Clock3 size={15} color="#ffffff" />
            <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "600" }}>
              Bloquear horário
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              if (services.length > 0 && formServiceIds.length === 0) {
                setFormServiceIds([services[0].id]);
              }
              if (employees.length > 0 && !formEmployeeId) {
                setFormEmployeeId(employees[0].id);
              }
              setNewModalVisible(true);
            }}
            activeOpacity={0.8}
            className="flex-1 flex-row items-center justify-center gap-1.5 py-3 px-3 rounded-xl"
            style={{ backgroundColor: primaryColor }}
          >
            <Plus size={16} color={primaryForeground} strokeWidth={2.5} />
            <Text style={{ color: primaryForeground, fontSize: 13, fontWeight: "700" }}>
              Novo agendamento
            </Text>
          </TouchableOpacity>
        </View>

        {/* 5. Professional Filter & Chips */}
        <View
          className="p-3.5 rounded-xl border gap-2.5"
          style={{ backgroundColor: "#111215", borderColor: "rgba(255, 255, 255, 0.08)" }}
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
                  className="flex-row items-center gap-2 px-2.5 py-1 rounded-lg border"
                  style={{
                    backgroundColor: isSelected ? "#2a2b32" : "#1b1c20",
                    borderColor: isSelected ? primaryColor : "rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <Avatar name={emp.name} photoUrl={emp.photoUrl} size="xs" />
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
                  style={{ width: timeColWidth, borderRightColor: "rgba(255, 255, 255, 0.08)" }}
                >
                  <View className="flex-row items-center gap-1">
                    <Clock size={12} color={colors.textMuted} />
                    <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600" }}>Horário</Text>
                  </View>
                </View>

                {/* Professional headers */}
                {visibleEmployees.map((emp) => {
                  const countEmp = filteredAppointments.filter((a) => a.employeeId === emp.id && a.date === selectedDate && a.status !== "cancelled").length;

                  return (
                    <View
                      key={emp.id}
                      className="flex-row items-center gap-2.5 p-3 border-r"
                      style={{ width: colWidth, borderRightColor: "rgba(255, 255, 255, 0.08)" }}
                    >
                      <Avatar name={emp.name} photoUrl={emp.photoUrl} size="sm" />

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
                      minHeight: 64,
                    }}
                  >
                    {/* Time label */}
                    <View
                      className="items-center justify-center border-r p-2"
                      style={{ width: timeColWidth, borderRightColor: "rgba(255, 255, 255, 0.08)" }}
                    >
                      <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "500" }}>
                        {time}
                      </Text>
                    </View>

                    {/* Professional slot cells */}
                    {visibleEmployees.map((emp) => {
                      const slotApts = filteredAppointments.filter(
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
                          className="border-r p-1.5 justify-center gap-1.5"
                          style={{
                            width: colWidth,
                            borderRightColor: "rgba(255, 255, 255, 0.08)",
                            backgroundColor: slotApts.length > 0 ? "rgba(255, 255, 255, 0.02)" : "transparent",
                          }}
                        >
                          {slotApts.map((apt) => (
                            <Pressable
                              key={apt.id}
                              onPress={(e) => {
                                e.stopPropagation();
                                setDetailAppointment(apt);
                              }}
                              className="p-2.5 rounded-xl"
                              style={{
                                backgroundColor: "#20232d",
                                borderColor: hexToRgba(primaryColor, 0.3),
                                borderWidth: 1,
                                borderLeftWidth: 4,
                                borderLeftColor: primaryColor,
                                shadowColor: "#000000",
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.4,
                                shadowRadius: 4,
                                elevation: 3,
                              }}
                            >
                              {/* Top Row: Client Name + Time badge */}
                              <View className="flex-row items-center justify-between gap-2">
                                <Text
                                  style={{
                                    color: "#ffffff",
                                    fontSize: 13.5,
                                    fontWeight: "800",
                                    flexShrink: 1,
                                  }}
                                  numberOfLines={1}
                                  ellipsizeMode="tail"
                                >
                                  {apt.clientName || "Cliente"}
                                </Text>
                                <View
                                  style={{
                                    backgroundColor: hexToRgba(primaryColor, 0.2),
                                    borderColor: hexToRgba(primaryColor, 0.35),
                                    borderWidth: 1,
                                    paddingHorizontal: 6.5,
                                    paddingVertical: 2,
                                    borderRadius: 7,
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: primaryColor,
                                      fontSize: 11,
                                      fontWeight: "800",
                                    }}
                                  >
                                    {apt.startTime}
                                  </Text>
                                </View>
                              </View>

                              {/* Bottom Row: Service Name + Price */}
                              <View className="flex-row items-center justify-between gap-2 mt-1">
                                <Text
                                  style={{
                                    color: "#d4d4d8",
                                    fontSize: 11.5,
                                    fontWeight: "500",
                                    flexShrink: 1,
                                  }}
                                  numberOfLines={1}
                                  ellipsizeMode="tail"
                                >
                                  {apt.serviceName || "Serviço"}
                                </Text>
                                {apt.total > 0 ? (
                                  <Text
                                    style={{
                                      color: "#ffffff",
                                      fontSize: 12,
                                      fontWeight: "700",
                                    }}
                                  >
                                    {formatBRL(apt.total)}
                                  </Text>
                                ) : null}
                              </View>
                            </Pressable>
                          ))}
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
              style={{ backgroundColor: "#111215", borderColor: "rgba(255, 255, 255, 0.08)" }}
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
                        style={{ width: weekColWidth, borderRightColor: "rgba(255, 255, 255, 0.08)" }}
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
                        minHeight: 64,
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
                            className="border-r p-1.5 justify-center gap-1"
                            style={{
                              width: weekColWidth,
                              borderRightColor: "rgba(255, 255, 255, 0.08)",
                              backgroundColor: aptsInSlot.length > 0 ? "rgba(255, 255, 255, 0.02)" : "transparent",
                            }}
                          >
                            {aptsInSlot.map((apt) => (
                              <Pressable
                                key={apt.id}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  setDetailAppointment(apt);
                                }}
                                className="p-2 rounded-lg gap-0.5"
                                style={{
                                  backgroundColor: "#20232d",
                                  borderColor: hexToRgba(primaryColor, 0.3),
                                  borderWidth: 1,
                                  borderLeftWidth: 3.5,
                                  borderLeftColor: primaryColor,
                                  shadowColor: "#000000",
                                  shadowOffset: { width: 0, height: 1 },
                                  shadowOpacity: 0.3,
                                  shadowRadius: 3,
                                  elevation: 2,
                                }}
                              >
                                <View className="flex-row items-center justify-between gap-1">
                                  <Text
                                    style={{ color: "#ffffff", fontSize: 11.5, fontWeight: "800", flexShrink: 1 }}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                  >
                                    {apt.clientName || "Cliente"}
                                  </Text>
                                  <Text style={{ color: primaryColor, fontSize: 10.5, fontWeight: "800" }}>
                                    {apt.startTime}
                                  </Text>
                                </View>
                                <Text
                                  style={{ color: "#d4d4d8", fontSize: 10.5, fontWeight: "500" }}
                                  numberOfLines={1}
                                  ellipsizeMode="tail"
                                >
                                  {apt.serviceName || "Serviço"}
                                </Text>
                              </Pressable>
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
                            backgroundColor: hexToRgba(primaryColor, 0.22),
                            borderColor: hexToRgba(primaryColor, 0.35),
                            borderWidth: 0.5,
                            borderRadius: 4,
                            paddingHorizontal: 4,
                            paddingVertical: 1.5,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 8.5,
                              fontWeight: "700",
                              color: primaryColor,
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

      {/* Modal: Novo Agendamento Completo (Web Parity) */}
      <Modal
        visible={newModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNewModalVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0, 0, 0, 0.75)" }}>
          <View
            style={{
              width: "100%",
              maxHeight: "92%",
              backgroundColor: "#111215",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.12)",
              paddingHorizontal: 20,
              paddingTop: 18,
              paddingBottom: 24,
              gap: 16,
            }}
          >
            {/* Modal Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: 14,
                borderBottomWidth: 1,
                borderBottomColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                <CalendarPlus size={20} color="#ffffff" />
                <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "800", letterSpacing: -0.3 }}>
                  Novo agendamento
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setNewModalVisible(false)}
                activeOpacity={0.7}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {/* Modal Body */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 18, paddingBottom: 12 }}>
              {/* Field 1: Cliente */}
              <View style={{ gap: 7 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <User size={15} color="#94a3b8" />
                  <Text style={{ color: "#94a3b8", fontSize: 13, fontWeight: "600" }}>Cliente</Text>
                </View>

                {formClientId || selectedClient ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: "#18191e",
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.08)",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          backgroundColor: primarySoft,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <UserCheck size={18} color={primaryColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "700" }}>
                          {selectedClient?.name || formClientName || "Cliente selecionado"}
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
                          {selectedClient?.phone && (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                              <Phone size={11} color="#8a94a6" />
                              <Text style={{ color: "#8a94a6", fontSize: 11.5 }}>{selectedClient.phone}</Text>
                            </View>
                          )}
                          {selectedClient?.email && (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                              <Mail size={11} color="#8a94a6" />
                              <Text style={{ color: "#8a94a6", fontSize: 11.5 }} numberOfLines={1}>{selectedClient.email}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setFormClientId("");
                        setClientSearchQuery("");
                      }}
                      style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                    >
                      <Text style={{ color: primaryColor, fontSize: 12.5, fontWeight: "600" }}>Trocar</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ gap: 8 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: "#18191e",
                        borderWidth: 1,
                        borderColor: "rgba(255, 255, 255, 0.1)",
                        borderRadius: 10,
                        height: 44,
                        paddingHorizontal: 12,
                        gap: 8,
                      }}
                    >
                      <Search size={17} color="#64748b" />
                      <TextInput
                        value={clientSearchQuery}
                        onChangeText={(t) => {
                          setClientSearchQuery(t);
                          setFormClientName(t);
                        }}
                        placeholder="Nome, telefone ou e-mail..."
                        placeholderTextColor={colors.textDisabled}
                        style={{
                          flex: 1,
                          color: "#ffffff",
                          fontSize: 13.5,
                        }}
                      />
                      {clientSearchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => { setClientSearchQuery(""); setFormClientName(""); }}>
                          <X size={16} color="#64748b" />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Results list */}
                    {matchingClients.length > 0 && (
                      <View
                        style={{
                          backgroundColor: "#14161c",
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: "rgba(255, 255, 255, 0.1)",
                          overflow: "hidden",
                        }}
                      >
                        {matchingClients.map((c) => (
                          <TouchableOpacity
                            key={c.id}
                            onPress={() => {
                              setFormClientId(c.id);
                              setFormClientName(c.name);
                              setFormClientPhone(c.phone || "");
                              setClientSearchQuery("");
                            }}
                            activeOpacity={0.7}
                            style={{
                              paddingVertical: 9,
                              paddingHorizontal: 12,
                              borderBottomWidth: 1,
                              borderBottomColor: "rgba(255, 255, 255, 0.05)",
                            }}
                          >
                            <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "600" }}>{c.name}</Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                              {c.phone ? <Text style={{ color: "#8a94a6", fontSize: 11.5 }}>{c.phone}</Text> : null}
                              {c.email ? <Text style={{ color: "#64748b", fontSize: 11.5 }}>• {c.email}</Text> : null}
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {/* Create new client toggle */}
                    {!isCreatingClient && (
                      <TouchableOpacity
                        onPress={() => {
                          setIsCreatingClient(true);
                          if (/^[+\d ()-]+$/.test(clientSearchQuery)) {
                            setNewClientPhone(clientSearchQuery);
                          } else {
                            setNewClientName(clientSearchQuery);
                          }
                        }}
                        style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 2 }}
                      >
                        <UserPlus size={14} color={primaryColor} />
                        <Text style={{ color: primaryColor, fontSize: 12.5, fontWeight: "600" }}>
                          Criar novo cliente
                        </Text>
                      </TouchableOpacity>
                    )}

                    {/* Inline client creation form */}
                    {isCreatingClient && (
                      <View
                        style={{
                          backgroundColor: "#16181f",
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: "rgba(255, 255, 255, 0.1)",
                          padding: 14,
                          gap: 10,
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <UserPlus size={15} color={primaryColor} />
                          <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700" }}>Novo cliente</Text>
                        </View>
                        <View style={{ gap: 4 }}>
                          <Text style={{ color: "#8a94a6", fontSize: 11, fontWeight: "600" }}>NOME *</Text>
                          <TextInput
                            value={newClientName}
                            onChangeText={setNewClientName}
                            placeholder="Nome completo"
                            placeholderTextColor={colors.textDisabled}
                            style={{
                              backgroundColor: "#111215",
                              borderWidth: 1,
                              borderColor: "rgba(255, 255, 255, 0.08)",
                              borderRadius: 8,
                              height: 38,
                              paddingHorizontal: 10,
                              color: "#ffffff",
                              fontSize: 13,
                            }}
                          />
                        </View>
                        <View style={{ gap: 4 }}>
                          <Text style={{ color: "#8a94a6", fontSize: 11, fontWeight: "600" }}>TELEFONE *</Text>
                          <TextInput
                            value={newClientPhone}
                            onChangeText={(text) => setNewClientPhone(formatPhone(text))}
                            placeholder="(11) 99999-9999"
                            placeholderTextColor={colors.textDisabled}
                            keyboardType="phone-pad"
                            style={{
                              backgroundColor: "#111215",
                              borderWidth: 1,
                              borderColor: "rgba(255, 255, 255, 0.08)",
                              borderRadius: 8,
                              height: 38,
                              paddingHorizontal: 10,
                              color: "#ffffff",
                              fontSize: 13,
                            }}
                          />
                        </View>
                        <View style={{ gap: 4 }}>
                          <Text style={{ color: "#8a94a6", fontSize: 11, fontWeight: "600" }}>E-MAIL (OPCIONAL)</Text>
                          <TextInput
                            value={newClientEmail}
                            onChangeText={setNewClientEmail}
                            placeholder="cliente@email.com"
                            placeholderTextColor={colors.textDisabled}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            style={{
                              backgroundColor: "#111215",
                              borderWidth: 1,
                              borderColor: "rgba(255, 255, 255, 0.08)",
                              borderRadius: 8,
                              height: 38,
                              paddingHorizontal: 10,
                              color: "#ffffff",
                              fontSize: 13,
                            }}
                          />
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                          <TouchableOpacity
                            onPress={handleCreateNewClient}
                            disabled={creatingClientBusy || newClientName.trim().length < 2 || newClientPhone.replace(/\D/g, "").length < 8}
                            style={{
                              backgroundColor: primaryColor,
                              paddingHorizontal: 14,
                              paddingVertical: 8,
                              borderRadius: 8,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text style={{ color: primaryForeground, fontSize: 12.5, fontWeight: "700" }}>
                              {creatingClientBusy ? "Salvando..." : "Salvar cliente"}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => setIsCreatingClient(false)}
                            style={{ paddingHorizontal: 10, paddingVertical: 8 }}
                          >
                            <Text style={{ color: "#8a94a6", fontSize: 12.5 }}>Cancelar</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Field 2: Unidade */}
              <View style={{ gap: 7 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Building2 size={15} color="#94a3b8" />
                  <Text style={{ color: "#94a3b8", fontSize: 13, fontWeight: "600" }}>Unidade</Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: "#18191e",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderRadius: 10,
                    height: 44,
                    paddingHorizontal: 12,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Building2 size={17} color="#64748b" />
                    <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "600" }}>
                      {companyName || "Unidade Principal"}
                    </Text>
                  </View>
                  <ChevronDown size={16} color="#64748b" />
                </View>
              </View>

              {/* Field 3: Serviços disponíveis */}
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Scissors size={15} color="#94a3b8" />
                  <Text style={{ color: "#94a3b8", fontSize: 13, fontWeight: "600" }}>Serviços disponíveis</Text>
                </View>

                {/* 2-Column Grid (2x2) */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 }}>
                  {services
                    .filter((s) => s.active)
                    .map((service) => {
                      const isSelected = formServiceIds.includes(service.id);
                      return (
                        <TouchableOpacity
                          key={service.id}
                          activeOpacity={0.7}
                          onPress={() => toggleService(service.id)}
                          style={{
                            width: "48.5%",
                            backgroundColor: isSelected ? primarySoft : "#14161d",
                            borderColor: isSelected ? primaryColor : "rgba(255, 255, 255, 0.08)",
                            borderWidth: isSelected ? 1.5 : 1,
                            borderRadius: 14,
                            padding: 12,
                            minHeight: 114,
                            justifyContent: "space-between",
                          }}
                        >
                          {/* Top row */}
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <View
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 8,
                                backgroundColor: isSelected ? primaryColor : "rgba(255, 255, 255, 0.06)",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Scissors size={14} color={isSelected ? primaryForeground : colors.textMuted} />
                            </View>
                            <View style={{ width: 20, height: 20, alignItems: "center", justifyContent: "center" }}>
                              {isSelected ? (
                                <CheckCircle2 size={18} color={primaryColor} />
                              ) : (
                                <View
                                  style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: 8,
                                    borderWidth: 1.5,
                                    borderColor: "rgba(255, 255, 255, 0.25)",
                                  }}
                                />
                              )}
                            </View>
                          </View>

                          {/* Title */}
                          <Text
                            style={{
                              color: "#ffffff",
                              fontSize: 12.5,
                              fontWeight: "700",
                              lineHeight: 16,
                              marginVertical: 6,
                            }}
                            numberOfLines={2}
                          >
                            {service.name.toUpperCase()}
                          </Text>

                          {/* Footer */}
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                              paddingTop: 7,
                              borderTopWidth: 1,
                              borderTopColor: "rgba(255, 255, 255, 0.08)",
                            }}
                          >
                            <Text style={{ color: primaryColor, fontSize: 13, fontWeight: "800", letterSpacing: -0.2 }}>
                              {formatBRL(service.price)}
                            </Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                              <Clock3 size={11} color="#8a94a6" />
                              <Text style={{ color: "#8a94a6", fontSize: 11, fontWeight: "500" }}>
                                {service.durationMinutes} min
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  {services.filter((s) => s.active).length === 0 && (
                    <Text style={{ color: "#8a94a6", fontSize: 12 }}>Nenhum serviço ativo cadastrado.</Text>
                  )}
                </View>

                {/* Selected Services Summary Bar */}
                {formServiceIds.length > 0 && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 10,
                      paddingHorizontal: 13,
                      borderRadius: 10,
                      backgroundColor: primarySoft,
                      borderWidth: 1,
                      borderColor: hexToRgba(primaryColor, 0.3) || "rgba(255, 255, 255, 0.15)",
                      marginTop: 2,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 7, flex: 1 }}>
                      <CheckCheck size={16} color={primaryColor} />
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                        <Text style={{ color: "#ffffff", fontWeight: "700" }}>{formServiceIds.length}</Text>{" "}
                        {formServiceIds.length === 1 ? "serviço selecionado" : "serviços selecionados"}
                        {"  "}•{"  "}
                        <Text style={{ color: "#8a94a6" }}>
                          {totalServiceDuration} min total
                        </Text>
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text style={{ color: "#8a94a6", fontSize: 12 }}>Total:</Text>
                      <Text style={{ color: primaryColor, fontSize: 14, fontWeight: "800" }}>
                        {formatBRL(totalServicePrice)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Field 4: Profissional */}
              <View style={{ gap: 7 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <UserRound size={15} color="#94a3b8" />
                  <Text style={{ color: "#94a3b8", fontSize: 13, fontWeight: "600" }}>Profissional</Text>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {eligibleEmployees.map((e) => {
                    const isSelected = formEmployeeId === e.id;
                    return (
                      <TouchableOpacity
                        key={e.id}
                        activeOpacity={0.7}
                        onPress={() => setFormEmployeeId(e.id)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderRadius: 12,
                          backgroundColor: isSelected ? primarySoft : "#18191e",
                          borderWidth: 1,
                          borderColor: isSelected ? primaryColor : "rgba(255, 255, 255, 0.08)",
                        }}
                      >
                        <Avatar name={e.name} photoUrl={e.photoUrl} size="xs" />
                        <View>
                          <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "600" }}>{e.name}</Text>
                          {e.jobTitle ? (
                            <Text style={{ color: colors.textMuted, fontSize: 11 }}>{e.jobTitle}</Text>
                          ) : null}
                        </View>
                        {isSelected && <Check size={14} color={primaryColor} strokeWidth={2.5} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                {formServiceIds.length > 0 && eligibleEmployees.length === 0 && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                    <AlertCircle size={14} color="#f59e0b" />
                    <Text style={{ color: "#f59e0b", fontSize: 12 }}>
                      Nenhum profissional selecionável realiza os serviços escolhidos.
                    </Text>
                  </View>
                )}
              </View>

              {/* Field 5: Data */}
              <View style={{ gap: 7 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Calendar size={15} color="#94a3b8" />
                  <Text style={{ color: "#94a3b8", fontSize: 13, fontWeight: "600" }}>Data</Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: "#18191e",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderRadius: 10,
                    height: 44,
                    paddingHorizontal: 12,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Calendar size={17} color="#64748b" />
                    <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "600" }}>
                      {selectedDate ? `${selectedDate.slice(8, 10)}/${selectedDate.slice(5, 7)}/${selectedDate.slice(0, 4)}` : "Selecionar data"}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => setSelectedDate(changeDateByMode(selectedDate, "day", -1))}
                      style={{ padding: 4 }}
                    >
                      <ChevronLeft size={16} color="#94a3b8" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setSelectedDate(todayKey())}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 6,
                        backgroundColor: selectedDate === todayKey() ? primarySoft : "rgba(255, 255, 255, 0.06)",
                      }}
                    >
                      <Text style={{ color: selectedDate === todayKey() ? primaryColor : "#94a3b8", fontSize: 11, fontWeight: "600" }}>
                        Hoje
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setSelectedDate(changeDateByMode(selectedDate, "day", 1))}
                      style={{ padding: 4 }}
                    >
                      <ChevronRight size={16} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Field 6: Horário de início */}
              <View style={{ gap: 7 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Clock3 size={15} color="#94a3b8" />
                  <Text style={{ color: "#94a3b8", fontSize: 13, fontWeight: "600" }}>Horário de início</Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#18191e",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderRadius: 10,
                    height: 44,
                    paddingHorizontal: 12,
                    gap: 10,
                  }}
                >
                  <Clock3 size={17} color="#64748b" />
                  <TextInput
                    value={formTime}
                    onChangeText={setFormTime}
                    placeholder="09:00"
                    placeholderTextColor={colors.textDisabled}
                    style={{
                      flex: 1,
                      color: "#ffffff",
                      fontSize: 14,
                      fontWeight: "600",
                    }}
                  />
                </View>

                {loadingSlots && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <ActivityIndicator size="small" color={primaryColor} />
                    <Text style={{ color: "#8a94a6", fontSize: 12 }}>
                      Calculando horários livres...
                    </Text>
                  </View>
                )}

                {!loadingSlots && availableSlots.length > 0 && (
                  <View style={{ gap: 6, marginTop: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <Sparkles size={12} color={primaryColor} />
                      <Text style={{ color: "#8a94a6", fontSize: 12, fontWeight: "600" }}>
                        Horários livres sugeridos ({availableSlots.length}):
                      </Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {availableSlots.map((slot) => {
                        const isSlotSelected = formTime === slot.startTime;
                        return (
                          <TouchableOpacity
                            key={slot.startTime}
                            onPress={() => setFormTime(slot.startTime)}
                            activeOpacity={0.7}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                              paddingVertical: 6,
                              paddingHorizontal: 10,
                              borderRadius: 8,
                              backgroundColor: isSlotSelected ? primaryColor : "#18191e",
                              borderWidth: 1,
                              borderColor: isSlotSelected ? primaryColor : "rgba(255, 255, 255, 0.1)",
                            }}
                          >
                            <Clock3 size={11} color={isSlotSelected ? primaryForeground : "#8a94a6"} />
                            <Text
                              style={{
                                color: isSlotSelected ? primaryForeground : "#ffffff",
                                fontSize: 12,
                                fontWeight: isSlotSelected ? "700" : "500",
                              }}
                            >
                              {slot.startTime}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {!loadingSlots && formEmployeeId && selectedDate && totalServiceDuration > 0 && availableSlots.length === 0 && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <AlertCircle size={13} color="#f59e0b" />
                    <Text style={{ color: "#f59e0b", fontSize: 12 }}>
                      Nenhum horário livre para este profissional nesta data.
                    </Text>
                  </View>
                )}
              </View>

              {/* Field 7: Observações */}
              <View style={{ gap: 7 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <FileText size={15} color="#94a3b8" />
                  <Text style={{ color: "#94a3b8", fontSize: 13, fontWeight: "600" }}>Observações (opcional)</Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    backgroundColor: "#18191e",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    gap: 10,
                  }}
                >
                  <FileText size={17} color="#64748b" style={{ marginTop: 2 }} />
                  <TextInput
                    value={formNotes}
                    onChangeText={setFormNotes}
                    placeholder="Alguma informação importante para este agendamento?"
                    placeholderTextColor={colors.textDisabled}
                    multiline
                    numberOfLines={3}
                    style={{
                      flex: 1,
                      color: "#ffffff",
                      fontSize: 13,
                      minHeight: 54,
                      textAlignVertical: "top",
                    }}
                  />
                </View>
              </View>
            </ScrollView>

            {/* Modal Footer */}
            <View
              style={{
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: "rgba(255, 255, 255, 0.08)",
                gap: 10,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <ShieldCheck size={15} color="#8a94a6" />
                <Text style={{ color: "#8a94a6", fontSize: 12 }}>
                  Revise os dados antes de confirmar
                </Text>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setNewModalVisible(false)}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    height: 46,
                    borderRadius: 12,
                    backgroundColor: "#1c1e24",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.08)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "600" }}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleCreateAppointment(false)}
                  disabled={savingAction || (!formClientId && !formClientName.trim()) || formServiceIds.length === 0 || !formEmployeeId || loadingSlots}
                  activeOpacity={0.8}
                  style={{
                    flex: 2,
                    height: 46,
                    borderRadius: 12,
                    backgroundColor: (!formClientId && !formClientName.trim()) || formServiceIds.length === 0 || !formEmployeeId || loadingSlots
                      ? "rgba(255, 255, 255, 0.1)"
                      : primaryColor,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  {savingAction ? (
                    <ActivityIndicator size="small" color={primaryForeground} />
                  ) : (
                    <>
                      <Check size={18} color={primaryForeground} strokeWidth={2.5} />
                      <Text
                        style={{
                          color: (!formClientId && !formClientName.trim()) || formServiceIds.length === 0 || !formEmployeeId || loadingSlots
                            ? colors.textDisabled
                            : primaryForeground,
                          fontSize: 14,
                          fontWeight: "700",
                        }}
                      >
                        Confirmar agendamento
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
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

      {/* Modal: Bloquear Horário ou Período (Web Parity) */}
      <Modal
        visible={blockModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBlockModalVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0, 0, 0, 0.75)" }}>
          <View
            style={{
              width: "100%",
              maxHeight: "92%",
              backgroundColor: "#111215",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.12)",
              paddingHorizontal: 20,
              paddingTop: 18,
              paddingBottom: 24,
              gap: 16,
            }}
          >
            {/* Modal Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: 14,
                borderBottomWidth: 1,
                borderBottomColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                <Ban size={20} color="#ffffff" />
                <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "800", letterSpacing: -0.3 }}>
                  Bloquear horário ou período
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setBlockModalVisible(false)}
                activeOpacity={0.7}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {/* Modal Body */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 10 }}>
              {/* Field 1: Profissional */}
              <View style={{ gap: 7 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <UserRound size={15} color="#94a3b8" />
                  <Text style={{ color: "#94a3b8", fontSize: 13, fontWeight: "600" }}>Profissional</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setEmpPickerOpen((prev) => !prev);
                    setLocPickerOpen(false);
                    setTypePickerOpen(false);
                  }}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: "#18191e",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderRadius: 10,
                    height: 44,
                    paddingHorizontal: 12,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                    <UserRound size={17} color="#64748b" />
                    <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "500" }} numberOfLines={1}>
                      {blockEmpId === "all"
                        ? "Toda a equipe (Geral da empresa)"
                        : (employees.find((e) => e.id === blockEmpId)?.name || "Selecione...")}
                    </Text>
                  </View>
                  <ChevronDown size={16} color="#64748b" />
                </TouchableOpacity>

                {empPickerOpen && (
                  <View
                    style={{
                      backgroundColor: "#14161c",
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      overflow: "hidden",
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        setBlockEmpId("all");
                        setEmpPickerOpen(false);
                      }}
                      style={{
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        backgroundColor: blockEmpId === "all" ? primarySoft : "transparent",
                        borderBottomWidth: 1,
                        borderBottomColor: "rgba(255, 255, 255, 0.05)",
                      }}
                    >
                      <Text style={{ color: blockEmpId === "all" ? primaryColor : "#ffffff", fontSize: 13, fontWeight: "600" }}>
                        Toda a equipe (Geral da empresa)
                      </Text>
                    </TouchableOpacity>
                    {employees
                      .filter((e) => e.active)
                      .map((emp) => {
                        const isSelected = blockEmpId === emp.id;
                        return (
                          <TouchableOpacity
                            key={emp.id}
                            onPress={() => {
                              setBlockEmpId(emp.id);
                              setEmpPickerOpen(false);
                            }}
                            style={{
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              backgroundColor: isSelected ? primarySoft : "transparent",
                              borderBottomWidth: 1,
                              borderBottomColor: "rgba(255, 255, 255, 0.05)",
                            }}
                          >
                            <Text style={{ color: isSelected ? primaryColor : "#ffffff", fontSize: 13, fontWeight: "600" }}>
                              {emp.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                  </View>
                )}
              </View>

              {/* Field 2: Unidade */}
              <View style={{ gap: 7 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Building2 size={15} color="#94a3b8" />
                  <Text style={{ color: "#94a3b8", fontSize: 13, fontWeight: "600" }}>Unidade</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setLocPickerOpen((prev) => !prev);
                    setEmpPickerOpen(false);
                    setTypePickerOpen(false);
                  }}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: "#18191e",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderRadius: 10,
                    height: 44,
                    paddingHorizontal: 12,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                    <Building2 size={17} color="#64748b" />
                    <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "500" }} numberOfLines={1}>
                      {blockLocationId
                        ? (session?.locations?.find((l) => l.id === blockLocationId)?.name || companyName || "Unidade")
                        : "Todas as unidades"}
                    </Text>
                  </View>
                  <ChevronDown size={16} color="#64748b" />
                </TouchableOpacity>

                {locPickerOpen && (
                  <View
                    style={{
                      backgroundColor: "#14161c",
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      overflow: "hidden",
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        setBlockLocationId("");
                        setLocPickerOpen(false);
                      }}
                      style={{
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        backgroundColor: !blockLocationId ? primarySoft : "transparent",
                        borderBottomWidth: 1,
                        borderBottomColor: "rgba(255, 255, 255, 0.05)",
                      }}
                    >
                      <Text style={{ color: !blockLocationId ? primaryColor : "#ffffff", fontSize: 13, fontWeight: "600" }}>
                        Todas as unidades
                      </Text>
                    </TouchableOpacity>
                    {(session?.locations || []).map((loc) => {
                      const isSelected = blockLocationId === loc.id;
                      return (
                        <TouchableOpacity
                          key={loc.id}
                          onPress={() => {
                            setBlockLocationId(loc.id);
                            setLocPickerOpen(false);
                          }}
                          style={{
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            backgroundColor: isSelected ? primarySoft : "transparent",
                            borderBottomWidth: 1,
                            borderBottomColor: "rgba(255, 255, 255, 0.05)",
                          }}
                        >
                          <Text style={{ color: isSelected ? primaryColor : "#ffffff", fontSize: 13, fontWeight: "600" }}>
                            {loc.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Field 3: Tipo de bloqueio */}
              <View style={{ gap: 7 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Tag size={15} color="#94a3b8" />
                  <Text style={{ color: "#94a3b8", fontSize: 13, fontWeight: "600" }}>Tipo de bloqueio</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setTypePickerOpen((prev) => !prev);
                    setEmpPickerOpen(false);
                    setLocPickerOpen(false);
                  }}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: "#18191e",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderRadius: 10,
                    height: 44,
                    paddingHorizontal: 12,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                    <Tag size={17} color="#64748b" />
                    <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "500" }}>
                      {blockType === "hours"
                        ? "Parcial (Horário específico)"
                        : blockType === "allDay"
                        ? "Dia inteiro (Feriado/Folga)"
                        : "Período de múltiplos dias (Férias)"}
                    </Text>
                  </View>
                  <ChevronDown size={16} color="#64748b" />
                </TouchableOpacity>

                {typePickerOpen && (
                  <View
                    style={{
                      backgroundColor: "#14161c",
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      overflow: "hidden",
                    }}
                  >
                    {[
                      { key: "hours", label: "Parcial (Horário específico)" },
                      { key: "allDay", label: "Dia inteiro (Feriado/Folga)" },
                      { key: "period", label: "Período de múltiplos dias (Férias)" },
                    ].map((item) => {
                      const isSelected = blockType === item.key;
                      return (
                        <TouchableOpacity
                          key={item.key}
                          onPress={() => {
                            setBlockType(item.key as "hours" | "allDay" | "period");
                            setTypePickerOpen(false);
                          }}
                          style={{
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            backgroundColor: isSelected ? primarySoft : "transparent",
                            borderBottomWidth: 1,
                            borderBottomColor: "rgba(255, 255, 255, 0.05)",
                          }}
                        >
                          <Text style={{ color: isSelected ? primaryColor : "#ffffff", fontSize: 13, fontWeight: "600" }}>
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Field 4: Motivo */}
              <View style={{ gap: 7 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <FileText size={15} color="#94a3b8" />
                  <Text style={{ color: "#94a3b8", fontSize: 13, fontWeight: "600" }}>Motivo</Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#18191e",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderRadius: 10,
                    height: 44,
                    paddingHorizontal: 12,
                    gap: 10,
                  }}
                >
                  <FileText size={17} color="#64748b" />
                  <TextInput
                    value={blockReason}
                    onChangeText={setBlockReason}
                    placeholder="Ex.: Almoço, Reforma, Férias..."
                    placeholderTextColor={colors.textDisabled}
                    style={{
                      flex: 1,
                      color: "#ffffff",
                      fontSize: 13.5,
                    }}
                  />
                </View>
              </View>

              {/* Field 5: Data inicial */}
              <View style={{ gap: 7 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Calendar size={15} color="#94a3b8" />
                  <Text style={{ color: "#94a3b8", fontSize: 13, fontWeight: "600" }}>Data inicial</Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: "#18191e",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderRadius: 10,
                    height: 44,
                    paddingHorizontal: 12,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Calendar size={17} color="#64748b" />
                    <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "600" }}>
                      {blockStartDate
                        ? `${blockStartDate.slice(8, 10)}/${blockStartDate.slice(5, 7)}/${blockStartDate.slice(0, 4)}`
                        : "Selecionar data"}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => setBlockStartDate(changeDateByMode(blockStartDate, "day", -1))}
                      style={{ padding: 4 }}
                    >
                      <ChevronLeft size={16} color="#94a3b8" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setBlockStartDate(todayKey())}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 6,
                        backgroundColor: blockStartDate === todayKey() ? primarySoft : "rgba(255, 255, 255, 0.06)",
                      }}
                    >
                      <Text style={{ color: blockStartDate === todayKey() ? primaryColor : "#94a3b8", fontSize: 11, fontWeight: "600" }}>
                        Hoje
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setBlockStartDate(changeDateByMode(blockStartDate, "day", 1))}
                      style={{ padding: 4 }}
                    >
                      <ChevronRight size={16} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Field 6: Data final (only if period) */}
              {blockType === "period" && (
                <View style={{ gap: 7 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Calendar size={15} color="#94a3b8" />
                    <Text style={{ color: "#94a3b8", fontSize: 13, fontWeight: "600" }}>Data final</Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: "#18191e",
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      borderRadius: 10,
                      height: 44,
                      paddingHorizontal: 12,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Calendar size={17} color="#64748b" />
                      <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "600" }}>
                        {blockEndDate
                          ? `${blockEndDate.slice(8, 10)}/${blockEndDate.slice(5, 7)}/${blockEndDate.slice(0, 4)}`
                          : "Selecionar data final"}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => setBlockEndDate(changeDateByMode(blockEndDate, "day", -1))}
                        style={{ padding: 4 }}
                      >
                        <ChevronLeft size={16} color="#94a3b8" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setBlockEndDate(changeDateByMode(blockEndDate, "day", 1))}
                        style={{ padding: 4 }}
                      >
                        <ChevronRight size={16} color="#94a3b8" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

              {/* Field 7: Horário início (only if hours) */}
              {blockType === "hours" && (
                <View style={{ gap: 7 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Clock3 size={15} color="#94a3b8" />
                    <Text style={{ color: "#94a3b8", fontSize: 13, fontWeight: "600" }}>Horário início</Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: "#18191e",
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      borderRadius: 10,
                      height: 44,
                      paddingHorizontal: 12,
                      gap: 10,
                    }}
                  >
                    <Clock3 size={17} color="#64748b" />
                    <TextInput
                      value={blockStartTime}
                      onChangeText={setBlockStartTime}
                      placeholder="12:00"
                      placeholderTextColor={colors.textDisabled}
                      style={{
                        flex: 1,
                        color: "#ffffff",
                        fontSize: 14,
                        fontWeight: "600",
                      }}
                    />
                    <Clock3 size={16} color="#64748b" />
                  </View>
                </View>
              )}

              {/* Field 8: Horário fim (only if hours) */}
              {blockType === "hours" && (
                <View style={{ gap: 7 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Clock3 size={15} color="#94a3b8" />
                    <Text style={{ color: "#94a3b8", fontSize: 13, fontWeight: "600" }}>Horário fim</Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: "#18191e",
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      borderRadius: 10,
                      height: 44,
                      paddingHorizontal: 12,
                      gap: 10,
                    }}
                  >
                    <Clock3 size={17} color="#64748b" />
                    <TextInput
                      value={blockEndTime}
                      onChangeText={setBlockEndTime}
                      placeholder="13:00"
                      placeholderTextColor={colors.textDisabled}
                      style={{
                        flex: 1,
                        color: "#ffffff",
                        fontSize: 14,
                        fontWeight: "600",
                      }}
                    />
                    <Clock3 size={16} color="#64748b" />
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Modal Footer & Actions */}
            <View style={{ gap: 10, paddingTop: 6 }}>
              <TouchableOpacity
                onPress={handleCreateBlock}
                disabled={savingAction}
                activeOpacity={0.8}
                style={{
                  height: 46,
                  borderRadius: 12,
                  backgroundColor: "#52525b",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {savingAction ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "700" }}>
                    Bloquear
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setBlockModalVisible(false)}
                activeOpacity={0.7}
                style={{
                  height: 46,
                  borderRadius: 12,
                  backgroundColor: "#1c1e24",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.12)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "600" }}>Cancelar</Text>
              </TouchableOpacity>

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4 }}>
                <AlertCircle size={14} color="#8a94a6" />
                <Text style={{ color: "#8a94a6", fontSize: 12 }}>
                  O motor impedirá agendamentos neste intervalo
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
