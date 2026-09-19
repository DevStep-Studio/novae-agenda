import {
  ArrowRight,
  Ban,
  Calendar,
  CalendarDays,
  Check,
  CheckCheck,
  CircleDollarSign,
  Clock,
  ImagePlus,
  Plus,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
  WalletCards,
  Zap,
} from "lucide-react-native";
import { Image } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";

import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { colors, radius } from "@/constants/design-tokens";
import { ApiError, api, resolveImageUrl } from "@/lib/api-client";
import { getStats, type StatsResponse } from "@/lib/stats";
import { useSession } from "@/lib/session-context";
import {
  CustomizeDashboardModal,
  DEFAULT_DASHBOARD_PREFS,
  type DashboardPrefs,
  type DashboardSectionKey,
} from "@/components/dashboard/customize-dashboard-modal";

const DASHBOARD_PREFS_KEY = "reservei_dashboard_prefs_v1";

function formatDashboardCurrency(val: number | null | undefined): string {
  const num = typeof val === "number" ? val : Number(val) || 0;
  if (num === 0) return "R$ 0";
  return num.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export default function OwnerHomeScreen() {
  const { session, signOut } = useSession();

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [customizeVisible, setCustomizeVisible] = useState(false);
  const [prefs, setPrefs] = useState<DashboardPrefs>(DEFAULT_DASHBOARD_PREFS);

  // Load saved preferences
  useEffect(() => {
    async function loadPrefs() {
      try {
        const saved = await SecureStore.getItemAsync(DASHBOARD_PREFS_KEY);
        if (saved) {
          setPrefs(JSON.parse(saved));
        }
      } catch {
        // use default
      }
    }
    loadPrefs();
  }, []);

  const savePrefs = async (newPrefs: DashboardPrefs) => {
    setPrefs(newPrefs);
    try {
      await SecureStore.setItemAsync(DASHBOARD_PREFS_KEY, JSON.stringify(newPrefs));
    } catch {
      // ignore
    }
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      const [statsData, aptsData] = await Promise.all([
        getStats("today"),
        api<{ appointments: any[] }>("/api/appointments?range=today").catch(() => ({
          appointments: [],
        })),
      ]);
      setStats(statsData);
      setAppointments(aptsData?.appointments || []);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não foi possível carregar o painel."
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

  const forecast = stats?.today.forecast ?? 0;
  const realized = stats?.today.realized ?? 0;
  const pendingAmount = Math.max(0, forecast - realized);
  const isAuthError =
    error &&
    (error.toLowerCase().includes("expirou") ||
      error.toLowerCase().includes("sessão") ||
      error.toLowerCase().includes("autenticação"));

  const firstName = session?.name ? session.name.split(" ")[0] : "Moa";
  const defaultBanner =
    "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80";
  const rawBannerUrl = session?.company?.bannerUrl || defaultBanner;
  const rawLogoUrl = session?.company?.logoUrl || session?.avatarUrl;
  const bannerUrl = resolveImageUrl(rawBannerUrl) || defaultBanner;
  const logoUrl = resolveImageUrl(rawLogoUrl);
  const [bannerLoadError, setBannerLoadError] = useState(false);
  const [logoLoadError, setLogoLoadError] = useState(false);
  const companyName = session?.company?.name || "Moa Tattoo";
  const initials = (companyName || firstName || "MO")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  const confirmedCount = appointments.filter(
    (a) => a.status === "confirmed" || a.status === "scheduled"
  ).length;
  const waitingCount = appointments.filter((a) => a.status === "waiting").length;
  const inProgressCount = appointments.filter((a) => a.status === "in_progress").length;
  const completedCount = appointments.filter((a) => a.status === "completed").length;
  const cancelledCount =
    (stats?.today?.cancelled ?? 0) + (stats?.today?.noShow ?? 0) ||
    appointments.filter((a) => a.status === "cancelled" || a.status === "no_show").length;
  const pendingCount = appointments.filter(
    (a) =>
      a.status !== "completed" && a.status !== "cancelled" && a.status !== "no_show"
  ).length;

  const nextAppointment = appointments.find(
    (a) =>
      a.status === "in_progress" ||
      a.status === "waiting" ||
      a.status === "confirmed" ||
      a.status === "scheduled"
  );

  const renderSection = (key: DashboardSectionKey) => {
    if (!prefs[key]) return null;

    switch (key) {
      case "showBanner":
        return (
          <View
            key="showBanner"
            className="rounded-2xl border overflow-hidden relative"
            style={{
              backgroundColor: "#111215",
              borderColor: "rgba(255, 255, 255, 0.08)",
              minHeight: 160,
            }}
          >
            {/* Background Cover Image with Dark Overlay */}
            <Image
              source={{ uri: bannerLoadError ? defaultBanner : bannerUrl }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                opacity: 0.35,
              }}
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
                backgroundColor: "rgba(10, 11, 14, 0.72)",
              }}
            />

            <View className="p-4 gap-2.5">
              {/* Top Tag Badge */}
              <View
                className="self-start flex-row items-center gap-1.5 px-2.5 py-1 rounded-md"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.15)",
                }}
              >
                <Sparkles size={11} color="#ffffff" />
                <Text
                  style={{
                    color: "#ffffff",
                    fontSize: 10.5,
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                  }}
                >
                  {companyName}
                </Text>
              </View>

              {/* Title & Greeting Subtitle */}
              <View className="gap-1 mt-0.5">
                <Text
                  style={{
                    color: "#ffffff",
                    fontSize: 21,
                    fontWeight: "800",
                    letterSpacing: -0.3,
                  }}
                >
                  Bom trabalho, {firstName}!
                </Text>
                <Text
                  style={{
                    color: "#9ca3af",
                    fontSize: 12.5,
                    lineHeight: 17,
                  }}
                >
                  {(stats?.today.appointments ?? 0) === 0
                    ? "Sua agenda está livre hoje. Pronto para receber novos clientes!"
                    : `Você tem ${stats?.today.appointments} atendimento${
                        (stats?.today.appointments ?? 0) === 1 ? "" : "s"
                      } agendado${(stats?.today.appointments ?? 0) === 1 ? "" : "s"} hoje.`}
                </Text>
              </View>

              {/* Bottom Row: Personalizar Capa Button + Logo Box */}
              <View className="flex-row items-end justify-between pt-1">
                <Pressable
                  onPress={() => router.push("/(owner)/perfil" as any)}
                  className="flex-row items-center gap-1.5 px-3 py-2 rounded-lg border"
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.55)",
                    borderColor: "rgba(255, 255, 255, 0.18)",
                  }}
                >
                  <ImagePlus size={13} color="#ffffff" />
                  <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "600" }}>
                    Personalizar capa
                  </Text>
                </Pressable>

                <View
                  className="items-center justify-center rounded-2xl overflow-hidden border"
                  style={{
                    width: 70,
                    height: 70,
                    backgroundColor: "#18191e",
                    borderColor: "rgba(255, 255, 255, 0.22)",
                  }}
                >
                  {logoUrl && !logoLoadError ? (
                    <Image
                      source={{ uri: logoUrl }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                      onError={() => setLogoLoadError(true)}
                    />
                  ) : (
                    <Text style={{ color: "#ffffff", fontSize: 22, fontWeight: "800" }}>
                      {initials}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </View>
        );

      case "showKpis":
        return (
          <View key="showKpis" className="flex-row flex-wrap justify-between gap-y-2.5">
            {/* Card 1: Atendimentos hoje */}
            <View
              className="p-3.5 rounded-2xl border justify-between"
              style={{
                width: "48.5%",
                backgroundColor: "#111215",
                borderColor: "rgba(255, 255, 255, 0.08)",
                minHeight: 90,
              }}
            >
              <View className="flex-row items-center gap-2">
                <View
                  className="items-center justify-center rounded-lg border"
                  style={{
                    width: 30,
                    height: 30,
                    backgroundColor: "#18191e",
                    borderColor: "rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <CalendarDays size={15} color="#ffffff" />
                </View>
                <Text
                  style={{
                    color: "#9ca3af",
                    fontSize: 11.5,
                    fontWeight: "500",
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  Atendimentos hoje
                </Text>
              </View>

              <View className="gap-0.5 mt-1.5">
                <Text
                  style={{
                    color: "#ffffff",
                    fontSize: 20,
                    fontWeight: "800",
                    letterSpacing: -0.3,
                  }}
                >
                  {stats?.today.appointments ?? 0}
                </Text>
                <Text style={{ color: "#6b7280", fontSize: 11 }}>
                  agendados para hoje
                </Text>
              </View>
            </View>

            {/* Card 2: Receita prevista */}
            <View
              className="p-3.5 rounded-2xl border justify-between"
              style={{
                width: "48.5%",
                backgroundColor: "#111215",
                borderColor: "rgba(255, 255, 255, 0.08)",
                minHeight: 90,
              }}
            >
              <View className="flex-row items-center gap-2">
                <View
                  className="items-center justify-center rounded-lg border"
                  style={{
                    width: 30,
                    height: 30,
                    backgroundColor: "#18191e",
                    borderColor: "rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <TrendingUp size={15} color="#ffffff" />
                </View>
                <Text
                  style={{
                    color: "#9ca3af",
                    fontSize: 11.5,
                    fontWeight: "500",
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  Receita prevista
                </Text>
              </View>

              <View className="gap-0.5 mt-1.5">
                <Text
                  style={{
                    color: "#ffffff",
                    fontSize: 20,
                    fontWeight: "800",
                    letterSpacing: -0.3,
                  }}
                >
                  {formatDashboardCurrency(forecast)}
                </Text>
                <Text style={{ color: "#6b7280", fontSize: 11 }}>
                  para hoje
                </Text>
              </View>
            </View>

            {/* Card 3: Receita realizada */}
            <View
              className="p-3.5 rounded-2xl border justify-between"
              style={{
                width: "48.5%",
                backgroundColor: "#111215",
                borderColor: "rgba(255, 255, 255, 0.08)",
                minHeight: 90,
              }}
            >
              <View className="flex-row items-center gap-2">
                <View
                  className="items-center justify-center rounded-lg border"
                  style={{
                    width: 30,
                    height: 30,
                    backgroundColor: "#18191e",
                    borderColor: "rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <WalletCards size={15} color="#ffffff" />
                </View>
                <Text
                  style={{
                    color: "#9ca3af",
                    fontSize: 11.5,
                    fontWeight: "500",
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  Receita realizada
                </Text>
              </View>

              <View className="gap-0.5 mt-1.5">
                <Text
                  style={{
                    color: "#ffffff",
                    fontSize: 20,
                    fontWeight: "800",
                    letterSpacing: -0.3,
                  }}
                >
                  {formatDashboardCurrency(realized)}
                </Text>
                <Text style={{ color: "#6b7280", fontSize: 11 }}>
                  já recebida hoje
                </Text>
              </View>
            </View>

            {/* Card 4: Receita pendente */}
            <View
              className="p-3.5 rounded-2xl border justify-between"
              style={{
                width: "48.5%",
                backgroundColor: "#111215",
                borderColor: "rgba(255, 255, 255, 0.08)",
                minHeight: 90,
              }}
            >
              <View className="flex-row items-center gap-2">
                <View
                  className="items-center justify-center rounded-lg border"
                  style={{
                    width: 30,
                    height: 30,
                    backgroundColor: "#18191e",
                    borderColor: "rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <CircleDollarSign size={15} color="#ffffff" />
                </View>
                <Text
                  style={{
                    color: "#9ca3af",
                    fontSize: 11.5,
                    fontWeight: "500",
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  Receita pendente
                </Text>
              </View>

              <View className="gap-0.5 mt-1.5">
                <Text
                  style={{
                    color: "#ffffff",
                    fontSize: 20,
                    fontWeight: "800",
                    letterSpacing: -0.3,
                  }}
                >
                  {formatDashboardCurrency(pendingAmount)}
                </Text>
                <Text style={{ color: "#6b7280", fontSize: 11 }}>
                  a receber hoje
                </Text>
              </View>
            </View>

            {/* Card 5: Clientes atendidos */}
            <View
              className="p-3.5 rounded-2xl border justify-between"
              style={{
                width: "48.5%",
                backgroundColor: "#111215",
                borderColor: "rgba(255, 255, 255, 0.08)",
                minHeight: 90,
              }}
            >
              <View className="flex-row items-center gap-2">
                <View
                  className="items-center justify-center rounded-lg border"
                  style={{
                    width: 30,
                    height: 30,
                    backgroundColor: "#18191e",
                    borderColor: "rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <Users size={15} color="#ffffff" />
                </View>
                <Text
                  style={{
                    color: "#9ca3af",
                    fontSize: 11.5,
                    fontWeight: "500",
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  Clientes atendidos
                </Text>
              </View>

              <View className="gap-0.5 mt-1.5">
                <Text
                  style={{
                    color: "#ffffff",
                    fontSize: 20,
                    fontWeight: "800",
                    letterSpacing: -0.3,
                  }}
                >
                  {stats?.today.clientsServed ?? 0}
                </Text>
                <Text style={{ color: "#6b7280", fontSize: 11 }}>
                  finalizados hoje
                </Text>
              </View>
            </View>
          </View>
        );

      case "showSubmetrics":
        return (
          <View key="showSubmetrics" className="flex-row gap-2.5">
            {/* Left Submetric: Atendimentos pendentes */}
            <View
              className="flex-1 flex-row items-center justify-between p-4 rounded-2xl border"
              style={{
                backgroundColor: "#111215",
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <Text
                style={{
                  color: "#9ca3af",
                  fontSize: 12,
                  fontWeight: "500",
                  flex: 1,
                  paddingRight: 6,
                }}
              >
                Atendimentos pendentes
              </Text>
              <Text
                style={{
                  color: "#ffffff",
                  fontSize: 20,
                  fontWeight: "800",
                }}
              >
                {pendingCount}
              </Text>
            </View>

            {/* Right Submetric: Cancelamentos hoje */}
            <View
              className="flex-1 flex-row items-center justify-between p-4 rounded-2xl border"
              style={{
                backgroundColor: "#111215",
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <View className="gap-0.5">
                <Text style={{ color: "#9ca3af", fontSize: 12, fontWeight: "500" }}>
                  Cancelamentos hoje
                </Text>
                <Text
                  style={{
                    color: cancelledCount > 0 ? "#ef4444" : "#ffffff",
                    fontSize: 20,
                    fontWeight: "800",
                  }}
                >
                  {cancelledCount}
                </Text>
              </View>
              <Ban
                size={18}
                color={cancelledCount > 0 ? "#ef4444" : "#6b7280"}
              />
            </View>
          </View>
        );

      case "showNextAppointment":
        return (
          <View
            key="showNextAppointment"
            className="p-4 rounded-2xl border gap-3.5"
            style={{
              backgroundColor: "#111215",
              borderColor: "rgba(255, 255, 255, 0.08)",
            }}
          >
            <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "700" }}>
              Próximo atendimento
            </Text>

            {nextAppointment ? (
              <View className="gap-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View
                      className="px-2.5 py-1 rounded-md"
                      style={{ backgroundColor: "rgba(59, 130, 246, 0.15)" }}
                    >
                      <Text
                        style={{
                          color: "#3b82f6",
                          fontSize: 11.5,
                          fontWeight: "700",
                        }}
                      >
                        {nextAppointment.startTime || "Hoje"}
                      </Text>
                    </View>
                    <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "600" }}>
                      {nextAppointment.clientName || "Cliente"}
                    </Text>
                  </View>

                  <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "700" }}>
                    {formatDashboardCurrency(nextAppointment.total || nextAppointment.price)}
                  </Text>
                </View>

                <Text style={{ color: "#9ca3af", fontSize: 12.5 }}>
                  {nextAppointment.serviceName || "Serviço"} · com{" "}
                  {nextAppointment.employeeName || "Profissional"}
                </Text>

                <Pressable
                  onPress={() => router.push("/(owner)/agenda")}
                  className="flex-row items-center justify-between pt-2 border-t"
                  style={{ borderTopColor: "rgba(255, 255, 255, 0.06)" }}
                >
                  <Text style={{ color: "#3b82f6", fontSize: 12.5, fontWeight: "600" }}>
                    Ver na Agenda
                  </Text>
                  <ArrowRight size={14} color="#3b82f6" />
                </Pressable>
              </View>
            ) : (
              <View className="items-center justify-center py-3 gap-1">
                <View
                  className="items-center justify-center rounded-xl border mb-1"
                  style={{
                    width: 44,
                    height: 44,
                    backgroundColor: "#18191e",
                    borderColor: "rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <CalendarDays size={22} color="#9ca3af" />
                </View>

                <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "700" }}>
                  Agenda livre hoje
                </Text>
                <Text style={{ color: "#9ca3af", fontSize: 12 }}>
                  Você ainda não tem atendimentos para hoje.
                </Text>

                <Pressable
                  onPress={() => router.push("/(owner)/agenda")}
                  className="flex-row items-center gap-1.5 px-4 py-2 rounded-xl mt-2.5"
                  style={{ backgroundColor: "#ffffff" }}
                >
                  <Plus size={15} color="#000000" strokeWidth={2.5} />
                  <Text style={{ color: "#000000", fontSize: 13, fontWeight: "700" }}>
                    Criar atendimento
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        );

      case "showDaySummary":
        return (
          <View
            key="showDaySummary"
            className="p-4 rounded-2xl border gap-3.5"
            style={{
              backgroundColor: "#111215",
              borderColor: "rgba(255, 255, 255, 0.08)",
            }}
          >
            <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "700" }}>
              Resumo do dia
            </Text>

            <View className="gap-3 pt-0.5">
              {/* Row 1: Confirmados */}
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2.5">
                  <View
                    className="items-center justify-center rounded-full"
                    style={{
                      width: 24,
                      height: 24,
                      backgroundColor: "rgba(16, 185, 129, 0.15)",
                    }}
                  >
                    <Check size={13} color="#10b981" strokeWidth={2.5} />
                  </View>
                  <Text style={{ color: "#d1d5db", fontSize: 13, fontWeight: "500" }}>
                    Confirmados
                  </Text>
                </View>
                <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700" }}>
                  {confirmedCount}
                </Text>
              </View>

              {/* Row 2: Aguardando */}
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2.5">
                  <View
                    className="items-center justify-center rounded-full"
                    style={{
                      width: 24,
                      height: 24,
                      backgroundColor: "rgba(245, 158, 11, 0.15)",
                    }}
                  >
                    <Clock size={13} color="#f59e0b" strokeWidth={2.5} />
                  </View>
                  <Text style={{ color: "#d1d5db", fontSize: 13, fontWeight: "500" }}>
                    Aguardando
                  </Text>
                </View>
                <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700" }}>
                  {waitingCount}
                </Text>
              </View>

              {/* Row 3: Em atendimento */}
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2.5">
                  <View
                    className="items-center justify-center rounded-full"
                    style={{
                      width: 24,
                      height: 24,
                      backgroundColor: "rgba(59, 130, 246, 0.15)",
                    }}
                  >
                    <Zap size={13} color="#3b82f6" strokeWidth={2.5} />
                  </View>
                  <Text style={{ color: "#d1d5db", fontSize: 13, fontWeight: "500" }}>
                    Em atendimento
                  </Text>
                </View>
                <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700" }}>
                  {inProgressCount}
                </Text>
              </View>

              {/* Row 4: Finalizados */}
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2.5">
                  <View
                    className="items-center justify-center rounded-full"
                    style={{
                      width: 24,
                      height: 24,
                      backgroundColor: "rgba(16, 185, 129, 0.15)",
                    }}
                  >
                    <Check size={13} color="#10b981" strokeWidth={2.5} />
                  </View>
                  <Text style={{ color: "#d1d5db", fontSize: 13, fontWeight: "500" }}>
                    Finalizados
                  </Text>
                </View>
                <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700" }}>
                  {completedCount}
                </Text>
              </View>
            </View>

            {/* Footer: Abrir agenda completa */}
            <Pressable
              onPress={() => router.push("/(owner)/agenda")}
              className="flex-row items-center justify-between pt-3 border-t mt-1"
              style={{ borderTopColor: "rgba(255, 255, 255, 0.06)" }}
            >
              <View className="flex-row items-center gap-2">
                <CalendarDays size={15} color="#9ca3af" />
                <Text style={{ color: "#9ca3af", fontSize: 12.5, fontWeight: "500" }}>
                  Abrir agenda completa
                </Text>
              </View>
              <ArrowRight size={14} color="#9ca3af" />
            </Pressable>
          </View>
        );

      case "showQuickSlots":
      case "showTodayAppointments":
        return null;

      default:
        return null;
    }
  };

  return (
    <Screen
      header={<TopBar title="Visão geral" company={companyName} />}
      style={{ paddingTop: 10 }}
    >
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-6 gap-4">
          <Text
            style={{ color: colors.textSecondary, textAlign: "center", fontSize: 14 }}
          >
            {error}
          </Text>
          {isAuthError ? (
            <Button
              label="Fazer login novamente"
              onPress={async () => {
                await signOut();
                router.replace("/(auth)/login");
              }}
            />
          ) : (
            <Button label="Tentar novamente" onPress={load} />
          )}
        </View>
      ) : (
        <>
          <ScrollView
            className="flex-1"
            contentContainerStyle={{
              gap: 14,
              paddingBottom: 36,
              paddingHorizontal: 2,
            }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
          >
            {/* 1. Page Intro / Headings (Exact Screenshot) */}
            <View className="gap-3">
              <View className="gap-1">
                <Text
                  style={{
                    color: "#9ca3af",
                    fontSize: 11,
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                  }}
                >
                  ACOMPANHE O DIA DE HOJE
                </Text>
                <Text
                  style={{
                    color: "#ffffff",
                    fontSize: 25,
                    fontWeight: "800",
                    letterSpacing: -0.4,
                  }}
                >
                  Olá! Aqui está seu dia
                </Text>
                <Text
                  style={{
                    color: "#9ca3af",
                    fontSize: 13,
                    lineHeight: 18,
                  }}
                >
                  Acompanhe os atendimentos e a receita do seu estabelecimento hoje.
                </Text>
              </View>

              {/* Action Buttons Row */}
              <View className="flex-row items-center gap-2.5 pt-0.5">
                <Pressable
                  onPress={() => setCustomizeVisible(true)}
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border py-2.5 px-3"
                  style={{
                    backgroundColor: "#15161a",
                    borderColor: "rgba(255, 255, 255, 0.12)",
                  }}
                >
                  <SlidersHorizontal size={14} color="#ffffff" />
                  <Text
                    style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "600" }}
                  >
                    Personalizar início
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => router.push("/(owner)/agenda")}
                  className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2.5 px-3"
                  style={{ backgroundColor: "#ffffff" }}
                >
                  <Plus size={16} color="#000000" strokeWidth={2.5} />
                  <Text
                    style={{ color: "#000000", fontSize: 12.5, fontWeight: "700" }}
                  >
                    Novo agendamento
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* 2. Render sections in order */}
            {prefs.order.map((key) => renderSection(key))}
          </ScrollView>

          {/* Modal Personalizar Painel Inicial */}
          <CustomizeDashboardModal
            visible={customizeVisible}
            currentPrefs={prefs}
            onClose={() => setCustomizeVisible(false)}
            onSave={savePrefs}
          />
        </>
      )}
    </Screen>
  );
}
