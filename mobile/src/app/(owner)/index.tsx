import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/ui/screen";
import { StatCard } from "@/components/ui/stat-card";
import { useTheme } from "@/hooks/use-theme";
import { ApiError } from "@/lib/api-client";
import { formatBRL, getStats, type StatsResponse } from "@/lib/stats";
import { useSession } from "@/lib/session-context";

export default function OwnerHomeScreen() {
  const { colors } = useTheme();
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

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <Text style={[styles.greeting, { color: colors.textSecondary }]}>Olá,</Text>
        <Text style={[styles.company, { color: colors.text }]}>{session?.company.name ?? "—"}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: colors.textSecondary, textAlign: "center" }}>{error}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.grid}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          <StatCard label="Atendimentos hoje" value={String(stats?.today.appointments ?? 0)} />
          <StatCard label="Clientes atendidos" value={String(stats?.today.clientsServed ?? 0)} />
          <StatCard label="Receita prevista" value={formatBRL(stats?.today.forecast ?? 0)} hint="para hoje" />
          <StatCard label="Receita realizada" value={formatBRL(stats?.today.realized ?? 0)} hint="já recebida hoje" />
          <StatCard label="Cancelamentos" value={String(stats?.today.cancelled ?? 0)} />
          <StatCard label="Ticket médio" value={formatBRL(stats?.today.averageTicket ?? 0)} />
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: 8, gap: 20 },
  header: { gap: 2 },
  greeting: { fontSize: 14 },
  company: { fontSize: 24, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingBottom: 24 },
});
