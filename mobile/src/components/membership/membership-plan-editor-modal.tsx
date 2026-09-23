import {
  Calendar,
  Check,
  ChevronDown,
  Plus,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  Users,
  X,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { useTheme, hexToRgba } from "@/hooks/use-theme";
import type { EmployeeDTO } from "@/lib/employees";
import {
  createMembershipPlan,
  updateMembershipPlan,
  type MembershipFrequencyType,
  type MembershipPlanDTO,
} from "@/lib/memberships";
import type { ServiceDTO } from "@/lib/services";

export const BADGE_COLORS = [
  "#6366f1", // Indigo
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#f59e0b", // Amber
  "#10b981", // Emerald
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#64748b", // Slate
];

export const WEEKLY_FREQUENCY_OPTIONS = [
  { value: 1, label: "1 atendimento por semana (4 ou 5 no mês)" },
  { value: 2, label: "2 atendimentos por semana (ex: Terça + Quinta)" },
  { value: 3, label: "3 atendimentos por semana" },
  { value: 4, label: "4 atendimentos por semana" },
  { value: 5, label: "5 atendimentos por semana" },
];

export interface MembershipPlanEditorModalProps {
  visible: boolean;
  plan: MembershipPlanDTO | null;
  services: ServiceDTO[];
  employees: EmployeeDTO[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDeletePlan?: (plan: MembershipPlanDTO) => Promise<void>;
}

export function MembershipPlanEditorModal({
  visible,
  plan,
  services,
  employees,
  onClose,
  onSaved,
  onDeletePlan,
}: MembershipPlanEditorModalProps) {
  const { primaryColor, primaryForeground } = useTheme();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [badgeColor, setBadgeColor] = useState("#6366f1");

  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [frequencyType, setFrequencyType] = useState<MembershipFrequencyType>("WEEKLY_CALENDAR_BASED");
  const [weeklyFrequency, setWeeklyFrequency] = useState<number>(1);
  const [showWeeklyFreqDropdown, setShowWeeklyFreqDropdown] = useState(false);
  const [sessionsPerPeriod, setSessionsPerPeriod] = useState<string>("4");

  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

  const [allowReschedule, setAllowReschedule] = useState(true);
  const [rescheduleHoursNotice, setRescheduleHoursNotice] = useState<string>("2");
  const [allowCarryOver, setAllowCarryOver] = useState(false);
  const [noShowConsumesSession, setNoShowConsumesSession] = useState(true);
  const [lateCancelConsumesSession, setLateCancelConsumesSession] = useState(true);

  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Initialize state when modal opens
  useEffect(() => {
    if (!visible) return;

    if (plan) {
      setName(plan.name || "");
      setDescription(plan.description || "");
      setPrice(plan.price != null ? String(plan.price) : "");
      setBadgeColor(plan.badgeColor || "#6366f1");

      const sIds =
        plan.serviceIds && plan.serviceIds.length > 0
          ? plan.serviceIds
          : plan.services && plan.services.length > 0
          ? plan.services.map((s) => s.id)
          : services[0]?.id
          ? [services[0].id]
          : [];
      setSelectedServiceIds(sIds);

      const freq = (plan.frequencyType as MembershipFrequencyType) || "WEEKLY_CALENDAR_BASED";
      setFrequencyType(freq);
      setWeeklyFrequency(plan.weeklyFrequency || 1);
      setSessionsPerPeriod(String(plan.sessionsPerPeriod || 4));

      const eIds =
        plan.employeeIds && plan.employeeIds.length > 0
          ? plan.employeeIds
          : plan.employees && plan.employees.length > 0
          ? plan.employees.map((e) => e.id)
          : [];
      setSelectedEmployeeIds(eIds);

      setAllowReschedule(plan.allowReschedule ?? true);
      setRescheduleHoursNotice(String(plan.rescheduleHoursNotice ?? 2));
      setAllowCarryOver(plan.allowCarryOver ?? false);
      setNoShowConsumesSession(plan.noShowConsumesSession ?? true);
      setLateCancelConsumesSession(plan.lateCancelConsumesSession ?? true);
      setActive(plan.active ?? true);
    } else {
      setName("");
      setDescription("");
      setPrice("");
      setBadgeColor("#6366f1");
      setSelectedServiceIds(services[0]?.id ? [services[0].id] : []);
      setFrequencyType("WEEKLY_CALENDAR_BASED");
      setWeeklyFrequency(1);
      setSessionsPerPeriod("4");
      setSelectedEmployeeIds([]);
      setAllowReschedule(true);
      setRescheduleHoursNotice("2");
      setAllowCarryOver(false);
      setNoShowConsumesSession(true);
      setLateCancelConsumesSession(true);
      setActive(true);
    }

    setShowWeeklyFreqDropdown(false);
  }, [visible, plan, services]);

  const activeEmployees = useMemo(() => employees.filter((e) => e.active), [employees]);

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id]
    );
  };

  const toggleEmployee = (id: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((eId) => eId !== id) : [...prev, id]
    );
  };

  const selectedServices = useMemo(
    () => services.filter((s) => selectedServiceIds.includes(s.id)),
    [services, selectedServiceIds]
  );

  const estimatedSumAvulso = useMemo(
    () => selectedServices.reduce((acc, s) => acc + (Number(s.price) || 0), 0),
    [selectedServices]
  );

  const currentWeeklyFreqLabel = useMemo(() => {
    const found = WEEKLY_FREQUENCY_OPTIONS.find((o) => o.value === weeklyFrequency);
    return found ? found.label : `${weeklyFrequency} atendimento(s) por semana`;
  }, [weeklyFrequency]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Erro", "O nome do plano é obrigatório.");
      return;
    }

    const numPrice = parseFloat(price.replace(",", "."));
    if (isNaN(numPrice) || numPrice <= 0) {
      Alert.alert("Erro", "Informe um preço mensal válido.");
      return;
    }

    if (selectedServiceIds.length === 0) {
      Alert.alert("Erro", "Selecione pelo menos um serviço incluído no plano.");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        price: numPrice,
        billingPeriod: "monthly" as const,
        frequencyType,
        weeklyFrequency: frequencyType === "WEEKLY_CALENDAR_BASED" ? weeklyFrequency : undefined,
        sessionsPerPeriod:
          frequencyType === "FIXED_MONTHLY_QUOTA" ? parseInt(sessionsPerPeriod, 10) || 4 : undefined,
        serviceIds: selectedServiceIds,
        employeeIds: selectedEmployeeIds.length > 0 ? selectedEmployeeIds : undefined,
        allowReschedule,
        rescheduleHoursNotice: parseInt(rescheduleHoursNotice, 10) || 0,
        allowCarryOver,
        noShowConsumesSession,
        lateCancelConsumesSession,
        badgeColor,
        active,
      };

      if (plan?.id) {
        await updateMembershipPlan(plan.id, payload);
        Alert.alert("Sucesso", "Plano mensal atualizado com sucesso!");
      } else {
        await createMembershipPlan(payload);
        Alert.alert("Sucesso", "Plano mensal criado com sucesso!");
      }

      await onSaved();
      onClose();
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível salvar o plano mensal.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!plan || busy || deleting || !onDeletePlan) return;
    setDeleting(true);
    try {
      await onDeletePlan(plan);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0, 0, 0, 0.82)" }}>
        <View
          className="w-full rounded-t-3xl border-t overflow-hidden"
          style={{
            maxHeight: "94%",
            backgroundColor: "#111215",
            borderColor: "rgba(255, 255, 255, 0.12)",
          }}
        >
          {/* 1. Modal Header */}
          <View
            className="flex-row items-center justify-between px-5 pt-4 pb-3.5 border-b"
            style={{ borderBottomColor: "rgba(255, 255, 255, 0.08)" }}
          >
            <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "800", letterSpacing: -0.3 }}>
              {plan ? "Editar Plano Mensal Recorrente" : "Cadastrar Plano Mensal Recorrente"}
            </Text>
            <Pressable
              onPress={onClose}
              className="items-center justify-center rounded-full"
              style={{
                width: 36,
                height: 36,
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <X size={18} color="#9ca3af" strokeWidth={2.5} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 30, gap: 18 }}
          >
            {/* 1. Identificação do Plano */}
            <View
              className="p-4 rounded-2xl border gap-3.5"
              style={{
                backgroundColor: "#16171c",
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <View className="flex-row items-center gap-2.5">
                <Sparkles size={16} color={primaryColor} />
                <View>
                  <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "700" }}>
                    Identificação do Plano
                  </Text>
                  <Text style={{ color: "#9ca3af", fontSize: 11.5 }}>
                    Defina o nome comercial, descrição e preço da assinatura
                  </Text>
                </View>
              </View>

              {/* Nome do Plano */}
              <View className="gap-1.5">
                <Text style={{ color: "#d1d5db", fontSize: 12, fontWeight: "600" }}>
                  Nome do Plano <Text style={{ color: "#ef4444" }}>*</Text>
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Ex: Corte Semanal, Terapia Semanal, Aulas 2x/Seman"
                  placeholderTextColor="#6b7280"
                  style={{
                    backgroundColor: "#121316",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    height: 44,
                    color: "#ffffff",
                    fontSize: 13.5,
                  }}
                />
              </View>

              {/* Descrição / Benefícios */}
              <View className="gap-1.5">
                <Text style={{ color: "#d1d5db", fontSize: 12, fontWeight: "600" }}>
                  Descrição / Benefícios
                </Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Descreva o que está incluído para encantar os seus clientes..."
                  placeholderTextColor="#6b7280"
                  multiline
                  numberOfLines={2}
                  style={{
                    backgroundColor: "#121316",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: 10,
                    padding: 12,
                    minHeight: 72,
                    color: "#ffffff",
                    fontSize: 13,
                    textAlignVertical: "top",
                  }}
                />
              </View>

              {/* Preço Mensal */}
              <View className="gap-1.5">
                <Text style={{ color: "#d1d5db", fontSize: 12, fontWeight: "600" }}>
                  Preço Mensal (R$) <Text style={{ color: "#ef4444" }}>*</Text>
                </Text>
                <View
                  className="flex-row items-center px-3.5 rounded-xl border"
                  style={{
                    backgroundColor: "#121316",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    height: 44,
                  }}
                >
                  <Text style={{ color: "#71717a", fontSize: 13, fontWeight: "600", marginRight: 8 }}>R$</Text>
                  <TextInput
                    value={price}
                    onChangeText={setPrice}
                    placeholder="160,00"
                    placeholderTextColor="#6b7280"
                    keyboardType="decimal-pad"
                    className="flex-1 text-white text-sm font-bold"
                    style={{ height: 44 }}
                  />
                </View>
              </View>

              {/* Cor de Destaque / Badge */}
              <View className="gap-2">
                <Text style={{ color: "#d1d5db", fontSize: 12, fontWeight: "600" }}>
                  Cor de Destaque / Badge
                </Text>
                <View className="flex-row items-center gap-2.5 flex-wrap">
                  {BADGE_COLORS.map((c) => {
                    const isSelected = badgeColor === c;
                    return (
                      <Pressable
                        key={c}
                        onPress={() => setBadgeColor(c)}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          backgroundColor: c,
                          borderWidth: isSelected ? 2.5 : 0,
                          borderColor: "#ffffff",
                          transform: [{ scale: isSelected ? 1.15 : 1 }],
                        }}
                      />
                    );
                  })}
                </View>
              </View>
            </View>

            {/* 2. Serviços Incluídos no Plano */}
            <View
              className="p-4 rounded-2xl border gap-3.5"
              style={{
                backgroundColor: "#16171c",
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <View className="flex-row items-center gap-2.5">
                <Tag size={16} color={primaryColor} />
                <View>
                  <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "700" }}>
                    Serviços Incluídos no Plano
                  </Text>
                  <Text style={{ color: "#9ca3af", fontSize: 11.5 }}>
                    Selecione os serviços do catálogo que fazem parte deste pacote
                  </Text>
                </View>
              </View>

              {services.length > 0 ? (
                <View className="flex-row flex-wrap gap-2">
                  {services.map((svc) => {
                    const isSelected = selectedServiceIds.includes(svc.id);
                    return (
                      <Pressable
                        key={svc.id}
                        onPress={() => toggleService(svc.id)}
                        className="flex-row items-center justify-between p-2.5 rounded-xl border"
                        style={{
                          width: "48.5%",
                          backgroundColor: isSelected ? "rgba(59, 130, 246, 0.12)" : "#121316",
                          borderColor: isSelected ? "#3b82f6" : "rgba(255, 255, 255, 0.08)",
                        }}
                      >
                        <View className="flex-1 mr-1.5">
                          <Text
                            numberOfLines={1}
                            style={{
                              color: "#ffffff",
                              fontSize: 11.5,
                              fontWeight: "700",
                              textTransform: "uppercase",
                            }}
                          >
                            {svc.name}
                          </Text>
                          <Text style={{ color: "#9ca3af", fontSize: 10.5, marginTop: 1 }}>
                            R$ {Number(svc.price || 0).toFixed(0)} • {svc.durationMinutes} min
                          </Text>
                        </View>

                        <View
                          className="items-center justify-center rounded-md"
                          style={{
                            width: 22,
                            height: 22,
                            backgroundColor: isSelected ? "#52525b" : "#20222a",
                          }}
                        >
                          {isSelected ? (
                            <Check size={13} color="#ffffff" strokeWidth={2.5} />
                          ) : (
                            <Plus size={13} color="#9ca3af" />
                          )}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={{ color: "#6b7280", fontSize: 12, textAlign: "center", paddingVertical: 8 }}>
                  Nenhum serviço cadastrado no catálogo.
                </Text>
              )}

              {selectedServices.length > 0 && (
                <View
                  className="flex-row items-center gap-1.5 pt-2.5 border-t"
                  style={{ borderTopColor: "rgba(255, 255, 255, 0.08)" }}
                >
                  <Text style={{ color: "#9ca3af", fontSize: 11.5 }}>Soma avulsa dos serviços:</Text>
                  <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "700" }}>
                    R$ {estimatedSumAvulso.toFixed(2).replace(".", ",")}
                  </Text>
                  <Text style={{ color: "#6b7280", fontSize: 11 }}>por atendimento</Text>
                </View>
              )}
            </View>

            {/* 3. Modelo de Frequência & Calendário */}
            <View
              className="p-4 rounded-2xl border gap-3.5"
              style={{
                backgroundColor: "#16171c",
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <View className="flex-row items-center gap-2.5">
                <Calendar size={16} color={primaryColor} />
                <View>
                  <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "700" }}>
                    Modelo de Frequência & Calendário
                  </Text>
                  <Text style={{ color: "#9ca3af", fontSize: 11.5 }}>
                    Como o sistema deve calcular e agendar as sessões mensais
                  </Text>
                </View>
              </View>

              {/* Frequency Option 1: Recorrência Semanal */}
              <Pressable
                onPress={() => setFrequencyType("WEEKLY_CALENDAR_BASED")}
                className="p-3.5 rounded-xl border gap-1.5"
                style={{
                  backgroundColor: "#1c1d24",
                  borderColor:
                    frequencyType === "WEEKLY_CALENDAR_BASED"
                      ? "rgba(255, 255, 255, 0.35)"
                      : "rgba(255, 255, 255, 0.08)",
                }}
              >
                <View className="flex-row items-center gap-2.5">
                  <View
                    className="items-center justify-center rounded-full border"
                    style={{
                      width: 18,
                      height: 18,
                      borderColor: frequencyType === "WEEKLY_CALENDAR_BASED" ? "#ffffff" : "#6b7280",
                    }}
                  >
                    {frequencyType === "WEEKLY_CALENDAR_BASED" && (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#ffffff" }} />
                    )}
                  </View>
                  <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700" }}>
                    Recorrência Semanal
                  </Text>
                </View>
                <Text style={{ color: "#9ca3af", fontSize: 11.5, lineHeight: 16, paddingLeft: 28 }}>
                  Calcula ocorrências reais no mês (ex: 4 ou 5 semanas conforme o dia escolhido no calendário).
                </Text>
              </Pressable>

              {/* Frequency Option 2: Franquia Mensal Fixa */}
              <Pressable
                onPress={() => setFrequencyType("FIXED_MONTHLY_QUOTA")}
                className="p-3.5 rounded-xl border gap-1.5"
                style={{
                  backgroundColor: "#1c1d24",
                  borderColor:
                    frequencyType === "FIXED_MONTHLY_QUOTA"
                      ? "rgba(255, 255, 255, 0.35)"
                      : "rgba(255, 255, 255, 0.08)",
                }}
              >
                <View className="flex-row items-center gap-2.5">
                  <View
                    className="items-center justify-center rounded-full border"
                    style={{
                      width: 18,
                      height: 18,
                      borderColor: frequencyType === "FIXED_MONTHLY_QUOTA" ? "#ffffff" : "#6b7280",
                    }}
                  >
                    {frequencyType === "FIXED_MONTHLY_QUOTA" && (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#ffffff" }} />
                    )}
                  </View>
                  <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700" }}>
                    Franquia Mensal Fixa
                  </Text>
                </View>
                <Text style={{ color: "#9ca3af", fontSize: 11.5, lineHeight: 16, paddingLeft: 28 }}>
                  Quantidade fixa de sessões por mês (ex: sempre 4 ou 8 atendimentos/mês, independente das semanas).
                </Text>
              </Pressable>

              {/* Frequency detail inputs */}
              {frequencyType === "WEEKLY_CALENDAR_BASED" ? (
                <View className="gap-1.5 mt-1">
                  <Text style={{ color: "#d1d5db", fontSize: 12, fontWeight: "600" }}>
                    Frequência Semanal
                  </Text>
                  <Pressable
                    onPress={() => setShowWeeklyFreqDropdown(!showWeeklyFreqDropdown)}
                    className="flex-row items-center justify-between px-3.5 rounded-xl border"
                    style={{
                      backgroundColor: "#121316",
                      borderColor: showWeeklyFreqDropdown ? primaryColor : "rgba(255, 255, 255, 0.1)",
                      height: 44,
                    }}
                  >
                    <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "500" }}>
                      {currentWeeklyFreqLabel}
                    </Text>
                    <ChevronDown
                      size={16}
                      color="#9ca3af"
                      style={{
                        transform: [{ rotate: showWeeklyFreqDropdown ? "180deg" : "0deg" }],
                      }}
                    />
                  </Pressable>

                  {showWeeklyFreqDropdown && (
                    <View
                      className="p-1.5 rounded-xl border gap-1 mt-1"
                      style={{
                        backgroundColor: "#181920",
                        borderColor: "rgba(255, 255, 255, 0.12)",
                      }}
                    >
                      {WEEKLY_FREQUENCY_OPTIONS.map((opt) => {
                        const isSelected = weeklyFrequency === opt.value;
                        return (
                          <Pressable
                            key={opt.value}
                            onPress={() => {
                              setWeeklyFrequency(opt.value);
                              setShowWeeklyFreqDropdown(false);
                            }}
                            className="flex-row items-center justify-between px-3 py-2.5 rounded-lg"
                            style={{
                              backgroundColor: isSelected ? hexToRgba(primaryColor, 0.15) : "transparent",
                            }}
                          >
                            <Text
                              style={{
                                color: isSelected ? primaryColor : "#ffffff",
                                fontSize: 12.5,
                                fontWeight: isSelected ? "700" : "500",
                              }}
                            >
                              {opt.label}
                            </Text>
                            {isSelected && <Check size={14} color={primaryColor} />}
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              ) : (
                <View className="gap-1.5 mt-1">
                  <Text style={{ color: "#d1d5db", fontSize: 12, fontWeight: "600" }}>
                    Sessões Fixas por Mês
                  </Text>
                  <TextInput
                    value={sessionsPerPeriod}
                    onChangeText={setSessionsPerPeriod}
                    placeholder="4"
                    placeholderTextColor="#6b7280"
                    keyboardType="numeric"
                    className="px-3.5 rounded-xl border text-white text-sm font-semibold"
                    style={{
                      backgroundColor: "#121316",
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      height: 44,
                    }}
                  />
                </View>
              )}
            </View>

            {/* 4. Profissionais Disponíveis */}
            {activeEmployees.length > 0 && (
              <View
                className="p-4 rounded-2xl border gap-3"
                style={{
                  backgroundColor: "#16171c",
                  borderColor: "rgba(255, 255, 255, 0.08)",
                }}
              >
                <View className="flex-row items-center gap-2.5">
                  <Users size={16} color={primaryColor} />
                  <View>
                    <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "700" }}>
                      Profissionais Disponíveis
                    </Text>
                    <Text style={{ color: "#9ca3af", fontSize: 11.5 }}>
                      Selecione quais profissionais podem atender por este plano (vazio = todos)
                    </Text>
                  </View>
                </View>

                <View className="flex-row flex-wrap gap-2 pt-1">
                  {activeEmployees.map((emp) => {
                    const isSelected = selectedEmployeeIds.includes(emp.id);
                    return (
                      <Pressable
                        key={emp.id}
                        onPress={() => toggleEmployee(emp.id)}
                        className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl border"
                        style={{
                          backgroundColor: isSelected ? hexToRgba(primaryColor, 0.15) : "#1c1d24",
                          borderColor: isSelected ? primaryColor : "rgba(255, 255, 255, 0.08)",
                        }}
                      >
                        <Text
                          style={{
                            color: isSelected ? primaryColor : "#d1d5db",
                            fontSize: 12,
                            fontWeight: "600",
                          }}
                        >
                          {emp.name}
                        </Text>
                        {isSelected ? (
                          <Check size={11} color={primaryColor} strokeWidth={3} />
                        ) : (
                          <Plus size={11} color="#9ca3af" />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* 5. Políticas e Regras de Sessão */}
            <View
              className="p-4 rounded-2xl border gap-3.5"
              style={{
                backgroundColor: "#16171c",
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <View className="flex-row items-center gap-2.5">
                <ShieldCheck size={16} color={primaryColor} />
                <View>
                  <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "700" }}>
                    Políticas e Regras de Sessão
                  </Text>
                  <Text style={{ color: "#9ca3af", fontSize: 11.5 }}>
                    Regras de remarcação, faltas e validade das sessões
                  </Text>
                </View>
              </View>

              {/* Policy 1: Permitir remarcação */}
              <View className="gap-2.5">
                <Pressable
                  onPress={() => setAllowReschedule(!allowReschedule)}
                  className="flex-row items-start gap-3"
                >
                  <View
                    className="items-center justify-center rounded-md mt-0.5"
                    style={{
                      width: 18,
                      height: 18,
                      backgroundColor: allowReschedule ? "#52525b" : "#20222a",
                      borderWidth: 1,
                      borderColor: allowReschedule ? "#52525b" : "rgba(255, 255, 255, 0.2)",
                    }}
                  >
                    {allowReschedule && <Check size={12} color="#ffffff" strokeWidth={3} />}
                  </View>
                  <View className="flex-1">
                    <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "600" }}>
                      Permitir remarcação de sessões agendadas
                    </Text>
                    <Text style={{ color: "#9ca3af", fontSize: 11 }}>
                      Cliente pode trocar o horário de uma sessão do plano
                    </Text>
                  </View>
                </Pressable>

                {allowReschedule && (
                  <View
                    className="flex-row items-center gap-2 p-2.5 rounded-xl ml-7 border"
                    style={{
                      backgroundColor: "#121316",
                      borderColor: "rgba(255, 255, 255, 0.08)",
                    }}
                  >
                    <Text style={{ color: "#9ca3af", fontSize: 11.5 }}>
                      Antecedência mínima para remarcar:
                    </Text>
                    <TextInput
                      value={rescheduleHoursNotice}
                      onChangeText={setRescheduleHoursNotice}
                      placeholder="2"
                      placeholderTextColor="#6b7280"
                      keyboardType="numeric"
                      className="px-2 rounded-lg border text-white text-xs font-bold text-center"
                      style={{
                        backgroundColor: "#1c1d24",
                        borderColor: "rgba(255, 255, 255, 0.12)",
                        width: 36,
                        height: 28,
                      }}
                    />
                    <Text style={{ color: "#9ca3af", fontSize: 11.5 }}>horas</Text>
                  </View>
                )}
              </View>

              {/* Policy 2: Acumular sessões */}
              <Pressable
                onPress={() => setAllowCarryOver(!allowCarryOver)}
                className="flex-row items-start gap-3"
              >
                <View
                  className="items-center justify-center rounded-md mt-0.5"
                  style={{
                    width: 18,
                    height: 18,
                    backgroundColor: allowCarryOver ? "#52525b" : "#20222a",
                    borderWidth: 1,
                    borderColor: allowCarryOver ? "#52525b" : "rgba(255, 255, 255, 0.2)",
                  }}
                >
                  {allowCarryOver && <Check size={12} color="#ffffff" strokeWidth={3} />}
                </View>
                <View className="flex-1">
                  <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "600" }}>
                    Acumular sessões não utilizadas para o mês seguinte
                  </Text>
                  <Text style={{ color: "#9ca3af", fontSize: 11 }}>
                    Sessões não realizadas no mês corrente não expiram
                  </Text>
                </View>
              </Pressable>

              {/* Policy 3: No-show */}
              <Pressable
                onPress={() => setNoShowConsumesSession(!noShowConsumesSession)}
                className="flex-row items-start gap-3"
              >
                <View
                  className="items-center justify-center rounded-md mt-0.5"
                  style={{
                    width: 18,
                    height: 18,
                    backgroundColor: noShowConsumesSession ? "#52525b" : "#20222a",
                    borderWidth: 1,
                    borderColor: noShowConsumesSession ? "#52525b" : "rgba(255, 255, 255, 0.2)",
                  }}
                >
                  {noShowConsumesSession && <Check size={12} color="#ffffff" strokeWidth={3} />}
                </View>
                <View className="flex-1">
                  <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "600" }}>
                    Falta sem aviso prévio (No-show) consome a sessão
                  </Text>
                  <Text style={{ color: "#9ca3af", fontSize: 11 }}>
                    Não permite reagendar sessão perdida por não comparecimento
                  </Text>
                </View>
              </Pressable>

              {/* Policy 4: Cancelamento tardio */}
              <Pressable
                onPress={() => setLateCancelConsumesSession(!lateCancelConsumesSession)}
                className="flex-row items-start gap-3"
              >
                <View
                  className="items-center justify-center rounded-md mt-0.5"
                  style={{
                    width: 18,
                    height: 18,
                    backgroundColor: lateCancelConsumesSession ? "#52525b" : "#20222a",
                    borderWidth: 1,
                    borderColor: lateCancelConsumesSession ? "#52525b" : "rgba(255, 255, 255, 0.2)",
                  }}
                >
                  {lateCancelConsumesSession && <Check size={12} color="#ffffff" strokeWidth={3} />}
                </View>
                <View className="flex-1">
                  <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "600" }}>
                    Cancelamento tardio fora do prazo consome a sessão
                  </Text>
                  <Text style={{ color: "#9ca3af", fontSize: 11 }}>
                    Cancelamentos em cima da hora contam como utilizados
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* 6. Status do Plano */}
            <View
              className="p-4 rounded-2xl border"
              style={{
                backgroundColor: "#16171c",
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <Pressable onPress={() => setActive(!active)} className="flex-row items-start gap-3">
                <View
                  className="items-center justify-center rounded-md mt-0.5"
                  style={{
                    width: 18,
                    height: 18,
                    backgroundColor: active ? "#52525b" : "#20222a",
                    borderWidth: 1,
                    borderColor: active ? "#52525b" : "rgba(255, 255, 255, 0.2)",
                  }}
                >
                  {active && <Check size={12} color="#ffffff" strokeWidth={3} />}
                </View>
                <View className="flex-1">
                  <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "600" }}>
                    Plano Ativo para Novas Adesões
                  </Text>
                  <Text style={{ color: "#9ca3af", fontSize: 11 }}>
                    Se desativado, mensalistas existentes continuam normalmente mas novos clientes não
                    podem aderir
                  </Text>
                </View>
              </Pressable>
            </View>
          </ScrollView>

          {/* 7. Sticky Footer Actions */}
          <View
            className="px-5 pt-3.5 pb-6 border-t gap-2.5"
            style={{
              backgroundColor: "#111215",
              borderTopColor: "rgba(255, 255, 255, 0.08)",
            }}
          >
            {Boolean(plan) && (
              <Pressable
                onPress={handleDelete}
                disabled={busy || deleting}
                className="flex-row items-center justify-center gap-2 rounded-xl border"
                style={{
                  height: 44,
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  borderColor: "rgba(239, 68, 68, 0.35)",
                }}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#ef4444" />
                ) : (
                  <>
                    <Trash2 size={16} color="#ef4444" />
                    <Text style={{ color: "#ef4444", fontSize: 13, fontWeight: "600" }}>
                      Desativar / Excluir plano
                    </Text>
                  </>
                )}
              </Pressable>
            )}

            <Pressable
              onPress={handleSave}
              disabled={busy || deleting}
              className="flex-row items-center justify-center gap-2 rounded-xl"
              style={{
                height: 46,
                backgroundColor: "#52525b",
                opacity: busy || deleting ? 0.7 : 1,
              }}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Check size={16} color="#ffffff" strokeWidth={2.5} />
                  <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "700" }}>
                    {plan?.id ? "Salvar Alterações" : "Criar Plano Mensal"}
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={onClose}
              disabled={busy || deleting}
              className="items-center justify-center rounded-xl border"
              style={{
                height: 44,
                backgroundColor: "#16171c",
                borderColor: "rgba(255, 255, 255, 0.12)",
              }}
            >
              <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "600" }}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
