import { Plus, Tag, X } from "lucide-react-native";
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
import { ServiceCard } from "@/components/ui/service-card";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { colors, radius, typography } from "@/constants/design-tokens";
import { ApiError, api } from "@/lib/api-client";
import { getServices, type ServiceDTO } from "@/lib/services";
import { useSession } from "@/lib/session-context";

type Filter = "Todos" | "Ativos" | "Inativos";
const FILTERS: Filter[] = ["Todos", "Ativos", "Inativos"];

export default function ServicosScreen() {
  const { session } = useSession();
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

  const visible = useMemo(() => {
    const list = services ?? [];
    if (filter === "Todos") return list;
    return list.filter((s) => s.active === (filter === "Ativos"));
  }, [services, filter]);

  return (
    <Screen header={<TopBar title="Serviços" company={session?.company.name} showBack={true} />} style={{ paddingTop: 16 }}>
      <View className="gap-3.5">
        <View>
          <Text style={{ color: colors.primary, ...typography.eyebrow }}>CATÁLOGO DE SERVIÇOS</Text>
          <Text style={{ color: colors.textPrimary, marginTop: 4, ...typography.pageTitle }}>Serviços Avulsos</Text>
          <Text style={{ color: colors.textMuted, marginTop: 6, ...typography.pageSubtitle }}>
            Crie experiências claras para seus clientes e sua equipe.
          </Text>
        </View>

        {/* Action Button */}
        <Pressable
          onPress={() => setCreateModalVisible(true)}
          className="h-10 flex-row items-center justify-center gap-1.5 rounded-lg px-3"
          style={{ backgroundColor: "#ffffff" }}
        >
          <Plus size={16} color="#000000" strokeWidth={2.5} />
          <Text style={{ color: "#000000", fontSize: 13, fontWeight: "700" }}>+ Novo serviço</Text>
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
          <View className="flex-row gap-2">
            {FILTERS.map((f) => {
              const active = filter === f;
              const count = f === "Todos" ? services?.length ?? 0 : services?.filter((s) => s.active === (f === "Ativos")).length ?? 0;
              return (
                <Pressable
                  key={f}
                  className="px-3.5 py-1.5 rounded-full border flex-row items-center gap-1.5"
                  style={{
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  }}
                  onPress={() => setFilter(f)}
                >
                  <Text
                    style={{
                      color: active ? colors.primaryForeground : colors.textSecondary,
                      fontSize: 12.5,
                      fontWeight: active ? "700" : "500",
                    }}
                  >
                    {f}
                  </Text>
                  <Text
                    style={{
                      color: active ? colors.primaryForeground : colors.textMuted,
                      fontSize: 11,
                      fontWeight: "700",
                      opacity: 0.8,
                    }}
                  >
                    ({count})
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {visible.length === 0 ? (
            <View className="items-center gap-1 py-16">
              <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}>Nenhum serviço</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>Cadastre serviços para começar a agendar.</Text>
            </View>
          ) : (
            <View className="gap-3">
              {visible.map((service) => (
                <ServiceCard key={service.id} service={service} onToggled={handleToggled} />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Modal: Cadastro de Novo Serviço */}
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

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
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
                  <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>PREÇO (R$) *</Text>
                  <TextInput
                    value={newPrice}
                    onChangeText={setNewPrice}
                    placeholder="Ex: 50,00"
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
                  <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>DURAÇÃO (MIN) *</Text>
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
                  placeholder="Descreva o procedimento e o que está incluso..."
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
    </Screen>
  );
}
