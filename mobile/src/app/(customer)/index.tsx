import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/ui/screen";
import { useTheme } from "@/hooks/use-theme";
import { ApiError } from "@/lib/api-client";
import { getMyBookings, type MyBooking } from "@/lib/my-bookings";

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmado",
  scheduled: "Agendado",
  completed: "Finalizado",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

export default function MyBookingsScreen() {
  const { colors } = useTheme();
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setBookings(await getMyBookings());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar suas reservas.");
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
      <Text style={[styles.title, { color: colors.text }]}>Minhas reservas</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: colors.textSecondary, textAlign: "center" }}>{error}</Text>
        </View>
      ) : bookings.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: colors.textSecondary }}>Você ainda não tem reservas.</Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => {
            const first = item.items[0];
            return (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.company, { color: colors.text }]}>{item.company.name}</Text>
                  <Text style={[styles.status, { color: colors.primary }]}>
                    {STATUS_LABELS[item.status] ?? item.status}
                  </Text>
                </View>
                {first ? (
                  <Text style={{ color: colors.textSecondary }}>
                    {first.name} · {first.date} às {first.startTime}
                  </Text>
                ) : null}
                <Text style={{ color: colors.textSecondary }}>
                  {new Date(item.startsAt).toLocaleString("pt-BR")}
                </Text>
              </View>
            );
          }}
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
  company: { fontSize: 16, fontWeight: "700" },
  status: { fontSize: 12, fontWeight: "700" },
});
