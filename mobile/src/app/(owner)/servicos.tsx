import { Check, Clock3, Layers, Plus, Tag, Trash2, X } from "lucide-react-native";
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
import { PageHeader } from "@/components/ui/page-header";
import { Screen } from "@/components/ui/screen";
import { ServiceCard } from "@/components/ui/service-card";
import { TopBar } from "@/components/ui/top-bar";
import { colors, radius, typography } from "@/constants/design-tokens";
import { useTheme } from "@/hooks/use-theme";
import { ApiError, api } from "@/lib/api-client";
import {
  deleteService,
  getServices,
  updateService,
  type ServiceDTO,
} from "@/lib/services";
import { useSession } from "@/lib/session-context";

type SubTab = "services" | "memberships";
type Filter = "Todos" | "Ativos" | "Inativos";
const FILTERS: Filter[] = ["Todos", "Ativos", "Inativos"];

export default function ServicosScreen() {
  const { session } = useSession();
  const { isDark, primaryColor, primarySoft, primaryForeground } = useTheme();

  const [subTab, setSubTab] = useState<SubTab>("services");
  const [services, setServices] = useState<ServiceDTO[] | null>(null);
  const [filter, setFilter] = useState<Filter>("Todos");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // New Service Modal
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [savingService, setSavingService] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newDuration, setNewDuration] = useState("30");
  const [newDescription, setNewDescription] = useState("");

  // Edit Service Modal
  const [editingService, setEditingService] = useState<ServiceDTO | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDuration, setEditDuration] = useState("30");
  const [editDescription, setEditDescription] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    try {
      setServices(await getServices());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar os serviços.");
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

  function handleToggled(updated: ServiceDTO) {
    setServices((prev) => prev?.map((s) => (s.id === updated.id ? updated : s)) ?? prev);
  }

  const handleCreateService = async () => {
    if (!newName.trim()) {
      Alert.alert("Erro", "O nome do serviço é obrigatório.");
      return;
    }
    const priceNum = parseFloat(newPrice.replace(",", ".")) || 0;
    const durNum = parseInt(newDuration, 10) || 30;

    setSavingService(true);
    try {
      await api("/api/services", {
        method: "POST",
        body: JSON.stringify({
          name: newName.trim(),
          price: priceNum,
          durationMinutes: durNum,
          description: newDescription.trim() || undefined,
          active: true,
        }),
      });

      setCreateModalVisible(false);
      setNewName("");
      setNewPrice("");
      setNewDuration("30");
      setNewDescription("");
      await load();
      Alert.alert("Sucesso", "Serviço criado com sucesso!");
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível criar o serviço.");
    } finally {
      setSavingService(false);
    }
  };

  const handleOpenEdit = (service: ServiceDTO) => {
    setEditingService(service);
    setEditName(service.name);
    setEditPrice(String(service.price || "0"));
    setEditDuration(String(service.durationMinutes || "30"));
    setEditDescription(service.description || "");
  };

  const handleSaveEdit = async () => {
    if (!editingService) return;
    if (!editName.trim()) {
      Alert.alert("Erro", "O nome do serviço é obrigatório.");
      return;
    }
    const priceNum = parseFloat(editPrice.replace(",", ".")) || 0;
    const durNum = parseInt(editDuration, 10) || 30;

    setSavingEdit(true);
    try {
      await updateService(editingService.id, {
        name: editName.trim(),
        price: priceNum,
        durationMinutes: durNum,
        description: editDescription.trim() || null,
      });

      setEditingService(null);
      await load();
      Alert.alert("Sucesso", "Serviço atualizado com sucesso!");
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível salvar as alterações.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteService = async (service: ServiceDTO) => {
    Alert.alert(
      "Excluir serviço",
      `Tem certeza que deseja excluir permanentemente o serviço "${service.name}"? Esta ação não pode ser desfeita.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir serviço",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteService(service.id);
              await load();
              Alert.alert("Sucesso", `Serviço "${service.name}" excluído.`);
            } catch (err: any) {
              Alert.alert("Erro", err?.message || "Não foi possível excluir o serviço.");
            }
          },
        },
      ]
    );
  };

  const counts = useMemo(() => {
    const list = services ?? [];
    return {
      all: list.length,
      active: list.filter((s) => s.active).length,
      inactive: list.filter((s) => !s.active).length,
    };
  }, [services]);

  const visible = useMemo(() => {
    const list = services ?? [];
    if (filter === "Todos") return list;
    return list.filter((s) => s.active === (filter === "Ativos"));
  }, [services, filter]);

  return (
    <Screen
      header={<TopBar title="Serviços" company={session?.company.name} showBack={true} />}
      style={{ paddingTop: 14 }}
    >
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 16, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />}
      >
        {/* 1. Header Section: Eyebrow + Title + Subtitle + Action Button */}
        <PageHeader
          eyebrow="CATÁLOGO DE SERVIÇOS"
          title="Serviços"
          subtitle={`${services?.length ?? 0} ${services?.length === 1 ? "serviço cadastrado" : "serviços cadastrados"} no seu catálogo.`}
          action={
            <Pressable
              onPress={() => setCreateModalVisible(true)}
              className="flex-row items-center gap-2 px-4 rounded-xl self-start"
              style={{
                backgroundColor: primaryColor,
                height: 40,
              }}
            >
              <Plus size={16} color={primaryForeground} strokeWidth={2.5} />
              <Text style={{ color: primaryForeground, fontSize: 13.5, fontWeight: "700" }}>
                Novo serviço
              </Text>
            </Pressable>
          }
        />

        {/* 2. Top Segmented Navigation: Serviços Avulsos | Planos Mensais */}
        <View
          className="flex-row p-1 rounded-2xl border"
          style={{
            backgroundColor: isDark ? "#121318" : "#f4f4f5",
            borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
          }}
        >
          <Pressable
            onPress={() => setSubTab("services")}
            className="flex-1 py-2.5 px-3 rounded-xl flex-row items-center justify-center gap-2"
            style={{
              backgroundColor:
                subTab === "services"
                  ? isDark
                    ? "#20222a"
                    : "#ffffff"
                  : "transparent",
              borderWidth: 1,
              borderColor:
                subTab === "services"
                  ? isDark
                    ? "rgba(255, 255, 255, 0.12)"
                    : "rgba(0, 0, 0, 0.08)"
                  : "transparent",
            }}
          >
            <Tag size={15} color={subTab === "services" ? primaryColor : "#71717a"} />
            <Text
              style={{
                color:
                  subTab === "services"
                    ? isDark
                      ? "#ffffff"
                      : "#18181b"
                    : "#71717a",
                fontSize: 13,
                fontWeight: subTab === "services" ? "700" : "500",
              }}
            >
              Serviços Avulsos
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setSubTab("memberships")}
            className="flex-1 py-2.5 px-3 rounded-xl flex-row items-center justify-center gap-2"
            style={{
              backgroundColor:
                subTab === "memberships"
                  ? isDark
                    ? "#20222a"
                    : "#ffffff"
                  : "transparent",
              borderWidth: 1,
              borderColor:
                subTab === "memberships"
                  ? isDark
                    ? "rgba(255, 255, 255, 0.12)"
                    : "rgba(0, 0, 0, 0.08)"
                  : "transparent",
            }}
          >
            <Layers size={15} color={subTab === "memberships" ? primaryColor : "#71717a"} />
            <Text
              style={{
                color:
                  subTab === "memberships"
                    ? isDark
                      ? "#ffffff"
                      : "#18181b"
                    : "#71717a",
                fontSize: 13,
                fontWeight: subTab === "memberships" ? "700" : "500",
              }}
            >
              Planos Mensais
            </Text>
          </Pressable>
        </View>

        {subTab === "memberships" ? (
          /* View: Planos Mensais */
          <View className="p-6 rounded-2xl border items-center text-center gap-3" style={{ backgroundColor: "#121318", borderColor: "rgba(255, 255, 255, 0.08)" }}>
            <Layers size={36} color={primaryColor} />
            <Text style={{ color: "#ffffff", fontSize: 17, fontWeight: "700", textAlign: "center" }}>
              Clubes e Assinaturas Mensais
            </Text>
            <Text style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", lineHeight: 18 }}>
              Crie planos recorrentes para fidelizar seus clientes com agendamentos ilimitados ou créditos periódicos.
            </Text>
            <Pressable
              onPress={() => setSubTab("services")}
              className="mt-2 px-4 py-2.5 rounded-xl border"
              style={{ backgroundColor: "#1c1d22", borderColor: "rgba(255, 255, 255, 0.12)" }}
            >
              <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "600" }}>Voltar para Serviços Avulsos</Text>
            </Pressable>
          </View>
        ) : (
          /* View: Serviços Avulsos */
          <>
            {/* 3. Filter Tabs / Chips: Todos | Ativos | Inativos */}
            <View className="flex-row items-center gap-2">
              {([
                { id: "Todos" as const, label: "Todos", count: counts.all },
                { id: "Ativos" as const, label: "Ativos", count: counts.active },
                { id: "Inativos" as const, label: "Inativos", count: counts.inactive },
              ]).map((tab) => {
                const isActive = filter === tab.id;

                return (
                  <Pressable
                    key={tab.id}
                    onPress={() => setFilter(tab.id)}
                    className="flex-row items-center gap-2 px-3.5 py-2 rounded-xl border"
                    style={{
                      backgroundColor: isActive
                        ? isDark
                          ? "rgba(220, 255, 76, 0.12)"
                          : "rgba(0, 0, 0, 0.06)"
                        : isDark
                        ? "#16171d"
                        : "#f4f4f5",
                      borderColor: isActive
                        ? isDark
                          ? "rgba(220, 255, 76, 0.35)"
                          : "rgba(0, 0, 0, 0.2)"
                        : isDark
                        ? "rgba(255, 255, 255, 0.07)"
                        : "rgba(0, 0, 0, 0.06)",
                      height: 38,
                    }}
                  >
                    <Text
                      style={{
                        color: isActive
                          ? isDark
                            ? primaryColor
                            : "#000000"
                          : isDark
                          ? "#9ca3af"
                          : "#71717a",
                        fontSize: 12.5,
                        fontWeight: isActive ? "700" : "500",
                      }}
                    >
                      {tab.label}
                    </Text>
                    <View
                      className="px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: isActive
                          ? isDark
                            ? "rgba(220, 255, 76, 0.2)"
                            : "rgba(0, 0, 0, 0.1)"
                          : isDark
                          ? "rgba(255, 255, 255, 0.06)"
                          : "rgba(0, 0, 0, 0.05)",
                      }}
                    >
                      <Text
                        style={{
                          color: isActive
                            ? isDark
                              ? primaryColor
                              : "#000000"
                            : "#71717a",
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
            </View>

            {/* 4. Service Cards Grid */}
            {loading ? (
              <View className="py-16 items-center justify-center">
                <ActivityIndicator color={primaryColor} />
              </View>
            ) : error ? (
              <View className="py-12 items-center justify-center p-6 gap-3">
                <Text style={{ color: colors.textSecondary, textAlign: "center" }}>{error}</Text>
                <Button label="Tentar novamente" onPress={load} />
              </View>
            ) : visible.length === 0 ? (
              <View className="items-center gap-2 py-16">
                <Tag size={32} color={colors.textMuted} />
                <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "600" }}>Nenhum serviço encontrado</Text>
                <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: "center" }}>
                  Cadastre serviços avulsos para exibir na sua página e agenda.
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                {visible.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    onToggled={handleToggled}
                    onEdit={handleOpenEdit}
                    onDelete={handleDeleteService}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Modal: Cadastrar Novo Serviço */}
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
                Cadastrar Novo Serviço
              </Text>
              <Pressable onPress={() => setCreateModalVisible(false)} className="p-1 rounded-lg">
                <X size={20} color="#ffffff" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 20 }}>
              <View className="gap-1.5">
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>NOME DO SERVIÇO *</Text>
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Ex: Corte Masculino + Barba"
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
                  <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>PREÇO (R$)</Text>
                  <TextInput
                    value={newPrice}
                    onChangeText={setNewPrice}
                    placeholder="35,00"
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

                <View className="flex-1 gap-1.5">
                  <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>DURAÇÃO (MIN)</Text>
                  <TextInput
                    value={newDuration}
                    onChangeText={setNewDuration}
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
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>DESCRIÇÃO (OPCIONAL)</Text>
                <TextInput
                  value={newDescription}
                  onChangeText={setNewDescription}
                  placeholder="Detalhes ou diferenciais do atendimento..."
                  placeholderTextColor={colors.textDisabled}
                  multiline
                  numberOfLines={3}
                  style={{
                    backgroundColor: "#18191e",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: radius.sm,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    height: 70,
                    color: "#ffffff",
                    fontSize: 13,
                    textAlignVertical: "top",
                  }}
                />
              </View>

              <Button
                label={savingService ? "Cadastrando..." : "Cadastrar Serviço"}
                onPress={handleCreateService}
                disabled={savingService}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: Editar Serviço */}
      <Modal
        visible={Boolean(editingService)}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingService(null)}
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
                Editar Serviço
              </Text>
              <Pressable onPress={() => setEditingService(null)} className="p-1 rounded-lg">
                <X size={20} color="#ffffff" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 20 }}>
              <View className="gap-1.5">
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>NOME DO SERVIÇO *</Text>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Nome do serviço"
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
                  <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>PREÇO (R$)</Text>
                  <TextInput
                    value={editPrice}
                    onChangeText={setEditPrice}
                    placeholder="35,00"
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

                <View className="flex-1 gap-1.5">
                  <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>DURAÇÃO (MIN)</Text>
                  <TextInput
                    value={editDuration}
                    onChangeText={setEditDuration}
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
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>DESCRIÇÃO</Text>
                <TextInput
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder="Descrição do serviço..."
                  placeholderTextColor={colors.textDisabled}
                  multiline
                  numberOfLines={3}
                  style={{
                    backgroundColor: "#18191e",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: radius.sm,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    height: 70,
                    color: "#ffffff",
                    fontSize: 13,
                    textAlignVertical: "top",
                  }}
                />
              </View>

              <Button
                label={savingEdit ? "Salvando..." : "Salvar Alterações"}
                onPress={handleSaveEdit}
                disabled={savingEdit}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
