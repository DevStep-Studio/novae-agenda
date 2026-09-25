import {
  Calendar,
  CalendarDays,
  CalendarPlus,
  Clock,
  MapPin,
  MessageCircle,
  Scissors,
  User,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { colors, fontFamily, radius, typography } from "@/constants/design-tokens";
import { ApiError, formatPhoneForWhatsApp } from "@/lib/api-client";
import { getMyBookings, type MyBooking } from "@/lib/my-bookings";
import { addBookingToNativeCalendar } from "@/lib/native-calendar";
import { formatBRL } from "@/lib/stats";

import { useResponsive } from "@/hooks/use-responsive";
import { scaleFont } from "@/lib/responsive";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  confirmed: { label: "Confirmado", color: colors.success, bg: colors.successSoft },
  scheduled: { label: "Agendado", color: colors.primary, bg: colors.primarySoft },
  completed: { label: "Finalizado", color: colors.textSecondary, bg: colors.surfaceTertiary },
  cancelled: { label: "Cancelado", color: colors.danger, bg: colors.dangerSoft },
  no_show: { label: "Não compareceu", color: colors.danger, bg: colors.dangerSoft },
};

export default function MyBookingsScreen() {
  const { isCompact, isTablet } = useResponsive();
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setBookings(await getMyBookings());
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar suas reservas."
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

  async function handleAddToCalendar(booking: MyBooking) {
    const first = booking.items[0];
    if (!first) return;

    try {
      // Parse ISO or YYYY-MM-DD + HH:mm
      const [year, month, day] = first.date.split("-").map(Number);
      const [hour, min] = first.startTime.split(":").map(Number);
      const startDate = new Date(year, month - 1, day, hour, min, 0);
      const endDate = new Date(startDate.getTime() + (first.durationMinutes || 45) * 60 * 1000);

      const res = await addBookingToNativeCalendar({
        title: `${first.name} - ${booking.company.name}`,
        startDate,
        endDate,
        location: booking.company.address || undefined,
        notes: `Agendamento no ${booking.company.name}\nServiço: ${first.name}\nProfissional: ${first.employeeName || "Não especificado"}`,
      });

      if (res.success) {
        Alert.alert(
          "Calendário Sincronizado",
          "O agendamento foi adicionado à sua agenda com lembretes automáticos!"
        );
      } else {
        Alert.alert(
          "Permissão Necessária",
          "Não foi possível acessar o calendário. Verifique as permissões do aplicativo nas configurações do aparelho."
        );
      }
    } catch {
      Alert.alert("Erro", "Não foi possível adicionar o evento ao calendário.");
    }
  }

  function handleOpenWhatsApp(companyPhone?: string | null, companyName?: string) {
    if (!companyPhone) return;
    const formatted = formatPhoneForWhatsApp(companyPhone);
    const msg = encodeURIComponent(
      `Olá, gostaria de tirar uma dúvida sobre meu agendamento no ${companyName || "estabelecimento"}.`
    );
    Linking.openURL(`https://wa.me/${formatted}?text=${msg}`);
  }

  return (
    <Screen header={<TopBar title="Meus Agendamentos" showBack={false} />} style={{ paddingTop: 16 }}>
      <PageHeader
        eyebrow="MINHAS RESERVAS"
        title="Meus Agendamentos"
        subtitle="Acompanhe seus horários marcados e histórico de atendimentos."
      />

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
      ) : bookings.length === 0 ? (
        <View
          className="flex-1 items-center justify-center p-8 mx-4 my-auto rounded-xl border"
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        >
          <CalendarDays size={44} color={colors.textMuted} />
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 17,
              fontWeight: "600",
              marginTop: 14,
            }}
          >
            Nenhum agendamento ativo
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 13,
              textAlign: "center",
              marginTop: 6,
            }}
          >
            Seus próximos atendimentos e histórico aparecerão aqui em tempo real.
          </Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 14 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => {
            const first = item.items[0];
            const cfg = STATUS_CONFIG[item.status] || {
              label: item.status,
              color: colors.textSecondary,
              bg: colors.surfaceTertiary,
            };

            return (
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
                {/* Header: Estabelecimento e Status */}
                <View className="flex-row items-center justify-between">
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontSize: 16,
                      fontFamily: fontFamily.display,
                      flex: 1,
                      marginRight: 8,
                    }}
                    numberOfLines={1}
                  >
                    {item.company.name}
                  </Text>

                  <View
                    style={{
                      backgroundColor: cfg.bg,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: radius.pill,
                      flexShrink: 0,
                    }}
                  >
                    <Text style={{ color: cfg.color, fontSize: 11, fontWeight: "700" }}>
                      {cfg.label.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Detalhes do Serviço */}
                {first && (
                  <View
                    className="rounded-lg p-3 gap-2"
                    style={{ backgroundColor: colors.surfaceSecondary }}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontSize: 15,
                          fontWeight: "600",
                          flex: 1,
                          marginRight: 8,
                        }}
                        numberOfLines={1}
                      >
                        {first.name}
                      </Text>
                      <Text
                        style={{
                          color: colors.primary,
                          fontSize: 15,
                          fontWeight: "700",
                          flexShrink: 0,
                        }}
                      >
                        {formatBRL(first.price)}
                      </Text>
                    </View>

                    <View className="flex-row items-center gap-2">
                      <Clock size={14} color={colors.textMuted} />
                      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                        {first.date} às {first.startTime}
                      </Text>
                    </View>

                    {first.employeeName && (
                      <View className="flex-row items-center gap-2">
                        <User size={14} color={colors.textMuted} />
                        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                          Profissional: {first.employeeName}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Ações: Calendário e Contato WhatsApp */}
                <View className="gap-2">
                  {(item.status === "scheduled" || item.status === "confirmed") && (
                    <Pressable
                      onPress={() => handleAddToCalendar(item)}
                      style={{
                        backgroundColor: colors.surfaceSecondary,
                        borderColor: colors.border,
                        borderWidth: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        height: 38,
                        borderRadius: radius.sm,
                      }}
                    >
                      <CalendarPlus size={16} color={colors.primary} />
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontWeight: "600",
                          fontSize: 13,
                        }}
                      >
                        Adicionar ao Calendário do Celular
                      </Text>
                    </Pressable>
                  )}

                  {item.company.phone && (
                    <Pressable
                      onPress={() =>
                        handleOpenWhatsApp(item.company.phone, item.company.name)
                      }
                      style={{
                        backgroundColor: colors.surfaceSecondary,
                        borderColor: colors.border,
                        borderWidth: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        height: 38,
                        borderRadius: radius.sm,
                      }}
                    >
                      <WhatsAppIcon size={16} color="#25D366" />
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontWeight: "600",
                          fontSize: 13,
                        }}
                      >
                        Falar com {item.company.name}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}
