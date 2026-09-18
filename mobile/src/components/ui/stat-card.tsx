import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/hooks/use-theme";

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
      {hint ? <Text style={[styles.hint, { color: colors.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    flexBasis: "47%",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  label: { fontSize: 12, fontWeight: "600" },
  value: { fontSize: 22, fontWeight: "700" },
  hint: { fontSize: 11 },
});
