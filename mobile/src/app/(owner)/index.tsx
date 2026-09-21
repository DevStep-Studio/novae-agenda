import {
  ArrowRight,
  Ban,
  Calendar,
  CalendarDays,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  Circle,
  CircleDollarSign,
  Clock,
  ImagePlus,
  Plus,
  Share2,
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
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import * as SecureStore from "expo-secure-store";

import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { AppointmentCard } from "@/components/ui/appointment-card";
import { colors, radius } from "@/constants/design-tokens";
import { ApiError, api, resolveImageUrl } from "@/lib/api-client";
import { getStats, type StatsResponse } from "@/lib/stats";
import { useSession } from "@/lib/session-context";
import { useTheme } from "@/hooks/use-theme";
import {
  CustomizeDashboardModal,
  DEFAULT_DASHBOARD_PREFS,
  type DashboardPrefs,
  type DashboardSectionKey,
} from "@/components/dashboard/customize-dashboard-modal";

const DASHBOARD_PREFS_KEY = "reservei_dashboard_prefs_v1";

interface SetupStatus {
  isComplete: boolean;
  publicUrl?: string;
  steps: {
    key: string;
    label: string;
    completed: boolean;
    route?: string;
  }[];
}

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
  const { session, refresh, signOut } = useSession();
  const { isDark, colors: themeColors, primaryColor, primaryForeground } = useTheme();

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [customizeVisible, setCustomizeVisible] = useState(false);
  const [prefs, setPrefs] = useState<DashboardPrefs>(DEFAULT_DASHBOARD_PREFS);

  // Load saved preferences from session or SecureStore
  useEffect(() => {
    async function loadPrefs() {
      if (session?.company?.dashboardPreferences) {
        setPrefs((prev) => ({
          ...prev,
          ...(session.company.dashboardPreferences as unknown as Partial<DashboardPrefs>),
        }));
        return;
      }
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
  }, [session?.company?.dashboardPreferences]);

  const savePrefs = async (newPrefs: DashboardPrefs) => {
    setPrefs(newPrefs);
    try {
      await SecureStore.setItemAsync(DASHBOARD_PREFS_KEY, JSON.stringify(newPrefs));
    } catch {
      // ignore
    }
    try {
      await api("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ dashboardPreferences: newPrefs }),
      });
    } catch {
      // ignore
    }
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      const [statsData, aptsData, setupData] = await Promise.all([
        getStats("today"),
        api<{ appointments: any[] }>("/api/appointments?range=today").catch(() => ({
          appointments: [],
        })),
        api<SetupStatus>("/api/company/setup-status").catch(() => null),
        refresh().catch(() => null),
      ]);
      setStats(statsData);
      setAppointments(aptsData?.appointments || []);
      if (setupData) setSetupStatus(setupData);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não foi possível carregar o painel."
      );
    }
  }, [refresh]);

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

  useFocusEffect(
    useCallback(() => {
      void load();
      setLogoLoadError(false);
      setBannerLoadError(false);
    }, [load])
  );

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

  const firstName = session?.name ? session.name.split(" ")[0] : "você";
  const defaultBanner =
    "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80";
  const rawBannerUrl = session?.company?.bannerUrl || session?.bannerUrl || defaultBanner;
  const rawLogoUrl = session?.company?.logoUrl || session?.avatarUrl;
  const bannerUrl = resolveImageUrl(rawBannerUrl) || defaultBanner;
  const logoUrl = resolveImageUrl(rawLogoUrl);
  const [bannerLoadError, setBannerLoadError] = useState(false);
  const [logoLoadError, setLogoLoadError] = useState(false);

  useEffect(() => {
    setLogoLoadError(false);
    setBannerLoadError(false);
  }, [logoUrl, bannerUrl]);

  const companyName = session?.company?.name || "Estabelecimento";
  const initials = (companyName || firstName || "RE")
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

  const cardBg = isDark ? "#111215" : "#ffffff";
  const cardBorder = isDark ? "rgba(255, 255, 255, 0.08)" : "#e2e8f0";
  const textTitle = isDark ? "#ffffff" : "#0f172a";
  const textMuted = isDark ? "#9ca3af" : "#64748b";

  const renderSection = (key: DashboardSectionKey) => {
    if (!prefs[key]) return null;

    switch (key) {
      case "showBanner":
        return (
          <View
            key="showBanner"
            style={[
              styles.cardBase,
              {
                backgroundColor: cardBg,
                borderColor: cardBorder,
                borderWidth: 1,
                borderRadius: 14,
                overflow: "hidden",
                position: "relative",
              },
            ]}
          >
            {/* Background Cover Image with Clean Subtle Opacity (No harsh gradient) */}
            {bannerUrl ? (
              <Image
                source={{ uri: bannerLoadError ? defaultBanner : bannerUrl }}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  opacity: 0.08,
                }}
                contentFit="cover"
                onError={() => setBannerLoadError(true)}
              />
            ) : null}

            <View style={{ padding: 18, gap: 14 }}>
              {/* Title & Greeting Subtitle */}
              <View style={{ gap: 4 }}>
                <Text
                  style={{
                    color: textTitle,
                    fontSize: 20,
                    fontWeight: "700",
                    letterSpacing: -0.3,
                  }}
                >
                  Bom trabalho, {firstName}!
                </Text>
                <Text
                  style={{
                    color: textMuted,
                    fontSize: 13,
                    lineHeight: 18,
                  }}
                >
                  {(stats?.today.appointments ?? 0) === 0
                    ? "Sua agenda está livre hoje. Pronto para receber novos clientes!"
                    : `Você tem ${stats?.today.appointments} atendimento${
                        (stats?.today.appointments ?? 0) === 1 ? "" : "s"
                      } agendado${(stats?.today.appointments ?? 0) === 1 ? "" : "s"} hoje.`}
                </Text>
              </View>

              {/* Bottom Row: Personalizar Capa Button + Logo/Profile Photo Box */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingTop: 4,
                }}
              >
                <Pressable
                  onPress={() => router.push("/(owner)/perfil" as any)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    height: 36,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
                    borderWidth: 1,
                    borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.08)",
                  }}
                >
                  <ImagePlus size={14} color={textTitle} />
                  <Text style={{ color: textTitle, fontSize: 12, fontWeight: "600" }}>
                    Personalizar capa
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => router.push("/(owner)/perfil" as any)}
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 12,
                    overflow: "hidden",
                    borderWidth: 1,
                    backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#f1f5f9",
                    borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.08)",
                    alignItems: "center",
                    justifyContent: "center",
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
                    <Text style={{ color: textTitle, fontSize: 17, fontWeight: "700" }}>
                      {initials}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        );

      case "showChecklist":
        if (!setupStatus) return null;
        return (
          <View
            key="showChecklist"
            style={[
              styles.cardBase,
              {
                backgroundColor: cardBg,
                borderColor: cardBorder,
                padding: 16,
                gap: 12,
              },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: "rgba(220, 255, 76, 0.15)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Sparkles size={15} color={primaryColor} />
                </View>
                <Text style={{ color: textTitle, fontSize: 14, fontWeight: "700" }}>
                  Checklist de Configuração
                </Text>
              </View>

              {setupStatus.publicUrl ? (
                <Pressable
                  onPress={() => {
                    void Share.share({
                      message: `Agende seu horário online no ${companyName}: ${setupStatus.publicUrl}`,
                      url: setupStatus.publicUrl,
                    });
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 6,
                    backgroundColor: primaryColor,
                  }}
                >
                  <Share2 size={12} color={primaryForeground} />
                  <Text style={{ color: primaryForeground, fontSize: 11, fontWeight: "700" }}>
                    Compartilhar
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <View style={{ gap: 8 }}>
              {setupStatus.steps?.map((step) => (
                <Pressable
                  key={step.key}
                  onPress={() => {
                    if (step.route) router.push(step.route as any);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 6,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                    {step.completed ? (
                      <CheckCircle2 size={18} color="#10b981" />
                    ) : (
                      <Circle size={18} color={textMuted} />
                    )}
                    <Text
                      style={{
                        color: step.completed ? textMuted : textTitle,
                        fontSize: 13,
                        fontWeight: step.completed ? "400" : "600",
                        textDecorationLine: step.completed ? "line-through" : "none",
                      }}
                    >
                      {step.label}
                    </Text>
                  </View>
                  <ChevronRight size={15} color={textMuted} />
                </Pressable>
              ))}
            </View>
          </View>
        );

      case "showKpis":
        return (
          <View key="showKpis" style={styles.kpiGrid}>
            {/* Card 1: Atendimentos hoje */}
            <View style={[styles.kpiCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={[styles.kpiIconBox, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#f1f5f9" }]}>
                  <CalendarDays size={16} color={textTitle} />
                </View>
                <Text style={{ color: textMuted, fontSize: 12, fontWeight: "500", flex: 1 }} numberOfLines={1}>
                  Atendimentos hoje
                </Text>
              </View>
              <View style={{ gap: 2, marginTop: 10 }}>
                <Text style={{ color: textTitle, fontSize: 22, fontWeight: "800", letterSpacing: -0.3 }}>
                  {stats?.today.appointments ?? 0}
                </Text>
                <Text style={{ color: isDark ? "#6b7280" : "#94a3b8", fontSize: 11.5 }}>
                  agendados para hoje
                </Text>
              </View>
            </View>

            {/* Card 2: Receita prevista */}
            <View style={[styles.kpiCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={[styles.kpiIconBox, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#f1f5f9" }]}>
                  <TrendingUp size={16} color={textTitle} />
                </View>
                <Text style={{ color: textMuted, fontSize: 12, fontWeight: "500", flex: 1 }} numberOfLines={1}>
                  Receita prevista
                </Text>
              </View>
              <View style={{ gap: 2, marginTop: 10 }}>
                <Text style={{ color: textTitle, fontSize: 22, fontWeight: "800", letterSpacing: -0.3 }}>
                  {formatDashboardCurrency(forecast)}
                </Text>
                <Text style={{ color: isDark ? "#6b7280" : "#94a3b8", fontSize: 11.5 }}>
                  para hoje
                </Text>
              </View>
            </View>

            {/* Card 3: Receita realizada */}
            <View style={[styles.kpiCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={[styles.kpiIconBox, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#f1f5f9" }]}>
                  <WalletCards size={16} color={textTitle} />
                </View>
                <Text style={{ color: textMuted, fontSize: 12, fontWeight: "500", flex: 1 }} numberOfLines={1}>
                  Receita realizada
                </Text>
              </View>
              <View style={{ gap: 2, marginTop: 10 }}>
                <Text style={{ color: textTitle, fontSize: 22, fontWeight: "800", letterSpacing: -0.3 }}>
                  {formatDashboardCurrency(realized)}
                </Text>
                <Text style={{ color: isDark ? "#6b7280" : "#94a3b8", fontSize: 11.5 }}>
                  já recebida hoje
                </Text>
              </View>
            </View>

            {/* Card 4: Receita pendente */}
            <View style={[styles.kpiCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={[styles.kpiIconBox, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#f1f5f9" }]}>
                  <CircleDollarSign size={16} color={textTitle} />
                </View>
                <Text style={{ color: textMuted, fontSize: 12, fontWeight: "500", flex: 1 }} numberOfLines={1}>
                  Receita pendente
                </Text>
              </View>
              <View style={{ gap: 2, marginTop: 10 }}>
                <Text style={{ color: textTitle, fontSize: 22, fontWeight: "800", letterSpacing: -0.3 }}>
                  {formatDashboardCurrency(pendingAmount)}
                </Text>
                <Text style={{ color: isDark ? "#6b7280" : "#94a3b8", fontSize: 11.5 }}>
                  a receber hoje
                </Text>
              </View>
            </View>

            {/* Card 5: Clientes atendidos */}
            <View style={[styles.kpiCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={[styles.kpiIconBox, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#f1f5f9" }]}>
                  <Users size={16} color={textTitle} />
                </View>
                <Text style={{ color: textMuted, fontSize: 12, fontWeight: "500", flex: 1 }} numberOfLines={1}>
                  Clientes atendidos
                </Text>
              </View>
              <View style={{ gap: 2, marginTop: 10 }}>
                <Text style={{ color: textTitle, fontSize: 22, fontWeight: "800", letterSpacing: -0.3 }}>
                  {stats?.today.clientsServed ?? 0}
                </Text>
                <Text style={{ color: isDark ? "#6b7280" : "#94a3b8", fontSize: 11.5 }}>
                  finalizados hoje
                </Text>
              </View>
            </View>
          </View>
        );

      case "showSubmetrics":
        return (
          <View key="showSubmetrics" style={{ flexDirection: "row", gap: 10 }}>
            {/* Left Submetric: Atendimentos pendentes */}
            <View
              style={[
                styles.submetricCard,
                { backgroundColor: cardBg, borderColor: cardBorder },
              ]}
            >
              <Text style={{ color: textMuted, fontSize: 12, fontWeight: "500", flex: 1, paddingRight: 6 }}>
                Atendimentos pendentes
              </Text>
              <Text style={{ color: textTitle, fontSize: 20, fontWeight: "800" }}>
                {pendingCount}
              </Text>
            </View>

            {/* Right Submetric: Cancelamentos hoje */}
            <View
              style={[
                styles.submetricCard,
                { backgroundColor: cardBg, borderColor: cardBorder },
              ]}
            >
              <View style={{ gap: 2 }}>
                <Text style={{ color: textMuted, fontSize: 12, fontWeight: "500" }}>
                  Cancelamentos
                </Text>
                <Text
                  style={{
                    color: cancelledCount > 0 ? "#ef4444" : textTitle,
                    fontSize: 20,
                    fontWeight: "800",
                  }}
                >
                  {cancelledCount}
                </Text>
              </View>
              <Ban size={18} color={cancelledCount > 0 ? "#ef4444" : textMuted} />
            </View>
          </View>
        );

      case "showNextAppointment":
        return (
          <View
            key="showNextAppointment"
            style={[
              styles.cardBase,
              {
                backgroundColor: cardBg,
                borderColor: cardBorder,
                padding: 16,
                gap: 14,
              },
            ]}
          >
            <Text style={{ color: textTitle, fontSize: 16, fontWeight: "700" }}>
              Próximo atendimento
            </Text>

            {nextAppointment ? (
              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 6,
                        backgroundColor: "rgba(59, 130, 246, 0.15)",
                      }}
                    >
                      <Text style={{ color: "#3b82f6", fontSize: 11.5, fontWeight: "700" }}>
                        {nextAppointment.startTime || "Hoje"}
                      </Text>
                    </View>
                    <Text style={{ color: textTitle, fontSize: 14, fontWeight: "600" }}>
                      {nextAppointment.clientName || "Cliente"}
                    </Text>
                  </View>

                  <Text style={{ color: textTitle, fontSize: 14, fontWeight: "700" }}>
                    {formatDashboardCurrency(nextAppointment.total || nextAppointment.price)}
                  </Text>
                </View>

                <Text style={{ color: textMuted, fontSize: 12.5 }}>
                  {nextAppointment.serviceName || "Serviço"} · com {nextAppointment.employeeName || "Profissional"}
                </Text>

                <Pressable
                  onPress={() => router.push("/(owner)/agenda")}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: 10,
                    borderTopWidth: 1,
                    borderTopColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#e2e8f0",
                  }}
                >
                  <Text style={{ color: "#3b82f6", fontSize: 12.5, fontWeight: "600" }}>
                    Ver na Agenda
                  </Text>
                  <ArrowRight size={14} color="#3b82f6" />
                </Pressable>
              </View>
            ) : (
              <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 12, gap: 4 }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    borderWidth: 1,
                    backgroundColor: isDark ? "#18191e" : "#f1f5f9",
                    borderColor: cardBorder,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 4,
                  }}
                >
                  <CalendarDays size={22} color={textMuted} />
                </View>

                <Text style={{ color: textTitle, fontSize: 14, fontWeight: "700" }}>
                  Agenda livre hoje
                </Text>
                <Text style={{ color: textMuted, fontSize: 12 }}>
                  Você ainda não tem atendimentos para hoje.
                </Text>

                <Pressable
                  onPress={() => router.push("/(owner)/agenda")}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 12,
                    marginTop: 10,
                    backgroundColor: primaryColor,
                  }}
                >
                  <Plus size={15} color={primaryForeground} strokeWidth={2.5} />
                  <Text style={{ color: primaryForeground, fontSize: 13, fontWeight: "700" }}>
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
            style={[
              styles.cardBase,
              {
                backgroundColor: cardBg,
                borderColor: cardBorder,
                padding: 16,
                gap: 14,
              },
            ]}
          >
            <Text style={{ color: textTitle, fontSize: 16, fontWeight: "700" }}>
              Resumo do dia
            </Text>

            <View style={{ gap: 12, paddingTop: 2 }}>
              {/* Confirmados */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(16, 185, 129, 0.15)", alignItems: "center", justifyContent: "center" }}>
                    <Check size={13} color="#10b981" strokeWidth={2.5} />
                  </View>
                  <Text style={{ color: textTitle, fontSize: 13, fontWeight: "500" }}>
                    Confirmados
                  </Text>
                </View>
                <Text style={{ color: textTitle, fontSize: 13, fontWeight: "700" }}>
                  {confirmedCount}
                </Text>
              </View>

              {/* Aguardando */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(245, 158, 11, 0.15)", alignItems: "center", justifyContent: "center" }}>
                    <Clock size={13} color="#f59e0b" strokeWidth={2.5} />
                  </View>
                  <Text style={{ color: textTitle, fontSize: 13, fontWeight: "500" }}>
                    Aguardando
                  </Text>
                </View>
                <Text style={{ color: textTitle, fontSize: 13, fontWeight: "700" }}>
                  {waitingCount}
                </Text>
              </View>

              {/* Em atendimento */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(59, 130, 246, 0.15)", alignItems: "center", justifyContent: "center" }}>
                    <Zap size={13} color="#3b82f6" strokeWidth={2.5} />
                  </View>
                  <Text style={{ color: textTitle, fontSize: 13, fontWeight: "500" }}>
                    Em atendimento
                  </Text>
                </View>
                <Text style={{ color: textTitle, fontSize: 13, fontWeight: "700" }}>
                  {inProgressCount}
                </Text>
              </View>

              {/* Finalizados */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(16, 185, 129, 0.15)", alignItems: "center", justifyContent: "center" }}>
                    <Check size={13} color="#10b981" strokeWidth={2.5} />
                  </View>
                  <Text style={{ color: textTitle, fontSize: 13, fontWeight: "500" }}>
                    Finalizados
                  </Text>
                </View>
                <Text style={{ color: textTitle, fontSize: 13, fontWeight: "700" }}>
                  {completedCount}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => router.push("/(owner)/agenda")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#e2e8f0",
                marginTop: 4,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <CalendarDays size={15} color={textMuted} />
                <Text style={{ color: textMuted, fontSize: 12.5, fontWeight: "500" }}>
                  Abrir agenda completa
                </Text>
              </View>
              <ArrowRight size={14} color={textMuted} />
            </Pressable>
          </View>
        );

      case "showTodayAppointments":
        if (appointments.length === 0) return null;
        return (
          <View key="showTodayAppointments" style={{ gap: 10 }}>
            <Text style={{ color: textTitle, fontSize: 16, fontWeight: "700" }}>
              Atendimentos de hoje ({appointments.length})
            </Text>
            {appointments.map((apt) => (
              <AppointmentCard key={apt.id} appointment={apt} />
            ))}
          </View>
        );

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
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={primaryColor} size="large" />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
          <Text style={{ color: textMuted, textAlign: "center", fontSize: 14 }}>
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
            style={{ flex: 1 }}
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
                tintColor={primaryColor}
              />
            }
          >
            {/* 1. Page Intro / Headings */}
            <View style={{ gap: 14, marginTop: 4, marginBottom: 2 }}>
              <View style={{ gap: 6 }}>
                <Text
                  style={{
                    color: isDark ? "#9ca3af" : "#64748b",
                    fontSize: 11.5,
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                  }}
                >
                  ACOMPANHE O DIA DE HOJE
                </Text>
                <Text
                  style={{
                    color: textTitle,
                    fontSize: 28,
                    fontWeight: "800",
                    letterSpacing: -0.5,
                    lineHeight: 34,
                  }}
                >
                  Olá! Aqui está seu dia
                </Text>
                <Text
                  style={{
                    color: textMuted,
                    fontSize: 14,
                    lineHeight: 20,
                  }}
                >
                  Acompanhe os atendimentos e a receita do seu estabelecimento hoje.
                </Text>
              </View>

              {/* Action Buttons Row */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 2 }}>
                <Pressable
                  onPress={() => setCustomizeVisible(true)}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    borderRadius: 12,
                    borderWidth: 1,
                    height: 44,
                    paddingHorizontal: 12,
                    backgroundColor: isDark ? "#121316" : "#f8fafc",
                    borderColor: isDark ? "rgba(255, 255, 255, 0.12)" : "#e2e8f0",
                  }}
                >
                  <SlidersHorizontal size={15} color={textTitle} />
                  <Text style={{ color: textTitle, fontSize: 13.5, fontWeight: "600" }}>
                    Personalizar início
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => router.push("/(owner)/agenda")}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    borderRadius: 12,
                    height: 44,
                    paddingHorizontal: 12,
                    backgroundColor: isDark ? "#ffffff" : primaryColor,
                  }}
                >
                  <Plus size={18} color={isDark ? "#000000" : primaryForeground} strokeWidth={2.5} />
                  <Text style={{ color: isDark ? "#000000" : primaryForeground, fontSize: 13.5, fontWeight: "700" }}>
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

const styles = StyleSheet.create({
  cardBase: {
    borderRadius: 16,
    borderWidth: 1,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  kpiCard: {
    width: "48.5%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    justifyContent: "space-between",
    minHeight: 110,
  },
  kpiIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  submetricCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
});
