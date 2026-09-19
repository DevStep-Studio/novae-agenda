import {
  CalendarDays,
  CircleDollarSign,
  ImagePlus,
  Plus,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react-native";
import { Image } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { colors, fontFamily, radius, typography } from "@/constants/design-tokens";
import { ApiError } from "@/lib/api-client";
import { formatBRL, getStats, type StatsResponse } from "@/lib/stats";
import { useSession } from "@/lib/session-context";

export default function OwnerHomeScreen() {
  const { session, signOut } = useSession();

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setStats(await getStats("today"));
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
  const companyName = session?.company?.name || "Estabelecimento";
  const initials = companyName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

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
              <Text style={{ color: colors.textPrimary, marginTop: 3, ...typography.pageTitle }}>
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
                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                onPress={() => router.push("/(owner)/configuracoes")}
              >
                <SlidersHorizontal size={14} color={colors.textPrimary} />
                <Text style={{ color: colors.textPrimary, fontSize: 12.5, fontWeight: "600" }}>
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

          {/* 2. Welcome Cover Banner Card (.dashboard-banner-card) */}
          <View
            className="relative overflow-hidden rounded-xl border"
            style={{
              borderColor: colors.border,
              backgroundColor: colors.surface,
              minHeight: 145,
            }}
          >
            {/* Background cover image */}
            <Image
              source={{ uri: bannerUrl }}
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.3 }}
              contentFit="cover"
            />

            {/* Content with gradient overlay */}
            <View
              className="p-4 gap-3.5"
              style={{
                backgroundColor: "rgba(14, 16, 20, 0.78)",
              }}
            >
              <View className="gap-1.5">
                <View
                  className="self-start flex-row items-center gap-1.5 px-2.5 py-1 rounded"
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    borderColor: "rgba(255, 255, 255, 0.14)",
                    borderWidth: 1,
                  }}
                >
                  <Sparkles size={11} color={colors.primary} />
                  <Text
                    style={{
                      color: colors.textPrimary,
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
                  onPress={() => router.push("/(owner)/configuracoes")}
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

          {/* 3. Metrics Cards 2-Column Grid */}
          <View className="flex-row flex-wrap gap-2.5">
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
        </ScrollView>
      )}
    </Screen>
  );
}
