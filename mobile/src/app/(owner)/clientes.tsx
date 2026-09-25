import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { Image as ExpoImage } from "expo-image";
import {
  ArrowUpDown,
  Calendar,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Copy,
  Edit3,
  ExternalLink,
  FileText,
  ImagePlus,
  Lightbulb,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Share2,
  Sparkles,
  Trash2,
  TrendingUp,
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
import { PageHeader } from "@/components/ui/page-header";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { ResponsiveTabs } from "@/components/ui/responsive-tabs";
import { useTheme } from "@/hooks/use-theme";
import { useResponsive } from "@/hooks/use-responsive";
import { scaleFont } from "@/lib/responsive";
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

function formatCreationDate(dateStr?: string | null): string {
  if (!dateStr) return "18/09/2026";
  try {
    const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00`);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)})${digits.slice(2)}`;
  return `(${digits.slice(0, 2)})${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 11;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "C";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ClientesScreen() {
  const { session } = useSession();
  const { isDark, primaryColor, primaryForeground, colors } = useTheme();
  const { isCompact, isTablet } = useResponsive();
  const [clients, setClients] = useState<ClientDTO[] | null>(null);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ClientTab>("all");
  const [sortBy, setSortBy] = useState<ClientSort>("visits-desc");
  const [inactiveDays, setInactiveDays] = useState<30 | 45 | 60 | 90>(30);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Soft primary accent background
  const primarySoft = useMemo(() => {
    if (primaryColor.startsWith("#") && primaryColor.length === 7) {
      return `${primaryColor}22`;
    }
    return "rgba(220, 255, 76, 0.14)";
  }, [primaryColor]);

  // Modals
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientDTO | null>(null);
  const [selectedClientDetail, setSelectedClientDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Load detailed client data on selection
  useEffect(() => {
    if (!selectedClient?.id) {
      setSelectedClientDetail(null);
      return;
    }
    let isMounted = true;
    async function fetchDetail() {
      setLoadingDetail(true);
      try {
        const data = await api<any>(`/api/clients/${selectedClient?.id}`);
        if (isMounted) setSelectedClientDetail(data);
      } catch {
        // fallback to selectedClient
      } finally {
        if (isMounted) setLoadingDetail(false);
      }
    }
    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [selectedClient?.id]);

  // New Client Form State
  const [savingClient, setSavingClient] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newPhotoUrl, setNewPhotoUrl] = useState<string | null>(null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);

  // Edit Client Form State
  const [editingClient, setEditingClient] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editPhotoUrl, setEditPhotoUrl] = useState<string | null>(null);
  const [editPreparingPhoto, setEditPreparingPhoto] = useState(false);
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

  const handlePickNewPhoto = async () => {
    setPreparingPhoto(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        base64: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const dataUrl = asset.base64
          ? `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`
          : asset.uri;
        setNewPhotoUrl(dataUrl);
      }
    } catch {
      Alert.alert("Erro", "Não foi possível carregar a foto do cliente.");
    } finally {
      setPreparingPhoto(false);
    }
  };

  const handlePickEditPhoto = async () => {
    setEditPreparingPhoto(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        base64: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const dataUrl = asset.base64
          ? `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`
          : asset.uri;
        setEditPhotoUrl(dataUrl);
      }
    } catch {
      Alert.alert("Erro", "Não foi possível carregar a foto do cliente.");
    } finally {
      setEditPreparingPhoto(false);
    }
  };

  const handleCreateClient = async () => {
    if (!newName.trim() || newName.trim().length < 2) {
      Alert.alert("Aviso", "Digite o nome completo do cliente.");
      return;
    }
    const nextPhone = formatPhone(newPhone);
    if (!newPhone.trim() || !isValidPhone(nextPhone)) {
      Alert.alert("Aviso", "Digite um telefone celular válido no formato (XX) XXXXX-XXXX.");
      return;
    }
    const trimmedEmail = newEmail.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      Alert.alert("Aviso", "Digite um e-mail válido ou deixe o campo vazio.");
      return;
    }

    setSavingClient(true);
    try {
      await api("/api/clients", {
        method: "POST",
        body: JSON.stringify({
          name: newName.trim(),
          phone: nextPhone,
          email: trimmedEmail || undefined,
          photoUrl: newPhotoUrl || undefined,
          notes: newNotes.trim() || undefined,
        }),
      });

      setCreateModalVisible(false);
      setNewName("");
      setNewPhone("");
      setNewEmail("");
      setNewNotes("");
      setNewPhotoUrl(null);
      await load(query);
      Alert.alert("Sucesso", "Cliente cadastrado com sucesso!");
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível cadastrar o cliente.");
    } finally {
      setSavingClient(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert("Copiado!", `${label} copiado para a área de transferência.`);
    } catch {
      Alert.alert("Aviso", text);
    }
  };

  const handleOpenEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`).catch(() => {
      Alert.alert("Erro", "Não foi possível abrir o aplicativo de e-mail.");
    });
  };

  const handleOpenEdit = (client: ClientDTO) => {
    setEditName(client.name);
    setEditPhone(client.phone ? formatPhone(client.phone) : "");
    setEditEmail(client.email || "");
    setEditNotes(client.notes || "");
    setEditPhotoUrl(client.photoUrl || null);
    setEditingClient(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedClient) return;
    if (!editName.trim() || editName.trim().length < 2) {
      Alert.alert("Aviso", "Digite o nome completo do cliente.");
      return;
    }
    const nextPhone = formatPhone(editPhone);
    if (!editPhone.trim() || !isValidPhone(nextPhone)) {
      Alert.alert("Aviso", "Digite um telefone celular válido no formato (XX) XXXXX-XXXX.");
      return;
    }
    const trimmedEmail = editEmail.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      Alert.alert("Aviso", "Digite um e-mail válido ou deixe o campo vazio.");
      return;
    }

    setSavingEdit(true);
    try {
      await api(`/api/clients/${selectedClient.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName.trim(),
          phone: nextPhone,
          email: trimmedEmail || null,
          photoUrl: editPhotoUrl,
          notes: editNotes.trim() || null,
        }),
      });

      const updatedClient: ClientDTO = {
        ...selectedClient,
        name: editName.trim(),
        phone: nextPhone,
        email: trimmedEmail || null,
        photoUrl: editPhotoUrl,
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
      header={<TopBar title="Clientes" company={session?.company?.name} />}
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
        <PageHeader
          eyebrow="BASE DE RELACIONAMENTO"
          title="Clientes"
          subtitle={`${totalClients} ${totalClients === 1 ? "pessoa já faz" : "pessoas já fazem"} parte da sua história.`}
          action={
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
          }
        />

        {/* 2. Metrics Grid (Matching Web KPIs Exactly) */}
        <View className="gap-2.5">
          <View className={isTablet ? "flex-row gap-2.5 flex-wrap" : "flex-row gap-2.5"}>
            {/* Card 1: Total de clientes */}
            <View
              className="flex-1 p-4 rounded-2xl border"
              style={{
                backgroundColor: "#121318",
                borderColor: "rgba(255, 255, 255, 0.08)",
                minWidth: isTablet ? "23%" : undefined,
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
              <Text style={{ color: "#9ca3af", fontSize: scaleFont(12, { min: 10.5, max: 13 }), fontWeight: "500", marginTop: 10 }}>
                Total de clientes
              </Text>
              <Text style={{ color: "#ffffff", fontSize: scaleFont(24, { min: 20, max: 26 }), fontWeight: "800", marginTop: 2 }}>
                {totalClients}
              </Text>
              <Text style={{ color: "#71717a", fontSize: scaleFont(11.5, { min: 10, max: 12.5 }), marginTop: 2 }}>
                base cadastrada
              </Text>
            </View>

            {/* Card 2: Clientes mensalistas */}
            <View
              className="flex-1 p-4 rounded-2xl border"
              style={{
                backgroundColor: "#121318",
                borderColor: "rgba(255, 255, 255, 0.08)",
                minWidth: isTablet ? "23%" : undefined,
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
              <Text style={{ color: "#9ca3af", fontSize: scaleFont(12, { min: 10.5, max: 13 }), fontWeight: "500", marginTop: 10 }}>
                Clientes mensalistas
              </Text>
              <Text style={{ color: "#ffffff", fontSize: scaleFont(24, { min: 20, max: 26 }), fontWeight: "800", marginTop: 2 }}>
                {membershipClients.length}
              </Text>
              <Text style={{ color: "#71717a", fontSize: scaleFont(11.5, { min: 10, max: 12.5 }), marginTop: 2 }}>
                planos recorrentes
              </Text>
            </View>
          </View>

          <View className={isTablet ? "flex-row gap-2.5 flex-wrap" : "flex-row gap-2.5"}>
            {/* Card 3: Clientes frequentes */}
            <View
              className="flex-1 p-4 rounded-2xl border"
              style={{
                backgroundColor: "#121318",
                borderColor: "rgba(255, 255, 255, 0.08)",
                minWidth: isTablet ? "23%" : undefined,
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
              <Text style={{ color: "#9ca3af", fontSize: scaleFont(12, { min: 10.5, max: 13 }), fontWeight: "500", marginTop: 10 }}>
                Clientes frequentes
              </Text>
              <Text style={{ color: "#ffffff", fontSize: scaleFont(24, { min: 20, max: 26 }), fontWeight: "800", marginTop: 2 }}>
                {vipClients.length}
              </Text>
              <Text style={{ color: "#71717a", fontSize: scaleFont(11.5, { min: 10, max: 12.5 }), marginTop: 2 }}>
                {retentionRate}% taxa de retenção
              </Text>
            </View>

            {/* Card 4: Ticket médio */}
            <View
              className="flex-1 p-4 rounded-2xl border"
              style={{
                backgroundColor: "#121318",
                borderColor: "rgba(255, 255, 255, 0.08)",
                minWidth: isTablet ? "23%" : undefined,
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
              <Text style={{ color: "#9ca3af", fontSize: scaleFont(12, { min: 10.5, max: 13 }), fontWeight: "500", marginTop: 10 }}>
                Ticket médio
              </Text>
              <Text style={{ color: "#ffffff", fontSize: scaleFont(24, { min: 20, max: 26 }), fontWeight: "800", marginTop: 2 }}>
                {formatCurrency(averageTicket)}
              </Text>
              <Text style={{ color: "#71717a", fontSize: scaleFont(11.5, { min: 10, max: 12.5 }), marginTop: 2 }}>
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
          {/* Segmented Responsive Filter Tabs */}
          <ResponsiveTabs
            tabs={tabs.map((t) => ({
              id: t.id,
              label: t.label,
              count: t.count,
              icon: t.icon,
            }))}
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id as ClientTab)}
          />

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
              const hasUpcoming = Boolean(client.nextVisit);

              return (
                <Pressable
                  key={client.id}
                  onPress={() => setSelectedClient(client)}
                  className="p-4 rounded-2xl border gap-3.5"
                  style={{
                    backgroundColor: "#111216",
                    borderColor: "rgba(255, 255, 255, 0.08)",
                  }}
                >
                  {/* 1. Header Row: Avatar + Name/Badges + Subtitle + Chevron */}
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3 flex-1 pr-2">
                      <Avatar name={client.name} photoUrl={client.photoUrl} size="md" />

                      <View className="flex-1 gap-1">
                        <View className="flex-row items-center gap-1.5 flex-wrap">
                          <Text
                            style={{
                              color: "#ffffff",
                              fontSize: 15.5,
                              fontWeight: "700",
                              letterSpacing: -0.2,
                            }}
                            numberOfLines={1}
                          >
                            {client.name}
                          </Text>

                          {client.isMembershipActive ? (
                            <View
                              className="px-2 py-0.5 rounded-full border"
                              style={{
                                backgroundColor: "rgba(168, 85, 247, 0.12)",
                                borderColor: "rgba(168, 85, 247, 0.3)",
                              }}
                            >
                              <Text
                                style={{
                                  color: "#c084fc",
                                  fontSize: 9.5,
                                  fontWeight: "800",
                                  letterSpacing: 0.3,
                                }}
                              >
                                MENSALISTA
                              </Text>
                            </View>
                          ) : isVip ? (
                            <View
                              className="px-2 py-0.5 rounded-full border"
                              style={{
                                backgroundColor: "rgba(245, 158, 11, 0.12)",
                                borderColor: "rgba(245, 158, 11, 0.3)",
                              }}
                            >
                              <Text
                                style={{
                                  color: "#fbbf24",
                                  fontSize: 9.5,
                                  fontWeight: "800",
                                  letterSpacing: 0.3,
                                }}
                              >
                                VIP
                              </Text>
                            </View>
                          ) : isFrequent ? (
                            <View
                              className="px-2 py-0.5 rounded-full border"
                              style={{
                                backgroundColor: "rgba(6, 182, 212, 0.12)",
                                borderColor: "rgba(6, 182, 212, 0.3)",
                              }}
                            >
                              <Text
                                style={{
                                  color: "#22d3ee",
                                  fontSize: 9.5,
                                  fontWeight: "800",
                                  letterSpacing: 0.3,
                                }}
                              >
                                FREQUENTE
                              </Text>
                            </View>
                          ) : isNew ? (
                            <View
                              className="px-2 py-0.5 rounded-full border"
                              style={{
                                backgroundColor: "rgba(16, 185, 129, 0.12)",
                                borderColor: "rgba(16, 185, 129, 0.3)",
                              }}
                            >
                              <Text
                                style={{
                                  color: "#34d399",
                                  fontSize: 9.5,
                                  fontWeight: "800",
                                  letterSpacing: 0.3,
                                }}
                              >
                                NOVO
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        <View className="flex-row items-center gap-2">
                          <Text
                            style={{ color: "#71717a", fontSize: 12, fontWeight: "500" }}
                            numberOfLines={1}
                          >
                            {client.email || (client.phone ? client.phone : "Sem telefone")}
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

                    <ChevronRight size={17} color="#52525b" />
                  </View>

                  {/* 2. Stats Row (Minimalist Flat Metrics) */}
                  <View
                    className="flex-row items-center justify-between py-2.5 px-3 rounded-xl border"
                    style={{
                      backgroundColor: "#16171d",
                      borderColor: "rgba(255, 255, 255, 0.04)",
                    }}
                  >
                    <View className="flex-1 items-center">
                      <Text style={{ color: "#71717a", fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Última Visita
                      </Text>
                      <Text style={{ color: "#e4e4e7", fontSize: 12.5, fontWeight: "700", marginTop: 2 }}>
                        {shortDate(client.lastVisit)}
                      </Text>
                    </View>

                    <View style={{ width: 1, height: 22, backgroundColor: "rgba(255, 255, 255, 0.06)" }} />

                    <View className="flex-1 items-center">
                      <Text style={{ color: "#71717a", fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Atendimentos
                      </Text>
                      <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "700", marginTop: 2 }}>
                        {client.visits || 0} {client.visits === 1 ? "visita" : "visitas"}
                      </Text>
                    </View>

                    <View style={{ width: 1, height: 22, backgroundColor: "rgba(255, 255, 255, 0.06)" }} />

                    <View className="flex-1 items-center">
                      <Text style={{ color: "#71717a", fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Total Gasto
                      </Text>
                      <Text style={{ color: "#10b981", fontSize: 12.5, fontWeight: "700", marginTop: 2 }}>
                        {formatCurrency(client.spent)}
                      </Text>
                    </View>
                  </View>

                  {/* 3. Action Buttons Row (Contato | Agendar | Ficha) */}
                  <View className="flex-row items-center gap-2 pt-0.5">
                    {client.phone ? (
                      <Pressable
                        onPress={() => handleOpenWhatsApp(client)}
                        className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border"
                        style={{
                          backgroundColor: "rgba(34, 197, 94, 0.08)",
                          borderColor: "rgba(34, 197, 94, 0.22)",
                          height: 38,
                        }}
                      >
                        <WhatsAppIcon size={14} />
                        <Text
                          style={{
                            color: "#22c55e",
                            fontSize: 12.5,
                            fontWeight: "700",
                            letterSpacing: 0.2,
                          }}
                        >
                          Contato
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
                      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border"
                      style={{
                        backgroundColor: "#17181f",
                        borderColor: "rgba(255, 255, 255, 0.08)",
                        height: 38,
                      }}
                    >
                      <CalendarPlus size={14} color="#9ca3af" />
                      <Text style={{ color: "#e4e4e7", fontSize: 12.5, fontWeight: "600" }}>
                        Agendar
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setSelectedClient(client)}
                      className="px-3.5 rounded-xl border items-center justify-center"
                      style={{
                        backgroundColor: "#17181f",
                        borderColor: "rgba(255, 255, 255, 0.08)",
                        height: 38,
                      }}
                    >
                      <Text style={{ color: "#9ca3af", fontSize: 12.5, fontWeight: "600" }}>
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
        <View style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.75)", justifyContent: "flex-end" }}>
          <Pressable
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={() => setSelectedClient(null)}
          />
          <View
            style={{
              maxHeight: "92%",
              backgroundColor: "#111215",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderTopWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.12)",
              paddingHorizontal: 20,
              paddingTop: 18,
              paddingBottom: 28,
              gap: 16,
            }}
          >
            {/* Modal Header */}
            {(() => {
              const currentClient = selectedClientDetail ?? selectedClient;
              const isVip = Boolean(
                (selectedClientDetail?.visits ?? currentClient?.visits ?? 0) >= 3 ||
                ((selectedClientDetail?.spent ?? currentClient?.spent ?? 0) >= 250)
              );
              const isFrequent = Boolean(!isVip && (selectedClientDetail?.visits ?? currentClient?.visits ?? 0) >= 2);
              const isNew = Boolean(!isVip && !isFrequent);

              return (
                <>
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
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <User size={18} color="#ffffff" />
                      <Text style={{ color: "#ffffff", fontSize: 17, fontWeight: "800" }}>
                        {currentClient?.name}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setSelectedClient(null)}
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
                    </Pressable>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 16 }}>
                    {/* Hero Section */}
                    <View style={{ alignItems: "center", paddingTop: 4, paddingBottom: 2 }}>
                      <View
                        style={{
                          width: 76,
                          height: 76,
                          borderRadius: 38,
                          backgroundColor: "#20232b",
                          borderWidth: 2,
                          borderColor: "rgba(255, 255, 255, 0.15)",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                        }}
                      >
                        {currentClient?.photoUrl ? (
                          <ExpoImage
                            source={{ uri: currentClient.photoUrl }}
                            style={{ width: 76, height: 76, borderRadius: 38 }}
                            contentFit="cover"
                          />
                        ) : (
                          <Text style={{ color: primaryColor, fontSize: 24, fontWeight: "800" }}>
                            {getInitials(currentClient?.name || "C")}
                          </Text>
                        )}
                      </View>

                      <Text style={{ color: "#ffffff", fontSize: 21, fontWeight: "800", marginTop: 10, textAlign: "center" }}>
                        {currentClient?.name}
                      </Text>

                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
                        {isVip ? (
                          <View
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 2.5,
                              borderRadius: 9999,
                              backgroundColor: "rgba(245, 158, 11, 0.12)",
                              borderWidth: 1,
                              borderColor: "rgba(245, 158, 11, 0.4)",
                            }}
                          >
                            <Text style={{ color: "#f59e0b", fontSize: 10.5, fontWeight: "800", letterSpacing: 0.5 }}>VIP</Text>
                          </View>
                        ) : isFrequent ? (
                          <View
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 2.5,
                              borderRadius: 9999,
                              backgroundColor: "rgba(52, 211, 153, 0.12)",
                              borderWidth: 1,
                              borderColor: "rgba(52, 211, 153, 0.4)",
                            }}
                          >
                            <Text style={{ color: "#34d399", fontSize: 10.5, fontWeight: "800", letterSpacing: 0.5 }}>FREQUENTE</Text>
                          </View>
                        ) : (
                          <View
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 2.5,
                              borderRadius: 9999,
                              backgroundColor: "rgba(16, 185, 129, 0.12)",
                              borderWidth: 1,
                              borderColor: "rgba(16, 185, 129, 0.4)",
                            }}
                          >
                            <Text style={{ color: "#10b981", fontSize: 10.5, fontWeight: "800", letterSpacing: 0.5 }}>NOVO</Text>
                          </View>
                        )}
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Calendar size={12} color="#9ca3af" />
                          <Text style={{ color: "#9ca3af", fontSize: 12 }}>
                            Desde {formatCreationDate(selectedClientDetail?.createdAt || currentClient?.createdAt)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={{ gap: 8 }}>
                      {/* Top Row: Agendar + WhatsApp */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Pressable
                          onPress={() => {
                            if (!currentClient) return;
                            setSelectedClient(null);
                            router.push({
                              pathname: "/(owner)/agenda",
                              params: { newForClient: currentClient.id },
                            } as any);
                          }}
                          style={{
                            flex: 1,
                            backgroundColor: primaryColor,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            paddingVertical: 12,
                            borderRadius: 12,
                          }}
                        >
                          <CalendarPlus size={16} color={primaryForeground} />
                          <Text style={{ color: primaryForeground, fontSize: 13.5, fontWeight: "700" }}>
                            Agendar
                          </Text>
                        </Pressable>

                        {currentClient?.phone ? (
                          <Pressable
                            onPress={() => handleOpenWhatsApp(currentClient)}
                            style={{
                              flex: 1,
                              backgroundColor: "rgba(34, 197, 94, 0.12)",
                              borderWidth: 1,
                              borderColor: "rgba(34, 197, 94, 0.3)",
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                              paddingVertical: 12,
                              borderRadius: 12,
                            }}
                          >
                            <WhatsAppIcon size={16} />
                            <Text style={{ color: "#22c55e", fontSize: 13.5, fontWeight: "700" }}>
                              WhatsApp
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>

                      {/* Row 2: Editar */}
                      <Pressable
                        onPress={() => handleOpenEdit(currentClient)}
                        style={{
                          width: "100%",
                          backgroundColor: "#181920",
                          borderWidth: 1,
                          borderColor: "rgba(255, 255, 255, 0.08)",
                          borderRadius: 12,
                          paddingVertical: 12,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                        }}
                      >
                        <Pencil size={15} color="#ffffff" />
                        <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "700" }}>
                          Editar
                        </Text>
                      </Pressable>

                      {/* Row 3: Excluir */}
                      <Pressable
                        onPress={() => handleDeleteClient(currentClient)}
                        style={{
                          width: "100%",
                          backgroundColor: "rgba(239, 68, 68, 0.06)",
                          borderWidth: 1,
                          borderColor: "rgba(239, 68, 68, 0.2)",
                          borderRadius: 12,
                          paddingVertical: 12,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                        }}
                      >
                        <Trash2 size={15} color="#ef4444" />
                        <Text style={{ color: "#ef4444", fontSize: 13.5, fontWeight: "700" }}>
                          Excluir
                        </Text>
                      </Pressable>
                    </View>

                    {/* Customer Membership Card */}
                    <View
                      style={{
                        backgroundColor: "#1c172a",
                        borderWidth: 1,
                        borderColor: "rgba(168, 85, 247, 0.3)",
                        borderRadius: 14,
                        padding: 16,
                        gap: 12,
                      }}
                    >
                      <View style={{ gap: 6 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <View
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              backgroundColor: "rgba(168, 85, 247, 0.18)",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Sparkles size={14} color="#c084fc" />
                          </View>
                          <Text style={{ color: "#ffffff", fontSize: 14.5, fontWeight: "700" }}>
                            {selectedClientDetail?.membership?.status === "active"
                              ? `Plano: ${selectedClientDetail.membership.planName || "Plano Mensal"}`
                              : "Cliente Avulso (Sem Plano)"}
                          </Text>
                        </View>
                        <Text style={{ color: "#9ca3af", fontSize: 12, lineHeight: 17 }}>
                          {selectedClientDetail?.membership?.status === "active"
                            ? "Cliente possui assinatura recorrente ativa com benefícios vinculados."
                            : "Fidelize este cliente com uma mensalidade recorrente e horários garantidos."}
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => {
                          Alert.alert(
                            "Planos de Assinatura",
                            "A gestão completa de planos mensais e faturas está disponível no painel web da Agenda."
                          );
                        }}
                        style={{
                          borderWidth: 1,
                          borderColor: "rgba(168, 85, 247, 0.35)",
                          backgroundColor: "rgba(168, 85, 247, 0.1)",
                          borderRadius: 10,
                          paddingVertical: 11,
                          alignItems: "center",
                          justifyContent: "center",
                          flexDirection: "row",
                          gap: 6,
                        }}
                      >
                        <Text style={{ color: "#e9d5ff", fontSize: 13, fontWeight: "700" }}>
                          {selectedClientDetail?.membership?.status === "active"
                            ? "Gerenciar Plano Mensal"
                            : "+ Vincular Plano Mensal"}
                        </Text>
                      </Pressable>
                    </View>

                    {/* Contact Information Card */}
                    {(currentClient?.phone || currentClient?.email) && (
                      <View
                        style={{
                          backgroundColor: "#14151b",
                          borderWidth: 1,
                          borderColor: "rgba(255, 255, 255, 0.08)",
                          borderRadius: 14,
                          padding: 14,
                          gap: 12,
                        }}
                      >
                        {currentClient?.phone ? (
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                              <View
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 8,
                                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <Phone size={14} color="#9ca3af" />
                              </View>
                              <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "600" }}>
                                {currentClient.phone}
                              </Text>
                            </View>
                            <Pressable
                              onPress={() => copyToClipboard(currentClient.phone!, "Telefone")}
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 5,
                                backgroundColor: "rgba(255, 255, 255, 0.06)",
                                borderWidth: 1,
                                borderColor: "rgba(255, 255, 255, 0.1)",
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 8,
                              }}
                            >
                              <Copy size={12} color="#9ca3af" />
                              <Text style={{ color: "#d1d5db", fontSize: 12, fontWeight: "600" }}>
                                Copiar
                              </Text>
                            </Pressable>
                          </View>
                        ) : null}

                        {currentClient?.email ? (
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, marginRight: 8 }}>
                              <View
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 8,
                                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <Mail size={14} color="#9ca3af" />
                              </View>
                              <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "600", flex: 1 }} numberOfLines={1}>
                                {currentClient.email}
                              </Text>
                            </View>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Pressable
                                onPress={() => handleOpenEmail(currentClient.email!)}
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 5,
                                  backgroundColor: "rgba(255, 255, 255, 0.06)",
                                  borderWidth: 1,
                                  borderColor: "rgba(255, 255, 255, 0.1)",
                                  paddingHorizontal: 10,
                                  paddingVertical: 6,
                                  borderRadius: 8,
                                }}
                              >
                                <ExternalLink size={12} color="#9ca3af" />
                                <Text style={{ color: "#d1d5db", fontSize: 12, fontWeight: "600" }}>
                                  E-mail
                                </Text>
                              </Pressable>
                              <Pressable
                                onPress={() => copyToClipboard(currentClient.email!, "E-mail")}
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 5,
                                  backgroundColor: "rgba(255, 255, 255, 0.06)",
                                  borderWidth: 1,
                                  borderColor: "rgba(255, 255, 255, 0.1)",
                                  paddingHorizontal: 10,
                                  paddingVertical: 6,
                                  borderRadius: 8,
                                }}
                              >
                                <Copy size={12} color="#9ca3af" />
                                <Text style={{ color: "#d1d5db", fontSize: 12, fontWeight: "600" }}>
                                  Copiar
                                </Text>
                              </Pressable>
                            </View>
                          </View>
                        ) : null}
                      </View>
                    )}

                    {/* 2x2 Stats Grid */}
                    <View style={{ gap: 10 }}>
                      <View style={{ flexDirection: "row", gap: 10 }}>
                        {/* Box 1: Total gasto */}
                        <View
                          style={{
                            flex: 1,
                            backgroundColor: "#14151b",
                            borderWidth: 1,
                            borderColor: "rgba(255, 255, 255, 0.08)",
                            borderRadius: 14,
                            padding: 14,
                          }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <Text style={{ color: "#8a94a6", fontSize: 12, fontWeight: "600" }}>
                              Total gasto
                            </Text>
                            <View
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: 6,
                                backgroundColor: "rgba(255, 255, 255, 0.04)",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <CircleDollarSign size={15} color="#71717a" />
                            </View>
                          </View>
                          <Text style={{ color: "#10b981", fontSize: 18, fontWeight: "800", marginTop: 8 }}>
                            {formatCurrency(selectedClientDetail?.spent ?? currentClient?.spent ?? 0)}
                          </Text>
                        </View>

                        {/* Box 2: Atendimentos */}
                        <View
                          style={{
                            flex: 1,
                            backgroundColor: "#14151b",
                            borderWidth: 1,
                            borderColor: "rgba(255, 255, 255, 0.08)",
                            borderRadius: 14,
                            padding: 14,
                          }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <Text style={{ color: "#8a94a6", fontSize: 12, fontWeight: "600" }}>
                              Atendimentos
                            </Text>
                            <View
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: 6,
                                backgroundColor: "rgba(255, 255, 255, 0.04)",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <CalendarDays size={15} color="#71717a" />
                            </View>
                          </View>
                          <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "800", marginTop: 8 }}>
                            {selectedClientDetail?.visits ?? currentClient?.visits ?? 0}
                          </Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: "row", gap: 10 }}>
                        {/* Box 3: Ticket médio */}
                        <View
                          style={{
                            flex: 1,
                            backgroundColor: "#14151b",
                            borderWidth: 1,
                            borderColor: "rgba(255, 255, 255, 0.08)",
                            borderRadius: 14,
                            padding: 14,
                          }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <Text style={{ color: "#8a94a6", fontSize: 12, fontWeight: "600" }}>
                              Ticket médio
                            </Text>
                            <View
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: 6,
                                backgroundColor: "rgba(255, 255, 255, 0.04)",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <TrendingUp size={15} color="#71717a" />
                            </View>
                          </View>
                          <Text style={{ color: "#10b981", fontSize: 18, fontWeight: "800", marginTop: 8 }}>
                            {formatCurrency(
                              selectedClientDetail?.averageTicket ??
                                ((currentClient?.visits ?? 0) > 0
                                  ? Math.round((currentClient?.spent || 0) / (currentClient?.visits || 1))
                                  : 0)
                            )}
                          </Text>
                        </View>

                        {/* Box 4: Última visita */}
                        <View
                          style={{
                            flex: 1,
                            backgroundColor: "#14151b",
                            borderWidth: 1,
                            borderColor: "rgba(255, 255, 255, 0.08)",
                            borderRadius: 14,
                            padding: 14,
                          }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <Text style={{ color: "#8a94a6", fontSize: 12, fontWeight: "600" }}>
                              Última visita
                            </Text>
                            <View
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: 6,
                                backgroundColor: "rgba(255, 255, 255, 0.04)",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Clock3 size={15} color="#71717a" />
                            </View>
                          </View>
                          <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "800", marginTop: 8 }}>
                            {selectedClientDetail?.lastVisit ? shortDate(selectedClientDetail.lastVisit) : currentClient?.lastVisit ? shortDate(currentClient.lastVisit) : "—"}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Client Observations */}
                    {currentClient?.notes ? (
                      <View
                        style={{
                          backgroundColor: "#14151b",
                          borderWidth: 1,
                          borderColor: "rgba(255, 255, 255, 0.08)",
                          borderRadius: 14,
                          padding: 14,
                          gap: 6,
                        }}
                      >
                        <Text style={{ color: "#8a94a6", fontSize: 12, fontWeight: "600" }}>
                          Observações do cliente
                        </Text>
                        <Text style={{ color: "#d1d5db", fontSize: 13, lineHeight: 18 }}>
                          {currentClient.notes}
                        </Text>
                      </View>
                    ) : null}

                    {/* Internal Notes Editor */}
                    <View
                      style={{
                        backgroundColor: "#14151b",
                        borderWidth: 1,
                        borderColor: "rgba(255, 255, 255, 0.08)",
                        borderRadius: 14,
                        padding: 14,
                        gap: 8,
                      }}
                    >
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
                        style={{
                          backgroundColor: "#1e2026",
                          borderColor: "rgba(255, 255, 255, 0.15)",
                          borderWidth: 1,
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderRadius: 8,
                          alignSelf: "flex-end",
                        }}
                      >
                        <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "700" }}>
                          {savingInternalNotes ? "Salvando..." : "Salvar notas"}
                        </Text>
                      </Pressable>
                    </View>
                  </ScrollView>
                </>
              );
            })()}
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
        <View style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.75)", justifyContent: "flex-end" }}>
          <Pressable
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={() => setEditingClient(false)}
          />
          <View
            style={{
              backgroundColor: "#111215",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderTopWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.12)",
              maxHeight: "92%",
              paddingHorizontal: 20,
              paddingTop: 18,
              paddingBottom: 28,
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: primarySoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Pencil size={18} color={primaryColor} />
                </View>
                <View>
                  <Text style={{ color: primaryColor, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 }}>
                    Ficha cadastral
                  </Text>
                  <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "800" }}>
                    Editar cliente
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => setEditingClient(false)}
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
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 12 }}>
              {/* Photo Card */}
              <View
                style={{
                  backgroundColor: "#16181f",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.08)",
                  borderRadius: 14,
                  padding: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <View
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 30,
                    backgroundColor: "#20232b",
                    borderWidth: 1.5,
                    borderColor: "rgba(255, 255, 255, 0.12)",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {editPhotoUrl ? (
                    <ExpoImage
                      source={{ uri: editPhotoUrl }}
                      style={{ width: 60, height: 60, borderRadius: 30 }}
                      contentFit="cover"
                    />
                  ) : (
                    <Text style={{ color: primaryColor, fontSize: 18, fontWeight: "800" }}>
                      {getInitials(editName || "Cliente")}
                    </Text>
                  )}
                </View>

                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "700" }}>
                    Foto do cliente
                  </Text>
                  <Text style={{ color: "#8a94a6", fontSize: 11.5 }}>
                    JPG, PNG ou WEBP · opcional
                  </Text>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <Pressable
                      onPress={handlePickEditPhoto}
                      disabled={editPreparingPhoto}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        backgroundColor: "rgba(255, 255, 255, 0.08)",
                        borderWidth: 1,
                        borderColor: "rgba(255, 255, 255, 0.12)",
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 8,
                      }}
                    >
                      {editPreparingPhoto ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <>
                          <ImagePlus size={14} color="#ffffff" />
                          <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "600" }}>
                            {editPhotoUrl ? "Alterar foto" : "Adicionar foto"}
                          </Text>
                        </>
                      )}
                    </Pressable>

                    {editPhotoUrl && (
                      <Pressable
                        onPress={() => setEditPhotoUrl(null)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          paddingHorizontal: 8,
                          paddingVertical: 7,
                          borderRadius: 8,
                        }}
                      >
                        <Trash2 size={13} color="#ef4444" />
                        <Text style={{ color: "#ef4444", fontSize: 12, fontWeight: "600" }}>
                          Remover
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>

              {/* Field: Nome completo */}
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <User size={14} color="#94a3b8" />
                  <Text style={{ color: "#94a3b8", fontSize: 12.5, fontWeight: "600" }}>
                    Nome completo *
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#18191e",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    height: 46,
                    gap: 10,
                  }}
                >
                  <User size={17} color="#6b7280" />
                  <TextInput
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Ex.: Fernanda Almeida"
                    placeholderTextColor="#52525b"
                    style={{
                      flex: 1,
                      color: "#ffffff",
                      fontSize: 13.5,
                    }}
                  />
                </View>
              </View>

              {/* Field: Telefone / WhatsApp */}
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Phone size={14} color="#94a3b8" />
                  <Text style={{ color: "#94a3b8", fontSize: 12.5, fontWeight: "600" }}>
                    Telefone / WhatsApp *
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#18191e",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    height: 46,
                    gap: 10,
                  }}
                >
                  <Phone size={17} color="#6b7280" />
                  <TextInput
                    value={editPhone}
                    onChangeText={(text) => setEditPhone(formatPhone(text))}
                    placeholder="(11) 99999-9999"
                    placeholderTextColor="#52525b"
                    keyboardType="phone-pad"
                    style={{
                      flex: 1,
                      color: "#ffffff",
                      fontSize: 13.5,
                    }}
                  />
                </View>
              </View>

              {/* Field: E-mail */}
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Mail size={14} color="#94a3b8" />
                  <Text style={{ color: "#94a3b8", fontSize: 12.5, fontWeight: "600" }}>
                    E-mail (opcional)
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#18191e",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    height: 46,
                    gap: 10,
                  }}
                >
                  <Mail size={17} color="#6b7280" />
                  <TextInput
                    value={editEmail}
                    onChangeText={setEditEmail}
                    placeholder="seuemail@dominio.com"
                    placeholderTextColor="#52525b"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={{
                      flex: 1,
                      color: "#ffffff",
                      fontSize: 13.5,
                    }}
                  />
                </View>
              </View>

              {/* Field: Observações */}
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <FileText size={14} color="#94a3b8" />
                  <Text style={{ color: "#94a3b8", fontSize: 12.5, fontWeight: "600" }}>
                    Observações (opcional)
                  </Text>
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
                    paddingTop: 10,
                    minHeight: 80,
                    gap: 10,
                  }}
                >
                  <FileText size={17} color="#6b7280" style={{ marginTop: 2 }} />
                  <TextInput
                    value={editNotes}
                    onChangeText={setEditNotes}
                    placeholder="Preferências ou dados relevantes do cliente..."
                    placeholderTextColor="#52525b"
                    multiline
                    numberOfLines={3}
                    style={{
                      flex: 1,
                      color: "#ffffff",
                      fontSize: 13.5,
                      textAlignVertical: "top",
                      minHeight: 60,
                    }}
                  />
                </View>
              </View>

              {/* Footer Actions */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 10,
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: "rgba(255, 255, 255, 0.08)",
                }}
              >
                <Pressable
                  onPress={() => setEditingClient(false)}
                  style={{
                    paddingVertical: 11,
                    paddingHorizontal: 16,
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ color: "#9ca3af", fontSize: 13.5, fontWeight: "600" }}>
                    Cancelar
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleSaveEdit}
                  disabled={savingEdit}
                  style={{
                    backgroundColor: primaryColor,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    paddingVertical: 11,
                    paddingHorizontal: 18,
                    borderRadius: 10,
                  }}
                >
                  {savingEdit ? (
                    <ActivityIndicator size="small" color={primaryForeground} />
                  ) : (
                    <>
                      <Check size={16} color={primaryForeground} />
                      <Text style={{ color: primaryForeground, fontSize: 13.5, fontWeight: "700" }}>
                        Salvar alterações
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
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
        <View style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.75)", justifyContent: "flex-end" }}>
          <Pressable
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={() => setCreateModalVisible(false)}
          />
          <View
            style={{
              backgroundColor: "#111215",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderTopWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.12)",
              maxHeight: "92%",
              paddingHorizontal: 20,
              paddingTop: 18,
              paddingBottom: 28,
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: primarySoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <UserPlus size={20} color={primaryColor} />
                </View>
                <View>
                  <Text style={{ color: primaryColor, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 }}>
                    Adicionar à sua base
                  </Text>
                  <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "800" }}>
                    Novo cliente
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => setCreateModalVisible(false)}
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
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 12 }}>
              {/* Photo Card */}
              <View
                style={{
                  backgroundColor: "#16181f",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.08)",
                  borderRadius: 14,
                  padding: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <View
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 30,
                    backgroundColor: "#20232b",
                    borderWidth: 1.5,
                    borderColor: "rgba(255, 255, 255, 0.12)",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {newPhotoUrl ? (
                    <ExpoImage
                      source={{ uri: newPhotoUrl }}
                      style={{ width: 60, height: 60, borderRadius: 30 }}
                      contentFit="cover"
                    />
                  ) : (
                    <Text style={{ color: primaryColor, fontSize: 18, fontWeight: "800" }}>
                      {getInitials(newName || "Cliente")}
                    </Text>
                  )}
                </View>

                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "700" }}>
                    Foto do cliente
                  </Text>
                  <Text style={{ color: "#8a94a6", fontSize: 11.5 }}>
                    JPG, PNG ou WEBP · opcional
                  </Text>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <Pressable
                      onPress={handlePickNewPhoto}
                      disabled={preparingPhoto}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        backgroundColor: "rgba(255, 255, 255, 0.08)",
                        borderWidth: 1,
                        borderColor: "rgba(255, 255, 255, 0.12)",
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 8,
                      }}
                    >
                      {preparingPhoto ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <>
                          <ImagePlus size={14} color="#ffffff" />
                          <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "600" }}>
                            {newPhotoUrl ? "Alterar foto" : "Adicionar foto"}
                          </Text>
                        </>
                      )}
                    </Pressable>

                    {newPhotoUrl && (
                      <Pressable
                        onPress={() => setNewPhotoUrl(null)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          paddingHorizontal: 8,
                          paddingVertical: 7,
                          borderRadius: 8,
                        }}
                      >
                        <Trash2 size={13} color="#ef4444" />
                        <Text style={{ color: "#ef4444", fontSize: 12, fontWeight: "600" }}>
                          Remover
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>

              {/* Field: Nome completo */}
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <User size={14} color="#94a3b8" />
                  <Text style={{ color: "#94a3b8", fontSize: 12.5, fontWeight: "600" }}>
                    Nome completo *
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#18191e",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    height: 46,
                    gap: 10,
                  }}
                >
                  <User size={17} color="#6b7280" />
                  <TextInput
                    value={newName}
                    onChangeText={setNewName}
                    placeholder="Ex.: Fernanda Almeida"
                    placeholderTextColor="#52525b"
                    style={{
                      flex: 1,
                      color: "#ffffff",
                      fontSize: 13.5,
                    }}
                  />
                </View>
              </View>

              {/* Field: Telefone / WhatsApp */}
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Phone size={14} color="#94a3b8" />
                  <Text style={{ color: "#94a3b8", fontSize: 12.5, fontWeight: "600" }}>
                    Telefone / WhatsApp *
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#18191e",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    height: 46,
                    gap: 10,
                  }}
                >
                  <Phone size={17} color="#6b7280" />
                  <TextInput
                    value={newPhone}
                    onChangeText={(text) => setNewPhone(formatPhone(text))}
                    placeholder="(11) 99999-9999"
                    placeholderTextColor="#52525b"
                    keyboardType="phone-pad"
                    style={{
                      flex: 1,
                      color: "#ffffff",
                      fontSize: 13.5,
                    }}
                  />
                </View>
              </View>

              {/* Field: E-mail */}
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Mail size={14} color="#94a3b8" />
                  <Text style={{ color: "#94a3b8", fontSize: 12.5, fontWeight: "600" }}>
                    E-mail (opcional)
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#18191e",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    height: 46,
                    gap: 10,
                  }}
                >
                  <Mail size={17} color="#6b7280" />
                  <TextInput
                    value={newEmail}
                    onChangeText={setNewEmail}
                    placeholder="seuemail@dominio.com"
                    placeholderTextColor="#52525b"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={{
                      flex: 1,
                      color: "#ffffff",
                      fontSize: 13.5,
                    }}
                  />
                </View>
              </View>

              {/* Field: Observações */}
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <FileText size={14} color="#94a3b8" />
                  <Text style={{ color: "#94a3b8", fontSize: 12.5, fontWeight: "600" }}>
                    Observações (opcional)
                  </Text>
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
                    paddingTop: 10,
                    minHeight: 80,
                    gap: 10,
                  }}
                >
                  <FileText size={17} color="#6b7280" style={{ marginTop: 2 }} />
                  <TextInput
                    value={newNotes}
                    onChangeText={setNewNotes}
                    placeholder="Preferências ou dados relevantes do cliente..."
                    placeholderTextColor="#52525b"
                    multiline
                    numberOfLines={3}
                    style={{
                      flex: 1,
                      color: "#ffffff",
                      fontSize: 13.5,
                      textAlignVertical: "top",
                      minHeight: 60,
                    }}
                  />
                </View>
              </View>

              {/* Footer Actions */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 10,
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: "rgba(255, 255, 255, 0.08)",
                }}
              >
                <Pressable
                  onPress={() => setCreateModalVisible(false)}
                  style={{
                    paddingVertical: 11,
                    paddingHorizontal: 16,
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ color: "#9ca3af", fontSize: 13.5, fontWeight: "600" }}>
                    Cancelar
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleCreateClient}
                  disabled={savingClient}
                  style={{
                    backgroundColor: primaryColor,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    paddingVertical: 11,
                    paddingHorizontal: 18,
                    borderRadius: 10,
                  }}
                >
                  {savingClient ? (
                    <ActivityIndicator size="small" color={primaryForeground} />
                  ) : (
                    <>
                      <UserPlus size={16} color={primaryForeground} />
                      <Text style={{ color: primaryForeground, fontSize: 13.5, fontWeight: "700" }}>
                        Cadastrar cliente
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
