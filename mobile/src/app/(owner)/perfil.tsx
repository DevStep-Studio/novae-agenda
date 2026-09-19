import * as ImagePicker from "expo-image-picker";
import {
  ArrowRight,
  Building2,
  Check,
  Globe,
  ImageIcon,
  ImagePlus,
  LogOut,
  Palette,
  Settings2,
  Share2,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  User,
  UserRound,
} from "lucide-react-native";
import { Image } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";

import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { colors, radius } from "@/constants/design-tokens";
import { api, resolveImageUrl } from "@/lib/api-client";
import { useSession } from "@/lib/session-context";

export const PRIMARY_COLOR_PRESETS = [
  { id: "blue", name: "Azul Elétrico (Padrão)", hex: "#3b82f6" },
  { id: "emerald", name: "Esmeralda", hex: "#10b981" },
  { id: "lime", name: "Verde Neon", hex: "#dcff4c" },
  { id: "violet", name: "Violeta / Roxo", hex: "#8b5cf6" },
  { id: "gold", name: "Dourado / Âmbar", hex: "#f59e0b" },
  { id: "pink", name: "Rosa / Magenta", hex: "#ec4899" },
  { id: "coral", name: "Coral / Laranja", hex: "#f97316" },
  { id: "cyan", name: "Ciano / Turquesa", hex: "#06b6d4" },
  { id: "mono", name: "Monocromático / Branco", hex: "#f5f5f5" },
];

export const BANNER_PRESETS = [
  {
    id: "dark-minimal",
    name: "Minimal Escuro",
    url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "studio-noir",
    name: "Studio Noir",
    url: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "slate-flat",
    name: "Ardósia Flat",
    url: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "abstract-grid",
    name: "Linhas Modernas",
    url: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1200&q=80",
  },
];

export const AVATAR_PRESETS = [
  {
    id: "avatar-1",
    name: "Profissional",
    url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
  },
  {
    id: "avatar-2",
    name: "Especialista",
    url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
  },
  {
    id: "avatar-3",
    name: "Criativo",
    url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80",
  },
];

function isLightHex(hex: string): boolean {
  const clean = hex.replace("#", "").trim();
  let r = 0;
  let g = 0;
  let b = 0;
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else if (clean.length === 6) {
    r = parseInt(clean.substring(0, 2), 16);
    g = parseInt(clean.substring(2, 4), 16);
    b = parseInt(clean.substring(4, 6), 16);
  }
  return (r * 299 + g * 587 + b * 114) / 1000 > 140;
}

