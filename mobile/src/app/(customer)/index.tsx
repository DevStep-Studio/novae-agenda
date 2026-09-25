import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  Camera,
  Check,
  Clock3,
  ExternalLink,
  Info,
  KeyRound,
  LogOut,
  MapPin,
  Moon,
  RotateCcw,
  Share2,
  Sun,
  UserRound,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";

import { ReserveiLogo } from "@/components/brand/reservei-logo";
import { colors, fontFamily, radius } from "@/constants/design-tokens";
import { useTheme } from "@/hooks/use-theme";
import { api, ApiError } from "@/lib/api-client";
import { cancelMyBooking, getMyBookings, type MyBooking } from "@/lib/my-bookings";
import { addBookingToNativeCalendar } from "@/lib/native-calendar";
import { useSession } from "@/lib/session-context";
import { formatBRL } from "@/lib/stats";

type TabType = "Próximos" | "Anteriores" | "Cancelados";

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmado",
  scheduled: "Agendado",
  completed: "Finalizado",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

function dateLabel(isoDate: string) {
  try {
    const [y, m, d] = isoDate.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return isoDate;
  }
}

function BarcodeView({ seed }: { seed: string }) {
  const bars: { width: number; space: number }[] = [];
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) % 1000000;
  for (let i = 0; i < 28; i++) {
    const w = (s % 3) + 1;
    s = Math.floor(s / 3) + i * 7;
    const sp = (s % 2) + 1;
    bars.push({ width: w, space: sp });
  }

  return (
    <View style={{ alignItems: "center", gap: 3 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          height: 22,
          justifyContent: "center",
        }}
      >
        {bars.map((b, idx) => (
          <View
            key={idx}
            style={{
              width: b.width,
              height: 22,
              backgroundColor: "rgba(255, 255, 255, 0.4)",
              marginRight: b.space,
            }}
          />
        ))}
      </View>
      <Text
        style={{
          fontSize: 8.5,
          letterSpacing: 1.5,
          fontWeight: "700",
          color: "#64748b",
        }}
      >
        PASSE DIGITAL
      </Text>
    </View>
  );
}

