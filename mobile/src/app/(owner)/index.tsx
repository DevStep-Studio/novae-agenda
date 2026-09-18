import { CalendarDays, CircleDollarSign, TrendingUp, Users, WalletCards } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";

import { MetricCard } from "@/components/ui/metric-card";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { colors, typography } from "@/constants/design-tokens";
import { ApiError } from "@/lib/api-client";
import { formatBRL, getStats, type StatsResponse } from "@/lib/stats";
import { useSession } from "@/lib/session-context";

// KPI set, order, icons and copy mirror app-shell.tsx:417-458 (`.metrics-grid`)
// exactly — including "Receita pendente", which the web computes client-side
// as max(0, forecast - realized) (app-shell.tsx:318) rather than reading it
// from the API, so this screen does the same instead of calling a new endpoint.
export default function OwnerHomeScreen() {
  const { session } = useSession();

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

  return (
    <Screen header={<TopBar title="Visão geral" company={session?.company.name} />} style={{ paddingTop: 16 }}>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center">
          <Text style={{ color: colors.textSecondary, textAlign: "center" }}>{error}</Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-5 pb-6"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {/* .page-intro / .eyebrow / .intro-copy, globals.css:8727-8770.
              The web also shows two action buttons here ("Personalizar
              início" / "Novo agendamento") and, for trial accounts, a
              subscription countdown card — both omitted: they'd open a
              dashboard-customization modal and an appointment-creation flow
              that don't exist in the mobile app yet, and IAP/paywall is a
              deliberately later phase (see MOBILE_DESIGN_SYSTEM.md). */}
          <View>
            <Text style={{ color: colors.primary, ...typography.eyebrow }}>ACOMPANHE O DIA DE HOJE</Text>
            <Text style={{ color: colors.textPrimary, marginTop: 4, ...typography.pageTitle }}>
              Olá! Aqui está seu dia
            </Text>
            <Text style={{ color: colors.textMuted, marginTop: 6, ...typography.pageSubtitle }}>
              Acompanhe os atendimentos e a receita do seu estabelecimento hoje.
            </Text>
          </View>

          <View className="flex-row flex-wrap gap-3">
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
