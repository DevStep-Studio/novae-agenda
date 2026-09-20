import {
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Image as ImageIcon,
  Palette,
  QrCode,
  Share2,
  Sparkles,
} from "lucide-react-native";
import { Image } from "expo-image";
import { useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
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
import { colors, radius, typography } from "@/constants/design-tokens";
import { api, resolveImageUrl } from "@/lib/api-client";
import { useSession } from "@/lib/session-context";
import { useTheme } from "@/hooks/use-theme";

export default function LinkAgendamentoScreen() {
  const { session, refresh } = useSession();
  const { colors: themeColors, primaryColor } = useTheme();

  const company = session?.company;
  const companyName = company?.name || session?.name || "Moa Tattoo";
  const [slug, setSlug] = useState(company?.publicSlug || company?.slug || "moatattoo");
  const [copied, setCopied] = useState(false);
  const [savingSlug, setSavingSlug] = useState(false);

  const publicUrl = `https://usereservei.com.br/${slug}`;
  const bannerUrl =
    resolveImageUrl(company?.bannerUrl) ||
    "https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?auto=format&fit=crop&w=1200&q=80";
  const avatarUrl = resolveImageUrl(company?.logoUrl || session?.avatarUrl);

  const handleCopy = async () => {
    try {
      await Share.share({
        message: `Agende seu horário no ${companyName}: ${publicUrl}`,
        url: publicUrl,
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      Alert.alert("Link de Agendamento", publicUrl);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Agende seu horário no ${companyName}: ${publicUrl}`,
        url: publicUrl,
      });
    } catch {
      void handleCopy();
    }
  };

  const handleOpenBrowser = () => {
    void Linking.openURL(publicUrl);
  };

  const handleSaveSlug = async () => {
    const cleanSlug = slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, "");

    if (!cleanSlug) {
      Alert.alert("Erro", "O link personalizado não pode ser vazio.");
      return;
    }

    setSavingSlug(true);
    try {
      await api("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ publicSlug: cleanSlug }),
      });
      await refresh();
      setSlug(cleanSlug);
      Alert.alert("Sucesso", "Link personalizado atualizado com sucesso!");
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível salvar o link personalizado.");
    } finally {
      setSavingSlug(false);
    }
  };

  return (
    <Screen header={<TopBar title="Link de agendamento" company={companyName} showBack={true} />} style={{ paddingTop: 16 }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ gap: 16, paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Eyebrow & Title */}
        <View className="gap-1">
          <Text style={{ color: primaryColor, ...typography.eyebrow }}>PÁGINA PÚBLICA DE RESERVAS</Text>
          <Text style={{ color: themeColors.textPrimary, ...typography.pageTitle }}>
            Link de Agendamento
          </Text>
          <Text style={{ color: themeColors.textMuted, ...typography.pageSubtitle }}>
            Receba agendamentos online 24h por dia compartilhando seu link exclusivo com clientes.
          </Text>
        </View>

        {/* Card Principal: URL & Ações de Compartilhamento */}
        <View
          className="p-5 rounded-2xl border gap-4"
          style={{
            backgroundColor: themeColors.surface,
            borderColor: themeColors.border,
          }}
        >
          <View className="flex-row items-center gap-2.5">
            <View
              className="w-9 h-9 rounded-xl items-center justify-center"
              style={{ backgroundColor: "rgba(220, 255, 76, 0.12)" }}
            >
              <Globe size={18} color={primaryColor} />
            </View>
            <View className="flex-1">
              <Text style={{ color: themeColors.textPrimary, fontSize: 14, fontWeight: "700" }}>
                Seu link oficial
              </Text>
              <Text style={{ color: themeColors.textMuted, fontSize: 12 }}>
                Acessível em qualquer navegador ou celular
              </Text>
            </View>
          </View>

          {/* Link Box */}
          <View
            className="flex-row items-center justify-between p-3.5 rounded-xl border"
            style={{
              backgroundColor: themeColors.surfaceSecondary,
              borderColor: themeColors.border,
            }}
          >
            <Text
              style={{
                color: themeColors.textPrimary,
                fontSize: 13,
                fontWeight: "600",
                flex: 1,
                marginRight: 8,
              }}
              numberOfLines={1}
            >
              {publicUrl}
            </Text>

            <Pressable
              onPress={handleCopy}
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg border"
              style={{
                backgroundColor: copied ? "rgba(16, 185, 129, 0.15)" : themeColors.surface,
                borderColor: copied ? "#10b981" : themeColors.border,
              }}
            >
              {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} color={themeColors.textPrimary} />}
              <Text
                style={{
                  color: copied ? "#10b981" : themeColors.textPrimary,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {copied ? "Copiado!" : "Copiar"}
              </Text>
            </Pressable>
          </View>

          {/* Action Buttons: Compartilhar | Abrir no Navegador */}
          <View className="flex-row gap-2.5">
            <Pressable
              onPress={handleShare}
              className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl border"
              style={{
                backgroundColor: themeColors.surfaceSecondary,
                borderColor: themeColors.border,
              }}
            >
              <Share2 size={16} color={themeColors.textPrimary} />
              <Text style={{ color: themeColors.textPrimary, fontSize: 13, fontWeight: "700" }}>
                Compartilhar
              </Text>
            </Pressable>

            <Pressable
              onPress={handleOpenBrowser}
              className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl border"
              style={{
                backgroundColor: themeColors.surfaceSecondary,
                borderColor: themeColors.border,
              }}
            >
              <ExternalLink size={16} color={themeColors.textPrimary} />
              <Text style={{ color: themeColors.textPrimary, fontSize: 13, fontWeight: "700" }}>
                Visualizar
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Card: Personalizar o Link (Slug) */}
        <View
          className="p-5 rounded-2xl border gap-3.5"
          style={{
            backgroundColor: themeColors.surface,
            borderColor: themeColors.border,
          }}
        >
          <View className="gap-1">
            <Text style={{ color: themeColors.textPrimary, fontSize: 15, fontWeight: "700" }}>
              Personalizar Endereço do Link
            </Text>
            <Text style={{ color: themeColors.textMuted, fontSize: 12.5, lineHeight: 17 }}>
              Escolha um endereço simples e memorável para sua marca (ex: usereservei.com.br/meustudio).
            </Text>
          </View>

          <View className="flex-row items-center gap-2 pt-1">
            <View
              className="flex-1 flex-row items-center px-3 rounded-xl border"
              style={{
                backgroundColor: themeColors.surfaceSecondary,
                borderColor: themeColors.border,
                height: 44,
              }}
            >
              <Text style={{ color: themeColors.textMuted, fontSize: 13, fontWeight: "500" }}>
                usereservei.com.br/
              </Text>
              <TextInput
                value={slug}
                onChangeText={(t) => setSlug(t.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="suaempresa"
                placeholderTextColor={colors.textDisabled}
                autoCapitalize="none"
                style={{
                  flex: 1,
                  color: themeColors.textPrimary,
                  fontSize: 13,
                  fontWeight: "700",
                }}
              />
            </View>

            <Pressable
              onPress={handleSaveSlug}
              disabled={savingSlug}
              className="px-4 h-11 rounded-xl items-center justify-center"
              style={{ backgroundColor: primaryColor }}
            >
              <Text style={{ color: colors.primaryForeground, fontSize: 13, fontWeight: "700" }}>
                {savingSlug ? "Salvando..." : "Salvar"}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Card: Pré-Visualização da Página do Cliente */}
        <View
          className="rounded-2xl border overflow-hidden"
          style={{
            backgroundColor: themeColors.surface,
            borderColor: themeColors.border,
          }}
        >
          {/* Banner cover */}
          <View style={{ height: 110, position: "relative", backgroundColor: "#181920" }}>
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

          {/* Info snippet */}
          <View className="p-4 pt-0 gap-3">
            <View className="flex-row items-end justify-between" style={{ marginTop: -28 }}>
              <View
                className="w-14 h-14 rounded-xl overflow-hidden border-2 items-center justify-center"
                style={{
                  backgroundColor: "#1c1d24",
                  borderColor: "#ffffff",
                }}
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                ) : (
                  <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "800" }}>
                    {companyName.slice(0, 2).toUpperCase()}
                  </Text>
                )}
              </View>

              <View
                className="flex-row items-center gap-1 px-2.5 py-1 rounded-full border mb-1"
                style={{
                  backgroundColor: "rgba(16, 185, 129, 0.15)",
                  borderColor: "#10b981",
                }}
              >
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#10b981" }} />
                <Text style={{ color: "#10b981", fontSize: 11, fontWeight: "700" }}>
                  Disponível Online
                </Text>
              </View>
            </View>

            <View className="gap-0.5">
              <Text style={{ color: themeColors.textPrimary, fontSize: 16, fontWeight: "800" }}>
                {companyName}
              </Text>
              <Text style={{ color: themeColors.textMuted, fontSize: 12 }}>
                Agendamento online sem complicação
              </Text>
            </View>

            {/* Link para personalizar no Perfil */}
            <Pressable
              onPress={() => router.push("/(owner)/perfil" as any)}
              className="flex-row items-center justify-between p-3 rounded-xl border mt-1"
              style={{
                backgroundColor: themeColors.surfaceSecondary,
                borderColor: themeColors.border,
              }}
            >
              <View className="flex-row items-center gap-2">
                <Palette size={16} color={primaryColor} />
                <Text style={{ color: themeColors.textPrimary, fontSize: 12.5, fontWeight: "600" }}>
                  Personalizar cores, logo e banner
                </Text>
              </View>
              <ArrowRight size={14} color={themeColors.textMuted} />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