export default function CustomerBookingsScreen() {
  const insets = useSafeAreaInsets();
  const { isDark, toggleTheme } = useTheme();
  const { session, signOut, refresh } = useSession();

  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabType>("Próximos");
  const [selectedBooking, setSelectedBooking] = useState<MyBooking | null>(null);

  // Modals
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");

  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinVal, setPinVal] = useState("");
  const [confirmPinVal, setConfirmPinVal] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinSuccess, setPinSuccess] = useState("");
  const [pinError, setPinError] = useState("");

  const [cancelBusy, setCancelBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await getMyBookings();
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não foi possível carregar suas reservas."
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      await load();
      if (!cancelled) setLoading(false);
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  // Filtragem dos grupos de reservas idêntica à Web
  const now = new Date();
  const upcoming = bookings.filter((r) => {
    const isCancelled = r.status === "cancelled";
    const isPast = r.status === "completed" || r.status === "no_show" || new Date(r.endsAt) < now;
    return !isCancelled && !isPast;
  });

  const previous = bookings.filter((r) => {
    const isCancelled = r.status === "cancelled";
    const isPast = r.status === "completed" || r.status === "no_show" || new Date(r.endsAt) < now;
    return isPast && !isCancelled;
  });

  const cancelledList = bookings.filter((r) => r.status === "cancelled");

  const groups: Record<TabType, MyBooking[]> = {
    Próximos: upcoming,
    Anteriores: previous,
    Cancelados: cancelledList,
  };

  const visibleList = groups[tab] ?? [];

  // Navegação para agendar novo horário
  function handleGoToBooking(companySlug?: string | null) {
    const slug = companySlug || bookings[0]?.company?.slug || "barbearia-reservei";
    router.push(`/agendar/${slug}` as any);
  }

  // Ações de calendário nativo
  async function handleAddToCalendar(booking: MyBooking) {
    const first = booking.items[0];
    if (!first) return;

    try {
      const [year, month, day] = first.date.split("-").map(Number);
      const [hour, min] = first.startTime.split(":").map(Number);
      const startDate = new Date(year, month - 1, day, hour, min, 0);
      const endDate = new Date(startDate.getTime() + (first.durationMinutes || 45) * 60 * 1000);

      const res = await addBookingToNativeCalendar({
        title: `${first.name} - ${booking.company.name}`,
        startDate,
        endDate,
        location: booking.company.address || undefined,
        notes: `Agendamento no ${booking.company.name}\nServiço: ${first.name}\nProfissional: ${first.employeeName || "Profissional"}`,
      });

      if (res.success) {
        Alert.alert(
          "Calendário Sincronizado",
          "O agendamento foi adicionado à sua agenda com sucesso!"
        );
      } else {
        Alert.alert(
          "Permissão Necessária",
          "Permita o acesso ao calendário nas configurações do seu celular para sincronizar."
        );
      }
    } catch {
      Alert.alert("Erro", "Não foi possível adicionar o evento ao calendário.");
    }
  }

  // Google Calendar URL
  function handleGoogleCalendar(booking: MyBooking) {
    const first = booking.items[0];
    if (!first) return;
    const [year, month, day] = first.date.split("-").map(Number);
    const [hour, min] = first.startTime.split(":").map(Number);
    const startDate = new Date(year, month - 1, day, hour, min, 0);
    const endDate = new Date(startDate.getTime() + (first.durationMinutes || 45) * 60 * 1000);

    const fmt = (d: Date) => d.toISOString().replace(/-|:|\.\d+/g, "");
    const dates = `${fmt(startDate)}/${fmt(endDate)}`;
    const text = encodeURIComponent(`${first.name} - ${booking.company.name}`);
    const details = encodeURIComponent(
      `Agendamento no ${booking.company.name}\nServiço: ${first.name}\nProfissional: ${first.employeeName || "Profissional"}`
    );
    const location = encodeURIComponent(booking.company.address || "");

    Linking.openURL(
      `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}`
    );
  }

  // Compartilhar agendamento
  async function handleShare(booking: MyBooking) {
    const first = booking.items[0];
    if (!first) return;
    try {
      await Share.share({
        title: `Reserva - ${booking.company.name}`,
        message: `Agendamento confirmado:\n🏢 ${booking.company.name}\n✂️ ${first.name}\n📅 ${dateLabel(first.date)}\n🕒 ${first.startTime.slice(0, 5)} – ${first.endTime.slice(0, 5)}${booking.company.address ? `\n📍 ${booking.company.address}` : ""}`,
      });
    } catch {}
  }

  // Cancelar agendamento
  async function handleCancel(booking: MyBooking) {
    Alert.alert(
      "Desmarcar Agendamento",
      "Tem certeza que deseja cancelar esta reserva?",
      [
        { text: "Voltar", style: "cancel" },
        {
          text: "Sim, desmarcar",
          style: "destructive",
          onPress: async () => {
            setCancelBusy(true);
            try {
              await cancelMyBooking(booking.id);
              Alert.alert("Sucesso", "Agendamento cancelado.");
              setSelectedBooking(null);
              await load();
            } catch (e: any) {
              Alert.alert("Erro", e.message || "Não foi possível cancelar a reserva.");
            } finally {
              setCancelBusy(false);
            }
          },
        },
      ]
    );
  }

  // Salvar foto de perfil
  async function handlePickPhoto() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]?.base64) {
        setProfilePhotoUrl(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch {
      Alert.alert("Erro", "Não foi possível selecionar a imagem.");
    }
  }

  // Salvar dados de perfil
  async function handleSaveProfile() {
    setProfileBusy(true);
    setProfileError("");
    setProfileSuccess("");
    try {
      await api("/api/my/data", {
        method: "PUT",
        body: JSON.stringify({
          name: profileName,
          email: profileEmail || undefined,
          photoUrl: profilePhotoUrl || undefined,
        }),
      });
      setProfileSuccess("Dados atualizados com sucesso!");
      await refresh();
      setTimeout(() => {
        setProfileModalOpen(false);
        setProfileSuccess("");
      }, 1200);
    } catch (err: any) {
      setProfileError(err.message || "Erro ao atualizar perfil.");
    } finally {
      setProfileBusy(false);
    }
  }

  // Salvar novo PIN
  async function handleSavePin() {
    if (pinVal.length !== 6 || confirmPinVal.length !== 6) {
      setPinError("O PIN deve conter exatamente 6 números.");
      return;
    }
    if (pinVal !== confirmPinVal) {
      setPinError("Os PINs não coincidem.");
      return;
    }
    setPinBusy(true);
    setPinError("");
    setPinSuccess("");
    try {
      await api("/api/customer-access/pin/setup", {
        method: "POST",
        body: JSON.stringify({
          pin: pinVal,
          confirmPin: confirmPinVal,
          phone: session?.phone || undefined,
        }),
      });
      setPinSuccess("PIN atualizado com sucesso!");
      setTimeout(() => {
        setPinModalOpen(false);
        setPinSuccess("");
        setPinVal("");
        setConfirmPinVal("");
      }, 1200);
    } catch (err: any) {
      setPinError(err.message || "Erro ao atualizar PIN.");
    } finally {
      setPinBusy(false);
    }
  }

  const userName = session?.name || "Cliente";
  const userInitial = userName.charAt(0).toUpperCase() || "C";

  return (
    <View style={{ flex: 1, backgroundColor: "#090a0f", paddingTop: insets.top }}>
      {/* 1. TOP NAVBAR IDÊNTICA À WEB */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255, 255, 255, 0.06)",
          backgroundColor: "#090a0f",
        }}
      >
        <ReserveiLogo height={22} variant="full" />

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {/* Theme Toggle Button */}
          <Pressable
            onPress={toggleTheme}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.1)",
              backgroundColor: "rgba(255, 255, 255, 0.03)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isDark ? (
              <Sun size={15} color="#94a3b8" />
            ) : (
              <Moon size={15} color="#94a3b8" />
            )}
          </Pressable>

          {/* User Initial Avatar */}
          <Pressable
            onPress={() => {
              setProfileName(session?.name || "");
              setProfileEmail(session?.email || "");
              setProfilePhotoUrl(session?.photoUrl || null);
              setProfileModalOpen(true);
            }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: "rgba(220, 255, 76, 0.16)",
              borderWidth: 1,
              borderColor: "rgba(220, 255, 76, 0.3)",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {session?.photoUrl ? (
              <Image
                source={{ uri: session.photoUrl }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
              />
            ) : (
              <Text style={{ color: "#dcff4c", fontWeight: "800", fontSize: 14 }}>
                {userInitial}
              </Text>
            )}
          </Pressable>

          {/* Logout Button */}
          <Pressable
            onPress={() => signOut()}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.1)",
              backgroundColor: "rgba(255, 255, 255, 0.03)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LogOut size={15} color="#94a3b8" />
          </Pressable>
        </View>
      </View>

      {/* TELA DE DETALHES DE RESERVA SELECIONADA */}
      {selectedBooking ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}
        >
          {/* Voltar para minhas reservas */}
          <Pressable
            onPress={() => setSelectedBooking(null)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingVertical: 4,
            }}
          >
            <ArrowLeft size={16} color="#94a3b8" />
            <Text style={{ color: "#94a3b8", fontSize: 13.5, fontWeight: "600" }}>
              Voltar para minhas reservas
            </Text>
          </Pressable>

          {/* Título da tela de detalhes */}
          <View style={{ gap: 2 }}>
            <Text
              style={{
                color: "#ffffff",
                fontSize: 24,
                fontWeight: "800",
                letterSpacing: -0.3,
              }}
            >
              Detalhes do agendamento
            </Text>
            <Text style={{ color: "#94a3b8", fontSize: 13.5, fontWeight: "500" }}>
              {selectedBooking.company.name}
            </Text>
          </View>

          {/* Card Principal de Detalhes */}
          <View
            style={{
              backgroundColor: "#13151f",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.08)",
              borderRadius: 16,
              padding: 16,
              gap: 16,
            }}
          >
            {/* Header do Card: Logo + Nome + Status Badge */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: 14,
                borderBottomWidth: 1,
                borderBottomColor: "rgba(255, 255, 255, 0.06)",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                {selectedBooking.company.logoUrl ? (
                  <Image
                    source={{ uri: selectedBooking.company.logoUrl }}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      backgroundColor: "#1f222e",
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      backgroundColor: "rgba(255, 255, 255, 0.06)",
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.08)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: "#10b981", fontWeight: "800", fontSize: 15 }}>
                      {selectedBooking.company.name.slice(0, 1)}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ color: "#f8fafc", fontSize: 15, fontWeight: "700" }}
                    numberOfLines={1}
                  >
                    {selectedBooking.company.name}
                  </Text>
                  {selectedBooking.company.businessType && (
                    <Text style={{ color: "#94a3b8", fontSize: 12, fontWeight: "500" }}>
                      {selectedBooking.company.businessType}
                    </Text>
                  )}
                </View>
              </View>

              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                  backgroundColor:
                    selectedBooking.status === "completed"
                      ? "rgba(148, 163, 184, 0.1)"
                      : selectedBooking.status === "cancelled"
                      ? "rgba(239, 68, 68, 0.1)"
                      : "rgba(16, 185, 129, 0.12)",
                  borderWidth: 1,
                  borderColor:
                    selectedBooking.status === "completed"
                      ? "rgba(148, 163, 184, 0.22)"
                      : selectedBooking.status === "cancelled"
                      ? "rgba(239, 68, 68, 0.25)"
                      : "rgba(16, 185, 129, 0.3)",
                }}
              >
                <Text
                  style={{
                    fontSize: 10.5,
                    fontWeight: "800",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    color:
                      selectedBooking.status === "completed"
                        ? "#94a3b8"
                        : selectedBooking.status === "cancelled"
                        ? "#f87171"
                        : "#10b981",
                  }}
                >
                  {STATUS_LABELS[selectedBooking.status] || selectedBooking.status}
                </Text>
              </View>
            </View>

            {/* Caixa Data e Horário */}
            <View
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.02)",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.06)",
                borderRadius: 12,
                padding: 12,
                gap: 10,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <CalendarDays size={16} color="#10b981" />
                <View>
                  <Text style={{ color: "#64748b", fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>
                    DATA
                  </Text>
                  <Text style={{ color: "#f1f5f9", fontSize: 13.5, fontWeight: "600" }}>
                    {dateLabel(selectedBooking.items[0]?.date || selectedBooking.startsAt.slice(0, 10))}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Clock3 size={16} color="#10b981" />
                <View>
                  <Text style={{ color: "#64748b", fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>
                    HORÁRIO
                  </Text>
                  <Text style={{ color: "#f1f5f9", fontSize: 13.5, fontWeight: "600" }}>
                    {selectedBooking.items[0]?.startTime.slice(0, 5)} – {selectedBooking.items.at(-1)?.endTime.slice(0, 5)} · Horários no fuso de Brasília
                  </Text>
                </View>
              </View>
            </View>

            {/* Serviço(s) Selecionado(s) */}
            <View style={{ gap: 8 }}>
              <Text style={{ color: "#64748b", fontSize: 10.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
                SERVIÇO(S) SELECIONADO(S)
              </Text>

              {selectedBooking.items.map((item) => (
                <View
                  key={item.id}
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.03)",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.06)",
                    borderRadius: 12,
                    padding: 12,
                    gap: 8,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        backgroundColor: "#27272a",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      {item.employeePhotoUrl ? (
                        <Image source={{ uri: item.employeePhotoUrl }} style={{ width: "100%", height: "100%" }} />
                      ) : (
                        <UserRound size={16} color="#94a3b8" />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#f8fafc", fontSize: 14, fontWeight: "700" }}>
                        {item.name}
                      </Text>
                      <Text style={{ color: "#94a3b8", fontSize: 12 }}>
                        {item.employeeName || "Profissional"} · {item.employeeJobTitle || "Profissional"}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingTop: 8,
                      borderTopWidth: 1,
                      borderTopColor: "rgba(255, 255, 255, 0.04)",
                    }}
                  >
                    <Text style={{ color: "#94a3b8", fontSize: 12.5 }}>
                      {item.startTime.slice(0, 5)} – {item.endTime.slice(0, 5)}
                    </Text>
                    <Text style={{ color: "#ec4899", fontSize: 14, fontWeight: "800" }}>
                      {formatBRL(item.price)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Total da Reserva */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <View>
                <Text style={{ color: "#f8fafc", fontSize: 14, fontWeight: "700" }}>
                  Total da reserva
                </Text>
                <Text style={{ color: "#94a3b8", fontSize: 11.5 }}>
                  Pagamento no atendimento
                </Text>
              </View>
              <Text style={{ color: "#ec4899", fontSize: 20, fontWeight: "800" }}>
                {formatBRL(selectedBooking.total)}
              </Text>
            </View>
          </View>

          {/* Botões de Ação de Calendário e Compartilhamento */}
          <View style={{ gap: 8 }}>
            <Pressable
              onPress={() => handleAddToCalendar(selectedBooking)}
              style={{
                height: 44,
                borderRadius: 12,
                backgroundColor: "#e11d48",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <CalendarDays size={16} color="#ffffff" />
              <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 14 }}>
                Adicionar ao calendário
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleGoogleCalendar(selectedBooking)}
              style={{
                height: 42,
                borderRadius: 12,
                backgroundColor: "#161822",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.1)",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <ExternalLink size={15} color="#f1f5f9" />
              <Text style={{ color: "#f1f5f9", fontWeight: "600", fontSize: 13.5 }}>
                Google Calendar
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleShare(selectedBooking)}
              style={{
                height: 42,
                borderRadius: 12,
                backgroundColor: "#161822",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.1)",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Share2 size={15} color="#f1f5f9" />
              <Text style={{ color: "#f1f5f9", fontWeight: "600", fontSize: 13.5 }}>
                Compartilhar
              </Text>
            </Pressable>

            <Text
              style={{
                color: "#64748b",
                fontSize: 11.5,
                textAlign: "center",
                marginTop: 2,
              }}
            >
              Compatível com Apple Calendar, Google Calendar e Outlook.
            </Text>
          </View>

          {/* Card Política de Alterações */}
          <View
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.06)",
              borderRadius: 12,
              padding: 14,
              flexDirection: "row",
              gap: 10,
            }}
          >
            <Info size={18} color="#94a3b8" style={{ marginTop: 2 }} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: "#f8fafc", fontSize: 13, fontWeight: "700" }}>
                Política de alterações
              </Text>
              <Text style={{ color: "#94a3b8", fontSize: 12, lineHeight: 17 }}>
                Você pode cancelar ou remarcar seu atendimento gratuitamente online até {selectedBooking.company.cancellationHours || 24} horas antes do horário reservado.
              </Text>
            </View>
          </View>

          {/* Ações Inferiores */}
          <View style={{ gap: 8 }}>
            <Pressable
              onPress={() => handleGoToBooking(selectedBooking.company.slug)}
              style={{
                height: 42,
                borderRadius: 12,
                backgroundColor: "#161822",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.1)",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <RotateCcw size={15} color="#f1f5f9" />
              <Text style={{ color: "#f1f5f9", fontWeight: "600", fontSize: 13.5 }}>
                Agendar novamente
              </Text>
            </Pressable>

            {selectedBooking.canChange && selectedBooking.status !== "cancelled" && (
              <Pressable
                onPress={() => handleCancel(selectedBooking)}
                disabled={cancelBusy}
                style={{
                  height: 42,
                  borderRadius: 12,
                  backgroundColor: "rgba(239, 68, 68, 0.08)",
                  borderWidth: 1,
                  borderColor: "rgba(239, 68, 68, 0.25)",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Text style={{ color: "#f87171", fontWeight: "600", fontSize: 13.5 }}>
                  {cancelBusy ? "Desmarcando..." : "Desmarcar agendamento"}
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => setSelectedBooking(null)}
              style={{
                height: 42,
                borderRadius: 12,
                backgroundColor: "#161822",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.1)",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <ArrowLeft size={15} color="#f1f5f9" />
              <Text style={{ color: "#f1f5f9", fontWeight: "600", fontSize: 13.5 }}>
                Ver todas as minhas reservas
              </Text>
            </Pressable>
          </View>

          {/* Footer */}
          <Text
            style={{
              color: "#64748b",
              fontSize: 11.5,
              textAlign: "center",
              marginVertical: 16,
            }}
          >
            Agendamento online seguro com Reservei · Seu tempo bem cuidado
          </Text>
        </ScrollView>
      ) : (
        /* TELA PRINCIPAL DE RESERVAS IDÊNTICA À WEB */
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#dcff4c"
            />
          }
        >
          {/* 2. TÍTULO E SUBTÍTULO DINÂMICOS */}
          <View style={{ gap: 4, marginTop: 4 }}>
            <Text
              style={{
                color: "#ffffff",
                fontSize: 26,
                fontWeight: "800",
                letterSpacing: -0.4,
              }}
            >
              {tab === "Próximos"
                ? `Olá, ${userName.split(" ")[0]} 👋`
                : tab === "Anteriores"
                ? "Histórico de reservas"
                : "Reservas canceladas"}
            </Text>
            <Text style={{ color: "#94a3b8", fontSize: 13.5, lineHeight: 19 }}>
              {tab === "Próximos"
                ? "Acompanhe seus próximos horários confirmados e gerencie suas reservas."
                : tab === "Anteriores"
                ? "Consulte seus atendimentos realizados e serviços anteriores."
                : "Histórico de agendamentos cancelados."}
            </Text>
          </View>

          {/* 3. BOTÃO PRINCIPAL "AGENDAR NOVO HORÁRIO" */}
          <Pressable
            onPress={() => handleGoToBooking(bookings[0]?.company?.slug)}
            style={{
              height: 44,
              borderRadius: 12,
              backgroundColor: "#dcff4c",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginTop: 4,
            }}
          >
            <CalendarPlus size={16} color="#000000" />
            <Text style={{ color: "#000000", fontWeight: "700", fontSize: 14 }}>
              Agendar novo horário
            </Text>
          </Pressable>

          {/* 4. BOTÕES SECUNDÁRIOS DO HEADER (MEUS DADOS, ALTERAR PIN, TROCAR CONTA) */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {/* Meus dados */}
            <Pressable
              onPress={() => {
                setProfileName(session?.name || "");
                setProfileEmail(session?.email || "");
                setProfilePhotoUrl(session?.photoUrl || null);
                setProfileModalOpen(true);
              }}
              style={{
                flex: 1,
                height: 38,
                borderRadius: 10,
                backgroundColor: "#161822",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.1)",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
              }}
            >
              <UserRound size={13} color="#f1f5f9" />
              <Text style={{ color: "#f1f5f9", fontSize: 12, fontWeight: "600" }} numberOfLines={1}>
                Meus dados
              </Text>
            </Pressable>

            {/* Alterar PIN */}
            <Pressable
              onPress={() => {
                setPinVal("");
                setConfirmPinVal("");
                setPinError("");
                setPinSuccess("");
                setPinModalOpen(true);
              }}
              style={{
                flex: 1,
                height: 38,
                borderRadius: 10,
                backgroundColor: "#161822",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.1)",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
              }}
            >
              <KeyRound size={13} color="#f1f5f9" />
              <Text style={{ color: "#f1f5f9", fontSize: 12, fontWeight: "600" }} numberOfLines={1}>
                Alterar PIN
              </Text>
            </Pressable>

            {/* Trocar conta */}
            <Pressable
              onPress={() => signOut()}
              style={{
                flex: 1,
                height: 38,
                borderRadius: 10,
                backgroundColor: "#161822",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.1)",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
              }}
            >
              <LogOut size={13} color="#f1f5f9" />
              <Text style={{ color: "#f1f5f9", fontSize: 12, fontWeight: "600" }} numberOfLines={1}>
                Trocar conta
              </Text>
            </Pressable>
          </View>

          {/* 5. ABAS SEGMENTADAS (PRÓXIMOS, ANTERIORES, CANCELADOS) */}
          <View
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.07)",
              borderRadius: 12,
              padding: 4,
              flexDirection: "row",
              gap: 4,
              marginTop: 4,
            }}
          >
            {(["Próximos", "Anteriores", "Cancelados"] as TabType[]).map((t) => {
              const count = groups[t]?.length || 0;
              const isActive = tab === t;

              return (
                <Pressable
                  key={t}
                  onPress={() => setTab(t)}
                  style={{
                    flex: 1,
                    height: 36,
                    borderRadius: 8,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    backgroundColor: "transparent",
                  }}
                >
                  <Text
                    style={{
                      color: isActive ? "#dcff4c" : "#94a3b8",
                      fontSize: 13,
                      fontWeight: isActive ? "700" : "600",
                    }}
                  >
                    {t}
                  </Text>
                  <View
                    style={{
                      minWidth: 18,
                      height: 18,
                      paddingHorizontal: 5,
                      borderRadius: 999,
                      backgroundColor: isActive ? "rgba(220, 255, 76, 0.14)" : "rgba(255, 255, 255, 0.05)",
                      borderWidth: 1,
                      borderColor: isActive ? "rgba(220, 255, 76, 0.25)" : "rgba(255, 255, 255, 0.08)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: isActive ? "#dcff4c" : "#64748b",
                        fontSize: 10.5,
                        fontWeight: "700",
                      }}
                    >
                      {count}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* 6. LISTA DE TICKETS OU EMPTY STATE */}
          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <ActivityIndicator color="#dcff4c" size="large" />
            </View>
          ) : visibleList.length > 0 ? (
            <View style={{ gap: 14 }}>
              {visibleList.map((r, index) => {
                const isUsed = tab === "Anteriores";
                const isCancelled = tab === "Cancelados";
                const firstItem = r.items[0];
                const bookingDate = firstItem?.date ?? r.startsAt.slice(0, 10);
                const isUpcoming =
                  r.status !== "cancelled" &&
                  r.status !== "completed" &&
                  r.status !== "no_show" &&
                  new Date(r.endsAt) >= now;

                return (
                  <View
                    key={r.id}
                    style={{
                      backgroundColor: "#14161f",
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.08)",
                      borderRadius: 16,
                      overflow: "hidden",
                    }}
                  >
                    {/* Header do Ticket: Empresa + Status */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        borderBottomWidth: 1,
                        borderBottomColor: "rgba(255, 255, 255, 0.06)",
                        backgroundColor: "rgba(255, 255, 255, 0.02)",
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                        {r.company.logoUrl ? (
                          <Image
                            source={{ uri: r.company.logoUrl }}
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 9,
                              backgroundColor: "#1f222e",
                            }}
                          />
                        ) : (
                          <View
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 9,
                              backgroundColor: "rgba(255, 255, 255, 0.06)",
                              borderWidth: 1,
                              borderColor: "rgba(255, 255, 255, 0.08)",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text style={{ color: "#10b981", fontWeight: "800", fontSize: 14 }}>
                              {r.company.name.slice(0, 1)}
                            </Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{ color: "#f8fafc", fontSize: 14, fontWeight: "700" }}
                            numberOfLines={1}
                          >
                            {r.company.name}
                          </Text>
                          {r.company.businessType && (
                            <Text style={{ color: "#94a3b8", fontSize: 11.5, fontWeight: "500" }}>
                              {r.company.businessType}
                            </Text>
                          )}
                        </View>
                      </View>

                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 6,
                          backgroundColor:
                            r.status === "completed"
                              ? "rgba(148, 163, 184, 0.1)"
                              : r.status === "cancelled"
                              ? "rgba(239, 68, 68, 0.1)"
                              : "rgba(16, 185, 129, 0.12)",
                          borderWidth: 1,
                          borderColor:
                            r.status === "completed"
                              ? "rgba(148, 163, 184, 0.22)"
                              : r.status === "cancelled"
                              ? "rgba(239, 68, 68, 0.25)"
                              : "rgba(16, 185, 129, 0.3)",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10.5,
                            fontWeight: "800",
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                            color:
                              r.status === "completed"
                                ? "#94a3b8"
                                : r.status === "cancelled"
                                ? "#f87171"
                                : "#10b981",
                          }}
                        >
                          {STATUS_LABELS[r.status] || r.status}
                        </Text>
                      </View>
                    </View>

                    {/* Corpo do Ticket */}
                    <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, gap: 12 }}>
                      <Text
                        style={{
                          color: "#ffffff",
                          fontSize: 18,
                          fontWeight: "700",
                          letterSpacing: -0.2,
                        }}
                      >
                        {r.items.map((i) => i.name).join(" + ")}
                      </Text>

                      {/* Grid de Informações */}
                      <View style={{ gap: 12 }}>
                        {/* Data */}
                        <View style={{ gap: 3 }}>
                          <Text style={{ color: "#64748b", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
                            DATA
                          </Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <CalendarDays size={15} color="#10b981" />
                            <Text style={{ color: "#f1f5f9", fontSize: 13.5, fontWeight: "600" }}>
                              {dateLabel(bookingDate)}
                            </Text>
                          </View>
                        </View>

                        {/* Horário */}
                        <View style={{ gap: 3 }}>
                          <Text style={{ color: "#64748b", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
                            HORÁRIO
                          </Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Clock3 size={15} color="#10b981" />
                            <Text style={{ color: "#f1f5f9", fontSize: 13.5, fontWeight: "600" }}>
                              {firstItem?.startTime.slice(0, 5)} – {r.items.at(-1)?.endTime.slice(0, 5)}
                            </Text>
                          </View>
                        </View>

                        {/* Profissional */}
                        <View style={{ gap: 3 }}>
                          <Text style={{ color: "#64748b", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
                            PROFISSIONAL
                          </Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <View
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                backgroundColor: "#27272a",
                                alignItems: "center",
                                justifyContent: "center",
                                overflow: "hidden",
                              }}
                            >
                              {firstItem?.employeePhotoUrl ? (
                                <Image
                                  source={{ uri: firstItem.employeePhotoUrl }}
                                  style={{ width: "100%", height: "100%" }}
                                />
                              ) : (
                                <UserRound size={15} color="#94a3b8" />
                              )}
                            </View>
                            <View>
                              <Text style={{ color: "#f8fafc", fontSize: 13, fontWeight: "600" }}>
                                {firstItem?.employeeName || "Profissional"}
                              </Text>
                              <Text style={{ color: "#94a3b8", fontSize: 11 }}>
                                {firstItem?.employeeJobTitle || "Profissional"}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Linha Tracejada de Perforação */}
                    <View
                      style={{
                        height: 1,
                        marginHorizontal: 16,
                        borderBottomWidth: 1,
                        borderBottomColor: "rgba(255, 255, 255, 0.1)",
                        borderStyle: "dashed",
                      }}
                    />

                    {/* Canhoto do Ticket (Stub) */}
                    <View
                      style={{
                        backgroundColor: "rgba(0, 0, 0, 0.2)",
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        gap: 14,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "flex-end",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: 12,
                        }}
                      >
                        {/* Código da Reserva */}
                        <View style={{ gap: 3 }}>
                          <Text style={{ color: "#64748b", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
                            CÓDIGO DA RESERVA
                          </Text>
                          <View
                            style={{
                              backgroundColor: "#1c1f2a",
                              borderWidth: 1,
                              borderColor: "rgba(255, 255, 255, 0.09)",
                              borderRadius: 6,
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                            }}
                          >
                            <Text
                              style={{
                                color: "#f1f5f9",
                                fontSize: 12.5,
                                fontWeight: "700",
                              }}
                            >
                              #RES-{r.id.replace(/-/g, "").slice(0, 6).toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        {/* Valor Total */}
                        <View style={{ gap: 3, alignItems: "flex-end" }}>
                          <Text style={{ color: "#64748b", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
                            VALOR TOTAL
                          </Text>
                          <Text style={{ color: "#ffffff", fontSize: 21, fontWeight: "800" }}>
                            {formatBRL(r.total)}
                          </Text>
                        </View>
                      </View>

                      {/* Código de Barras */}
                      <BarcodeView seed={r.id} />

                      {/* Botões de Ação do Ticket */}
                      <View style={{ gap: 8 }}>
                        <Pressable
                          onPress={() => setSelectedBooking(r)}
                          style={{
                            height: 42,
                            borderRadius: 10,
                            backgroundColor: "rgba(255, 255, 255, 0.05)",
                            borderWidth: 1,
                            borderColor: "rgba(255, 255, 255, 0.12)",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text style={{ color: "#f1f5f9", fontWeight: "600", fontSize: 13 }}>
                            Ver detalhes
                          </Text>
                        </Pressable>

                        {r.status === "completed" && (
                          <Pressable
                            onPress={() => handleGoToBooking(r.company.slug)}
                            style={{
                              height: 42,
                              borderRadius: 10,
                              backgroundColor: "#dcff4c",
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                            }}
                          >
                            <RotateCcw size={14} color="#000000" />
                            <Text style={{ color: "#000000", fontWeight: "700", fontSize: 13 }}>
                              Agendar novamente
                            </Text>
                          </Pressable>
                        )}

                        {isUpcoming && (
                          <View style={{ flexDirection: "row", gap: 8 }}>
                            <Pressable
                              onPress={() => handleGoToBooking(r.company.slug)}
                              style={{
                                flex: 1,
                                height: 40,
                                borderRadius: 10,
                                backgroundColor: "rgba(255, 255, 255, 0.05)",
                                borderWidth: 1,
                                borderColor: "rgba(255, 255, 255, 0.12)",
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 6,
                              }}
                            >
                              <RotateCcw size={13} color="#f1f5f9" />
                              <Text style={{ color: "#f1f5f9", fontWeight: "600", fontSize: 12.5 }}>
                                Remarcar
                              </Text>
                            </Pressable>

                            <Pressable
                              onPress={() => handleCancel(r)}
                              style={{
                                flex: 1,
                                height: 40,
                                borderRadius: 10,
                                backgroundColor: "rgba(239, 68, 68, 0.06)",
                                borderWidth: 1,
                                borderColor: "rgba(239, 68, 68, 0.25)",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Text style={{ color: "#f87171", fontWeight: "600", fontSize: 12.5 }}>
                                Desmarcar
                              </Text>
                            </Pressable>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            /* 7. EMPTY STATE IDENTICO AO WEB */
            <View
              style={{
                backgroundColor: "#13151f",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.08)",
                borderRadius: 16,
                paddingVertical: 36,
                paddingHorizontal: 20,
                alignItems: "center",
                gap: 12,
                marginTop: 8,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: "#1c1f2a",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.08)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CalendarDays size={24} color="#dcff4c" />
              </View>

              <Text
                style={{
                  color: "#f8fafc",
                  fontSize: 16.5,
                  fontWeight: "700",
                  textAlign: "center",
                }}
              >
                {tab === "Próximos"
                  ? "Nenhum agendamento futuro"
                  : tab === "Anteriores"
                  ? "Nenhum agendamento anterior"
                  : "Nenhuma reserva cancelada"}
              </Text>

              <Text
                style={{
                  color: "#94a3b8",
                  fontSize: 13,
                  textAlign: "center",
                  maxWidth: 290,
                  lineHeight: 18,
                }}
              >
                {tab === "Próximos"
                  ? "Quando você reservar um horário, ele aparecerá aqui com todos os detalhes e opções de remarcação."
                  : "Seu histórico de atendimentos concluídos ficará registrado aqui."}
              </Text>

              <Pressable
                onPress={() => handleGoToBooking()}
                style={{
                  height: 42,
                  paddingHorizontal: 20,
                  borderRadius: 10,
                  backgroundColor: "#dcff4c",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  marginTop: 6,
                }}
              >
                <CalendarPlus size={15} color="#000000" />
                <Text style={{ color: "#000000", fontWeight: "700", fontSize: 13.5 }}>
                  Agendar horário
                </Text>
              </Pressable>
            </View>
          )}

          {/* 8. FOOTER IDÊNTICO À WEB */}
          <Text
            style={{
              color: "#64748b",
              fontSize: 11.5,
              textAlign: "center",
              marginVertical: 18,
            }}
          >
            Agendamento online seguro com Reservei · Seu tempo bem cuidado
          </Text>
        </ScrollView>
      )}

      {/* MODAL: MEUS DADOS */}
      <Modal visible={profileModalOpen} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: "#14161f",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.1)",
              borderRadius: 20,
              padding: 22,
              gap: 16,
            }}
          >
            <View style={{ alignItems: "center", gap: 6 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: "rgba(220, 255, 76, 0.12)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <UserRound size={22} color="#dcff4c" />
              </View>
              <Text style={{ color: "#f8fafc", fontSize: 18, fontWeight: "700" }}>
                Editar meus dados
              </Text>
              <Text style={{ color: "#94a3b8", fontSize: 12.5, textAlign: "center" }}>
                Atualize suas informações para contato e identificação nos agendamentos.
              </Text>
            </View>

            {/* Foto de Perfil */}
            <View style={{ alignItems: "center", gap: 6 }}>
              <Pressable
                onPress={handlePickPhoto}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: "#27272a",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  borderWidth: 2,
                  borderColor: "#dcff4c",
                  overflow: "hidden",
                }}
              >
                {profilePhotoUrl ? (
                  <Image source={{ uri: profilePhotoUrl }} style={{ width: "100%", height: "100%" }} />
                ) : (
                  <Text style={{ color: "#a1a1aa", fontSize: 22, fontWeight: "700" }}>
                    {profileName.charAt(0).toUpperCase() || "C"}
                  </Text>
                )}
                <View
                  style={{
                    position: "absolute",
                    bottom: 2,
                    right: 2,
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: "#dcff4c",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Camera size={12} color="#000000" />
                </View>
              </Pressable>
              <Text style={{ color: "#a1a1aa", fontSize: 11 }}>Toque para alterar foto</Text>
            </View>

            <View style={{ gap: 12 }}>
              <View style={{ gap: 5 }}>
                <Text style={{ color: "#94a3b8", fontSize: 12, fontWeight: "600" }}>
                  Nome completo
                </Text>
                <TextInput
                  value={profileName}
                  onChangeText={setProfileName}
                  placeholder="Seu nome"
                  placeholderTextColor="#64748b"
                  style={{
                    backgroundColor: "#18181b",
                    borderWidth: 1,
                    borderColor: "#27272a",
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    height: 42,
                    color: "#f8fafc",
                    fontSize: 14,
                  }}
                />
              </View>

              <View style={{ gap: 5 }}>
                <Text style={{ color: "#94a3b8", fontSize: 12, fontWeight: "600" }}>
                  E-mail
                </Text>
                <TextInput
                  value={profileEmail}
                  onChangeText={setProfileEmail}
                  placeholder="seu.email@exemplo.com"
                  placeholderTextColor="#64748b"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={{
                    backgroundColor: "#18181b",
                    borderWidth: 1,
                    borderColor: "#27272a",
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    height: 42,
                    color: "#f8fafc",
                    fontSize: 14,
                  }}
                />
              </View>
            </View>

            {profileError ? (
              <Text style={{ color: "#f87171", fontSize: 12, textAlign: "center" }}>
                {profileError}
              </Text>
            ) : null}

            {profileSuccess ? (
              <Text style={{ color: "#10b981", fontSize: 12, textAlign: "center", fontWeight: "600" }}>
                {profileSuccess}
              </Text>
            ) : null}

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => setProfileModalOpen(false)}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 10,
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.1)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#94a3b8", fontWeight: "600", fontSize: 13.5 }}>Cancelar</Text>
              </Pressable>

              <Pressable
                onPress={handleSaveProfile}
                disabled={profileBusy}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 10,
                  backgroundColor: "#dcff4c",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#000000", fontWeight: "700", fontSize: 13.5 }}>
                  {profileBusy ? "Salvando..." : "Salvar dados"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: ALTERAR PIN */}
      <Modal visible={pinModalOpen} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: "#14161f",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.1)",
              borderRadius: 20,
              padding: 22,
              gap: 16,
            }}
          >
            <View style={{ alignItems: "center", gap: 6 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: "rgba(220, 255, 76, 0.12)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <KeyRound size={22} color="#dcff4c" />
              </View>
              <Text style={{ color: "#f8fafc", fontSize: 18, fontWeight: "700" }}>
                Alterar PIN de acesso
              </Text>
              <Text style={{ color: "#94a3b8", fontSize: 12.5, textAlign: "center" }}>
                Digite um novo código numérico de 6 dígitos para acessar suas reservas rapidamente.
              </Text>
            </View>

            <View style={{ gap: 12 }}>
              <View style={{ gap: 5 }}>
                <Text style={{ color: "#94a3b8", fontSize: 12, fontWeight: "600" }}>
                  Novo PIN (6 dígitos)
                </Text>
                <TextInput
                  value={pinVal}
                  onChangeText={setPinVal}
                  placeholder="000000"
                  placeholderTextColor="#64748b"
                  keyboardType="numeric"
                  maxLength={6}
                  secureTextEntry
                  style={{
                    backgroundColor: "#18181b",
                    borderWidth: 1,
                    borderColor: "#27272a",
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    height: 42,
                    color: "#f8fafc",
                    fontSize: 16,
                    textAlign: "center",
                    letterSpacing: 4,
                  }}
                />
              </View>

              <View style={{ gap: 5 }}>
                <Text style={{ color: "#94a3b8", fontSize: 12, fontWeight: "600" }}>
                  Confirmar novo PIN
                </Text>
                <TextInput
                  value={confirmPinVal}
                  onChangeText={setConfirmPinVal}
                  placeholder="000000"
                  placeholderTextColor="#64748b"
                  keyboardType="numeric"
                  maxLength={6}
                  secureTextEntry
                  style={{
                    backgroundColor: "#18181b",
                    borderWidth: 1,
                    borderColor: "#27272a",
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    height: 42,
                    color: "#f8fafc",
                    fontSize: 16,
                    textAlign: "center",
                    letterSpacing: 4,
                  }}
                />
              </View>
            </View>

            {pinError ? (
              <Text style={{ color: "#f87171", fontSize: 12, textAlign: "center" }}>
                {pinError}
              </Text>
            ) : null}

            {pinSuccess ? (
              <Text style={{ color: "#10b981", fontSize: 12, textAlign: "center", fontWeight: "600" }}>
                {pinSuccess}
              </Text>
            ) : null}

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => setPinModalOpen(false)}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 10,
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.1)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#94a3b8", fontWeight: "600", fontSize: 13.5 }}>Cancelar</Text>
              </Pressable>

              <Pressable
                onPress={handleSavePin}
                disabled={pinBusy || pinVal.length !== 6 || confirmPinVal.length !== 6}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 10,
                  backgroundColor:
                    pinVal.length === 6 && confirmPinVal.length === 6 ? "#dcff4c" : "#27272a",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color:
                      pinVal.length === 6 && confirmPinVal.length === 6 ? "#000000" : "#71717a",
                    fontWeight: "700",
                    fontSize: 13.5,
                  }}
                >
                  {pinBusy ? "Salvando..." : "Salvar novo PIN"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
