import {
  Calendar,
  Check,
  CheckCircle2,
  Crown,
  Pencil,
  Plus,
  Sparkles,
  Users,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MembershipPlanEditorModal } from "@/components/membership/membership-plan-editor-modal";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { fontFamily, radius, typography } from "@/constants/design-tokens";
import { useTheme, hexToRgba } from "@/hooks/use-theme";
import { ApiError } from "@/lib/api-client";
import { getEmployees, type EmployeeDTO } from "@/lib/employees";
import {
  deleteMembershipPlan,
  getCustomerMemberships,
  getMembershipPlans,
  type CustomerMembershipDTO,
  type MembershipPlanDTO,
} from "@/lib/memberships";
import { getServices, type ServiceDTO } from "@/lib/services";
import { formatBRL } from "@/lib/stats";

export default function ClubesScreen() {
  const { colors, primaryColor, primarySoft, primaryForeground, isDark } = useTheme();
  const [tab, setTab] = useState<"members" | "plans">("members");
  const [plans, setPlans] = useState<MembershipPlanDTO[]>([]);
  const [memberships, setMemberships] = useState<CustomerMembershipDTO[]>([]);
  const [services, setServices] = useState<ServiceDTO[]>([]);
  const [employees, setEmployees] = useState<EmployeeDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Plan modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlanDTO | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [plansRes, membersRes, servicesRes, employeesRes] = await Promise.all([
        getMembershipPlans(true),
        getCustomerMemberships(),
        getServices(),
        getEmployees(),
      ]);
      setPlans(plansRes || []);
      setMemberships(membersRes || []);
      setServices(servicesRes || []);
      setEmployees(employeesRes || []);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar os clubes de assinatura."
      );
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

  const handleOpenCreatePlan = () => {
    setSelectedPlan(null);
    setModalVisible(true);
  };

  const handleOpenEditPlan = (plan: MembershipPlanDTO) => {
    setSelectedPlan(plan);
    setModalVisible(true);
  };

  const handleDeletePlan = async (plan: MembershipPlanDTO) => {
    return new Promise<void>((resolve, reject) => {
      Alert.alert(
        "Desativar plano",
        `Deseja realmente desativar o plano "${plan.name}"? Assinantes existentes continuarão ativos, mas novos clientes não poderão aderir.`,
        [
          { text: "Cancelar", style: "cancel", onPress: () => resolve() },
          {
            text: "Desativar plano",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteMembershipPlan(plan.id);
                await load();
                Alert.alert("Sucesso", `Plano "${plan.name}" desativado.`);
                resolve();
              } catch (err: any) {
                Alert.alert("Erro", err?.message || "Não foi possível desativar o plano.");
                reject(err);
              }
            },
          },
        ]
      );
    });
  };

  const activeMembersCount = memberships.filter((m) => m.status === "active").length;
  const totalMonthlyMRR = memberships
    .filter((m) => m.status === "active")
    .reduce((acc, m) => acc + (Number(m.monthlyPriceSnapshot) || 0), 0);

  return (
    <Screen
      header={<TopBar title="Clubes de Assinatura" company="Mensalistas e recorrência" showBack={true} />}
      style={{ paddingTop: 16 }}
    >
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
          {/* Header da Página */}
          <PageHeader
            eyebrow="FIDELIZAÇÃO E RECORRÊNCIA"
            title="Clubes & Planos"
            subtitle="Crie planos de assinatura mensais e programas de fidelidade para seus clientes."
            action={
              tab === "plans" ? (
                <Pressable
                  onPress={handleOpenCreatePlan}
                  className="flex-row items-center gap-2 px-4 rounded-xl self-start"
                  style={{
                    backgroundColor: primaryColor,
                    height: 40,
                  }}
                >
                  <Plus size={16} color={primaryForeground} strokeWidth={2.5} />
                  <Text style={{ color: primaryForeground, fontSize: 13.5, fontWeight: "700" }}>
                    Novo plano mensal
                  </Text>
                </Pressable>
              ) : undefined
            }
          />

          {/* Métricas Principais */}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <MetricCard
                label="Assinantes Ativos"
                value={String(activeMembersCount)}
                detail="Clientes recorrentes"
                icon={Crown}
                variant="teal"
              />
            </View>
            <View className="flex-1">
              <MetricCard
                label="Receita Recorrente"
                value={formatBRL(totalMonthlyMRR)}
                detail="MRR mensal garantido"
                icon={Sparkles}
                variant="teal"
              />
            </View>
          </View>

          {/* Abas: Assinantes vs Planos */}
          <View
            className="flex-row rounded-lg p-1 border"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            <Pressable
              onPress={() => setTab("members")}
              style={{
                flex: 1,
                alignItems: "center",
                paddingVertical: 8,
                backgroundColor: tab === "members" ? colors.surfaceSecondary : "transparent",
                borderRadius: radius.sm,
              }}
            >
              <Text
                style={{
                  color: tab === "members" ? colors.textPrimary : colors.textMuted,
                  fontSize: 13,
                  fontWeight: tab === "members" ? "700" : "500",
                }}
              >
                Assinantes ({memberships.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setTab("plans")}
              style={{
                flex: 1,
                alignItems: "center",
                paddingVertical: 8,
                backgroundColor: tab === "plans" ? colors.surfaceSecondary : "transparent",
                borderRadius: radius.sm,
              }}
            >
              <Text
                style={{
                  color: tab === "plans" ? colors.textPrimary : colors.textMuted,
                  fontSize: 13,
                  fontWeight: tab === "plans" ? "700" : "500",
                }}
              >
                Planos Oferecidos ({plans.length})
              </Text>
            </Pressable>
          </View>

          {/* Conteúdo da Aba Selecionada */}
          {tab === "members" ? (
            memberships.length === 0 ? (
              <View
                className="items-center justify-center rounded-xl border p-8"
                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              >
                <Crown size={36} color={colors.textMuted} />
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: 16,
                    fontWeight: "600",
                    marginTop: 12,
                  }}
                >
                  Nenhum assinante ativo
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 13,
                    textAlign: "center",
                    marginTop: 4,
                  }}
                >
                  Crie planos mensais para fidelizar seus clientes com agendamentos automáticos e faturamento recorrente.
                </Text>
              </View>
            ) : (
              memberships.map((item) => (
                <View
                  key={item.id}
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: radius.md,
                    padding: 16,
                    gap: 12,
                  }}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3" style={{ flex: 1, flexShrink: 1, marginRight: 8 }}>
                      <Avatar name={item.clientName || "Cliente"} size="md" />
                      <View className="gap-0.5" style={{ flex: 1, flexShrink: 1 }}>
                        <Text
                          style={{
                            color: colors.textPrimary,
                            fontSize: 15,
                            fontWeight: "600",
                            flexShrink: 1,
                          }}
                          numberOfLines={1}
                        >
                          {item.clientName || "Cliente VIP"}
                        </Text>
                        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }} numberOfLines={1}>
                          {item.planName || "Plano Mensal"}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={{
                        backgroundColor:
                          item.status === "active"
                            ? colors.successSoft
                            : colors.warningSoft,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: radius.pill,
                        flexShrink: 0,
                      }}
                    >
                      <Text
                        style={{
                          color:
                            item.status === "active"
                              ? colors.success
                              : colors.warning,
                          fontSize: 11,
                          fontWeight: "700",
                        }}
                      >
                        {item.status === "active" ? "ATIVO" : item.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View
                    className="flex-row items-center justify-between rounded-lg p-3"
                    style={{ backgroundColor: colors.surfaceSecondary }}
                  >
                    <View className="gap-0.5">
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>Valor da Mensalidade</Text>
                      <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "700" }}>
                        {formatBRL(item.monthlyPriceSnapshot)}
                      </Text>
                    </View>

                    {item.currentPeriod && (
                      <View className="items-end gap-0.5">
                        <Text style={{ color: colors.textMuted, fontSize: 12 }}>Sessões no mês</Text>
                        <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "700" }}>
                          {item.currentPeriod.sessionsUsed} / {item.currentPeriod.sessionAllowance} usadas
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ))
            )
          ) : (
            /* Lista de Planos */
            plans.length === 0 ? (
              <View
                className="items-center justify-center rounded-xl border p-8"
                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              >
                <Sparkles size={36} color={colors.textMuted} />
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: 16,
                    fontWeight: "600",
                    marginTop: 12,
                  }}
                >
                  Nenhum plano configurado
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 13,
                    textAlign: "center",
                    marginTop: 4,
                  }}
                >
                  Configure planos de assinatura para oferecer pacotes de serviços mensais para seus clientes.
                </Text>
                <Pressable
                  onPress={handleOpenCreatePlan}
                  className="mt-4 px-4 py-2.5 rounded-xl border flex-row items-center gap-2"
                  style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
                >
                  <Plus size={16} color={primaryForeground} strokeWidth={2.5} />
                  <Text style={{ color: primaryForeground, fontSize: 13, fontWeight: "700" }}>
                    Criar Primeiro Plano
                  </Text>
                </Pressable>
              </View>
            ) : (
              plans.map((p) => {
                const freqLabel =
                  p.frequencyType === "WEEKLY_CALENDAR_BASED"
                    ? p.weeklyFrequency === 1
                      ? "Semanal (4 a 5 sessões/mês)"
                      : `${p.weeklyFrequency}x por semana`
                    : `${p.sessionsPerPeriod} sessões/mês (fixo)`;

                return (
                  <View
                    key={p.id}
                    style={{
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderWidth: 1,
                      borderRadius: radius.md,
                      padding: 16,
                      gap: 12,
                      opacity: p.active ? 1 : 0.65,
                    }}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2 flex-1 mr-2">
                        <View
                          className="flex-row items-center gap-1.5 px-2.5 py-0.5 rounded-full border"
                          style={{
                            backgroundColor: "#1c1d24",
                            borderColor: p.badgeColor ? hexToRgba(p.badgeColor, 0.4) : "rgba(255, 255, 255, 0.12)",
                          }}
                        >
                          <Calendar size={11} color={p.badgeColor || primaryColor} />
                          <Text
                            style={{
                              color: p.badgeColor || primaryColor,
                              fontSize: 11,
                              fontWeight: "700",
                            }}
                          >
                            {freqLabel}
                          </Text>
                        </View>
                      </View>

                      <Pressable
                        onPress={() => handleOpenEditPlan(p)}
                        className="p-1.5 rounded-lg border"
                        style={{
                          backgroundColor: "#20222a",
                          borderColor: "rgba(255, 255, 255, 0.12)",
                        }}
                      >
                        <Pencil size={13} color="#ffffff" />
                      </Pressable>
                    </View>

                    <View className="flex-row items-center justify-between">
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontSize: 17,
                          fontFamily: fontFamily.display,
                          flex: 1,
                          flexShrink: 1,
                          marginRight: 8,
                        }}
                        numberOfLines={1}
                      >
                        {p.name}
                      </Text>

                      <Text
                        style={{
                          color: colors.primary,
                          fontSize: 18,
                          fontFamily: fontFamily.display,
                          flexShrink: 0,
                        }}
                      >
                        {formatBRL(p.price)}/mês
                      </Text>
                    </View>

                    {p.description && (
                      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                        {p.description}
                      </Text>
                    )}

                    <View className="flex-row flex-wrap gap-2 pt-1">
                      <View
                        style={{
                          backgroundColor: colors.surfaceSecondary,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: radius.sm,
                        }}
                      >
                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                          {p.frequencyType === "WEEKLY_CALENDAR_BASED"
                            ? `${p.weeklyFrequency || 1}x por semana`
                            : `${p.sessionsPerPeriod} sessões por mês`}
                        </Text>
                      </View>

                      {p.allowReschedule && (
                        <View
                          style={{
                            backgroundColor: colors.surfaceSecondary,
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: radius.sm,
                          }}
                        >
                          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                            Reagendamento liberado
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )
          )}
        </ScrollView>
      )}

      {/* Complete Redesigned Membership Plan Editor Modal */}
      <MembershipPlanEditorModal
        visible={modalVisible}
        plan={selectedPlan}
        services={services}
        employees={employees}
        onClose={() => {
          setModalVisible(false);
          setSelectedPlan(null);
        }}
        onSaved={load}
        onDeletePlan={handleDeletePlan}
      />
    </Screen>
  );
}
