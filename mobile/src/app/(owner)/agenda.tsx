import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Clock3,
  Plus,
  Users,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { ApiError, api } from "@/lib/api-client";
import { getAppointments, todayKey, type AppointmentDTO } from "@/lib/appointments";
import { getEmployees, type EmployeeDTO } from "@/lib/employees";
import { formatBRL } from "@/lib/stats";
import { useSession } from "@/lib/session-context";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
});

function dateLabel(date: string): string {
  try {
    const d = new Date(`${date}T12:00:00`);
    if (Number.isNaN(d.getTime())) return date;
    return dateFormatter.format(d);
  } catch {
    return date;
  }
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return todayKey();
  d.setUTCDate(d.getUTCDate() + days);
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
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [calMode, setCalMode] = useState<CalendarMode>("day");
  const [appointments, setAppointments] = useState<AppointmentDTO[]>([]);
  const [employees, setEmployees] = useState<EmployeeDTO[]>([]);
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // New appointment / block modal state
  const [newModalVisible, setNewModalVisible] = useState(false);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ employeeId?: string; time?: string } | null>(null);

  const companyName = session?.company?.name || "Moa Tattoo";

  const load = useCallback(async (date: string) => {
    setError(null);
    try {
      const [aptsData, empsData] = await Promise.all([
        getAppointments({ from: date, to: date }),
        getEmployees().catch(() => []),
      ]);
      setAppointments(aptsData || []);
      setEmployees(empsData || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar a agenda.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    async function run() {
      await load(selectedDate);
      if (!cancelled) setLoading(false);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, load]);

  async function onRefresh() {
    setRefreshing(true);
    await load(selectedDate);
    setRefreshing(false);
  }

  const { activeCount, projectedRevenue } = useMemo(() => {
    const active = appointments.filter((a) => a.status !== "cancelled");
    return {
      activeCount: active.length,
      projectedRevenue: active.reduce((sum, a) => sum + (a.total || 0), 0),
    };
  }, [appointments]);

  const visibleEmployees = useMemo(() => {
    if (employeeFilter !== "all") {
      const filtered = employees.filter((e) => e.id === employeeFilter);
      if (filtered.length > 0) return filtered;
    }
    const active = employees.filter((e) => e.active);
    return active.length > 0 ? active : employees;
  }, [employees, employeeFilter]);

  const handleSlotPress = (empId: string, time: string) => {
    setSelectedSlot({ employeeId: empId, time });
    setNewModalVisible(true);
  };

  return (
    <Screen header={<TopBar title="Agenda" company={companyName} />} style={{ paddingTop: 14 }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ gap: 14, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* 1. Header Section */}
        <View className="gap-1">
          <Text
            style={{
              color: colors.primary,
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
              color: "#ffffff",
              fontSize: 26,
              fontWeight: "800",
              letterSpacing: -0.5,
              textTransform: "lowercase",
            }}
            numberOfLines={1}
          >
            {dateLabel(selectedDate)}
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
              onPress={() => setSelectedDate((d) => shiftDate(d, -1))}
              hitSlop={8}
              className="p-1.5 rounded-lg"
            >
              <ChevronLeft size={18} color="#ffffff" />
            </Pressable>

            <Pressable
              onPress={() => setSelectedDate((d) => shiftDate(d, 1))}
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
            {dateLabel(selectedDate)}
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
              setSelectedSlot(null);
              setNewModalVisible(true);
            }}
            className="flex-1 flex-row items-center justify-center gap-1.5 py-3 px-3 rounded-xl"
            style={{ backgroundColor: "#ffffff" }}
          >
            <Plus size={16} color="#000000" strokeWidth={2.5} />
            <Text style={{ color: "#000000", fontSize: 13, fontWeight: "700" }}>
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
                // Cycle through filters
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
                    borderColor: isSelected ? colors.primary : "rgba(255, 255, 255, 0.08)",
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

        {/* 6. Multi-Professional Timetable Grid */}
        {loading ? (
          <View className="py-12 items-center justify-center">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
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

                  const countEmp = appointments.filter((a) => a.employeeId === emp.id && a.status !== "cancelled").length;

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

              {/* Table Body: Time Rows */}
              {TIME_SLOTS.map((time) => (
                <View
                  key={time}
                  className="flex-row border-b"
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
                    const apt = appointments.find(
                      (a) =>
                        a.employeeId === emp.id &&
                        a.startTime.startsWith(time.slice(0, 2)) &&
                        a.status !== "cancelled"
                    );

                    return (
                      <Pressable
                        key={emp.id}
                        onPress={() => handleSlotPress(emp.id, time)}
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
                              borderColor: colors.primary,
                            }}
                          >
                            <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "700" }} numberOfLines={1}>
                              {apt.clientName || "Cliente"}
                            </Text>
                            <Text style={{ color: colors.primary, fontSize: 10.5, fontWeight: "600" }} numberOfLines={1}>
                              {apt.serviceName || "Serviço"} · {apt.startTime}
                            </Text>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </ScrollView>

      {/* Modal: Novo Agendamento */}
      <Modal
        visible={newModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNewModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center p-4" style={{ backgroundColor: "rgba(0, 0, 0, 0.75)" }}>
          <View
            className="w-full rounded-2xl border p-5 gap-4"
            style={{
              maxWidth: 400,
              backgroundColor: "#111215",
              borderColor: "rgba(255, 255, 255, 0.12)",
            }}
          >
            <View className="flex-row items-center justify-between">
              <Text style={{ color: "#ffffff", fontSize: 17, fontWeight: "700" }}>
                Novo Agendamento
              </Text>
              <Pressable onPress={() => setNewModalVisible(false)}>
                <X size={18} color="#ffffff" />
              </Pressable>
            </View>

            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              Data: {selectedDate} {selectedSlot?.time ? `às ${selectedSlot.time}` : ""}
            </Text>

            <View className="gap-2.5">
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Nome do Cliente</Text>
              <TextInput
                placeholder="Ex: João da Silva"
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
              label="Confirmar Horário"
              onPress={() => {
                setNewModalVisible(false);
                void load(selectedDate);
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Modal: Bloquear Horário */}
      <Modal
        visible={blockModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBlockModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center p-4" style={{ backgroundColor: "rgba(0, 0, 0, 0.75)" }}>
          <View
            className="w-full rounded-2xl border p-5 gap-4"
            style={{
              maxWidth: 400,
              backgroundColor: "#111215",
              borderColor: "rgba(255, 255, 255, 0.12)",
            }}
          >
            <View className="flex-row items-center justify-between">
              <Text style={{ color: "#ffffff", fontSize: 17, fontWeight: "700" }}>
                Bloquear Horário
              </Text>
              <Pressable onPress={() => setBlockModalVisible(false)}>
                <X size={18} color="#ffffff" />
              </Pressable>
            </View>

            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              Bloqueie intervalos para almoço, folgas ou manutenção na data {selectedDate}.
            </Text>

            <Button
              label="Salvar Bloqueio"
              onPress={() => {
                setBlockModalVisible(false);
                void load(selectedDate);
              }}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