export default function PerfilPersonalizacaoScreen() {
  const { session, refresh, signOut } = useSession();

  const [activeTab, setActiveTab] = useState<"visual" | "dados" | "widgets" | "atalhos">("visual");
  const [saving, setSaving] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Profile Form States
  const [name, setName] = useState(session?.name || "Moa Tattoo");
  const [phone, setPhone] = useState(session?.phone || session?.company?.phone || "");
  const [companyName, setCompanyName] = useState(session?.company?.name || "Moa Tattoo");
  const [businessType, setBusinessType] = useState(session?.company?.businessType || "");
  const [primaryColor, setPrimaryColor] = useState(session?.company?.primaryColor || "#f5f5f5");
  const [avatarUrl, setAvatarUrl] = useState(
    session?.avatarUrl || session?.company?.logoUrl || ""
  );
  const [bannerUrl, setBannerUrl] = useState(session?.company?.bannerUrl || "");

  // Dashboard Preferences State
  const [dashboardPrefs, setDashboardPrefs] = useState(() => ({
    showBanner: session?.company?.dashboardPreferences?.showBanner ?? true,
    showChecklist: session?.company?.dashboardPreferences?.showChecklist ?? true,
    showKpis: session?.company?.dashboardPreferences?.showKpis ?? true,
    showSubmetrics: session?.company?.dashboardPreferences?.showSubmetrics ?? true,
    showNextAppointment: session?.company?.dashboardPreferences?.showNextAppointment ?? true,
    showDaySummary: session?.company?.dashboardPreferences?.showDaySummary ?? true,
    showQuickSlots: session?.company?.dashboardPreferences?.showQuickSlots ?? true,
    showTodayAppointments: session?.company?.dashboardPreferences?.showTodayAppointments ?? true,
  }));

  // Sync state if session updates
  useEffect(() => {
    if (session) {
      setName(session.name || "Moa Tattoo");
      setPhone(session.phone || session.company?.phone || "");
      setCompanyName(session.company?.name || "Moa Tattoo");
      setBusinessType(session.company?.businessType || "");
      if (session.company?.primaryColor) {
        setPrimaryColor(session.company.primaryColor);
      }
      if (session.avatarUrl || session.company?.logoUrl) {
        setAvatarUrl(session.avatarUrl || session.company?.logoUrl || "");
      }
      if (session.company?.bannerUrl) {
        setBannerUrl(session.company.bannerUrl);
      }
      if (session.company?.dashboardPreferences) {
        setDashboardPrefs((prev) => ({
          ...prev,
          ...session.company.dashboardPreferences,
        }));
      }
    }
  }, [session]);

  const defaultBanner =
    "https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?auto=format&fit=crop&w=1200&q=80";
  const displayBanner = resolveImageUrl(bannerUrl) || defaultBanner;
  const resolvedAvatarUrl = resolveImageUrl(avatarUrl);
  const [bannerLoadError, setBannerLoadError] = useState(false);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const publicSlug = session?.company?.publicSlug || session?.company?.slug;

  const initials = (companyName || name || "MO")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  const handleOpenPublicPage = async () => {
    const slug = publicSlug || "moatattoo";
    const url = `https://usereservei.com.br/${slug}`;
    try {
      await Share.share({
        message: `Confira a página de agendamentos de ${companyName}: ${url}`,
        url,
      });
    } catch {
      Alert.alert("Página de Agendamento", `Link da página: ${url}`);
    }
  };

  const handlePickBanner = async () => {
    setUploadingBanner(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [16, 9],
        base64: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const dataUrl = asset.base64
          ? `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`
          : asset.uri;
        setBannerUrl(dataUrl);
        Alert.alert("Banner Selecionado", "Clique em 'Salvar alterações' para aplicar a todos.");
      }
    } catch {
      Alert.alert("Erro", "Não foi possível carregar a imagem do banner.");
    } finally {
      setUploadingBanner(false);
    }
  };

  const handlePickAvatar = async () => {
    setUploadingAvatar(true);
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
        setAvatarUrl(dataUrl);
        Alert.alert("Logo / Foto Selecionada", "Clique em 'Salvar alterações' para aplicar a todos.");
      }
    } catch {
      Alert.alert("Erro", "Não foi possível carregar a imagem da logomarca.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim() || undefined,
          phone: phone.trim() || undefined,
          companyName: companyName.trim() || undefined,
          businessType: businessType.trim() || undefined,
          avatarUrl: avatarUrl.trim() || null,
          bannerUrl: bannerUrl.trim() || null,
          primaryColor: primaryColor.trim() || undefined,
          dashboardPreferences: dashboardPrefs,
        }),
      });

      await refresh();
      Alert.alert("Sucesso", "Suas personalizações e dados foram salvos com sucesso!");
    } catch (err: any) {
      Alert.alert("Erro ao Salvar", err?.message || "Não foi possível salvar as alterações.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Sair da conta", "Tem certeza que deseja sair?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  return (
    <Screen
      header={<TopBar title="Meu Perfil & Personalização" company={companyName} />}
      style={{ paddingTop: 10 }}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ gap: 14, paddingBottom: 36, paddingHorizontal: 2 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Top Notice Banner (Exact Screenshot) */}
        <View
          className="p-4 rounded-2xl border gap-2.5"
          style={{
            backgroundColor: "#16171b",
            borderColor: "rgba(255, 255, 255, 0.08)",
          }}
        >
          <View className="flex-row items-center gap-3">
            <View
              className="items-center justify-center rounded-xl"
              style={{
                width: 36,
                height: 36,
                backgroundColor: "#ffffff",
              }}
            >
              <Shield size={20} color="#000000" strokeWidth={2.5} />
            </View>

            <Text
              style={{
                color: "#ffffff",
                fontSize: 14.5,
                fontWeight: "700",
                flex: 1,
                lineHeight: 19,
              }}
            >
              Identidade Visual Compartilhada para Toda a Equipe
            </Text>
          </View>

          <View className="gap-1 pt-0.5">
            <Text style={{ color: "#9ca3af", fontSize: 13, lineHeight: 18 }}>
              Você está editando as preferências visuais de{" "}
              <Text style={{ color: "#ffffff", fontWeight: "700" }}>{companyName}.</Text>
            </Text>
            <Text style={{ color: "#9ca3af", fontSize: 12.5, lineHeight: 17 }}>
              Todas as cores, capas, logomarca e preferências que você salvar aqui são herdadas automaticamente por todos os profissionais e colaboradores vinculados a esta empresa.
            </Text>
          </View>
        </View>

        {/* 2. Live Preview Hero Card (Exact Screenshot) */}
        <View
          className="rounded-2xl border overflow-hidden"
          style={{
            backgroundColor: "#111215",
            borderColor: "rgba(255, 255, 255, 0.09)",
          }}
        >
          {/* Cover background */}
          <View style={{ height: 140, position: "relative", backgroundColor: "#1a1b20" }}>
            <Image
              source={{ uri: bannerLoadError ? defaultBanner : displayBanner }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              onError={() => setBannerLoadError(true)}
            />
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0, 0, 0, 0.35)",
              }}
            />
          </View>

          {/* Card Info & Overlapping Avatar */}
          <View className="p-4 pt-0 gap-3">
            <View className="flex-row items-end justify-between" style={{ marginTop: -36 }}>
              <View
                className="items-center justify-center rounded-2xl overflow-hidden border-2"
                style={{
                  width: 78,
                  height: 78,
                  backgroundColor: "#18191e",
                  borderColor: "#ffffff",
                }}
              >
                {resolvedAvatarUrl && !avatarLoadError ? (
                  <Image
                    source={{ uri: resolvedAvatarUrl }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                    onError={() => setAvatarLoadError(true)}
                  />
                ) : (
                  <Text style={{ color: "#ffffff", fontSize: 24, fontWeight: "800" }}>
                    {initials}
                  </Text>
                )}
              </View>
            </View>

            <View className="gap-0.5">
              <Text
                style={{
                  color: "#ffffff",
                  fontSize: 22,
                  fontWeight: "800",
                  letterSpacing: -0.4,
                }}
              >
                {companyName}
              </Text>
              <Text style={{ color: "#9ca3af", fontSize: 13, fontWeight: "500" }}>
                {companyName} · Proprietário
              </Text>
            </View>

            {/* Actions Row */}
            <View className="flex-row items-center gap-2.5 pt-1">
              <Pressable
                onPress={handleOpenPublicPage}
                className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border"
                style={{
                  backgroundColor: "#18191e",
                  borderColor: "rgba(255, 255, 255, 0.12)",
                }}
              >
                <Globe size={15} color="#ffffff" />
                <Text
                  style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "600" }}
                  numberOfLines={1}
                >
                  Página de Agendamento
                </Text>
              </Pressable>

              <Pressable
                onPress={handleSave}
                disabled={saving}
                className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl"
                style={{ backgroundColor: "#ffffff" }}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <>
                    <Check size={16} color="#000000" strokeWidth={2.5} />
                    <Text style={{ color: "#000000", fontSize: 12.5, fontWeight: "700" }}>
                      Salvar alterações
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>

        {/* 3. Navigation Tabs Row (Exact Screenshot) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          <Pressable
            onPress={() => setActiveTab("visual")}
            className="flex-row items-center justify-center gap-2 py-2.5 px-3.5 rounded-xl border"
            style={{
              backgroundColor: activeTab === "visual" ? "#18191e" : "transparent",
              borderColor:
                activeTab === "visual"
                  ? "rgba(255, 255, 255, 0.25)"
                  : "rgba(255, 255, 255, 0.08)",
            }}
          >
            <Palette size={15} color={activeTab === "visual" ? "#ffffff" : "#9ca3af"} />
            <Text
              style={{
                color: activeTab === "visual" ? "#ffffff" : "#9ca3af",
                fontSize: 12.5,
                fontWeight: "700",
              }}
            >
              Identidade Visual & Cores
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("dados")}
            className="flex-row items-center justify-center gap-2 py-2.5 px-3.5 rounded-xl border"
            style={{
              backgroundColor: activeTab === "dados" ? "#18191e" : "transparent",
              borderColor:
                activeTab === "dados"
                  ? "rgba(255, 255, 255, 0.25)"
                  : "rgba(255, 255, 255, 0.08)",
            }}
          >
            <User size={15} color={activeTab === "dados" ? "#ffffff" : "#9ca3af"} />
            <Text
              style={{
                color: activeTab === "dados" ? "#ffffff" : "#9ca3af",
                fontSize: 12.5,
                fontWeight: activeTab === "dados" ? "700" : "600",
              }}
            >
              Dados da Conta & Empresa
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("widgets")}
            className="flex-row items-center justify-center gap-2 py-2.5 px-3.5 rounded-xl border"
            style={{
              backgroundColor: activeTab === "widgets" ? "#18191e" : "transparent",
              borderColor:
                activeTab === "widgets"
                  ? "rgba(255, 255, 255, 0.25)"
                  : "rgba(255, 255, 255, 0.08)",
            }}
          >
            <SlidersHorizontal
              size={15}
              color={activeTab === "widgets" ? "#ffffff" : "#9ca3af"}
            />
            <Text
              style={{
                color: activeTab === "widgets" ? "#ffffff" : "#9ca3af",
                fontSize: 12.5,
                fontWeight: activeTab === "widgets" ? "700" : "600",
              }}
            >
              Widgets do Início
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("atalhos")}
            className="flex-row items-center justify-center gap-2 py-2.5 px-3.5 rounded-xl border"
            style={{
              backgroundColor: activeTab === "atalhos" ? "#18191e" : "transparent",
              borderColor:
                activeTab === "atalhos"
                  ? "rgba(255, 255, 255, 0.25)"
                  : "rgba(255, 255, 255, 0.08)",
            }}
          >
            <Sparkles size={15} color={activeTab === "atalhos" ? "#ffffff" : "#9ca3af"} />
            <Text
              style={{
                color: activeTab === "atalhos" ? "#ffffff" : "#9ca3af",
                fontSize: 12.5,
                fontWeight: activeTab === "atalhos" ? "700" : "600",
              }}
            >
              Ações & Links
            </Text>
          </Pressable>
        </ScrollView>

        {/* 4. Tab 1: Identidade Visual & Cores */}
        {activeTab === "visual" && (
          <View className="gap-3.5">
            {/* Card: Cor Primária do Sistema */}
            <View
              className="p-4 rounded-2xl border gap-3.5"
              style={{
                backgroundColor: "#16171b",
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <View className="flex-row items-center gap-2">
                <Palette size={18} color="#ffffff" />
                <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "700" }}>
                  Cor Primária do Sistema
                </Text>
              </View>

              <Text style={{ color: "#9ca3af", fontSize: 12.5, lineHeight: 17 }}>
                Substitua a cor de destaque do Reservei. Afeta botões, badges, status e links para você e todos os profissionais da sua empresa.
              </Text>

              {/* Color Preset Circles Grid */}
              <View className="flex-row flex-wrap gap-2.5 pt-1">
                {PRIMARY_COLOR_PRESETS.map((preset) => {
                  const isSelected =
                    primaryColor.toLowerCase() === preset.hex.toLowerCase();
                  const light = isLightHex(preset.hex);
                  return (
                    <Pressable
                      key={preset.hex}
                      onPress={() => setPrimaryColor(preset.hex)}
                      className="items-center justify-center rounded-full"
                      style={{
                        width: 36,
                        height: 36,
                        backgroundColor: preset.hex,
                        borderWidth: isSelected ? 2.5 : 1,
                        borderColor: isSelected
                          ? "#ffffff"
                          : "rgba(255, 255, 255, 0.18)",
                      }}
                    >
                      {isSelected ? (
                        <Check
                          size={16}
                          color={light ? "#000000" : "#ffffff"}
                          strokeWidth={3}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              {/* Custom Color Input Row */}
              <View
                className="flex-row items-center gap-2.5 p-2 rounded-xl border"
                style={{
                  backgroundColor: "#111215",
                  borderColor: "rgba(255, 255, 255, 0.06)",
                }}
              >
                <View
                  className="rounded-lg border"
                  style={{
                    width: 34,
                    height: 34,
                    backgroundColor: primaryColor,
                    borderColor: "rgba(255, 255, 255, 0.2)",
                  }}
                />

                <TextInput
                  value={primaryColor}
                  onChangeText={setPrimaryColor}
                  placeholder="#3b82f6"
                  placeholderTextColor="#6b7280"
                  maxLength={9}
                  style={{
                    flex: 1,
                    backgroundColor: "#18191e",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    height: 36,
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: "600",
                  }}
                />

                <Pressable
                  onPress={() => setPrimaryColor("#3b82f6")}
                  className="px-3 py-2 rounded-lg border items-center justify-center"
                  style={{
                    backgroundColor: "#18191e",
                    borderColor: "rgba(255, 255, 255, 0.12)",
                    height: 36,
                  }}
                >
                  <Text style={{ color: "#ffffff", fontSize: 11.5, fontWeight: "600" }}>
                    Restaurar padrão
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Card: Banner de Capa */}
            <View
              className="p-4 rounded-2xl border gap-3.5"
              style={{
                backgroundColor: "#16171b",
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <ImagePlus size={18} color="#ffffff" />
                  <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "700" }}>
                    Banner de Capa
                  </Text>
                </View>

                <Pressable
                  onPress={handlePickBanner}
                  disabled={uploadingBanner}
                  className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg border"
                  style={{
                    backgroundColor: "#18191e",
                    borderColor: "rgba(255, 255, 255, 0.14)",
                  }}
                >
                  {uploadingBanner ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Upload size={13} color="#ffffff" />
                      <Text style={{ color: "#ffffff", fontSize: 11.5, fontWeight: "600" }}>
                        Upload do Computador
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>

              <Text style={{ color: "#9ca3af", fontSize: 12.5, lineHeight: 17 }}>
                Imagem decorativa de destaque exibida no topo do painel inicial para você e toda a equipe.
              </Text>

              {/* URL Input & Limpar Button */}
              <View className="flex-row items-center gap-2">
                <TextInput
                  value={bannerUrl}
                  onChangeText={setBannerUrl}
                  placeholder="https://exemplo.com/banner.jpg ou faça upload acima"
                  placeholderTextColor="#6b7280"
                  style={{
                    flex: 1,
                    backgroundColor: "#111215",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    height: 40,
                    color: "#ffffff",
                    fontSize: 12.5,
                  }}
                />
                {bannerUrl ? (
                  <Pressable
                    onPress={() => setBannerUrl("")}
                    className="px-3.5 py-2.5 rounded-lg border items-center justify-center"
                    style={{
                      backgroundColor: "#18191e",
                      borderColor: "rgba(255, 255, 255, 0.12)",
                      height: 40,
                    }}
                  >
                    <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "600" }}>
                      Limpar
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Banner Presets Grid */}
              <View className="gap-2 pt-1">
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#9ca3af" }}>
                  Sugestões de Capas Profissionais:
                </Text>

                <View className="flex-row flex-wrap gap-2.5">
                  {BANNER_PRESETS.map((preset) => {
                    const isSelected = bannerUrl === preset.url;
                    return (
                      <Pressable
                        key={preset.id}
                        onPress={() => setBannerUrl(preset.url)}
                        className="rounded-xl overflow-hidden border"
                        style={{
                          width: "48%",
                          height: 52,
                          position: "relative",
                          borderColor: isSelected
                            ? "#ffffff"
                            : "rgba(255, 255, 255, 0.1)",
                          borderWidth: isSelected ? 2 : 1,
                        }}
                      >
                        <Image
                          source={{ uri: preset.url }}
                          style={{ width: "100%", height: "100%" }}
                          contentFit="cover"
                        />
                        <View
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: "rgba(0, 0, 0, 0.45)",
                            justifyContent: "center",
                            paddingHorizontal: 10,
                          }}
                        >
                          <Text
                            style={{
                              color: "#ffffff",
                              fontSize: 11,
                              fontWeight: "700",
                            }}
                            numberOfLines={1}
                          >
                            {preset.name}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Card: Logomarca da Empresa / Foto */}
            <View
              className="p-4 rounded-2xl border gap-3.5"
              style={{
                backgroundColor: "#16171b",
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <ImageIcon size={18} color="#ffffff" />
                  <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "700" }}>
                    Logomarca da Empresa / Foto
                  </Text>
                </View>

                <Pressable
                  onPress={handlePickAvatar}
                  disabled={uploadingAvatar}
                  className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg border"
                  style={{
                    backgroundColor: "#18191e",
                    borderColor: "rgba(255, 255, 255, 0.14)",
                  }}
                >
                  {uploadingAvatar ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Upload size={13} color="#ffffff" />
                      <Text style={{ color: "#ffffff", fontSize: 11.5, fontWeight: "600" }}>
                        Upload da Logo / Foto
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>

              <Text style={{ color: "#9ca3af", fontSize: 12.5, lineHeight: 17 }}>
                Logotipo ou foto principal exibida no topo do menu lateral, banner de boas-vindas e página de agendamento online.
              </Text>

              {/* URL Input & Limpar Button */}
              <View className="flex-row items-center gap-2">
                <TextInput
                  value={avatarUrl}
                  onChangeText={setAvatarUrl}
                  placeholder="https://exemplo.com/foto.jpg ou faça upload acima"
                  placeholderTextColor="#6b7280"
                  style={{
                    flex: 1,
                    backgroundColor: "#111215",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    height: 40,
                    color: "#ffffff",
                    fontSize: 12.5,
                  }}
                />
                {avatarUrl ? (
                  <Pressable
                    onPress={() => setAvatarUrl("")}
                    className="px-3.5 py-2.5 rounded-lg border items-center justify-center"
                    style={{
                      backgroundColor: "#18191e",
                      borderColor: "rgba(255, 255, 255, 0.12)",
                      height: 40,
                    }}
                  >
                    <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "600" }}>
                      Limpar
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Suggested Avatars List */}
              <View className="gap-2 pt-1">
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#9ca3af" }}>
                  Avatares e Ícones Sugeridos:
                </Text>

                <View className="flex-row items-center gap-3">
                  {AVATAR_PRESETS.map((preset) => {
                    const isSelected = avatarUrl === preset.url;
                    return (
                      <Pressable
                        key={preset.id}
                        onPress={() => setAvatarUrl(preset.url)}
                        className="rounded-full overflow-hidden border-2"
                        style={{
                          width: 44,
                          height: 44,
                          borderColor: isSelected
                            ? "#ffffff"
                            : "rgba(255, 255, 255, 0.15)",
                        }}
                      >
                        <Image
                          source={{ uri: preset.url }}
                          style={{ width: "100%", height: "100%" }}
                          contentFit="cover"
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* 5. Tab 2: Dados da Conta & Empresa */}
        {activeTab === "dados" && (
          <View className="gap-3.5">
            {/* Card: Dados Pessoais do Administrador */}
            <View
              className="p-4 rounded-2xl border gap-3.5"
              style={{
                backgroundColor: "#16171b",
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <View className="flex-row items-center gap-2">
                <User size={18} color="#ffffff" />
                <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "700" }}>
                  Dados Pessoais do Administrador
                </Text>
              </View>
              <Text style={{ color: "#9ca3af", fontSize: 12.5 }}>
                Informações de contato e identificação do proprietário da conta.
              </Text>

              <View className="gap-1.5">
                <Text style={{ color: "#9ca3af", fontSize: 12, fontWeight: "600" }}>
                  Nome completo
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Seu nome completo"
                  placeholderTextColor="#6b7280"
                  style={{
                    backgroundColor: "#111215",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    height: 42,
                    color: "#ffffff",
                    fontSize: 13,
                  }}
                />
              </View>

              <View className="gap-1.5">
                <Text style={{ color: "#9ca3af", fontSize: 12, fontWeight: "600" }}>
                  Telefone / WhatsApp
                </Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="(11) 99999-9999"
                  placeholderTextColor="#6b7280"
                  style={{
                    backgroundColor: "#111215",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    height: 42,
                    color: "#ffffff",
                    fontSize: 13,
                  }}
                />
              </View>

              <View className="gap-1.5">
                <Text style={{ color: "#9ca3af", fontSize: 12, fontWeight: "600" }}>
                  E-mail de acesso (login)
                </Text>
                <TextInput
                  value={session?.email || ""}
                  editable={false}
                  style={{
                    backgroundColor: "#18191e",
                    borderColor: "rgba(255, 255, 255, 0.06)",
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    height: 42,
                    color: "#9ca3af",
                    fontSize: 13,
                    opacity: 0.8,
                  }}
                />
              </View>
            </View>

            {/* Card: Dados do Estabelecimento */}
            <View
              className="p-4 rounded-2xl border gap-3.5"
              style={{
                backgroundColor: "#16171b",
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <View className="flex-row items-center gap-2">
                <Building2 size={18} color="#ffffff" />
                <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "700" }}>
                  Dados do Estabelecimento
                </Text>
              </View>
              <Text style={{ color: "#9ca3af", fontSize: 12.5 }}>
                Informações da empresa registrada no sistema Reservei.
              </Text>

              <View className="gap-1.5">
                <Text style={{ color: "#9ca3af", fontSize: 12, fontWeight: "600" }}>
                  Nome da empresa
                </Text>
                <TextInput
                  value={companyName}
                  onChangeText={setCompanyName}
                  placeholder="Nome do seu estabelecimento"
                  placeholderTextColor="#6b7280"
                  style={{
                    backgroundColor: "#111215",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    height: 42,
                    color: "#ffffff",
                    fontSize: 13,
                  }}
                />
              </View>

              <View className="gap-1.5">
                <Text style={{ color: "#9ca3af", fontSize: 12, fontWeight: "600" }}>
                  Segmento de atuação
                </Text>
                <TextInput
                  value={businessType}
                  onChangeText={setBusinessType}
                  placeholder="Ex.: Manicure, Barbearia, Salão de Beleza, Estética..."
                  placeholderTextColor="#6b7280"
                  style={{
                    backgroundColor: "#111215",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    height: 42,
                    color: "#ffffff",
                    fontSize: 13,
                  }}
                />
              </View>

              <View className="gap-1.5">
                <Text style={{ color: "#9ca3af", fontSize: 12, fontWeight: "600" }}>
                  Nível de permissão
                </Text>
                <TextInput
                  value="Proprietário · Acesso Total e Gerenciamento"
                  editable={false}
                  style={{
                    backgroundColor: "#18191e",
                    borderColor: "rgba(255, 255, 255, 0.06)",
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    height: 42,
                    color: "#9ca3af",
                    fontSize: 13,
                    opacity: 0.8,
                  }}
                />
              </View>

              <Pressable
                onPress={() => router.push("/(owner)/mais" as any)}
                className="flex-row items-center justify-center gap-2 py-3 px-4 rounded-xl border mt-1"
                style={{
                  backgroundColor: "#18191e",
                  borderColor: "rgba(255, 255, 255, 0.12)",
                }}
              >
                <Settings2 size={16} color="#ffffff" />
                <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "600" }}>
                  Configurações completas da empresa
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* 6. Tab 3: Widgets do Início */}
        {activeTab === "widgets" && (
          <View
            className="p-4 rounded-2xl border gap-3.5"
            style={{
              backgroundColor: "#16171b",
              borderColor: "rgba(255, 255, 255, 0.08)",
            }}
          >
            <View className="flex-row items-center gap-2">
              <SlidersHorizontal size={18} color="#ffffff" />
              <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "700" }}>
                Visibilidade de Módulos no Painel Inicial
              </Text>
            </View>
            <Text style={{ color: "#9ca3af", fontSize: 12.5, lineHeight: 17 }}>
              Escolha quais seções e blocos devem ser visíveis no Dashboard geral da empresa.
            </Text>

            <View className="gap-2.5 pt-1">
              {[
                {
                  key: "showBanner",
                  label: "Banner e Saudação no Topo",
                  desc: "Exibe a imagem de capa e cumprimento diário",
                },
                {
                  key: "showChecklist",
                  label: "Checklist de Primeiros Passos",
                  desc: "Guia interativo para configurar a agenda",
                },
                {
                  key: "showKpis",
                  label: "Cards de Indicadores (KPIs)",
                  desc: "Métricas de faturamento, reservas e taxa de ocupação",
                },
                {
                  key: "showSubmetrics",
                  label: "Submétricas Financeiras",
                  desc: "Detalhamento de recebidos e pendentes",
                },
                {
                  key: "showNextAppointment",
                  label: "Próximo Atendimento em Destaque",
                  desc: "Card rápido do cliente que está chegando",
                },
                {
                  key: "showDaySummary",
                  label: "Resumo do Dia por Status",
                  desc: "Gráfico e contadores de agendamentos de hoje",
                },
                {
                  key: "showQuickSlots",
                  label: "Horários Livres para Encaixe",
                  desc: "Acesso direto a slots vagos da agenda",
                },
                {
                  key: "showTodayAppointments",
                  label: "Tabela de Atendimentos de Hoje",
                  desc: "Lista completa de clientes agendados",
                },
              ].map(({ key, label, desc }) => {
                const isChecked = Boolean(
                  (dashboardPrefs as Record<string, boolean | undefined>)[key]
                );
                return (
                  <Pressable
                    key={key}
                    onPress={() =>
                      setDashboardPrefs((prev) => ({
                        ...prev,
                        [key]: !isChecked,
                      }))
                    }
                    className="flex-row items-center justify-between p-3.5 rounded-xl border"
                    style={{
                      backgroundColor: isChecked ? "#1c1d24" : "#111215",
                      borderColor: isChecked
                        ? "rgba(255, 255, 255, 0.18)"
                        : "rgba(255, 255, 255, 0.06)",
                    }}
                  >
                    <View className="flex-1 pr-3 gap-0.5">
                      <Text
                        style={{
                          color: "#ffffff",
                          fontSize: 13.5,
                          fontWeight: "600",
                        }}
                      >
                        {label}
                      </Text>
                      <Text style={{ color: "#9ca3af", fontSize: 11.5 }}>
                        {desc}
                      </Text>
                    </View>

                    <Switch
                      value={isChecked}
                      onValueChange={(val) =>
                        setDashboardPrefs((prev) => ({
                          ...prev,
                          [key]: val,
                        }))
                      }
                      trackColor={{ false: "#27272a", true: primaryColor || "#3b82f6" }}
                      thumbColor="#ffffff"
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* 7. Tab 4: Ações & Links */}
        {activeTab === "atalhos" && (
          <View
            className="p-4 rounded-2xl border gap-3"
            style={{
              backgroundColor: "#16171b",
              borderColor: "rgba(255, 255, 255, 0.08)",
            }}
          >
            <View className="flex-row items-center gap-2">
              <Sparkles size={18} color="#ffffff" />
              <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "700" }}>
                Ações Rápidas e Acesso
              </Text>
            </View>
            <Text style={{ color: "#9ca3af", fontSize: 12.5 }}>
              Atalhos para navegação externa e ferramentas administrativas.
            </Text>

            <Pressable
              onPress={handleOpenPublicPage}
              className="flex-row items-center justify-between p-3.5 rounded-xl border mt-1"
              style={{
                backgroundColor: "rgba(59, 130, 246, 0.1)",
                borderColor: "rgba(59, 130, 246, 0.3)",
              }}
            >
              <View className="flex-row items-center gap-2.5">
                <UserRound size={18} color="#3b82f6" />
                <Text style={{ color: "#3b82f6", fontSize: 13, fontWeight: "700" }}>
                  Abrir Portal do Cliente (Agendamento Online)
                </Text>
              </View>
              <ArrowRight size={16} color="#3b82f6" />
            </Pressable>

            <Pressable
              onPress={() => router.push("/(owner)/mais" as any)}
              className="flex-row items-center gap-2.5 p-3.5 rounded-xl border"
              style={{
                backgroundColor: "#18191e",
                borderColor: "rgba(255, 255, 255, 0.12)",
              }}
            >
              <Settings2 size={18} color="#ffffff" />
              <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "600" }}>
                Configurações Gerais da Conta
              </Text>
            </Pressable>

            <Pressable
              onPress={handleLogout}
              className="flex-row items-center gap-2.5 p-3.5 rounded-xl border"
              style={{
                backgroundColor: "#18191e",
                borderColor: "rgba(239, 68, 68, 0.25)",
              }}
            >
              <LogOut size={18} color="#ef4444" />
              <Text style={{ color: "#ef4444", fontSize: 13, fontWeight: "700" }}>
                Sair da conta
              </Text>
            </Pressable>
          </View>
        )}

        {/* 8. Sticky Save Bar at Bottom (Exact Screenshot) */}
        <View
          className="p-4 rounded-2xl border gap-3"
          style={{
            backgroundColor: "#16171b",
            borderColor: "rgba(255, 255, 255, 0.08)",
          }}
        >
          <View className="flex-row items-center gap-2.5">
            <ShieldCheck size={18} color={primaryColor || "#3b82f6"} />
            <Text style={{ color: "#9ca3af", fontSize: 12, flex: 1, lineHeight: 16 }}>
              As personalizações aplicadas aqui valem para você e todos os profissionais desta empresa
            </Text>
          </View>

          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="flex-row items-center justify-center gap-2 py-3 px-4 rounded-xl"
            style={{ backgroundColor: "#ffffff" }}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <>
                <Check size={18} color="#000000" strokeWidth={2.5} />
                <Text style={{ color: "#000000", fontSize: 14, fontWeight: "700" }}>
                  Salvar alterações
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}
