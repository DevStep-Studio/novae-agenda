import {
  Calendar,
  Clock,
  MessageCircle,
  Phone,
  Sparkles,
  Users,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { colors, radius, typography } from "@/constants/design-tokens";
import { ApiError, formatPhoneForWhatsApp } from "@/lib/api-client";
import { getCompanyWaitlist, type WaitlistEntryDTO } from "@/lib/waitlist";

function formatPeriodLabel(period: string): string {
  switch (period) {
    case "morning":
      return "Manhã (08h às 12h)";
    case "afternoon":
      return "Tarde (12h às 18h)";
    case "evening":
      return "Noite (após 18h)";
    default:
      return "Qualquer horário";
  }
}

export default function ListaEsperaScreen() {
  const [entries, setEntries] = useState<WaitlistEntryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getCompanyWaitlist();
      setEntries(res || []);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar a lista de espera."
      );
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

  function handleOpenWhatsApp(entry: WaitlistEntryDTO) {
    if (!entry.clientPhone) return;
    const formatted = formatPhoneForWhatsApp(entry.clientPhone);
    const dateFormatted = new Date(entry.requestedDate + "T12:00:00").toLocaleDateString("pt-BR");
    const msg = encodeURIComponent(
      `Olá, ${entry.clientName}! Vimos seu interesse na nossa lista de espera para o dia ${dateFormatted}. Temos uma vaga disponível, gostaria de agendar?`
    );
    Linking.openURL(`https://wa.me/${formatted}?text=${msg}`);
  }

  const availableCount = entries.filter((e) => e.available).length;

  return (
    <Screen style={{ paddingHorizontal: 0, paddingBottom: 0 }}>
      <View style={{ paddingHorizontal: 16 }}>
        <TopBar
          title="Lista de Espera"
          company="Clientes aguardando vagas"
        />
      </View>

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
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {/* Métricas */}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <MetricCard
                label="Aguardando Vaga"
                value={String(entries.length)}
                detail="Interessados cadastrados"
                icon={Users}
                variant="teal"
              />
            </View>
            <View className="flex-1">
              <MetricCard
                label="Vagas Encontradas"
                value={String(availableCount)}
                detail="Horário vago identificado"
                icon={Sparkles}
                variant="teal"
              />
            </View>
          </View>

          {/* Lista de Registros da Fila */}
          {entries.length === 0 ? (
            <View
              className="items-center justify-center rounded-xl border p-8"
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            >
              <Users size={36} color={colors.textMuted} />
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: 16,
                  fontWeight: "600",
                  marginTop: 12,
                }}
              >
                Fila de espera vazia
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 13,
                  textAlign: "center",
                  marginTop: 4,
                }}
              >
                Quando seus clientes tentarem agendar em dias lotados e optarem pela lista de espera, eles aparecerão aqui.
              </Text>
            </View>
          ) : (
            entries.map((item) => (
              <View
                key={item.id}
                style={{
                  backgroundColor: colors.surface,
                  borderColor: item.available ? colors.primary : colors.border,
                  borderWidth: item.available ? 1.5 : 1,
                  borderRadius: radius.md,
                  padding: 16,
                  gap: 12,
                }}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <Avatar name={item.clientName} size="md" />
                    <View className="gap-0.5">
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontSize: 15,
                          fontWeight: "600",
                        }}
                      >
                        {item.clientName}
                      </Text>
                      {item.clientPhone && (
                        <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                          {item.clientPhone}
                        </Text>
                      )}
                    </View>
                  </View>

                  {item.available && (
                    <View
                      style={{
                        backgroundColor: colors.primarySoft,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: radius.pill,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.primary,
                          fontSize: 11,
                          fontWeight: "700",
                        }}
                      >
                        VAGA DISPONÍVEL
                      </Text>
                    </View>
                  )}
                </View>

                {/* Detalhes do interesse */}
                <View
                  className="rounded-lg p-3 gap-1.5"
                  style={{ backgroundColor: colors.surfaceSecondary }}
                >
                  <View className="flex-row items-center gap-2">
                    <Calendar size={14} color={colors.textSecondary} />
                    <Text style={{ color: colors.textPrimary, fontSize: 13 }}>
                      Data desejada:{" "}
                      <Text style={{ fontWeight: "600" }}>
                        {new Date(item.requestedDate + "T12:00:00").toLocaleDateString("pt-BR")}
                      </Text>
                    </Text>
                  </View>

                  <View className="flex-row items-center gap-2">
                    <Clock size={14} color={colors.textSecondary} />
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                      Período preferido: {formatPeriodLabel(item.period)}
                    </Text>
                  </View>

                  {item.serviceNames && item.serviceNames.length > 0 && (
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                      Serviços: {item.serviceNames.join(", ")}
                    </Text>
                  )}
                </View>

                {/* Botão de Contato WhatsApp */}
                {item.clientPhone && (
                  <Pressable
                    onPress={() => handleOpenWhatsApp(item)}
                    style={{
                      backgroundColor: "#25D366",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      height: 42,
                      borderRadius: radius.sm,
                    }}
                  >
                    <WhatsAppIcon size={18} color="#ffffff" />
                    <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 14 }}>
                      Chamar no WhatsApp
                    </Text>
                  </Pressable>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
