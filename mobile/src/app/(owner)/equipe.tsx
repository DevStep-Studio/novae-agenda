import { CalendarDays, CircleDollarSign, Plus, TrendingUp, Users, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
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
import { ApiError, api } from "@/lib/api-client";
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

export default function EquipeScreen() {
  const { session } = useSession();
  const [employees, setEmployees] = useState<EmployeeDTO[] | null>(null);
  const [appointments, setAppointments] = useState<AppointmentDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // New Employee Modal
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [newName, setNewName] = useState("");
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCommission, setNewCommission] = useState("30");

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

  const handleCreateEmployee = async () => {
    if (!newName.trim()) {
      Alert.alert("Erro", "O nome do profissional é obrigatório.");
      return;
    }
    const commVal = parseInt(newCommission, 10) || 30;

    setSavingEmployee(true);
    try {
      await api("/api/employees", {
        method: "POST",
        body: JSON.stringify({
          name: newName.trim(),
          jobTitle: newJobTitle.trim() || "Profissional",
          phone: newPhone.trim() || undefined,
          email: newEmail.trim() || undefined,
          commissionType: "percentage",
          commissionValue: commVal,
          active: true,
        }),
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
    <Screen header={<TopBar title="Equipe" company={session?.company.name} showBack={true} />} style={{ paddingTop: 16 }}>
      <View className="gap-3.5">
        <View>
          <Text style={{ color: colors.primary, ...typography.eyebrow }}>PESSOAS E PERMISSÕES</Text>
          <Text style={{ color: colors.textPrimary, marginTop: 4, ...typography.pageTitle }}>Equipe</Text>
          <Text style={{ color: colors.textMuted, marginTop: 6, ...typography.pageSubtitle }}>
            {totalEmployees} profissionais cadastrados no seu estabelecimento.
          </Text>
        </View>

        {/* Action Button */}
        <Pressable
          onPress={() => setCreateModalVisible(true)}
          className="h-10 flex-row items-center justify-center gap-1.5 rounded-lg px-3"
          style={{ backgroundColor: "#ffffff" }}
        >
          <Plus size={16} color="#000000" strokeWidth={2.5} />
          <Text style={{ color: "#000000", fontSize: 13, fontWeight: "700" }}>+ Novo profissional</Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-6 gap-3">
          <Text style={{ color: colors.textSecondary, textAlign: "center" }}>{error}</Text>
          <Button label="Tentar novamente" onPress={load} />
        </View>
      ) : (
        <ScrollView
          className="flex-1 mt-4"
          contentContainerClassName="gap-4 pb-6"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {/* 2x2 Metrics Grid */}
          <View className="gap-2.5">
            <View className="flex-row gap-2.5">
              <View className="flex-1">
                <MetricCard
                  icon={Users}
                  label="Profissionais ativos"
                  value={String(activeCount)}
                  detail={totalEmployees > 0 ? `${totalEmployees} no total` : undefined}
                />
              </View>
              <View className="flex-1">
                <MetricCard
                  icon={CalendarDays}
                  label="Atendimentos no mês"
                  value={String(totalMonthApts)}
                  detail={totalEmployees > 0 ? `méd. ${avgPerEmployee}/prof.` : undefined}
                />
              </View>
            </View>
            <View className="flex-row gap-2.5">
              <View className="flex-1">
                <MetricCard
                  icon={TrendingUp}
                  label="Receita gerada"
                  value={formatBRL(totalRevenue)}
                  detail="mês atual"
                />
              </View>
              <View className="flex-1">
                <MetricCard
                  icon={CircleDollarSign}
                  label="Comissões totais"
                  value={formatBRL(totalCommissions)}
                  detail="a repassar no mês"
                />
              </View>
            </View>
          </View>

          {employees && employees.length === 0 ? (
            <View className="items-center gap-1 py-16">
              <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}>Nenhum profissional</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>Cadastre sua equipe para gerenciar a agenda.</Text>
            </View>
          ) : (
            <View className="gap-3">
              {(employees ?? []).map((emp) => (
                <EmployeeCard
                  key={emp.id}
                  employee={emp}
                  metrics={metricsByEmployee.get(emp.id) || { todayCount: 0, monthCount: 0, monthRevenue: 0 }}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}

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

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
              <View className="gap-1.5">
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>NOME COMPLETO *</Text>
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Ex: Carlos Oliveira"
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

              <View className="gap-1.5">
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>CARGO / ESPECIALIDADE</Text>
                <TextInput
                  value={newJobTitle}
                  onChangeText={setNewJobTitle}
                  placeholder="Ex: Barbeiro Especialista, Tatuador"
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

              <View className="flex-row gap-3">
                <View className="flex-1 gap-1.5">
                  <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>WHATSAPP</Text>
                  <TextInput
                    value={newPhone}
                    onChangeText={setNewPhone}
                    placeholder="(11) 98888-7777"
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

                <View className="flex-1 gap-1.5">
                  <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>COMISSÃO (%)</Text>
                  <TextInput
                    value={newCommission}
                    onChangeText={setNewCommission}
                    placeholder="30"
                    placeholderTextColor={colors.textDisabled}
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
                  placeholderTextColor={colors.textDisabled}
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
    </Screen>
  );
}
