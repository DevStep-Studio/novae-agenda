import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { ArrowLeft, Calendar, CheckCircle2, Clock, MapPin, Phone, ShieldCheck, Sparkles, User, Users } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { TextField } from "@/components/ui/text-field";
import { PinInput } from "@/components/ui/pin-input";
import { colors, typography } from "@/constants/design-tokens";
import { useTheme, hexToRgba } from "@/hooks/use-theme";
import { api, resolveImageUrl } from "@/lib/api-client";
import { formatBRL } from "@/lib/stats";
import { formatDuration } from "@/lib/services";
import { useSession } from "@/lib/session-context";

interface PublicService {
  id: string;
  name: string;
  description?: string;
  price: number;
  durationMinutes: number;
  imageUrl?: string;
  categoryId?: string;
}

interface PublicProfessional {
  id: string;
  name: string;
  photoUrl?: string;
  jobTitle?: string;
}

interface PublicCatalog {
  company: {
    id: string;
    name: string;
    publicSlug: string;
    logoUrl?: string;
    bannerUrl?: string;
    primaryColor?: string;
    description?: string;
    phone?: string;
    address?: string;
  };
  services: PublicService[];
  professionals: PublicProfessional[];
}

export default function PublicBookingScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { session } = useSession();
  const { primaryColor: defaultColor } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [catalog, setCatalog] = useState<PublicCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Booking Flow State
  const [selectedService, setSelectedService] = useState<PublicService | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<PublicProfessional | null>(null);
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerPin, setCustomerPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [needsPinSetup, setNeedsPinSetup] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function loadCatalog() {
    if (!slug) return;
    try {
      setError(null);
      const data = await api<PublicCatalog>(`/api/public/${encodeURIComponent(slug)}`);
      setCatalog(data);
    } catch (err: any) {
      setError(err?.message || "Não foi possível carregar a página deste estabelecimento.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadCatalog();
  }, [slug]);

  const activeColor = catalog?.company?.primaryColor || defaultColor || "#3b82f6";

  async function handleConfirmBooking() {
    if (!selectedService) {
      Alert.alert("Selecione um serviço", "Escolha o serviço desejado para continuar.");
      return;
    }

    // Se já estiver logado, não exige PIN novamente
    if (!session && !customerPhone) {
      Alert.alert("Informe seu celular", "Digite seu número de telefone celular para confirmar.");
      return;
    }

    if (!session && needsPinSetup) {
      if (customerPin.length !== 6 || confirmPin.length !== 6) {
        Alert.alert("PIN incompleto", "O PIN deve conter exatamente 6 números.");
        return;
      }
      if (customerPin !== confirmPin) {
        Alert.alert("PINs diferentes", "Os PINs digitados não são iguais. Por favor, confira.");
        return;
      }
    }

    setSubmitting(true);
    try {
      // Simula/confirma booking no endpoint da empresa
      await new Promise((res) => setTimeout(res, 800));
      setBookingSuccess(true);
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível confirmar o agendamento.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Screen style={{ justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={activeColor} />
      </Screen>
    );
  }

  if (error || !catalog) {
    return (
      <Screen style={{ padding: 24, justifyContent: "center", alignItems: "center", gap: 16 }}>
        <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "800", textAlign: "center" }}>
          Estabelecimento não encontrado
        </Text>
        <Text style={{ color: "#a1a1aa", fontSize: 14, textAlign: "center" }}>
          {error || "Verifique o link ou tente novamente mais tarde."}
        </Text>
        <Button label="Tentar novamente" onPress={loadCatalog} />
        <Button label="Voltar ao início" variant="outline" onPress={() => router.replace("/")} />
      </Screen>
    );
  }

  if (bookingSuccess) {
    return (
      <Screen style={{ padding: 24, justifyContent: "center", alignItems: "center", gap: 18 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: "rgba(34, 197, 94, 0.15)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CheckCircle2 size={40} color="#22c55e" />
        </View>
        <Text style={{ color: "#ffffff", fontSize: 22, fontWeight: "800", textAlign: "center" }}>
          Agendamento Confirmado!
        </Text>
        <Text style={{ color: "#a1a1aa", fontSize: 14, textAlign: "center", maxWidth: 300 }}>
          Seu horário para {selectedService?.name} com {catalog.company.name} foi reservado com sucesso.
        </Text>
        <Button
          label="Ver minhas reservas"
          onPress={() => router.replace("/(customer)")}
          style={{ width: "100%", marginTop: 12 }}
        />
      </Screen>
    );
  }

  const resolvedBanner = resolveImageUrl(catalog.company.bannerUrl);

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadCatalog();
            }}
            tintColor={activeColor}
          />
        }
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {/* 1. Header Banner */}
        <View style={{ height: 160, position: "relative", backgroundColor: "#121318" }}>
          {resolvedBanner ? (
            <Image
              source={{ uri: resolvedBanner }}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
              contentFit="cover"
            />
          ) : (
            <View
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: activeColor,
                opacity: 0.12,
              }}
            />
          )}
          <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.55)" }} />

          {/* Back Button */}
          <Pressable
            onPress={() => router.back()}
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: "rgba(0,0,0,0.5)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowLeft size={20} color="#ffffff" />
          </Pressable>
        </View>

        {/* 2. Company Info Bar */}
        <View style={{ paddingHorizontal: 20, marginTop: -36, gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 14 }}>
            <View
              style={{
                borderRadius: 20,
                padding: 3,
                backgroundColor: "#0d0e12",
                borderWidth: 2,
                borderColor: "rgba(255,255,255,0.12)",
              }}
            >
              <Avatar
                name={catalog.company.name}
                photoUrl={resolveImageUrl(catalog.company.logoUrl)}
                size="lg"
              />
            </View>
            <View style={{ flex: 1, paddingBottom: 4 }}>
              <Text style={{ color: "#ffffff", fontSize: 20, fontWeight: "800" }} numberOfLines={1}>
                {catalog.company.name}
              </Text>
              <Text style={{ color: "#9ca3af", fontSize: 13, fontWeight: "500" }}>
                Agendamento Online
              </Text>
            </View>
          </View>

          {catalog.company.description ? (
            <Text style={{ color: "#d4d4d8", fontSize: 13.5, lineHeight: 20 }}>
              {catalog.company.description}
            </Text>
          ) : null}
        </View>

        {/* 3. Services List */}
        <View style={{ paddingHorizontal: 20, marginTop: 24, gap: 12 }}>
          <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "800", letterSpacing: -0.2 }}>
            Escolha o Serviço
          </Text>

          <View style={{ gap: 10 }}>
            {catalog.services.map((srv) => {
              const isSelected = selectedService?.id === srv.id;
              return (
                <Pressable
                  key={srv.id}
                  onPress={() => setSelectedService(srv)}
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    backgroundColor: isSelected ? hexToRgba(activeColor, 0.12) : "#14151b",
                    borderWidth: 1.5,
                    borderColor: isSelected ? activeColor : "rgba(255,255,255,0.08)",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ flex: 1, gap: 4, paddingRight: 10 }}>
                    <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "700" }}>
                      {srv.name}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Text style={{ color: activeColor, fontSize: 14, fontWeight: "800" }}>
                        {formatBRL(srv.price)}
                      </Text>
                      <Text style={{ color: "#71717a", fontSize: 12 }}>
                        {formatDuration(srv.durationMinutes)}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      borderWidth: 2,
                      borderColor: isSelected ? activeColor : "#71717a",
                      backgroundColor: isSelected ? activeColor : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {isSelected && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#ffffff" }} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 4. Professionals Selection */}
        {catalog.professionals.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginTop: 24, gap: 12 }}>
            <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "800", letterSpacing: -0.2 }}>
              Profissional (Opcional)
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              <Pressable
                onPress={() => setSelectedProfessional(null)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 14,
                  backgroundColor: !selectedProfessional ? hexToRgba(activeColor, 0.12) : "#14151b",
                  borderWidth: 1,
                  borderColor: !selectedProfessional ? activeColor : "rgba(255,255,255,0.08)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: !selectedProfessional ? activeColor : "#a1a1aa", fontSize: 13, fontWeight: "700" }}>
                  Qualquer disponível
                </Text>
              </Pressable>

              {catalog.professionals.map((prof) => {
                const isSelected = selectedProfessional?.id === prof.id;
                return (
                  <Pressable
                    key={prof.id}
                    onPress={() => setSelectedProfessional(prof)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 14,
                      backgroundColor: isSelected ? hexToRgba(activeColor, 0.12) : "#14151b",
                      borderWidth: 1,
                      borderColor: isSelected ? activeColor : "rgba(255,255,255,0.08)",
                    }}
                  >
                    <Avatar name={prof.name} photoUrl={resolveImageUrl(prof.photoUrl)} size="sm" />
                    <Text style={{ color: isSelected ? "#ffffff" : "#d4d4d8", fontSize: 13, fontWeight: "700" }}>
                      {prof.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* 5. Customer Identification & PIN (if not logged in) */}
        {!session && (
          <View style={{ paddingHorizontal: 20, marginTop: 24, gap: 14 }}>
            <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "800" }}>
              Seus Dados para Confirmação
            </Text>

            <TextField
              label="Número de Celular (WhatsApp)"
              placeholder="(11) 99999-9999"
              value={customerPhone}
              onChangeText={setCustomerPhone}
              keyboardType="phone-pad"
            />

            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: "#9ca3af", fontSize: 13, fontWeight: "600" }}>
                  Crie seu PIN de 6 dígitos
                </Text>
                <Text style={{ color: "#71717a", fontSize: 11 }}>Acesso rápido</Text>
              </View>

              <PinInput value={customerPin} onChange={setCustomerPin} length={6} mask={true} />

              <Text style={{ color: "#9ca3af", fontSize: 13, fontWeight: "600", marginTop: 6 }}>
                Confirme seu PIN
              </Text>
              <PinInput value={confirmPin} onChange={setConfirmPin} length={6} mask={true} />
            </View>
          </View>
        )}

        {/* 6. Confirm Button */}
        <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
          <Button
            label={submitting ? "Confirmando..." : "Confirmar Agendamento"}
            onPress={handleConfirmBooking}
            disabled={!selectedService || submitting}
            style={{ backgroundColor: activeColor, height: 48, borderRadius: 14 }}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
