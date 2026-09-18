import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/ui/screen";
import { useTheme } from "@/hooks/use-theme";
import { ApiError } from "@/lib/api-client";
import { getAppointments, statusLabel, todayKey, type AppointmentDTO } from "@/lib/appointments";
import { formatBRL } from "@/lib/stats";

export default function EmployeeAgendaScreen() {
  const { colors } = useTheme();
  const [appointments, setAppointments] = useState<AppointmentDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setAppointments(await getAppointments({ from: todayKey() }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar sua agenda.");
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
      <Text style={[styles.title, { color: colors.text }]}>Hoje</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: colors.textSecondary, textAlign: "center" }}>{error}</Text>
        </View>
      ) : appointments.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: colors.textSecondary }}>Nenhum atendimento hoje.</Text>
        </View>
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.time, { color: colors.primary }]}>{item.startTime}</Text>
                <Text style={[styles.status, { color: colors.textMuted }]}>{statusLabel(item.status)}</Text>
              </View>
              <Text style={[styles.client, { color: colors.text }]}>{item.clientName}</Text>
              <Text style={{ color: colors.textSecondary }}>{item.serviceName}</Text>
              <Text style={[styles.price, { color: colors.text }]}>{formatBRL(item.total)}</Text>
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: 8, gap: 16 },
  title: { fontSize: 24, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { gap: 10, paddingBottom: 24 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 4 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between" },
  time: { fontWeight: "700" },
  status: { fontSize: 12 },
  client: { fontSize: 16, fontWeight: "700" },
  price: { fontWeight: "600", marginTop: 4 },
});
