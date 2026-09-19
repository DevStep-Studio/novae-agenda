import * as ImagePicker from "expo-image-picker";
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ExternalLink,
  Globe,
  ImageIcon,
  ImagePlus,
  Lock,
  LogOut,
  Palette,
  Phone,
  RefreshCw,
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
        setBannerLoadError(false);
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
        setAvatarLoadError(false);
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
      style={{ paddingTop: 8 }}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ gap: 16, paddingBottom: 40, paddingHorizontal: 4 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Minimalist Info Notice Banner */}
        <View
          className="p-4 rounded-2xl border"
          style={{
            backgroundColor: "#121318",
            borderColor: "rgba(255, 255, 255, 0.07)",
          }}
        >
          <View className="flex-row items-center gap-3">
            <View
              className="items-center justify-center rounded-xl"
              style={{
                width: 38,
                height: 38,
                backgroundColor: "#ffffff",
              }}
            >
              <Shield size={20} color="#000000" strokeWidth={2.4} />
            </View>

            <View className="flex-1">
              <Text
                style={{
                  color: "#ffffff",
                  fontSize: 14,
                  fontWeight: "700",
                  lineHeight: 18,
                }}
              >
                Identidade Visual Compartilhada
              </Text>
              <Text
                style={{
                  color: "#9ca3af",
                  fontSize: 12,
                  marginTop: 2,
                }}
              >
                Preferências herdadas por toda a equipe de{" "}
                <Text style={{ color: "#ffffff", fontWeight: "600" }}>{companyName}</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* 2. Hero Live Preview Card (Clean Minimalist Design) */}
        <View
          className="rounded-3xl border overflow-hidden"
          style={{
            backgroundColor: "#111216",
            borderColor: "rgba(255, 255, 255, 0.08)",
          }}
        >
          {/* Cover background */}
          <View style={{ height: 145, position: "relative", backgroundColor: "#181920" }}>
            <Image
              source={{ uri: bannerLoadError ? defaultBanner : displayBanner }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              onError={() => setBannerLoadError(true)}
            />
            {/* Linear Gradient Fade Overlay */}
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(10, 11, 14, 0.42)",
              }}
            />
          </View>

          {/* Card Info & Overlapping Avatar */}
          <View className="p-4 pt-0 gap-3.5">
            <View className="flex-row items-end justify-between" style={{ marginTop: -40 }}>
              <View
                className="items-center justify-center rounded-2xl overflow-hidden border-2"
                style={{
                  width: 80,
                  height: 80,
                  backgroundColor: "#181920",
                  borderColor: "#ffffff",
                  shadowColor: "#000000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.35,
                  shadowRadius: 8,
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
                  <Text style={{ color: "#ffffff", fontSize: 26, fontWeight: "800" }}>
                    {initials}
                  </Text>
                )}
              </View>

              {/* Status Tag */}
              <View
                className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full border mb-1"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.06)",
                  borderColor: "rgba(255, 255, 255, 0.12)",
                }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: "#10b981",
                  }}
                />
                <Text style={{ color: "#ffffff", fontSize: 11, fontWeight: "600" }}>
                  Ao vivo
                </Text>
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
                className="flex-1 flex-row items-center justify-center gap-2 py-3 px-3.5 rounded-xl border"
                style={{
                  backgroundColor: "#17181f",
                  borderColor: "rgba(255, 255, 255, 0.1)",
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
                className="flex-1 flex-row items-center justify-center gap-2 py-3 px-3.5 rounded-xl"
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

        {/* 3. Minimalist Tab Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
        >
          <Pressable
            onPress={() => setActiveTab("visual")}
            className="flex-row items-center justify-center gap-2 py-2.5 px-4 rounded-xl border"
            style={{
              backgroundColor: activeTab === "visual" ? "#1e1f26" : "transparent",
              borderColor:
                activeTab === "visual"
                  ? "rgba(255, 255, 255, 0.2)"
                  : "rgba(255, 255, 255, 0.06)",
            }}
          >
            <Palette size={15} color={activeTab === "visual" ? "#ffffff" : "#71717a"} />
            <Text
              style={{
                color: activeTab === "visual" ? "#ffffff" : "#71717a",
                fontSize: 12.5,
                fontWeight: activeTab === "visual" ? "700" : "500",
              }}
            >
              Identidade Visual & Cores
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("dados")}
            className="flex-row items-center justify-center gap-2 py-2.5 px-4 rounded-xl border"
            style={{
              backgroundColor: activeTab === "dados" ? "#1e1f26" : "transparent",
              borderColor:
                activeTab === "dados"
                  ? "rgba(255, 255, 255, 0.2)"
                  : "rgba(255, 255, 255, 0.06)",
            }}
          >
            <User size={15} color={activeTab === "dados" ? "#ffffff" : "#71717a"} />
            <Text
              style={{
                color: activeTab === "dados" ? "#ffffff" : "#71717a",
                fontSize: 12.5,
                fontWeight: activeTab === "dados" ? "700" : "500",
              }}
            >
              Dados da Conta & Empresa
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("widgets")}
            className="flex-row items-center justify-center gap-2 py-2.5 px-4 rounded-xl border"
            style={{
              backgroundColor: activeTab === "widgets" ? "#1e1f26" : "transparent",
              borderColor:
                activeTab === "widgets"
                  ? "rgba(255, 255, 255, 0.2)"
                  : "rgba(255, 255, 255, 0.06)",
            }}
          >
            <SlidersHorizontal
              size={15}
              color={activeTab === "widgets" ? "#ffffff" : "#71717a"}
            />
            <Text
              style={{
                color: activeTab === "widgets" ? "#ffffff" : "#71717a",
                fontSize: 12.5,
                fontWeight: activeTab === "widgets" ? "700" : "500",
              }}
            >
              Widgets do Início
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("atalhos")}
            className="flex-row items-center justify-center gap-2 py-2.5 px-4 rounded-xl border"
            style={{
              backgroundColor: activeTab === "atalhos" ? "#1e1f26" : "transparent",
              borderColor:
                activeTab === "atalhos"
                  ? "rgba(255, 255, 255, 0.2)"
                  : "rgba(255, 255, 255, 0.06)",
            }}
          >
            <Sparkles size={15} color={activeTab === "atalhos" ? "#ffffff" : "#71717a"} />
            <Text
              style={{
                color: activeTab === "atalhos" ? "#ffffff" : "#71717a",
                fontSize: 12.5,
                fontWeight: activeTab === "atalhos" ? "700" : "500",
              }}
            >
              Ações & Links
            </Text>
          </Pressable>
        </ScrollView>

        {/* 4. Tab 1: Identidade Visual & Cores */}
        {activeTab === "visual" && (
          <View className="gap-4">
            {/* Card: Cor Primária do Sistema */}
            <View
              className="p-5 rounded-2xl border gap-4"
              style={{
                backgroundColor: "#121318",
                borderColor: "rgba(255, 255, 255, 0.07)",
              }}
            >
              <View className="gap-1">
                <View className="flex-row items-center gap-2">
                  <Palette size={17} color="#ffffff" />
                  <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "700" }}>
                    Cor Primária do Sistema
                  </Text>
                </View>
                <Text style={{ color: "#9ca3af", fontSize: 12.5, lineHeight: 17 }}>
                  Substitua a cor de destaque do Reservei para botões, badges e status.
                </Text>
              </View>

              {/* Color Preset Circles Grid */}
              <View className="flex-row flex-wrap gap-3 pt-1">
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
                        width: 38,
                        height: 38,
                        backgroundColor: preset.hex,
                        borderWidth: isSelected ? 3 : 1,
                        borderColor: isSelected
                          ? "#ffffff"
                          : "rgba(255, 255, 255, 0.15)",
                      }}
                    >
                      {isSelected ? (
                        <Check
                          size={18}
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
                  backgroundColor: "#0d0e12",
                  borderColor: "rgba(255, 255, 255, 0.06)",
                }}
              >
                <View
                  className="rounded-lg border"
                  style={{
                    width: 36,
                    height: 36,
                    backgroundColor: primaryColor,
                    borderColor: "rgba(255, 255, 255, 0.2)",
                  }}
                />

                <TextInput
                  value={primaryColor}
                  onChangeText={setPrimaryColor}
                  placeholder="#3b82f6"
                  placeholderTextColor="#52525b"
                  maxLength={9}
                  style={{
                    flex: 1,
                    backgroundColor: "#16171e",
                    borderColor: "rgba(255, 255, 255, 0.08)",
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    height: 38,
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: "600",
                  }}
                />

                <Pressable
                  onPress={() => setPrimaryColor("#3b82f6")}
                  className="px-3 rounded-lg border items-center justify-center"
                  style={{
                    backgroundColor: "#16171e",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    height: 38,
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
              className="p-5 rounded-2xl border gap-4"
              style={{
                backgroundColor: "#121318",
                borderColor: "rgba(255, 255, 255, 0.07)",
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <ImagePlus size={17} color="#ffffff" />
                  <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "700" }}>
                    Banner de Capa
                  </Text>
                </View>

                <Pressable
                  onPress={handlePickBanner}
                  disabled={uploadingBanner}
                  className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg border"
                  style={{
                    backgroundColor: "#181920",
                    borderColor: "rgba(255, 255, 255, 0.12)",
                  }}
                >
                  {uploadingBanner ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Upload size={13} color="#ffffff" />
                      <Text style={{ color: "#ffffff", fontSize: 11.5, fontWeight: "600" }}>
                        Upload
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>

              <Text style={{ color: "#9ca3af", fontSize: 12.5, lineHeight: 17 }}>
                Imagem decorativa de destaque exibida no topo do painel inicial.
              </Text>

              {/* URL Input & Limpar Button */}
              <View className="flex-row items-center gap-2">
                <TextInput
                  value={bannerUrl}
                  onChangeText={(text) => {
                    setBannerUrl(text);
                    setBannerLoadError(false);
                  }}
                  placeholder="https://exemplo.com/banner.jpg"
                  placeholderTextColor="#52525b"
                  style={{
                    flex: 1,
                    backgroundColor: "#0d0e12",
                    borderColor: "rgba(255, 255, 255, 0.08)",
                    borderWidth: 1,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    height: 42,
                    color: "#ffffff",
                    fontSize: 12.5,
                  }}
                />
                {bannerUrl ? (
                  <Pressable
                    onPress={() => {
                      setBannerUrl("");
                      setBannerLoadError(false);
                    }}
                    className="px-3.5 rounded-10 border items-center justify-center"
                    style={{
                      backgroundColor: "#181920",
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      height: 42,
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "600" }}>
                      Limpar
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Banner Presets Grid */}
              <View className="gap-2.5 pt-1">
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#9ca3af" }}>
                  Sugestões de Capas Profissionais:
                </Text>

                <View className="flex-row flex-wrap gap-2.5">
                  {BANNER_PRESETS.map((preset) => {
                    const isSelected = bannerUrl === preset.url;
                    return (
                      <Pressable
                        key={preset.id}
                        onPress={() => {
                          setBannerUrl(preset.url);
                          setBannerLoadError(false);
                        }}
                        className="rounded-xl overflow-hidden border"
                        style={{
                          width: "48%",
                          height: 56,
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
                            backgroundColor: "rgba(0, 0, 0, 0.5)",
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
              className="p-5 rounded-2xl border gap-4"
              style={{
                backgroundColor: "#121318",
                borderColor: "rgba(255, 255, 255, 0.07)",
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <ImageIcon size={17} color="#ffffff" />
                  <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "700" }}>
                    Logomarca da Empresa / Foto
                  </Text>
                </View>

                <Pressable
                  onPress={handlePickAvatar}
                  disabled={uploadingAvatar}
                  className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg border"
                  style={{
                    backgroundColor: "#181920",
                    borderColor: "rgba(255, 255, 255, 0.12)",
                  }}
                >
                  {uploadingAvatar ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Upload size={13} color="#ffffff" />
                      <Text style={{ color: "#ffffff", fontSize: 11.5, fontWeight: "600" }}>
                        Upload
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>

              <Text style={{ color: "#9ca3af", fontSize: 12.5, lineHeight: 17 }}>
                Logotipo ou foto principal exibida no topo do menu lateral e página online.
              </Text>

              {/* URL Input & Limpar Button */}
              <View className="flex-row items-center gap-2">
                <TextInput
                  value={avatarUrl}
                  onChangeText={(text) => {
                    setAvatarUrl(text);
                    setAvatarLoadError(false);
                  }}
                  placeholder="https://exemplo.com/foto.jpg"
                  placeholderTextColor="#52525b"
                  style={{
                    flex: 1,
                    backgroundColor: "#0d0e12",
                    borderColor: "rgba(255, 255, 255, 0.08)",
                    borderWidth: 1,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    height: 42,
                    color: "#ffffff",
                    fontSize: 12.5,
                  }}
                />
                {avatarUrl ? (
                  <Pressable
                    onPress={() => {
                      setAvatarUrl("");
                      setAvatarLoadError(false);
                    }}
                    className="px-3.5 border items-center justify-center"
                    style={{
                      backgroundColor: "#181920",
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      height: 42,
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "600" }}>
                      Limpar
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Suggested Avatars List */}
              <View className="gap-2.5 pt-1">
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#9ca3af" }}>
                  Avatares Sugeridos:
                </Text>

                <View className="flex-row items-center gap-3.5">
                  {AVATAR_PRESETS.map((preset) => {
                    const isSelected = avatarUrl === preset.url;
                    return (
                      <Pressable
                        key={preset.id}
                        onPress={() => {
                          setAvatarUrl(preset.url);
                          setAvatarLoadError(false);
                        }}
                        className="rounded-full overflow-hidden border-2"
                        style={{
                          width: 46,
                          height: 46,
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
          <View className="gap-4">
            {/* Card: Dados Pessoais do Administrador */}
            <View
              className="p-5 rounded-2xl border gap-4"
              style={{
                backgroundColor: "#121318",
                borderColor: "rgba(255, 255, 255, 0.07)",
              }}
            >
              <View className="flex-row items-center gap-2">
                <User size={17} color="#ffffff" />
                <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "700" }}>
                  Dados Pessoais do Administrador
                </Text>
              </View>

              <View className="gap-1.5">
                <Text style={{ color: "#71717a", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Nome completo
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Seu nome completo"
                  placeholderTextColor="#52525b"
                  style={{
                    backgroundColor: "#0d0e12",
                    borderColor: "rgba(255, 255, 255, 0.08)",
                    borderWidth: 1,
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    height: 44,
                    color: "#ffffff",
                    fontSize: 13.5,
                  }}
                />
              </View>

              <View className="gap-1.5">
                <Text style={{ color: "#71717a", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Telefone / WhatsApp
                </Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="(11) 99999-9999"
                  placeholderTextColor="#52525b"
                  style={{
                    backgroundColor: "#0d0e12",
                    borderColor: "rgba(255, 255, 255, 0.08)",
                    borderWidth: 1,
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    height: 44,
                    color: "#ffffff",
                    fontSize: 13.5,
                  }}
                />
              </View>

              <View className="gap-1.5">
                <View className="flex-row items-center justify-between">
                  <Text style={{ color: "#71717a", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    E-mail de acesso (login)
                  </Text>
                  <Lock size={12} color="#71717a" />
                </View>
                <TextInput
                  value={session?.email || ""}
                  editable={false}
                  style={{
                    backgroundColor: "#16171e",
                    borderColor: "rgba(255, 255, 255, 0.05)",
                    borderWidth: 1,
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    height: 44,
                    color: "#71717a",
                    fontSize: 13.5,
                  }}
                />
              </View>
            </View>

            {/* Card: Dados do Estabelecimento */}
            <View
              className="p-5 rounded-2xl border gap-4"
              style={{
                backgroundColor: "#121318",
                borderColor: "rgba(255, 255, 255, 0.07)",
              }}
            >
              <View className="flex-row items-center gap-2">
                <Building2 size={17} color="#ffffff" />
                <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "700" }}>
                  Dados do Estabelecimento
                </Text>
              </View>

              <View className="gap-1.5">
                <Text style={{ color: "#71717a", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Nome da empresa
                </Text>
                <TextInput
                  value={companyName}
                  onChangeText={setCompanyName}
                  placeholder="Nome do seu estabelecimento"
                  placeholderTextColor="#52525b"
                  style={{
                    backgroundColor: "#0d0e12",
                    borderColor: "rgba(255, 255, 255, 0.08)",
                    borderWidth: 1,
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    height: 44,
                    color: "#ffffff",
                    fontSize: 13.5,
                  }}
                />
              </View>

              <View className="gap-1.5">
                <Text style={{ color: "#71717a", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Segmento de atuação
                </Text>
                <TextInput
                  value={businessType}
                  onChangeText={setBusinessType}
                  placeholder="Ex.: Barbearia, Studio, Manicure..."
                  placeholderTextColor="#52525b"
                  style={{
                    backgroundColor: "#0d0e12",
                    borderColor: "rgba(255, 255, 255, 0.08)",
                    borderWidth: 1,
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    height: 44,
                    color: "#ffffff",
                    fontSize: 13.5,
                  }}
                />
              </View>

              <View className="gap-1.5">
                <View className="flex-row items-center justify-between">
                  <Text style={{ color: "#71717a", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Nível de permissão
                  </Text>
                  <ShieldCheck size={13} color="#10b981" />
                </View>
                <TextInput
                  value="Proprietário · Acesso Total e Gerenciamento"
                  editable={false}
                  style={{
                    backgroundColor: "#16171e",
                    borderColor: "rgba(255, 255, 255, 0.05)",
                    borderWidth: 1,
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    height: 44,
                    color: "#71717a",
                    fontSize: 13.5,
                  }}
                />
              </View>

              <Pressable
                onPress={() => router.push("/(owner)/configuracoes" as any)}
                className="flex-row items-center justify-center gap-2 py-3 px-4 rounded-xl border mt-1"
                style={{
                  backgroundColor: "#181920",
                  borderColor: "rgba(255, 255, 255, 0.1)",
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
            className="p-5 rounded-2xl border gap-4"
            style={{
              backgroundColor: "#121318",
              borderColor: "rgba(255, 255, 255, 0.07)",
            }}
          >
            <View className="gap-1">
              <View className="flex-row items-center gap-2">
                <SlidersHorizontal size={17} color="#ffffff" />
                <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "700" }}>
                  Visibilidade de Módulos
                </Text>
              </View>
              <Text style={{ color: "#9ca3af", fontSize: 12.5 }}>
                Escolha quais seções e blocos devem ser visíveis no Dashboard geral.
              </Text>
            </View>

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
                  desc: "Métricas de faturamento, reservas e ocupação",
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
                  desc: "Gráfico e contadores de atendimentos de hoje",
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
                      backgroundColor: isChecked ? "#181920" : "#0d0e12",
                      borderColor: isChecked
                        ? "rgba(255, 255, 255, 0.14)"
                        : "rgba(255, 255, 255, 0.05)",
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
                      <Text style={{ color: "#71717a", fontSize: 11.5 }}>
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
            className="p-5 rounded-2xl border gap-3"
            style={{
              backgroundColor: "#121318",
              borderColor: "rgba(255, 255, 255, 0.07)",
            }}
          >
            <View className="gap-1">
              <View className="flex-row items-center gap-2">
                <Sparkles size={17} color="#ffffff" />
                <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "700" }}>
                  Ações Rápidas & Acesso
                </Text>
              </View>
              <Text style={{ color: "#9ca3af", fontSize: 12.5 }}>
                Atalhos para navegação externa e ferramentas administrativas.
              </Text>
            </View>

            <Pressable
              onPress={handleOpenPublicPage}
              className="flex-row items-center justify-between p-4 rounded-xl border mt-1"
              style={{
                backgroundColor: "rgba(59, 130, 246, 0.08)",
                borderColor: "rgba(59, 130, 246, 0.25)",
              }}
            >
              <View className="flex-row items-center gap-3">
                <UserRound size={18} color="#3b82f6" />
                <Text style={{ color: "#3b82f6", fontSize: 13.5, fontWeight: "700" }}>
                  Abrir Portal do Cliente
                </Text>
              </View>
              <ArrowRight size={16} color="#3b82f6" />
            </Pressable>

            <Pressable
              onPress={() => router.push("/(owner)/configuracoes" as any)}
              className="flex-row items-center justify-between p-4 rounded-xl border"
              style={{
                backgroundColor: "#181920",
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <View className="flex-row items-center gap-3">
                <Settings2 size={18} color="#ffffff" />
                <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "600" }}>
                  Configurações Gerais da Conta
                </Text>
              </View>
              <ArrowRight size={15} color="#71717a" />
            </Pressable>

            <Pressable
              onPress={handleLogout}
              className="flex-row items-center justify-between p-4 rounded-xl border"
              style={{
                backgroundColor: "#181920",
                borderColor: "rgba(239, 68, 68, 0.2)",
              }}
            >
              <View className="flex-row items-center gap-3">
                <LogOut size={18} color="#ef4444" />
                <Text style={{ color: "#ef4444", fontSize: 13.5, fontWeight: "700" }}>
                  Sair da conta
                </Text>
              </View>
              <ArrowRight size={15} color="#ef4444" />
            </Pressable>
          </View>
        )}

        {/* 8. Minimalist Bottom Save Card */}
        <View
          className="p-4 rounded-2xl border gap-3"
          style={{
            backgroundColor: "#121318",
            borderColor: "rgba(255, 255, 255, 0.07)",
          }}
        >
          <View className="flex-row items-center gap-2.5">
            <ShieldCheck size={18} color={primaryColor || "#3b82f6"} />
            <Text style={{ color: "#71717a", fontSize: 12, flex: 1, lineHeight: 16 }}>
              As personalizações aplicadas aqui valem para você e todos os profissionais desta empresa
            </Text>
          </View>

          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="flex-row items-center justify-center gap-2 py-3.5 px-4 rounded-xl"
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
