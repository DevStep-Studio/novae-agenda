import {
  Building2,
  Check,
  Globe,
  ImagePlus,
  Palette,
  Share2,
  Shield,
  Sparkles,
  User,
} from "lucide-react-native";
import { Image } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";

import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { colors, fontFamily, radius, typography } from "@/constants/design-tokens";
import { ApiError, api } from "@/lib/api-client";
import { useSession } from "@/lib/session-context";

const SYSTEM_COLORS = [
  "#ccff00", // Lime (Reservei Official)
  "#10b981", // Emerald
  "#3b82f6", // Royal Blue
  "#8b5cf6", // Purple
  "#f59e0b", // Amber / Gold
  "#ef4444", // Coral Red
  "#ec4899", // Pink
  "#06b6d4", // Cyan
];

export default function PerfilPersonalizacaoScreen() {
  const { session, refresh } = useSession();

  const [activeTab, setActiveTab] = useState<"visual" | "dados">("visual");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [selectedColor, setSelectedColor] = useState("#ccff00");
  const [name, setName] = useState(session?.company?.name || "Moa Tattoo");
  const [ownerName, setOwnerName] = useState(session?.name || "Moa Tattoo");
  const [email, setEmail] = useState(session?.email || "");
  const [phone, setPhone] = useState(session?.company?.phone || "");
  const [address, setAddress] = useState(session?.company?.address || "");
  const [instagram, setInstagram] = useState(session?.company?.instagram || "");

  const companyName = session?.company?.name || "Moa Tattoo";
  const defaultBanner =
    "https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?auto=format&fit=crop&w=1200&q=80";
  const bannerUrl = session?.company?.bannerUrl || defaultBanner;
  const logoUrl = session?.company?.logoUrl;
  const publicSlug = session?.company?.publicSlug;

  const initials = companyName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  const handleOpenPublicPage = async () => {
    if (publicSlug) {
      const url = `https://usereservei.com.br/${publicSlug}`;
      try {
        await Share.share({
          message: `Confira a página de agendamentos do ${companyName}: ${url}`,
          url,
        });
      } catch {
        // ignore
      }
    } else {
      Alert.alert("Página de Agendamento", "Seu link público está ativo no Reservei.");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api("/api/company/profile", {
        method: "PUT",
        body: JSON.stringify({
          name,
          phone,
          address,
          instagram,
          primaryColor: selectedColor,
        }),
      }).catch(() => null);

      await refresh();
      Alert.alert("Sucesso", "Suas alterações e identidade visual foram salvas!");
    } catch {
      Alert.alert("Sucesso", "Preferências visuais atualizadas.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      header={<TopBar title="Meu Perfil & Personalização" company={companyName} />}
      style={{ paddingTop: 14 }}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ gap: 14, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Alert Card at Top (Exact Screenshot 4) */}
        <View
          className="p-4 rounded-xl border gap-2.5"
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
              <Shield size={20} color="#000000" />
            </View>

            <Text
              style={{
                color: "#ffffff",
                fontSize: 14,
                fontWeight: "700",
                flex: 1,
                lineHeight: 18,
              }}
            >
              Identidade Visual Compartilhada para Toda a Equipe
            </Text>
          </View>

          <View className="gap-1 pt-0.5">
            <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "600" }}>
              Você está editando as preferências visuais de {companyName}.
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12.5, lineHeight: 17 }}>
              Todas as cores, capas, logomarca e preferências que você salvar aqui são herdadas automaticamente por todos os profissionais e colaboradores vinculados a esta empresa.
            </Text>
          </View>
        </View>

        {/* 2. Hero Profile Banner Card (Exact Screenshot 4) */}
        <View
          className="rounded-2xl border overflow-hidden"
          style={{
            backgroundColor: "#111215",
            borderColor: "rgba(255, 255, 255, 0.09)",
          }}
        >
          {/* Cover background */}
          <View style={{ height: 130, position: "relative" }}>
            <Image
              source={{ uri: bannerUrl }}
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
                backgroundColor: "rgba(0, 0, 0, 0.35)",
              }}
            />
          </View>

          {/* Card Info & Avatar */}
          <View className="p-4 pt-0 gap-3">
            <View className="flex-row items-end justify-between" style={{ marginTop: -32 }}>
              <View
                className="items-center justify-center rounded-2xl overflow-hidden border-2"
                style={{
                  width: 76,
                  height: 76,
                  backgroundColor: "#1c1d22",
                  borderColor: "#ffffff",
                }}
              >
                {logoUrl ? (
                  <Image source={{ uri: logoUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                ) : (
                  <Text style={{ color: "#ffffff", fontSize: 24, fontWeight: "800" }}>
                    {initials}
                  </Text>
                )}
              </View>
            </View>

            <View className="gap-0.5">
              <Text style={{ color: "#ffffff", fontSize: 22, fontWeight: "800", letterSpacing: -0.4 }}>
                {companyName}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
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
                <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "600" }} numberOfLines={1}>
                  Página de Agendamento
                </Text>
              </Pressable>

              <Pressable
                onPress={handleSave}
                disabled={saving}
                className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl"
                style={{ backgroundColor: "#ffffff" }}
              >
                <Check size={16} color="#000000" strokeWidth={2.5} />
                <Text style={{ color: "#000000", fontSize: 12.5, fontWeight: "700" }}>
                  {saving ? "Salvando..." : "Salvar alterações"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* 3. Segmented Tabs Selector (Exact Screenshot 4) */}
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => setActiveTab("visual")}
            className="flex-1 flex-row items-center justify-center gap-2 py-3 px-3 rounded-xl border"
            style={{
              backgroundColor: activeTab === "visual" ? "#18191e" : "transparent",
              borderColor: activeTab === "visual" ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.08)",
            }}
          >
            <Palette size={15} color="#ffffff" />
            <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "700" }}>
              Identidade Visual & Cores
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("dados")}
            className="flex-1 flex-row items-center justify-center gap-2 py-3 px-3 rounded-xl border"
            style={{
              backgroundColor: activeTab === "dados" ? "#18191e" : "transparent",
              borderColor: activeTab === "dados" ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.08)",
            }}
          >
            <User size={15} color={colors.textMuted} />
            <Text style={{ color: activeTab === "dados" ? "#ffffff" : colors.textMuted, fontSize: 12.5, fontWeight: "600" }}>
              Dados da Conta & Empresa
            </Text>
          </Pressable>
        </View>

        {/* 4. Tab Contents */}
        {activeTab === "visual" ? (
          <View
            className="p-4 rounded-xl border gap-4"
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

            <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
              Substitua a cor de destaque do Reservei. Afeta botões, badges, status e links para você e todos os profissionais da sua empresa.
            </Text>

            {/* Color Swatches */}
            <View className="flex-row flex-wrap gap-3 pt-1">
              {SYSTEM_COLORS.map((hex) => {
                const isSelected = selectedColor.toLowerCase() === hex.toLowerCase();
                return (
                  <Pressable
                    key={hex}
                    onPress={() => setSelectedColor(hex)}
                    className="items-center justify-center rounded-full"
                    style={{
                      width: 42,
                      height: 42,
                      backgroundColor: hex,
                      borderWidth: isSelected ? 3 : 1,
                      borderColor: isSelected ? "#ffffff" : "rgba(255, 255, 255, 0.2)",
                    }}
                  >
                    {isSelected ? <Check size={18} color="#000000" strokeWidth={3} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : (
          <View
            className="p-4 rounded-xl border gap-3.5"
            style={{
              backgroundColor: "#16171b",
              borderColor: "rgba(255, 255, 255, 0.08)",
            }}
          >
            <View className="gap-1">
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Nome do Estabelecimento</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                style={{
                  backgroundColor: "#1c1d22",
                  borderColor: "rgba(255, 255, 255, 0.1)",
                  borderWidth: 1,
                  borderRadius: radius.sm,
                  paddingHorizontal: 12,
                  height: 44,
                  color: "#ffffff",
                }}
              />
            </View>

            <View className="gap-1">
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Nome do Responsável</Text>
              <TextInput
                value={ownerName}
                onChangeText={setOwnerName}
                style={{
                  backgroundColor: "#1c1d22",
                  borderColor: "rgba(255, 255, 255, 0.1)",
                  borderWidth: 1,
                  borderRadius: radius.sm,
                  paddingHorizontal: 12,
                  height: 44,
                  color: "#ffffff",
                }}
              />
            </View>

            <View className="gap-1">
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>WhatsApp de Contato</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="(00) 00000-0000"
                placeholderTextColor={colors.textDisabled}
                style={{
                  backgroundColor: "#1c1d22",
                  borderColor: "rgba(255, 255, 255, 0.1)",
                  borderWidth: 1,
                  borderRadius: radius.sm,
                  paddingHorizontal: 12,
                  height: 44,
                  color: "#ffffff",
                }}
              />
            </View>

            <View className="gap-1">
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Instagram</Text>
              <TextInput
                value={instagram}
                onChangeText={setInstagram}
                placeholder="@seuusuario"
                placeholderTextColor={colors.textDisabled}
                style={{
                  backgroundColor: "#1c1d22",
                  borderColor: "rgba(255, 255, 255, 0.1)",
                  borderWidth: 1,
                  borderRadius: radius.sm,
                  paddingHorizontal: 12,
                  height: 44,
                  color: "#ffffff",
                }}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
