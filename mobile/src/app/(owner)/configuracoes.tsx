import {
  Building2,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Fingerprint,
  Globe,
  MapPin,
  Phone,
  Save,
  Share2,
  Shield,
  Sliders,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { colors, fontFamily, radius, typography } from "@/constants/design-tokens";
import { ApiError } from "@/lib/api-client";
import {
  isBiometricsSupported,
  isBiometricsEnabled,
  setBiometricsEnabled,
  promptBiometricAuth,
} from "@/lib/biometrics";
import {
  getCompanyProfile,
  getCompanySettings,
  updateCompanyProfile,
  updateCompanySettings,
  type CompanyDTO,
  type CompanySettingsDTO,
} from "@/lib/company-settings";

export default function ConfiguracoesScreen() {
  const [profile, setProfile] = useState<CompanyDTO | null>(null);
  const [settings, setSettings] = useState<CompanySettingsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [instagram, setInstagram] = useState("");
  const [openTime, setOpenTime] = useState("08:00");
  const [closeTime, setCloseTime] = useState("19:00");
  const [minLeadMinutes, setMinLeadMinutes] = useState("60");
  const [cancellationHours, setCancellationHours] = useState("2");

  // Biometrics & App Settings
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricsEnabledState, setBiometricsEnabledState] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [prof, sett, bioSupp, bioEn] = await Promise.all([
        getCompanyProfile(),
        getCompanySettings(),
        isBiometricsSupported(),
        isBiometricsEnabled(),
      ]);
      setProfile(prof);
      setSettings(sett);
      setBiometricsAvailable(bioSupp);
      setBiometricsEnabledState(bioEn);

      if (prof) {
        setName(prof.name || "");
        setWhatsapp(prof.whatsapp || "");
        setAddress(prof.address || "");
        setInstagram(prof.instagram || "");
      }

      if (sett) {
        setOpenTime(sett.openTime || "08:00");
        setCloseTime(sett.closeTime || "19:00");
        setMinLeadMinutes(String(sett.minLeadMinutes || 60));
        setCancellationHours(String(sett.cancellationHours || 2));
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar as configurações."
      );
    }
  }, []);

  async function handleToggleBiometrics(val: boolean) {
    if (val) {
      const authenticated = await promptBiometricAuth("Confirme para ativar a biometria");
      if (authenticated) {
        await setBiometricsEnabled(true);
        setBiometricsEnabledState(true);
        Alert.alert("Biometria Ativada", "Você agora pode desbloquear o Reservei usando sua biometria.");
      } else {
        setBiometricsEnabledState(false);
      }
    } else {
      await setBiometricsEnabled(false);
      setBiometricsEnabledState(false);
    }
  }

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

  const publicUrl = profile?.publicSlug
    ? `https://usereservei.com.br/r/${profile.publicSlug}`
    : "https://usereservei.com.br";

  async function handleShareLink() {
    try {
      await Share.share({
        message: `Agende seu horário online no ${profile?.name || "nosso espaço"}: ${publicUrl}`,
        url: publicUrl,
      });
    } catch (err) {
      // Ignored
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      await Promise.all([
        updateCompanyProfile({
          name: name.trim(),
          whatsapp: whatsapp.trim() || null,
          address: address.trim() || null,
          instagram: instagram.trim() || null,
        }),
        updateCompanySettings({
          openTime,
          closeTime,
          minLeadMinutes: Number(minLeadMinutes) || 60,
          cancellationHours: Number(cancellationHours) || 2,
        }),
      ]);

      Alert.alert("Sucesso", "Configurações atualizadas com sucesso!");
      await load();
    } catch (err) {
      Alert.alert(
        "Erro ao salvar",
        err instanceof ApiError ? err.message : "Não foi possível salvar os dados."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      header={<TopBar title="Configurações & Perfil" company="Dados do estabelecimento" showBack={true} />}
      style={{ paddingTop: 16 }}
    >
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-6 text-center">
          <Text style={{ color: colors.danger, textAlign: "center", marginBottom: 12 }}>
            {error}
          </Text>
          <Button label="Tentar novamente" onPress={load} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40, gap: 20 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {/* Card do Link de Agendamento Público */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.primary,
              borderWidth: 1.5,
              borderRadius: radius.md,
              padding: 16,
              gap: 12,
            }}
          >
            <View className="flex-row items-center gap-2">
              <Globe size={18} color={colors.primary} />
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: 16,
                  fontFamily: fontFamily.display,
                }}
              >
                Link de Agendamento Online
              </Text>
            </View>

            <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
              Compartilhe com seus clientes nas redes sociais e WhatsApp para receber agendamentos automáticos 24/7.
            </Text>

            <View
              className="flex-row items-center justify-between rounded-lg p-2.5 border"
              style={{
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.border,
              }}
            >
              <Text
                numberOfLines={1}
                style={{ color: colors.primary, fontSize: 13, fontWeight: "600", flex: 1 }}
              >
                {publicUrl}
              </Text>
            </View>

            <View className="flex-row gap-2">
              <Pressable
                onPress={handleShareLink}
                style={{
                  flex: 1,
                  backgroundColor: colors.primary,
                  height: 40,
                  borderRadius: radius.sm,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Share2 size={16} color={colors.primaryForeground} />
                <Text
                  style={{
                    color: colors.primaryForeground,
                    fontSize: 13,
                    fontWeight: "700",
                  }}
                >
                  Compartilhar Link
                </Text>
              </Pressable>

              <Pressable
                onPress={() => Linking.openURL(publicUrl)}
                style={{
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.border,
                  borderWidth: 1,
                  paddingHorizontal: 14,
                  height: 40,
                  borderRadius: radius.sm,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <ExternalLink size={16} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>
                  Abrir
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Dados Gerais da Empresa */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radius.md,
              padding: 16,
              gap: 14,
            }}
          >
            <View className="flex-row items-center gap-2">
              <Building2 size={18} color={colors.primary} />
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: 16,
                  fontFamily: fontFamily.display,
                }}
              >
                Dados do Estabelecimento
              </Text>
            </View>

            <View className="gap-1">
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "500" }}>
                Nome da Empresa *
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Ex: Barbearia Reservei"
                placeholderTextColor={colors.textDisabled}
                style={{
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: radius.sm,
                  paddingHorizontal: 12,
                  height: 44,
                  color: colors.textPrimary,
                  fontSize: 14,
                }}
              />
            </View>

            <View className="gap-1">
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "500" }}>
                WhatsApp do Estabelecimento
              </Text>
              <TextInput
                value={whatsapp}
                onChangeText={setWhatsapp}
                placeholder="(11) 99999-9999"
                keyboardType="phone-pad"
                placeholderTextColor={colors.textDisabled}
                style={{
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: radius.sm,
                  paddingHorizontal: 12,
                  height: 44,
                  color: colors.textPrimary,
                  fontSize: 14,
                }}
              />
            </View>

            <View className="gap-1">
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "500" }}>
                Endereço
              </Text>
              <TextInput
                value={address}
                onChangeText={setAddress}
                placeholder="Av. Paulista, 1000 - Sala 42"
                placeholderTextColor={colors.textDisabled}
                style={{
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: radius.sm,
                  paddingHorizontal: 12,
                  height: 44,
                  color: colors.textPrimary,
                  fontSize: 14,
                }}
              />
            </View>

            <View className="gap-1">
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "500" }}>
                Instagram
              </Text>
              <TextInput
                value={instagram}
                onChangeText={setInstagram}
                placeholder="@seu_perfil"
                placeholderTextColor={colors.textDisabled}
                style={{
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: radius.sm,
                  paddingHorizontal: 12,
                  height: 44,
                  color: colors.textPrimary,
                  fontSize: 14,
                }}
              />
            </View>
          </View>

          {/* Horários e Regras de Agendamento */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radius.md,
              padding: 16,
              gap: 14,
            }}
          >
            <View className="flex-row items-center gap-2">
              <Clock size={18} color={colors.primary} />
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: 16,
                  fontFamily: fontFamily.display,
                }}
              >
                Horários de Atendimento & Regras
              </Text>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1 gap-1">
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Horário de Abertura
                </Text>
                <TextInput
                  value={openTime}
                  onChangeText={setOpenTime}
                  placeholder="08:00"
                  placeholderTextColor={colors.textDisabled}
                  style={{
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: radius.sm,
                    paddingHorizontal: 12,
                    height: 44,
                    color: colors.textPrimary,
                    fontSize: 14,
                  }}
                />
              </View>

              <View className="flex-1 gap-1">
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Horário de Fechamento
                </Text>
                <TextInput
                  value={closeTime}
                  onChangeText={setCloseTime}
                  placeholder="19:00"
                  placeholderTextColor={colors.textDisabled}
                  style={{
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: radius.sm,
                    paddingHorizontal: 12,
                    height: 44,
                    color: colors.textPrimary,
                    fontSize: 14,
                  }}
                />
              </View>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1 gap-1">
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Antecedência Mínima (minutos)
                </Text>
                <TextInput
                  value={minLeadMinutes}
                  onChangeText={setMinLeadMinutes}
                  keyboardType="numeric"
                  placeholder="60"
                  placeholderTextColor={colors.textDisabled}
                  style={{
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: radius.sm,
                    paddingHorizontal: 12,
                    height: 44,
                    color: colors.textPrimary,
                    fontSize: 14,
                  }}
                />
              </View>

              <View className="flex-1 gap-1">
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Limite Cancelamento (horas)
                </Text>
                <TextInput
                  value={cancellationHours}
                  onChangeText={setCancellationHours}
                  keyboardType="numeric"
                  placeholder="2"
                  placeholderTextColor={colors.textDisabled}
                  style={{
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: radius.sm,
                    paddingHorizontal: 12,
                    height: 44,
                    color: colors.textPrimary,
                    fontSize: 14,
                  }}
                />
              </View>
            </View>
          </View>

          {/* Segurança & Biometria (P1 Item 6) */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radius.md,
              padding: 16,
              gap: 12,
            }}
          >
            <View className="flex-row items-center gap-2">
              <Fingerprint size={18} color={colors.primary} />
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: 16,
                  fontFamily: fontFamily.display,
                }}
              >
                Segurança & Acesso Rápido
              </Text>
            </View>

            <View className="flex-row items-center justify-between">
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "600" }}>
                  Desbloqueio com Face ID / Biometria
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                  {biometricsAvailable
                    ? "Acesse sua conta com segurança usando o leitor biométrico do dispositivo."
                    : "Biometria não configurada ou não disponível neste aparelho."}
                </Text>
              </View>
              <Switch
                value={biometricsEnabledState}
                onValueChange={handleToggleBiometrics}
                disabled={!biometricsAvailable}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Preferências de Notificação (P1 Item 8) */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radius.md,
              padding: 16,
              gap: 12,
            }}
          >
            <View className="flex-row items-center gap-2">
              <Sliders size={18} color={colors.primary} />
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: 16,
                  fontFamily: fontFamily.display,
                }}
              >
                Preferências de Notificação
              </Text>
            </View>

            <View className="flex-row items-center justify-between">
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "600" }}>
                  Notificações Push
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                  Receba avisos imediatos de novas reservas, reagendamentos e cancelamentos.
                </Text>
              </View>
              <Switch
                value={pushEnabled}
                onValueChange={setPushEnabled}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Botão de Salvar */}
          <Button
            label={saving ? "Salvando alterações..." : "Salvar Configurações"}
            onPress={handleSave}
            disabled={saving}
          />

          {/* Zona de Privacidade e Exclusão de Conta (App Store / Google Play Compliance) */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radius.md,
              padding: 16,
              gap: 12,
              marginTop: 8,
            }}
          >
            <View className="flex-row items-center gap-2">
              <Shield size={18} color={colors.textSecondary} />
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: 15,
                  fontWeight: "600",
                }}
              >
                Privacidade e Conta
              </Text>
            </View>

            <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
              Em conformidade com a LGPD e diretrizes da App Store e Google Play, você pode solicitar a exclusão definitiva da sua conta e de todos os seus dados pessoais a qualquer momento.
            </Text>

            <Button
              label="Excluir Minha Conta"
              variant="danger"
              onPress={() => {
                Alert.alert(
                  "Excluir Conta Definitivamente",
                  "Esta ação é irreversível. Todos os seus dados, estabelecimentos vinculados e registros serão permanentemente removidos. Deseja continuar?",
                  [
                    { text: "Cancelar", style: "cancel" },
                    {
                      text: "Sim, Excluir",
                      style: "destructive",
                      onPress: async () => {
                        try {
                          await fetch("/api/account/delete-request", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ confirmation: "EXCLUIR" }),
                          });
                          Alert.alert("Conta Excluída", "Sua conta foi excluída com sucesso.");
                        } catch {
                          Alert.alert("Erro", "Não foi possível concluir a exclusão. Entre em contato com o suporte.");
                        }
                      },
                    },
                  ]
                );
              }}
            />
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

