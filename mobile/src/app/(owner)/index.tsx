import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock,
  ImagePlus,
  Plus,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  User,
  Users,
  WalletCards,
} from "lucide-react-native";
import { Image } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";

import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { colors, fontFamily, radius, typography } from "@/constants/design-tokens";
import { ApiError, api } from "@/lib/api-client";
import { formatBRL, getStats, type StatsResponse } from "@/lib/stats";
import { useSession } from "@/lib/session-context";
import {
  CustomizeDashboardModal,
  DEFAULT_DASHBOARD_PREFS,
  type DashboardPrefs,
  type DashboardSectionKey,
} from "@/components/dashboard/customize-dashboard-modal";

const DASHBOARD_PREFS_KEY = "reservei_dashboard_prefs_v1";

export default function OwnerHomeScreen() {
  const { session, signOut } = useSession();

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [customizeVisible, setCustomizeVisible] = useState(false);
  const [prefs, setPrefs] = useState<DashboardPrefs>(DEFAULT_DASHBOARD_PREFS);

  // Load saved preferences from SecureStore
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
        api<{ appointments: any[] }>("/api/appointments?range=today").catch(() => ({ appointments: [] })),
      ]);
      setStats(statsData);
      setAppointments(aptsData?.appointments || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar o painel.");
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

  const firstName = session?.name ? session.name.split(" ")[0] : "você";
  const defaultBanner =
    "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80";
  const bannerUrl = session?.company?.bannerUrl || defaultBanner;
  const logoUrl = session?.company?.logoUrl;
  const companyName = session?.company?.name || "Moa Tattoo";
  const initials = companyName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  const nextAppointment = appointments.find(
    (a) => a.status === "confirmed" || a.status === "scheduled"
  );

  const confirmedCount = appointments.filter((a) => a.status === "confirmed" || a.status === "scheduled").length;
  const inProgressCount = appointments.filter((a) => a.status === "in_progress").length;
  const completedCount = appointments.filter((a) => a.status === "completed").length;
  const cancelledCount = appointments.filter((a) => a.status === "cancelled").length;

  const renderSection = (key: DashboardSectionKey) => {
    if (!prefs[key]) return null;

    switch (key) {
      case "showBanner":
        return (
          <View
            key="showBanner"
            className="relative overflow-hidden rounded-xl border"
            style={{
              borderColor: "rgba(255, 255, 255, 0.1)",
              backgroundColor: "#131418",
              minHeight: 145,
            }}
          >
            <Image
              source={{ uri: bannerUrl }}
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.35 }}
              contentFit="cover"
            />
            <View className="p-4 gap-3.5" style={{ backgroundColor: "rgba(14, 16, 20, 0.78)" }}>
              <View className="gap-1.5">
                <View
                  className="self-start flex-row items-center gap-1.5 px-2.5 py-1 rounded"
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    borderColor: "rgba(255, 255, 255, 0.14)",
                    borderWidth: 1,
                  }}
                >
                  <Sparkles size={11} color="#ccff00" />
                  <Text
                    style={{
                      color: "#ffffff",
                      fontSize: 10.5,
                      fontWeight: "700",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    {companyName}
                  </Text>
                </View>

                <Text style={{ color: "#ffffff", fontSize: 21, fontFamily: fontFamily.display }}>
                  Bom trabalho, {firstName}!
                </Text>

                <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
                  {(stats?.today.appointments ?? 0) === 0
                    ? "Sua agenda está livre hoje. Pronto para receber novos clientes!"
                    : `Você tem ${stats?.today.appointments} atendimento${(stats?.today.appointments ?? 0) === 1 ? "" : "s"} agendado${(stats?.today.appointments ?? 0) === 1 ? "" : "s"} hoje.`}
                </Text>
              </View>

              <View className="flex-row items-end justify-between pt-1">
                <Pressable
                  className="flex-row items-center gap-1.5 px-3 py-2 rounded-lg border"
                  style={{ backgroundColor: "rgba(0, 0, 0, 0.5)", borderColor: "rgba(255, 255, 255, 0.18)" }}
                  onPress={() => router.push("/(owner)/perfil" as any)}
                >
                  <ImagePlus size={13} color="#ffffff" />
                  <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "600" }}>
                    Personalizar capa
                  </Text>
                </Pressable>

                <View
                  className="items-center justify-center rounded-2xl overflow-hidden border"
                  style={{
                    width: 68,
                    height: 68,
                    backgroundColor: "rgba(0, 0, 0, 0.4)",
                    borderColor: "rgba(255, 255, 255, 0.18)",
                  }}
                >
                  {logoUrl ? (
                    <Image source={{ uri: logoUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  ) : (
                    <Text style={{ color: "#ffffff", fontSize: 20, fontWeight: "700" }}>
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
          <View key="showKpis" className="flex-row flex-wrap gap-2.5">
            <MetricCard
              icon={CalendarDays}
              label="Atendimentos hoje"
              value={String(stats?.today.appointments ?? 0)}
              detail="agendados para hoje"
            />
            <MetricCard icon={TrendingUp} label="Receita prevista" value={formatBRL(forecast)} detail="para hoje" />
            <MetricCard
              icon={WalletCards}
              label="Receita realizada"
              value={formatBRL(realized)}
              detail="já recebida hoje"
            />
            <MetricCard
              icon={CircleDollarSign}
              label="Receita pendente"
              value={formatBRL(pendingAmount)}
              detail="a receber hoje"
            />
            <MetricCard
              icon={Users}
              label="Clientes atendidos"
              value={String(stats?.today.clientsServed ?? 0)}
              detail="finalizados hoje"
            />
          </View>
        );

      case "showSubmetrics":
        return (
          <View key="showSubmetrics" className="flex-row gap-2.5">
            <View
              className="flex-1 p-3.5 rounded-xl border"
              style={{ backgroundColor: "#15161a", borderColor: "rgba(255, 255, 255, 0.08)" }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 11.5, fontWeight: "600" }}>Pendentes</Text>
              <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "700", marginTop: 2 }}>
                {confirmedCount}
              </Text>
            </View>
            <View
              className="flex-1 p-3.5 rounded-xl border"
              style={{ backgroundColor: "#15161a", borderColor: "rgba(255, 255, 255, 0.08)" }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 11.5, fontWeight: "600" }}>Cancelamentos</Text>
              <Text style={{ color: colors.danger, fontSize: 18, fontWeight: "700", marginTop: 2 }}>
                {cancelledCount}
              </Text>
            </View>
          </View>
        );

      case "showNextAppointment":
        if (!nextAppointment) return null;
        return (
          <View
            key="showNextAppointment"
            className="p-4 rounded-xl border gap-3"
            style={{ backgroundColor: "#15161a", borderColor: "rgba(255, 255, 255, 0.08)" }}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Clock size={16} color={colors.primary} />
                <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "700" }}>
                  Próximo Atendimento
                </Text>
              </View>
              <View
                className="px-2.5 py-0.5 rounded-full"
                style={{ backgroundColor: colors.primarySoft }}
              >
                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700" }}>
                  {nextAppointment.startTime || "Hoje"}
                </Text>
              </View>
            </View>

            <View className="gap-1">
              <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "600" }}>
                {nextAppointment.clientName || "Cliente"}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                {nextAppointment.serviceName || "Serviço"} · {nextAppointment.employeeName || "Profissional"}
              </Text>
            </View>

            <Pressable
              onPress={() => router.push("/(owner)/agenda")}
              className="flex-row items-center justify-between pt-2 border-t"
              style={{ borderTopColor: "rgba(255, 255, 255, 0.06)" }}
            >
              <Text style={{ color: colors.primary, fontSize: 12.5, fontWeight: "600" }}>
                Ver na Agenda
              </Text>
              <ChevronRight size={15} color={colors.primary} />
            </Pressable>
          </View>
        );

      case "showDaySummary":
        return (
          <View
            key="showDaySummary"
            className="p-4 rounded-xl border gap-3"
            style={{ backgroundColor: "#15161a", borderColor: "rgba(255, 255, 255, 0.08)" }}
          >
            <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "700" }}>
              Resumo do Dia por Status
            </Text>

            <View className="flex-row justify-between pt-1">
              <View className="items-center">
                <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "700" }}>
                  {confirmedCount}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>Confirmados</Text>
              </View>
              <View className="items-center">
                <Text style={{ color: "#f59e0b", fontSize: 16, fontWeight: "700" }}>
                  {inProgressCount}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>Em andamento</Text>
              </View>
              <View className="items-center">
                <Text style={{ color: colors.success, fontSize: 16, fontWeight: "700" }}>
                  {completedCount}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>Finalizados</Text>
              </View>
              <View className="items-center">
                <Text style={{ color: colors.danger, fontSize: 16, fontWeight: "700" }}>
                  {cancelledCount}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>Cancelados</Text>
              </View>
            </View>
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
    <Screen header={<TopBar title="Visão geral" company={companyName} />} style={{ paddingTop: 14 }}>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-6 gap-4">
          <Text style={{ color: colors.textSecondary, textAlign: "center", fontSize: 14 }}>{error}</Text>
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
            contentContainerClassName="gap-4 pb-8"
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          >
            {/* 1. Page Intro / Headings */}
            <View className="gap-3">
              <View>
                <Text style={{ color: colors.primary, ...typography.eyebrow }}>ACOMPANHE O DIA DE HOJE</Text>
                <Text style={{ color: "#ffffff", marginTop: 3, ...typography.pageTitle }}>
                  Olá! Aqui está seu dia
                </Text>
                <Text style={{ color: colors.textMuted, marginTop: 4, ...typography.pageSubtitle }}>
                  Acompanhe os atendimentos e a receita do seu estabelecimento hoje.
                </Text>
              </View>

              {/* Action buttons row */}
              <View className="flex-row items-center gap-2.5">
                <Pressable
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-[9px] border py-2.5 px-3"
                  style={{ backgroundColor: "#15161a", borderColor: "rgba(255, 255, 255, 0.12)" }}
                  onPress={() => setCustomizeVisible(true)}
                >
                  <SlidersHorizontal size={14} color="#ffffff" />
                  <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "600" }}>
                    Personalizar início
                  </Text>
                </Pressable>

                <Pressable
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-[9px] py-2.5 px-3"
                  style={{ backgroundColor: "#ffffff" }}
                  onPress={() => router.push("/(owner)/agenda")}
                >
                  <Plus size={16} color="#000000" strokeWidth={2.5} />
                  <Text style={{ color: "#000000", fontSize: 12.5, fontWeight: "700" }}>
                    Novo agendamento
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Render customizable sections in user-defined order */}
            {prefs.order.map((key) => renderSection(key))}
          </ScrollView>

          {/* Modal Personalizar Painel Inicial (Exact Screenshot 1) */}
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
