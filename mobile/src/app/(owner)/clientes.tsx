import {
  ArrowUpDown,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Copy,
  Edit3,
  Lightbulb,
  Phone,
  Plus,
  Search,
  Share2,
  Sparkles,
  Trash2,
  User,
  UserPlus,
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
import { useFocusEffect, router } from "expo-router";

import { Avatar } from "@/components/ui/avatar";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { useTheme } from "@/hooks/use-theme";
import { ApiError, api, formatPhoneForWhatsApp } from "@/lib/api-client";
import { type ClientDTO } from "@/lib/clients";
import { useSession } from "@/lib/session-context";

type ClientTab = "all" | "membership" | "vip" | "new" | "with_appointment" | "inactive";
type ClientSort = "visits-desc" | "spent-desc" | "recent" | "name-asc";

const SORT_OPTIONS: { id: ClientSort; label: string; desc: string }[] = [
  { id: "visits-desc", label: "Mais atendimentos", desc: "Clientes com mais visitas realizadas" },
  { id: "spent-desc", label: "Maior valor total", desc: "Clientes com maior receita acumulada" },
  { id: "recent", label: "Última visita", desc: "Mais recentes no estabelecimento" },
  { id: "name-asc", label: "Nome (A–Z)", desc: "Ordem alfabética de nomes" },
];

function formatCurrency(value: number | string | null | undefined): string {
  const num = typeof value === "number" ? value : Number(value);
  if (isNaN(num) || !isFinite(num)) return "R$\u00a00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(num);
}

function shortDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00`);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" })
      .format(d)
      .replace(".", "");
  } catch {
    return dateStr;
  }
}

export default function ClientesScreen() {
  const { session } = useSession();
  const { isDark, primaryColor, primaryForeground, colors } = useTheme();
  const [clients, setClients] = useState<ClientDTO[] | null>(null);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ClientTab>("all");
  const [sortBy, setSortBy] = useState<ClientSort>("visits-desc");
  const [inactiveDays, setInactiveDays] = useState<30 | 45 | 60 | 90>(30);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientDTO | null>(null);

  // New Client Form State
  const [savingClient, setSavingClient] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // Edit Client Form State
  const [editingClient, setEditingClient] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Internal Notes State
  const [internalNotes, setInternalNotes] = useState("");
  const [savingInternalNotes, setSavingInternalNotes] = useState(false);

  const load = useCallback(async (q: string) => {
    try {
      const search = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      const data = await api<ClientDTO[]>(`/api/clients${search}`);
      setClients(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar os clientes.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      async function run() {
        await load(query);
        if (!cancelled) setLoading(false);
      }
      run();
      return () => {
        cancelled = true;
      };
    }, [load, query])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load(query);
    setRefreshing(false);
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      load(query);
    }, 300);
    return () => clearTimeout(handle);
  }, [query, load]);

  const handleCreateClient = async () => {
    if (!newName.trim()) {
      Alert.alert("Erro", "O nome do cliente é obrigatório.");
      return;
    }
    setSavingClient(true);
    try {
      await api("/api/clients", {
        method: "POST",
        body: JSON.stringify({
          name: newName.trim(),
          phone: newPhone.trim() || undefined,
          email: newEmail.trim() || undefined,
          notes: newNotes.trim() || undefined,
        }),
      });

      setCreateModalVisible(false);
      setNewName("");
      setNewPhone("");
      setNewEmail("");
      setNewNotes("");
      await load(query);
      Alert.alert("Sucesso", "Cliente cadastrado com sucesso!");
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível cadastrar o cliente.");
    } finally {
      setSavingClient(false);
    }
  };

  const handleOpenEdit = (client: ClientDTO) => {
    setEditName(client.name);
    setEditPhone(client.phone || "");
    setEditEmail(client.email || "");
    setEditNotes(client.notes || "");
    setEditingClient(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedClient) return;
    if (!editName.trim()) {
      Alert.alert("Erro", "O nome do cliente é obrigatório.");
      return;
    }
    setSavingEdit(true);
    try {
      await api(`/api/clients/${selectedClient.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName.trim(),
          phone: editPhone.trim() || undefined,
          email: editEmail.trim() || undefined,
          notes: editNotes.trim() || undefined,
        }),
      });

      const updatedClient = {
        ...selectedClient,
        name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim() || null,
        notes: editNotes.trim() || null,
      };
      setSelectedClient(updatedClient);
      setEditingClient(false);
      await load(query);
      Alert.alert("Sucesso", "Dados do cliente atualizados com sucesso!");
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível salvar os dados do cliente.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteClient = (client: ClientDTO) => {
    Alert.alert(
      "Excluir cliente",
      `Tem certeza que deseja remover ${client.name}? O histórico de agendamentos será preservado.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await api(`/api/clients/${client.id}`, { method: "DELETE" });
              setSelectedClient(null);
              await load(query);
              Alert.alert("Sucesso", "Cliente removido com sucesso.");
            } catch (err: any) {
              Alert.alert("Erro", err?.message || "Não foi possível excluir o cliente.");
            }
          },
        },
      ]
    );
  };

  const handleSaveInternalNotes = async () => {
    if (!selectedClient) return;
    setSavingInternalNotes(true);
    try {
      await api(`/api/clients/${selectedClient.id}`, {
        method: "PATCH",
        body: JSON.stringify({ internalNotes }),
      });
      setSelectedClient((prev) => (prev ? { ...prev, internalNotes } : null));
      Alert.alert("Sucesso", "Notas internas salvas!");
    } catch {
      Alert.alert("Erro", "Não foi possível salvar as notas internas.");
    } finally {
      setSavingInternalNotes(false);
    }
  };

  // Sync internal notes when client selected
  useEffect(() => {
    if (selectedClient) {
      setInternalNotes(selectedClient.internalNotes || "");
    }
  }, [selectedClient]);

  // Metric Computations matching Web
  const list = clients ?? [];
  const totalClients = list.length;
  const totalSpent = list.reduce((acc, c) => acc + (c.spent || 0), 0);
  const totalVisits = list.reduce((acc, c) => acc + (c.visits || 0), 0);
  const averageTicket = totalVisits > 0 ? Math.round(totalSpent / totalVisits) : 0;

  const vipClients = list.filter((c) => c.visits >= 2 || (c.spent && c.spent >= 200));
  const membershipClients = list.filter((c) => Boolean(c.isMembershipActive));
  const retentionRate = totalClients > 0 ? Math.round((vipClients.length / totalClients) * 100) : 0;

  const thirtyDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  }, []);

  const newClientsCount = list.filter((c) => new Date(c.createdAt) >= thirtyDaysAgo).length;
  const withAppointmentCount = list.filter((c) => Boolean(c.nextVisit)).length;

  const todayStr = new Date().toISOString().slice(0, 10);
  const referenceTime = new Date(`${todayStr}T00:00:00`).getTime();

  const inactiveClients = useMemo(() => {
    return list.filter((c) => {
      const refDateStr = c.lastVisit || c.createdAt;
      if (!refDateStr) return false;
      const diffDays = Math.floor((referenceTime - new Date(refDateStr).getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= inactiveDays && !c.nextVisit;
    });
  }, [list, inactiveDays, referenceTime]);

  // Tab definitions
  const tabs: Array<{ id: ClientTab; label: string; count: number; icon?: any }> = [
    { id: "all", label: "Todos os clientes", count: totalClients },
    { id: "membership", label: "Mensalistas", count: membershipClients.length, icon: Sparkles },
    { id: "vip", label: "Frequentes & VIPs", count: vipClients.length, icon: Sparkles },
    { id: "new", label: "Novos no mês", count: newClientsCount, icon: UserPlus },
    { id: "with_appointment", label: "Com agendamento", count: withAppointmentCount, icon: CalendarDays },
    { id: "inactive", label: "Sem retorno", count: inactiveClients.length, icon: Clock3 },
  ];

  // Filtered list
  const filtered = useMemo(() => {
    return list.filter((client) => {
      const q = query.trim().toLowerCase();
      if (q) {
        const matchName = (client.name || "").toLowerCase().includes(q);
        const matchPhone = (client.phone ?? "").toLowerCase().includes(q);
        const matchEmail = (client.email ?? "").toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchEmail) return false;
      }

      if (activeTab === "membership") {
        return Boolean(client.isMembershipActive);
      }
      if (activeTab === "vip") {
        return client.visits >= 2 || (client.spent && client.spent >= 200);
      }
      if (activeTab === "new") {
        return new Date(client.createdAt) >= thirtyDaysAgo;
      }
      if (activeTab === "with_appointment") {
        return Boolean(client.nextVisit);
      }
      if (activeTab === "inactive") {
        const refDateStr = client.lastVisit || client.createdAt;
        if (!refDateStr) return false;
        const diffDays = Math.floor((referenceTime - new Date(refDateStr).getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= inactiveDays && !client.nextVisit;
      }
      return true;
    });
  }, [list, query, activeTab, thirtyDaysAgo, inactiveDays, referenceTime]);

  // Sorted list
  const sorted = useMemo(() => {
    const res = [...filtered];
    switch (sortBy) {
      case "visits-desc":
        return res.sort((a, b) => (b.visits || 0) - (a.visits || 0));
      case "spent-desc":
        return res.sort((a, b) => (b.spent || 0) - (a.spent || 0));
      case "recent":
        return res.sort((a, b) => (b.lastVisit || "").localeCompare(a.lastVisit || ""));
      case "name-asc":
        return res.sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt-BR"));
      default:
        return res;
    }
  }, [filtered, sortBy]);

  const activeSortLabel =
    SORT_OPTIONS.find((s) => s.id === sortBy)?.label || "Mais atendimentos";

  const handleOpenWhatsApp = (client: ClientDTO) => {
    const digits = formatPhoneForWhatsApp(client.phone);
    if (!digits) {
      Alert.alert("Telefone inválido", "Este cliente não possui um número de WhatsApp cadastrado.");
      return;
    }
    const message =
      activeTab === "inactive"
        ? `Olá, ${client.name}! Faz tempo que não nos vemos no(a) ${session?.company?.name || "Reservei"}. Preparamos um horário especial para você retornar, que tal agendar?`
        : `Olá, ${client.name}! Tudo bem? Falamos da ${session?.company?.name || "Reservei"}.`;
    Linking.openURL(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`);
  };

  const handleCallPhone = (client: ClientDTO) => {
    const digits = formatPhoneForWhatsApp(client.phone);
    if (!digits) return;
    Linking.openURL(`tel:${digits}`);
  };

  return (
    <Screen
      header={<TopBar title="Clientes" company={session?.company?.name || "Barbearia Pelly"} />}
      style={{ paddingTop: 14 }}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ gap: 16, paddingBottom: 110, paddingHorizontal: 4 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />
        }
      >
        {/* 1. Header: Eyebrow + Title + Subtitle + Action Button */}
        <View className="gap-3">
          <View className="gap-1">
            <Text
              style={{
                color: primaryColor,
                fontSize: 11,
                fontWeight: "700",
                letterSpacing: 0.8,
                textTransform: "uppercase",
              }}
            >
              BASE DE RELACIONAMENTO
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
              Clientes
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
              {totalClients} {totalClients === 1 ? "pessoa já faz" : "pessoas já fazem"} parte da sua história.
            </Text>
          </View>

          {/* Action Button: Novo cliente */}
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
              Novo cliente
            </Text>
          </Pressable>
        </View>

        {/* 2. 2x2 Metrics Grid (Matching Web KPIs Exactly) */}
        <View className="gap-2.5">
          <View className="flex-row gap-2.5">
            {/* Card 1: Total de clientes */}
            <View
              className="flex-1 p-4 rounded-2xl border"
              style={{
                backgroundColor: "#121318",
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <View
                className="items-center justify-center rounded-xl border"
                style={{
                  width: 36,
                  height: 36,
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  borderColor: "rgba(255, 255, 255, 0.08)",
                }}
              >
                <Users size={18} color="#9ca3af" />
              </View>
              <Text style={{ color: "#9ca3af", fontSize: 12, fontWeight: "500", marginTop: 10 }}>
                Total de clientes
              </Text>
              <Text style={{ color: "#ffffff", fontSize: 24, fontWeight: "800", marginTop: 2 }}>
                {totalClients}
              </Text>
              <Text style={{ color: "#71717a", fontSize: 11.5, marginTop: 2 }}>
                base cadastrada
              </Text>
            </View>

            {/* Card 2: Clientes mensalistas */}
            <View
              className="flex-1 p-4 rounded-2xl border"
              style={{
                backgroundColor: "#121318",
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <View
                className="items-center justify-center rounded-xl border"
                style={{
                  width: 36,
                  height: 36,
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  borderColor: "rgba(255, 255, 255, 0.08)",
                }}
              >
                <Sparkles size={18} color="#9ca3af" />
              </View>
              <Text style={{ color: "#9ca3af", fontSize: 12, fontWeight: "500", marginTop: 10 }}>
                Clientes mensalistas
              </Text>
              <Text style={{ color: "#ffffff", fontSize: 24, fontWeight: "800", marginTop: 2 }}>
                {membershipClients.length}
              </Text>
              <Text style={{ color: "#71717a", fontSize: 11.5, marginTop: 2 }}>
                planos recorrentes
              </Text>
            </View>
          </View>

          <View className="flex-row gap-2.5">
            {/* Card 3: Clientes frequentes */}
            <View
              className="flex-1 p-4 rounded-2xl border"
              style={{
                backgroundColor: "#121318",
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <View
                className="items-center justify-center rounded-xl border"
                style={{
                  width: 36,
                  height: 36,
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  borderColor: "rgba(255, 255, 255, 0.08)",
                }}
              >
                <Sparkles size={18} color="#9ca3af" />
              </View>
              <Text style={{ color: "#9ca3af", fontSize: 12, fontWeight: "500", marginTop: 10 }}>
                Clientes frequentes
              </Text>
              <Text style={{ color: "#ffffff", fontSize: 24, fontWeight: "800", marginTop: 2 }}>
                {vipClients.length}
              </Text>
              <Text style={{ color: "#71717a", fontSize: 11.5, marginTop: 2 }}>
                {retentionRate}% taxa de retenção
              </Text>
            </View>

            {/* Card 4: Ticket médio */}
            <View
              className="flex-1 p-4 rounded-2xl border"
              style={{
                backgroundColor: "#121318",
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <View
                className="items-center justify-center rounded-xl border"
                style={{
                  width: 36,
                  height: 36,
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  borderColor: "rgba(255, 255, 255, 0.08)",
                }}
              >
                <CircleDollarSign size={18} color="#9ca3af" />
              </View>
              <Text style={{ color: "#9ca3af", fontSize: 12, fontWeight: "500", marginTop: 10 }}>
                Ticket médio
              </Text>
              <Text style={{ color: "#ffffff", fontSize: 24, fontWeight: "800", marginTop: 2 }}>
                {formatCurrency(averageTicket)}
              </Text>
              <Text style={{ color: "#71717a", fontSize: 11.5, marginTop: 2 }}>
                por atendimento
              </Text>
            </View>
          </View>
        </View>

        {/* 3. Filter & Search Toolbar Card */}
        <View
          className="rounded-2xl border p-3.5 gap-3"
          style={{
            backgroundColor: "#121318",
            borderColor: "rgba(255, 255, 255, 0.08)",
          }}
        >
          {/* Segmented Filter Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 2 }}
          >
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              const TabIcon = tab.icon;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id)}
                  className="flex-row items-center gap-2 px-3 py-2 rounded-xl border"
                  style={{
                    backgroundColor: active ? "#20222a" : "transparent",
                    borderColor: active ? "rgba(255, 255, 255, 0.22)" : "rgba(255, 255, 255, 0.06)",
                    height: 38,
                  }}
                >
                  {TabIcon && (
                    <TabIcon size={14} color={active ? "#ffffff" : "#9ca3af"} />
                  )}
                  <Text
                    style={{
                      color: active ? "#ffffff" : "#9ca3af",
                      fontSize: 12.5,
                      fontWeight: active ? "700" : "500",
                    }}
                  >
                    {tab.label}
                  </Text>
                  <View
                    className="items-center justify-center px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: active ? "#2c2e3a" : "rgba(255, 255, 255, 0.06)",
                    }}
                  >
                    <Text
                      style={{
                        color: active ? "#ffffff" : "#71717a",
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

          {/* Inactive retention days options */}
          {activeTab === "inactive" && (
            <View
              className="flex-row items-center gap-2 p-2.5 rounded-xl border flex-wrap"
              style={{
                backgroundColor: "#0d0e12",
                borderColor: "rgba(255, 255, 255, 0.06)",
              }}
            >
              <Text style={{ color: "#9ca3af", fontSize: 12, fontWeight: "600" }}>
                Sem retorno há:
              </Text>
              {([30, 45, 60, 90] as const).map((days) => (
                <Pressable
                  key={days}
                  onPress={() => setInactiveDays(days)}
                  className="px-2.5 py-1 rounded-md border"
                  style={{
                    backgroundColor: inactiveDays === days ? "#1e2026" : "transparent",
                    borderColor: inactiveDays === days ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <Text
                    style={{
                      color: inactiveDays === days ? "#ffffff" : "#9ca3af",
                      fontSize: 11.5,
                      fontWeight: inactiveDays === days ? "700" : "500",
                    }}
                  >
                    {days} dias
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Search Bar Input */}
          <View
            className="flex-row items-center gap-2.5 px-3 rounded-xl border"
            style={{
              height: 42,
              backgroundColor: "#0d0e12",
              borderColor: "rgba(255, 255, 255, 0.08)",
            }}
          >
            <Search size={16} color="#71717a" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar por nome, telefone ou e-mail..."
              placeholderTextColor="#52525b"
              style={{
                flex: 1,
                color: "#ffffff",
                fontSize: 13.5,
              }}
            />
            {query ? (
              <Pressable onPress={() => setQuery("")} hitSlop={8} className="p-1">
                <X size={15} color="#9ca3af" />
              </Pressable>
            ) : null}
          </View>

          {/* Sort Row & Count (Properly spaced) */}
          <View className="flex-row items-center justify-between pt-1">
            <Pressable
              onPress={() => setSortModalVisible(true)}
              className="flex-row items-center gap-1.5 py-1.5 px-2.5 rounded-lg border"
              style={{
                backgroundColor: "#181920",
                borderColor: "rgba(255, 255, 255, 0.1)",
              }}
            >
              <ArrowUpDown size={12} color="#a1a1aa" />
              <Text style={{ color: "#71717a", fontSize: 12 }}>Ordenar:</Text>
              <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "700" }}>
                {activeSortLabel}
              </Text>
              <ChevronDown size={13} color="#9ca3af" />
            </Pressable>

            <Text style={{ color: "#71717a", fontSize: 12 }}>
              Exibindo{" "}
              <Text style={{ color: "#ffffff", fontWeight: "700" }}>
                {sorted.length}
              </Text>{" "}
              de {totalClients}
            </Text>
          </View>
        </View>

        {/* 4. Client Cards List (Native Mobile Cards) */}
        {loading ? (
          <View className="items-center justify-center py-16">
            <ActivityIndicator color={primaryColor} size="small" />
          </View>
        ) : sorted.length === 0 ? (
          <View className="items-center justify-center py-12 gap-2">
            <Users size={36} color="#52525b" />
            <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "700" }}>
              Nenhum cliente encontrado
            </Text>
            <Text style={{ color: "#71717a", fontSize: 12.5, textAlign: "center", maxWidth: 280 }}>
              {query || activeTab !== "all"
                ? "Nenhum cliente corresponde aos filtros ou busca selecionados."
                : "Cadastre seu primeiro cliente para começar a gerenciar."}
            </Text>
            {query || activeTab !== "all" ? (
              <Pressable
                onPress={() => {
                  setQuery("");
                  setActiveTab("all");
                }}
                className="px-4 py-2 rounded-lg border mt-2"
                style={{
                  backgroundColor: "#181920",
                  borderColor: "rgba(255, 255, 255, 0.12)",
                }}
              >
                <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "600" }}>
                  Limpar filtros
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View className="gap-3">
            {sorted.map((client) => {
              const isVip = Boolean(client.visits >= 3 || (client.spent ?? 0) >= 250);
              const isFrequent = Boolean(!isVip && client.visits >= 2);
              const isNew = Boolean(!isVip && !isFrequent && !client.isMembershipActive);
              const avgClientTicket =
                client.visits > 0 ? Math.round((client.spent || 0) / client.visits) : 0;
              const hasUpcoming = Boolean(client.nextVisit);

              return (
                <Pressable
                  key={client.id}
                  onPress={() => setSelectedClient(client)}
                  className="p-4 rounded-2xl border gap-3"
                  style={{
                    backgroundColor: "#121318",
                    borderColor: "rgba(255, 255, 255, 0.08)",
                  }}
                >
                  {/* 1. Header Row: Avatar + Name/Badges + Chevron */}
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3 flex-1 pr-2">
                      <Avatar name={client.name} photoUrl={client.photoUrl} size="md" />

                      <View className="flex-1 gap-0.5">
                        <View className="flex-row items-center gap-1.5 flex-wrap">
                          <Text
                            style={{
                              color: "#ffffff",
                              fontSize: 15,
                              fontWeight: "700",
                            }}
                            numberOfLines={1}
                          >
                            {client.name}
                          </Text>

                          {client.isMembershipActive ? (
                            <View
                              className="px-1.5 py-0.5 rounded-full border"
                              style={{
                                backgroundColor: "rgba(139, 92, 246, 0.15)",
                                borderColor: "rgba(139, 92, 246, 0.4)",
                              }}
                            >
                              <Text
                                style={{
                                  color: "#a78bfa",
                                  fontSize: 9.5,
                                  fontWeight: "800",
                                }}
                              >
                                MENSALISTA
                              </Text>
                            </View>
                          ) : isVip ? (
                            <View
                              className="px-1.5 py-0.5 rounded-full border"
                              style={{
                                backgroundColor: "rgba(245, 158, 11, 0.15)",
                                borderColor: "rgba(245, 158, 11, 0.4)",
                              }}
                            >
                              <Text
                                style={{
                                  color: "#f59e0b",
                                  fontSize: 9.5,
                                  fontWeight: "800",
                                }}
                              >
                                VIP
                              </Text>
                            </View>
                          ) : isFrequent ? (
                            <View
                              className="px-1.5 py-0.5 rounded-full border"
                              style={{
                                backgroundColor: "rgba(16, 185, 129, 0.15)",
                                borderColor: "rgba(16, 185, 129, 0.4)",
                              }}
                            >
                              <Text
                                style={{
                                  color: "#34d399",
                                  fontSize: 9.5,
                                  fontWeight: "800",
                                }}
                              >
                                FREQUENTE
                              </Text>
                            </View>
                          ) : isNew ? (
                            <View
                              className="px-1.5 py-0.5 rounded-full border"
                              style={{
                                backgroundColor: "rgba(16, 185, 129, 0.12)",
                                borderColor: "rgba(16, 185, 129, 0.35)",
                              }}
                            >
                              <Text
                                style={{
                                  color: "#10b981",
                                  fontSize: 9.5,
                                  fontWeight: "800",
                                }}
                              >
                                NOVO
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        <View className="flex-row items-center gap-2">
                          <Text
                            style={{ color: "#71717a", fontSize: 12 }}
                            numberOfLines={1}
                          >
                            {client.email || (client.phone ? "Cliente cadastrado" : "Sem telefone")}
                          </Text>

                          {hasUpcoming && (
                            <View className="flex-row items-center gap-1">
                              <View
                                style={{
                                  width: 5,
                                  height: 5,
                                  borderRadius: 2.5,
                                  backgroundColor: "#22c55e",
                                }}
                              />
                              <Text
                                style={{
                                  color: "#4ade80",
                                  fontSize: 11,
                                  fontWeight: "600",
                                }}
                              >
                                Agendado
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>

                    <ChevronRight size={18} color="#71717a" />
                  </View>

                  {/* 2. Stats Grid (Última Visita | Visitas | Total Gasto) */}
                  <View
                    className="flex-row items-center justify-between p-2.5 rounded-xl border"
                    style={{
                      backgroundColor: "#0d0e12",
                      borderColor: "rgba(255, 255, 255, 0.05)",
                    }}
                  >
                    <View className="flex-1 items-center border-r border-[rgba(255,255,255,0.06)]">
                      <Text style={{ color: "#71717a", fontSize: 10.5, fontWeight: "600", textTransform: "uppercase" }}>
                        Última Visita
                      </Text>
                      <Text style={{ color: "#d1d5db", fontSize: 12.5, fontWeight: "700", marginTop: 2 }}>
                        {shortDate(client.lastVisit)}
                      </Text>
                    </View>

                    <View className="flex-1 items-center border-r border-[rgba(255,255,255,0.06)]">
                      <Text style={{ color: "#71717a", fontSize: 10.5, fontWeight: "600", textTransform: "uppercase" }}>
                        Atendimentos
                      </Text>
                      <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "700", marginTop: 2 }}>
                        {client.visits || 0} {client.visits === 1 ? "visita" : "visitas"}
                      </Text>
                    </View>

                    <View className="flex-1 items-center">
                      <Text style={{ color: "#71717a", fontSize: 10.5, fontWeight: "600", textTransform: "uppercase" }}>
                        Total Gasto
                      </Text>
                      <Text style={{ color: "#22c55e", fontSize: 12.5, fontWeight: "700", marginTop: 2 }}>
                        {formatCurrency(client.spent)}
                      </Text>
                    </View>
                  </View>

                  {/* 3. Action Buttons Row */}
                  <View className="flex-row items-center gap-2 pt-0.5">
                    {client.phone ? (
                      <Pressable
                        onPress={() => handleOpenWhatsApp(client)}
                        className="flex-1 flex-row items-center justify-center gap-1.5 py-2 px-3 rounded-xl border"
                        style={{
                          backgroundColor: "rgba(34, 197, 94, 0.08)",
                          borderColor: "rgba(34, 197, 94, 0.25)",
                          height: 36,
                        }}
                      >
                        <WhatsAppIcon size={14} />
                        <Text
                          style={{
                            color: "#22c55e",
                            fontSize: 12,
                            fontWeight: "700",
                          }}
                          numberOfLines={1}
                        >
                          {client.phone}
                        </Text>
                      </Pressable>
                    ) : null}

                    <Pressable
                      onPress={() => {
                        router.push({
                          pathname: "/(owner)/agenda",
                          params: { newForClient: client.id },
                        } as any);
                      }}
                      className="flex-1 flex-row items-center justify-center gap-1.5 py-2 px-3 rounded-xl border"
                      style={{
                        backgroundColor: "#181920",
                        borderColor: "rgba(255, 255, 255, 0.1)",
                        height: 36,
                      }}
                    >
                      <CalendarPlus size={14} color="#9ca3af" />
                      <Text style={{ color: "#d1d5db", fontSize: 12, fontWeight: "600" }}>
                        Agendar
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setSelectedClient(client)}
                      className="px-3 py-2 rounded-xl border items-center justify-center"
                      style={{
                        backgroundColor: "#181920",
                        borderColor: "rgba(255, 255, 255, 0.1)",
                        height: 36,
                      }}
                    >
                      <Text style={{ color: "#9ca3af", fontSize: 12, fontWeight: "600" }}>
                        Ficha
                      </Text>
                    </Pressable>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Modal 1: Sort Selection Dropdown Sheet */}
      <Modal
        visible={sortModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSortModalVisible(false)}
      >
        <Pressable
          onPress={() => setSortModalVisible(false)}
          className="flex-1 justify-end"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.7)" }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-full rounded-t-3xl border-t p-5 gap-3"
            style={{
              backgroundColor: "#111215",
              borderColor: "rgba(255, 255, 255, 0.1)",
            }}
          >
            <View className="flex-row items-center justify-between pb-2 border-b border-[rgba(255,255,255,0.08)]">
              <View className="flex-row items-center gap-2">
                <ArrowUpDown size={17} color="#ffffff" />
                <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "700" }}>
                  Ordenar clientes por
                </Text>
              </View>
              <Pressable onPress={() => setSortModalVisible(false)}>
                <X size={20} color="#9ca3af" />
              </Pressable>
            </View>

            <View className="gap-2 pt-1">
              {SORT_OPTIONS.map((option) => {
                const isSelected = sortBy === option.id;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => {
                      setSortBy(option.id);
                      setSortModalVisible(false);
                    }}
                    className="flex-row items-center justify-between p-3.5 rounded-xl border"
                    style={{
                      backgroundColor: isSelected ? "#1c1e26" : "#15161c",
                      borderColor: isSelected ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.06)",
                    }}
                  >
                    <View className="gap-0.5">
                      <Text
                        style={{
                          color: isSelected ? "#ffffff" : "#d1d5db",
                          fontSize: 13.5,
                          fontWeight: isSelected ? "700" : "500",
                        }}
                      >
                        {option.label}
                      </Text>
                      <Text style={{ color: "#71717a", fontSize: 11.5 }}>
                        {option.desc}
                      </Text>
                    </View>

                    {isSelected && <Check size={18} color="#ffffff" strokeWidth={2.5} />}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal 2: Client Profile / Detail Modal (Ficha do Cliente) */}
      <Modal
        visible={Boolean(selectedClient && !editingClient)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedClient(null)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0, 0, 0, 0.75)" }}>
          <View
            className="w-full rounded-t-3xl border-t p-5 gap-4"
            style={{
              maxHeight: "90%",
              backgroundColor: "#111215",
              borderColor: "rgba(255, 255, 255, 0.12)",
            }}
          >
            {/* Modal Header */}
            <View className="flex-row items-center justify-between pb-2 border-b border-[rgba(255,255,255,0.08)]">
              <View className="flex-row items-center gap-2">
                <User size={18} color="#ffffff" />
                <View>
                  <Text style={{ color: "#71717a", fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>
                    Ficha do Cliente
                  </Text>
                  <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "800" }}>
                    {selectedClient?.name}
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => setSelectedClient(null)} className="p-1 rounded-lg">
                <X size={20} color="#ffffff" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
              {/* Profile Hero */}
              <View className="items-center py-2 gap-2">
                <Avatar name={selectedClient?.name || "C"} photoUrl={selectedClient?.photoUrl} size="lg" />
                <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "800" }}>
                  {selectedClient?.name}
                </Text>

                <View className="flex-row items-center gap-2">
                  {(selectedClient?.visits ?? 0) >= 3 ? (
                    <View
                      className="px-2 py-0.5 rounded-full border"
                      style={{
                        backgroundColor: "rgba(245, 158, 11, 0.12)",
                        borderColor: "rgba(245, 158, 11, 0.4)",
                      }}
                    >
                      <Text style={{ color: "#f59e0b", fontSize: 10, fontWeight: "800" }}>VIP</Text>
                    </View>
                  ) : (selectedClient?.visits ?? 0) >= 2 ? (
                    <View
                      className="px-2 py-0.5 rounded-full border"
                      style={{
                        backgroundColor: "rgba(16, 185, 129, 0.12)",
                        borderColor: "rgba(16, 185, 129, 0.4)",
                      }}
                    >
                      <Text style={{ color: "#34d399", fontSize: 10, fontWeight: "800" }}>FREQUENTE</Text>
                    </View>
                  ) : (
                    <View
                      className="px-2 py-0.5 rounded-full border"
                      style={{
                        backgroundColor: "rgba(16, 185, 129, 0.12)",
                        borderColor: "rgba(16, 185, 129, 0.4)",
                      }}
                    >
                      <Text style={{ color: "#10b981", fontSize: 10, fontWeight: "800" }}>NOVO</Text>
                    </View>
                  )}
                  <Text style={{ color: "#71717a", fontSize: 12 }}>
                    Cliente desde {shortDate(selectedClient?.createdAt)}
                  </Text>
                </View>
              </View>

              {/* Quick Actions Row */}
              <View className="flex-row items-center gap-2">
                {selectedClient?.phone ? (
                  <Pressable
                    onPress={() => selectedClient && handleOpenWhatsApp(selectedClient)}
                    className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl border"
                    style={{
                      backgroundColor: "rgba(34, 197, 94, 0.1)",
                      borderColor: "rgba(34, 197, 94, 0.3)",
                    }}
                  >
                    <WhatsAppIcon size={14} />
                    <Text style={{ color: "#22c55e", fontSize: 12.5, fontWeight: "700" }}>
                      WhatsApp
                    </Text>
                  </Pressable>
                ) : null}

                {selectedClient?.phone ? (
                  <Pressable
                    onPress={() => selectedClient && handleCallPhone(selectedClient)}
                    className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl border"
                    style={{
                      backgroundColor: "#181920",
                      borderColor: "rgba(255, 255, 255, 0.1)",
                    }}
                  >
                    <Phone size={14} color="#ffffff" />
                    <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "700" }}>
                      Ligar
                    </Text>
                  </Pressable>
                ) : null}

                <Pressable
                  onPress={() => {
                    if (!selectedClient) return;
                    setSelectedClient(null);
                    router.push({
                      pathname: "/(owner)/agenda",
                      params: { newForClient: selectedClient.id },
                    } as any);
                  }}
                  className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl border"
                  style={{
                    backgroundColor: "#52545d",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                  }}
                >
                  <CalendarPlus size={14} color="#ffffff" />
                  <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "700" }}>
                    Agendar
                  </Text>
                </Pressable>
              </View>

              {/* Stats 4-box Grid */}
              <View className="flex-row gap-2">
                <View className="flex-1 p-3 rounded-xl border bg-[#14151b] border-[rgba(255,255,255,0.06)]">
                  <Text style={{ color: "#71717a", fontSize: 11, fontWeight: "600" }}>Visitas</Text>
                  <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "800", marginTop: 2 }}>
                    {selectedClient?.visits || 0}
                  </Text>
                </View>
                <View className="flex-1 p-3 rounded-xl border bg-[#14151b] border-[rgba(255,255,255,0.06)]">
                  <Text style={{ color: "#71717a", fontSize: 11, fontWeight: "600" }}>Gasto total</Text>
                  <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "800", marginTop: 2 }}>
                    {formatCurrency(selectedClient?.spent)}
                  </Text>
                </View>
                <View className="flex-1 p-3 rounded-xl border bg-[#14151b] border-[rgba(255,255,255,0.06)]">
                  <Text style={{ color: "#71717a", fontSize: 11, fontWeight: "600" }}>Ticket médio</Text>
                  <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "800", marginTop: 2 }}>
                    {formatCurrency(
                      (selectedClient?.visits ?? 0) > 0
                        ? Math.round((selectedClient?.spent || 0) / (selectedClient?.visits || 1))
                        : 0
                    )}
                  </Text>
                </View>
                <View className="flex-1 p-3 rounded-xl border bg-[#14151b] border-[rgba(255,255,255,0.06)]">
                  <Text style={{ color: "#71717a", fontSize: 11, fontWeight: "600" }}>Última visita</Text>
                  <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "800", marginTop: 2 }}>
                    {shortDate(selectedClient?.lastVisit)}
                  </Text>
                </View>
              </View>

              {/* Contact Information */}
              <View className="p-4 rounded-xl border bg-[#14151b] border-[rgba(255,255,255,0.06)] gap-2.5">
                <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700" }}>
                  Informações de Contato
                </Text>
                <View className="flex-row items-center justify-between">
                  <Text style={{ color: "#71717a", fontSize: 12 }}>Telefone:</Text>
                  <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "600" }}>
                    {selectedClient?.phone || "Não informado"}
                  </Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text style={{ color: "#71717a", fontSize: 12 }}>E-mail:</Text>
                  <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "600" }}>
                    {selectedClient?.email || "Não informado"}
                  </Text>
                </View>
                {selectedClient?.notes ? (
                  <View className="gap-1 pt-1 border-t border-[rgba(255,255,255,0.06)]">
                    <Text style={{ color: "#71717a", fontSize: 11.5 }}>Observações do cliente:</Text>
                    <Text style={{ color: "#d1d5db", fontSize: 12.5 }}>{selectedClient.notes}</Text>
                  </View>
                ) : null}
              </View>

              {/* Internal Notes Editor */}
              <View className="p-4 rounded-xl border bg-[#14151b] border-[rgba(255,255,255,0.06)] gap-2">
                <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700" }}>
                  Notas Internas da Equipe
                </Text>
                <TextInput
                  value={internalNotes}
                  onChangeText={setInternalNotes}
                  placeholder="Observações confidenciais, corte preferido, hábitos..."
                  placeholderTextColor="#52525b"
                  multiline
                  numberOfLines={3}
                  style={{
                    backgroundColor: "#0d0e12",
                    borderColor: "rgba(255, 255, 255, 0.08)",
                    borderWidth: 1,
                    borderRadius: 8,
                    padding: 10,
                    height: 70,
                    color: "#ffffff",
                    fontSize: 12.5,
                    textAlignVertical: "top",
                  }}
                />
                <Pressable
                  onPress={handleSaveInternalNotes}
                  disabled={savingInternalNotes}
                  className="py-2 px-3 rounded-lg border self-end items-center justify-center"
                  style={{
                    backgroundColor: "#1e2026",
                    borderColor: "rgba(255, 255, 255, 0.15)",
                  }}
                >
                  <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "700" }}>
                    {savingInternalNotes ? "Salvando..." : "Salvar notas"}
                  </Text>
                </Pressable>
              </View>

              {/* Management Actions: Edit & Delete */}
              <View className="flex-row items-center gap-2 pt-1">
                <Pressable
                  onPress={() => selectedClient && handleOpenEdit(selectedClient)}
                  className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl border"
                  style={{
                    backgroundColor: "#181920",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                  }}
                >
                  <Edit3 size={15} color="#ffffff" />
                  <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700" }}>
                    Editar dados
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => selectedClient && handleDeleteClient(selectedClient)}
                  className="flex-row items-center justify-center gap-2 py-3 px-4 rounded-xl border"
                  style={{
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    borderColor: "rgba(239, 68, 68, 0.25)",
                  }}
                >
                  <Trash2 size={15} color="#ef4444" />
                  <Text style={{ color: "#ef4444", fontSize: 13, fontWeight: "700" }}>
                    Excluir
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal 3: Edit Client Modal */}
      <Modal
        visible={editingClient}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingClient(false)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0, 0, 0, 0.75)" }}>
          <View
            className="w-full rounded-t-3xl border-t p-5 gap-4"
            style={{
              backgroundColor: "#111215",
              borderColor: "rgba(255, 255, 255, 0.12)",
            }}
          >
            <View className="flex-row items-center justify-between pb-2 border-b border-[rgba(255,255,255,0.08)]">
              <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "800" }}>
                Editar Dados do Cliente
              </Text>
              <Pressable onPress={() => setEditingClient(false)} className="p-1 rounded-lg">
                <X size={20} color="#ffffff" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
              <View className="gap-1.5">
                <Text style={{ color: "#9ca3af", fontSize: 12, fontWeight: "600" }}>NOME COMPLETO *</Text>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  style={{
                    backgroundColor: "#18191e",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    height: 44,
                    color: "#ffffff",
                    fontSize: 14,
                  }}
                />
              </View>

              <View className="gap-1.5">
                <Text style={{ color: "#9ca3af", fontSize: 12, fontWeight: "600" }}>TELEFONE / WHATSAPP</Text>
                <TextInput
                  value={editPhone}
                  onChangeText={setEditPhone}
                  keyboardType="phone-pad"
                  style={{
                    backgroundColor: "#18191e",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    height: 44,
                    color: "#ffffff",
                    fontSize: 14,
                  }}
                />
              </View>

              <View className="gap-1.5">
                <Text style={{ color: "#9ca3af", fontSize: 12, fontWeight: "600" }}>E-MAIL</Text>
                <TextInput
                  value={editEmail}
                  onChangeText={setEditEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={{
                    backgroundColor: "#18191e",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    height: 44,
                    color: "#ffffff",
                    fontSize: 14,
                  }}
                />
              </View>

              <View className="gap-1.5">
                <Text style={{ color: "#9ca3af", fontSize: 12, fontWeight: "600" }}>OBSERVAÇÕES DO CLIENTE</Text>
                <TextInput
                  value={editNotes}
                  onChangeText={setEditNotes}
                  multiline
                  numberOfLines={2}
                  style={{
                    backgroundColor: "#18191e",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    height: 60,
                    color: "#ffffff",
                    fontSize: 13,
                    textAlignVertical: "top",
                  }}
                />
              </View>

              <Pressable
                onPress={handleSaveEdit}
                disabled={savingEdit}
                className="items-center justify-center py-3.5 rounded-xl"
                style={{
                  backgroundColor: primaryColor,
                }}
              >
                {savingEdit ? (
                  <ActivityIndicator size="small" color={primaryForeground} />
                ) : (
                  <Text style={{ color: primaryForeground, fontSize: 14, fontWeight: "700" }}>
                    Salvar Alterações
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal 4: Cadastro de Novo Cliente */}
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
            <View className="flex-row items-center justify-between pb-2 border-b border-[rgba(255,255,255,0.08)]">
              <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "800" }}>
                Cadastrar Novo Cliente
              </Text>
              <Pressable onPress={() => setCreateModalVisible(false)} className="p-1 rounded-lg">
                <X size={20} color="#ffffff" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
              <View className="gap-1.5">
                <Text style={{ color: "#9ca3af", fontSize: 12, fontWeight: "600" }}>NOME COMPLETO *</Text>
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Ex: Amanda Silva"
                  placeholderTextColor="#52525b"
                  style={{
                    backgroundColor: "#18191e",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    height: 44,
                    color: "#ffffff",
                    fontSize: 14,
                  }}
                />
              </View>

              <View className="gap-1.5">
                <Text style={{ color: "#9ca3af", fontSize: 12, fontWeight: "600" }}>WHATSAPP / TELEFONE</Text>
                <TextInput
                  value={newPhone}
                  onChangeText={setNewPhone}
                  placeholder="(11) 98888-7777"
                  placeholderTextColor="#52525b"
                  keyboardType="phone-pad"
                  style={{
                    backgroundColor: "#18191e",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    height: 44,
                    color: "#ffffff",
                    fontSize: 14,
                  }}
                />
              </View>

              <View className="gap-1.5">
                <Text style={{ color: "#9ca3af", fontSize: 12, fontWeight: "600" }}>E-MAIL (OPCIONAL)</Text>
                <TextInput
                  value={newEmail}
                  onChangeText={setNewEmail}
                  placeholder="amanda@exemplo.com"
                  placeholderTextColor="#52525b"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={{
                    backgroundColor: "#18191e",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    height: 44,
                    color: "#ffffff",
                    fontSize: 14,
                  }}
                />
              </View>

              <View className="gap-1.5">
                <Text style={{ color: "#9ca3af", fontSize: 12, fontWeight: "600" }}>OBSERVAÇÕES (OPCIONAL)</Text>
                <TextInput
                  value={newNotes}
                  onChangeText={setNewNotes}
                  placeholder="Preferências, histórico ou alergias..."
                  placeholderTextColor="#52525b"
                  multiline
                  numberOfLines={2}
                  style={{
                    backgroundColor: "#18191e",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    height: 60,
                    color: "#ffffff",
                    fontSize: 13,
                    textAlignVertical: "top",
                  }}
                />
              </View>

              <Pressable
                onPress={handleCreateClient}
                disabled={savingClient}
                className="items-center justify-center py-3.5 rounded-xl"
                style={{
                  backgroundColor: primaryColor,
                }}
              >
                {savingClient ? (
                  <ActivityIndicator size="small" color={primaryForeground} />
                ) : (
                  <Text style={{ color: primaryForeground, fontSize: 14, fontWeight: "700" }}>
                    Cadastrar Cliente
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
