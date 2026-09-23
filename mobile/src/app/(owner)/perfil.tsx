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
import { useCallback, useEffect, useMemo, useState } from "react";
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

import { PageHeader } from "@/components/ui/page-header";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { colors, radius } from "@/constants/design-tokens";
import { api, resolveImageUrl, resolveImageUrlWithFallback } from "@/lib/api-client";
import { useSession } from "@/lib/session-context";
import { useTheme } from "@/hooks/use-theme";
import { Sun, Moon } from "lucide-react-native";

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
    id: "logo-1",
    name: "Barber Badge",
    url: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=300&q=80",
  },
  {
    id: "logo-2",
    name: "Vintage Emblem",
    url: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=300&q=80",
  },
  {
    id: "logo-3",
    name: "Modern Studio",
    url: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=300&q=80",
  },
  {
    id: "logo-4",
    name: "Classic Crown",
    url: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=300&q=80",
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
  const { themeMode, setThemeMode, setPrimaryColorOverride, primaryColor: themePrimaryColor } = useTheme();

  const [activeTab, setActiveTab] = useState<"visual" | "dados" | "widgets" | "atalhos">("visual");
  const [saving, setSaving] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Profile Form States
  const [name, setName] = useState(session?.name || "Proprietário");
  const [phone, setPhone] = useState(session?.phone || session?.company?.phone || "");
  const [companyName, setCompanyName] = useState(session?.company?.name || "Minha Empresa");
  const [businessType, setBusinessType] = useState(session?.company?.businessType || "");
  const [primaryColor, setPrimaryColor] = useState(
    session?.company?.primaryColor || themePrimaryColor || "#3b82f6"
  );
  const activePrimary = primaryColor || themePrimaryColor || "#3b82f6";
  const activeForeground = isLightHex(activePrimary) ? "#0a0a0a" : "#ffffff";
  const [avatarUrl, setAvatarUrl] = useState(
    session?.avatarUrl || session?.company?.logoUrl || ""
  );
  const [bannerUrl, setBannerUrl] = useState(
    session?.company?.bannerUrl || session?.bannerUrl || ""
  );

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
      setName(session.name || "Proprietário");
      setPhone(session.phone || session.company?.phone || "");
      setCompanyName(session.company?.name || "Minha Empresa");
      setBusinessType(session.company?.businessType || "");
      if (session.company?.primaryColor) {
        setPrimaryColor(session.company.primaryColor);
      }
      if (session.avatarUrl || session.company?.logoUrl) {
        setAvatarUrl(session.avatarUrl || session.company?.logoUrl || "");
      }
      if (session.company?.bannerUrl || session.bannerUrl) {
        setBannerUrl(session.company?.bannerUrl || session.bannerUrl || "");
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
    "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80";

  const bannerUris = useMemo(() => resolveImageUrlWithFallback(bannerUrl), [bannerUrl]);
  const avatarUris = useMemo(() => resolveImageUrlWithFallback(avatarUrl), [avatarUrl]);

  const [bannerFailedPrimary, setBannerFailedPrimary] = useState(false);
  const [bannerFailedFallback, setBannerFailedFallback] = useState(false);
  const [avatarFailedPrimary, setAvatarFailedPrimary] = useState(false);
  const [avatarFailedFallback, setAvatarFailedFallback] = useState(false);

  useEffect(() => {
    setBannerFailedPrimary(false);
    setBannerFailedFallback(false);
  }, [bannerUrl]);

  useEffect(() => {
    setAvatarFailedPrimary(false);
    setAvatarFailedFallback(false);
  }, [avatarUrl]);

  const activeBannerUri = !bannerFailedPrimary
    ? (bannerUris.primary || defaultBanner)
    : !bannerFailedFallback
    ? (bannerUris.fallback || defaultBanner)
    : defaultBanner;

  const activeAvatarUri = !avatarFailedPrimary
    ? avatarUris.primary
    : !avatarFailedFallback
    ? avatarUris.fallback
    : null;

  const handleBannerError = () => {
    if (!bannerFailedPrimary && bannerUris.fallback && bannerUris.fallback !== bannerUris.primary) {
      setBannerFailedPrimary(true);
    } else {
      setBannerFailedFallback(true);
    }
  };

  const handleAvatarError = () => {
    if (!avatarFailedPrimary && avatarUris.fallback && avatarUris.fallback !== avatarUris.primary) {
      setAvatarFailedPrimary(true);
    } else {
      setAvatarFailedFallback(true);
    }
  };

  const publicSlug = session?.company?.publicSlug || session?.company?.slug;

  const initials = (name || session?.name || companyName || "PL")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  const handleOpenPublicPage = async () => {
    const slug = publicSlug || "barbeariapelly";
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
      if (primaryColor) {
        await setPrimaryColorOverride(primaryColor);
      }

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
        {/* Header Section */}
        <PageHeader
          eyebrow="CONTA & IDENTIDADE VISUAL"
          title="Meu Perfil"
          subtitle="Personalize as cores, fotos de capa e informações da sua conta e da equipe."
        />

        {/* 1. Shared Visual Identity Notice Banner (Web Parity) */}
        <View
          className="p-3.5 rounded-2xl border"
          style={{
            backgroundColor: "#121318",
            borderColor: "rgba(255, 255, 255, 0.08)",
          }}
        >
          <View className="flex-row items-center gap-3.5">
            <View
              className="items-center justify-center rounded-xl border"
              style={{
                width: 38,
                height: 38,
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                borderColor: "rgba(255, 255, 255, 0.12)",
              }}
            >
              <ShieldCheck size={20} color="#ffffff" strokeWidth={2} />
            </View>

            <View className="flex-1">
              <Text
                style={{
                  color: "#ffffff",
                  fontSize: 14,
                  fontWeight: "700",
                  lineHeight: 19,
                }}
              >
                Identidade Visual Compartilhada para Toda a Equipe
              </Text>
            </View>
          </View>
        </View>

        {/* 2. Hero Live Preview Card (Matching Web Exactly) */}
        <View
          className="rounded-2xl border overflow-hidden"
          style={{
            backgroundColor: "#121318",
            borderColor: "rgba(255, 255, 255, 0.08)",
          }}
        >
          {/* Cover background */}
          <View style={{ height: 160, position: "relative", backgroundColor: "#181920" }}>
            <Image
              source={{ uri: activeBannerUri }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              onError={handleBannerError}
            />
            {/* Linear Gradient Fade Overlay */}
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(10, 11, 14, 0.55)",
              }}
            />
          </View>

          {/* Overlapping Avatar, Info & Hero Buttons */}
          <View className="px-4 pb-4 pt-0 gap-3.5">
            <View className="flex-row items-end gap-3.5" style={{ marginTop: -40 }}>
              <View
                className="items-center justify-center rounded-2xl overflow-hidden"
                style={{
                  width: 80,
                  height: 80,
                  backgroundColor: "#181920",
                  borderWidth: 3.5,
                  borderColor: "#121318",
                  shadowColor: "#000000",
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.45,
                  shadowRadius: 10,
                }}
              >
                {activeAvatarUri ? (
                  <Image
                    source={{ uri: activeAvatarUri }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                    onError={handleAvatarError}
                  />
                ) : (
                  <Text style={{ color: "#ffffff", fontSize: 28, fontWeight: "800" }}>
                    {initials}
                  </Text>
                )}
              </View>

              <View className="flex-1 gap-0.5 pb-1">
                <Text
                  style={{
                    color: "#ffffff",
                    fontSize: 22,
                    fontWeight: "800",
                    letterSpacing: -0.4,
                  }}
                  numberOfLines={1}
                >
                  {name || session?.name || "PL"}
                </Text>
                <Text style={{ color: "#9ca3af", fontSize: 13, fontWeight: "500" }} numberOfLines={1}>
                  {companyName} · Proprietário
                </Text>
              </View>
            </View>

            {/* Hero Actions Row: [ Página de Agendamento ] & [ Salvar alterações ] */}
            <View className="flex-row items-center gap-2.5 pt-1">
              <Pressable
                onPress={handleOpenPublicPage}
                className="flex-1 flex-row items-center justify-center gap-2 py-3 px-3.5 rounded-xl border"
                style={{
                  backgroundColor: "#17181f",
                  borderColor: "rgba(255, 255, 255, 0.12)",
                  height: 44,
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
                className="flex-1 flex-row items-center justify-center gap-2 py-3 px-3.5 rounded-xl border"
                style={{
                  backgroundColor: activePrimary,
                  borderColor: "transparent",
                  height: 44,
                }}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={activeForeground} />
                ) : (
                  <>
                    <Check size={16} color={activeForeground} strokeWidth={2.5} />
                    <Text style={{ color: activeForeground, fontSize: 12.5, fontWeight: "700" }}>
                      Salvar alterações
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>

        {/* 3. Navigation Tabs Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
        >
          <Pressable
            onPress={() => setActiveTab("visual")}
            className="flex-row items-center justify-center gap-2 py-3 px-4 rounded-xl border"
            style={{
              backgroundColor: activeTab === "visual" ? "#1e2027" : "#121318",
              borderColor:
                activeTab === "visual"
                  ? "rgba(255, 255, 255, 0.25)"
                  : "rgba(255, 255, 255, 0.08)",
              height: 46,
            }}
          >
            <Palette size={16} color={activeTab === "visual" ? "#ffffff" : "#9ca3af"} />
            <Text
              style={{
                color: activeTab === "visual" ? "#ffffff" : "#9ca3af",
                fontSize: 13,
                fontWeight: activeTab === "visual" ? "700" : "600",
              }}
            >
              Identidade Visual & Cores
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("dados")}
            className="flex-row items-center justify-center gap-2 py-3 px-4 rounded-xl border"
            style={{
              backgroundColor: activeTab === "dados" ? "#1e2027" : "#121318",
              borderColor:
                activeTab === "dados"
                  ? "rgba(255, 255, 255, 0.25)"
                  : "rgba(255, 255, 255, 0.08)",
              height: 46,
            }}
          >
            <User size={16} color={activeTab === "dados" ? "#ffffff" : "#9ca3af"} />
            <Text
              style={{
                color: activeTab === "dados" ? "#ffffff" : "#9ca3af",
                fontSize: 13,
                fontWeight: activeTab === "dados" ? "700" : "600",
              }}
            >
              Dados da Conta & Empresa
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("widgets")}
            className="flex-row items-center justify-center gap-2 py-3 px-4 rounded-xl border"
            style={{
              backgroundColor: activeTab === "widgets" ? "#1e2027" : "#121318",
              borderColor:
                activeTab === "widgets"
                  ? "rgba(255, 255, 255, 0.25)"
                  : "rgba(255, 255, 255, 0.08)",
              height: 46,
            }}
          >
            <SlidersHorizontal
              size={16}
              color={activeTab === "widgets" ? "#ffffff" : "#9ca3af"}
            />
            <Text
              style={{
                color: activeTab === "widgets" ? "#ffffff" : "#9ca3af",
                fontSize: 13,
                fontWeight: activeTab === "widgets" ? "700" : "600",
              }}
            >
              Widgets do Início
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("atalhos")}
            className="flex-row items-center justify-center gap-2 py-3 px-4 rounded-xl border"
            style={{
              backgroundColor: activeTab === "atalhos" ? "#1e2027" : "#121318",
              borderColor:
                activeTab === "atalhos"
                  ? "rgba(255, 255, 255, 0.25)"
                  : "rgba(255, 255, 255, 0.08)",
              height: 46,
            }}
          >
            <Sparkles size={16} color={activeTab === "atalhos" ? "#ffffff" : "#9ca3af"} />
            <Text
              style={{
                color: activeTab === "atalhos" ? "#ffffff" : "#9ca3af",
                fontSize: 13,
                fontWeight: activeTab === "atalhos" ? "700" : "600",
              }}
            >
              Ações & Links
            </Text>
          </Pressable>
        </ScrollView>

        {/* 4. Tab 1: Identidade Visual & Cores */}
        {activeTab === "visual" && (
          <View className="gap-4">
            {/* Card 1: Cor Primária do Sistema */}
            <View
              className="p-5 rounded-2xl border gap-4"
              style={{
                backgroundColor: "#121318",
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <View className="gap-1.5">
                <View className="flex-row items-center gap-2">
                  <Palette size={18} color="#ffffff" />
                  <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "700" }}>
                    Cor Primária do Sistema
                  </Text>
                </View>
                <Text style={{ color: "#9ca3af", fontSize: 13, lineHeight: 18 }}>
                  Substitua a cor de destaque do Reservei. Afeta botões, badges, status e links para você e todos os profissionais da sua empresa.
                </Text>
              </View>

              {/* Color Preset Circles Grid (8 in row 1, 1 in row 2) */}
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

              {/* Custom Color Hex Input Row */}
              <View
                className="flex-row items-center gap-2.5 p-2.5 rounded-xl border"
                style={{
                  backgroundColor: "#0d0e12",
                  borderColor: "rgba(255, 255, 255, 0.08)",
                }}
              >
                <View
                  className="rounded-lg border"
                  style={{
                    width: 38,
                    height: 38,
                    backgroundColor: primaryColor,
                    borderColor: "rgba(255, 255, 255, 0.2)",
                  }}
                />

                <TextInput
                  value={primaryColor}
                  onChangeText={setPrimaryColor}
                  placeholder="#696969"
                  placeholderTextColor="#52525b"
                  maxLength={9}
                  style={{
                    flex: 1,
                    backgroundColor: "#16171e",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    height: 40,
                    color: "#ffffff",
                    fontSize: 13.5,
                    fontWeight: "600",
                  }}
                />

                <Pressable
                  onPress={() => setPrimaryColor("#3b82f6")}
                  className="px-3.5 rounded-lg border items-center justify-center"
                  style={{
                    backgroundColor: "#181920",
                    borderColor: "rgba(255, 255, 255, 0.12)",
                    height: 40,
                  }}
                >
                  <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "600" }}>
                    Restaurar padrão
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Card 2: Banner de Capa */}
            <View
              className="p-5 rounded-2xl border gap-4"
              style={{
                backgroundColor: "#121318",
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <ImagePlus size={18} color="#ffffff" />
                  <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "700" }}>
                    Banner de Capa
                  </Text>
                </View>

                <Pressable
                  onPress={handlePickBanner}
                  disabled={uploadingBanner}
                  className="flex-row items-center gap-1.5 px-3 py-2 rounded-lg border"
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
                      <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "600" }}>
                        Upload do Celular
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>

              <Text style={{ color: "#9ca3af", fontSize: 13, lineHeight: 18, marginTop: -4 }}>
                Imagem decorativa de destaque exibida no topo do painel inicial para você e toda a equipe.
              </Text>

              {/* URL Input & Limpar Button */}
              <View className="flex-row items-center gap-2">
                <TextInput
                  value={bannerUrl}
                  onChangeText={(text) => {
                    setBannerUrl(text);
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
                    }}
                    className="px-3.5 border items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: "#181920",
                      borderColor: "rgba(255, 255, 255, 0.12)",
                      height: 42,
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
                <Text style={{ fontSize: 12.5, fontWeight: "600", color: "#9ca3af" }}>
                  Sugestões de Capas Profissionais:
                </Text>

                <View className="flex-row flex-wrap gap-2.5 justify-between">
                  {BANNER_PRESETS.map((preset) => {
                    const isSelected = bannerUrl === preset.url;
                    return (
                      <Pressable
                        key={preset.id}
                        onPress={() => {
                          setBannerUrl(preset.url);
                        }}
                        className="rounded-xl overflow-hidden border"
                        style={{
                          width: "48.5%",
                          height: 58,
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
                            justifyContent: "flex-end",
                            paddingHorizontal: 8,
                            paddingBottom: 6,
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

            {/* Card 3: Logo da Empresa */}
            <View
              className="p-5 rounded-2xl border gap-4"
              style={{
                backgroundColor: "#121318",
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <ImageIcon size={18} color="#ffffff" />
                  <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "700" }}>
                    Logo
                  </Text>
                </View>

                <Pressable
                  onPress={handlePickAvatar}
                  disabled={uploadingAvatar}
                  className="flex-row items-center gap-1.5 px-3 py-2 rounded-lg border"
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
                      <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "600" }}>
                        Upload da Logo
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>

              <Text style={{ color: "#9ca3af", fontSize: 13, lineHeight: 18, marginTop: -4 }}>
                Logotipo da empresa exibido no topo do menu lateral, banner de boas-vindas e página de agendamento online.
              </Text>

              {/* Preview da Logo Selecionada */}
              {activeAvatarUri ? (
                <View
                  className="flex-row items-center gap-3 p-3 rounded-xl border"
                  style={{ backgroundColor: "#0d0e12", borderColor: "rgba(255, 255, 255, 0.08)" }}
                >
                  <View
                    className="items-center justify-center overflow-hidden border"
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 12,
                      backgroundColor: "#181920",
                      borderColor: "rgba(255, 255, 255, 0.15)",
                    }}
                  >
                    <Image
                      source={{ uri: activeAvatarUri }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                      onError={handleAvatarError}
                    />
                  </View>
                  <View className="flex-1 gap-0.5">
                    <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700" }}>
                      Logo Ativa
                    </Text>
                    <Text style={{ color: "#9ca3af", fontSize: 11.5 }} numberOfLines={1}>
                      {avatarUrl || "Logotipo carregado"}
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* URL Input & Limpar Button */}
              <View className="flex-row items-center gap-2">
                <TextInput
                  value={avatarUrl}
                  onChangeText={(text) => {
                    setAvatarUrl(text);
                  }}
                  placeholder="https://exemplo.com/logo.png"
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
                    }}
                    className="px-3.5 border items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: "#181920",
                      borderColor: "rgba(255, 255, 255, 0.12)",
                      height: 42,
                    }}
                  >
                    <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "600" }}>
                      Limpar
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Suggested Logos List */}
              <View className="gap-2.5 pt-1">
                <Text style={{ fontSize: 12.5, fontWeight: "600", color: "#9ca3af" }}>
                  Logos e Ícones Sugeridos:
                </Text>

                <View className="flex-row items-center gap-3.5">
                  {AVATAR_PRESETS.map((preset) => {
                    const isSelected = avatarUrl === preset.url;
                    return (
                      <Pressable
                        key={preset.id}
                        onPress={() => {
                          setAvatarUrl(preset.url);
                        }}
                        className="overflow-hidden border-2"
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 12,
                          backgroundColor: "#181920",
                          borderColor: isSelected
                            ? (primaryColor || "#ffffff")
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

        {/* 8. Bottom Save Card (Matching Screenshot 3) */}
        <View
          className="p-4 rounded-2xl border gap-3.5"
          style={{
            backgroundColor: "#121318",
            borderColor: "rgba(255, 255, 255, 0.08)",
          }}
        >
          <View className="flex-row items-start gap-2.5">
            <ShieldCheck size={18} color="#9ca3af" style={{ marginTop: 1 }} />
            <Text style={{ color: "#9ca3af", fontSize: 12.5, flex: 1, lineHeight: 17 }}>
              As personalizações aplicadas aqui valem para você e todos os profissionais desta empresa.
            </Text>
          </View>

          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="flex-row items-center justify-center gap-2 py-3 px-4 rounded-xl border"
            style={{
              backgroundColor: activePrimary,
              borderColor: "transparent",
              height: 44,
            }}
          >
            {saving ? (
              <ActivityIndicator size="small" color={activeForeground} />
            ) : (
              <>
                <Check size={16} color={activeForeground} strokeWidth={2.5} />
                <Text style={{ color: activeForeground, fontSize: 13.5, fontWeight: "700" }}>
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
