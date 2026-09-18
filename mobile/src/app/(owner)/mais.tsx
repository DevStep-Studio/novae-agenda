import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { useTheme } from "@/hooks/use-theme";
import { useSession } from "@/lib/session-context";

// Everything below "Início" is not built yet — listed honestly rather than faked.
// See the engagement report for the phased plan (Section 13 of the build prompt).
const PENDING_SECTIONS = [
  "Agenda / calendário",
  "Clientes",
  "Equipe e permissões",
  "Serviços",
  "Financeiro e relatórios",
  "Link de agendamento público",
  "Identidade / branding (somente leitura — o Page Builder visual é exclusivo da web)",
  "Assinatura Reservei (planos e pagamento)",
];

export default function OwnerMoreScreen() {
  const { colors } = useTheme();
  const { session, signOut } = useSession();

  return (
    <Screen style={styles.screen}>
      <View style={styles.profile}>
        <Text style={[styles.name, { color: colors.text }]}>{session?.name}</Text>
        <Text style={[styles.email, { color: colors.textSecondary }]}>{session?.email}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Em construção</Text>
        {PENDING_SECTIONS.map((section) => (
          <View key={section} style={[styles.row, { borderColor: colors.border }]}>
            <Text style={{ color: colors.textSecondary }}>{section}</Text>
          </View>
        ))}
      </ScrollView>

      <Button
        label="Sair"
        variant="ghost"
        onPress={async () => {
          await signOut();
          router.replace("/(auth)/login");
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: 8, gap: 20 },
  profile: { gap: 2 },
  name: { fontSize: 20, fontWeight: "700" },
  email: { fontSize: 13 },
  sectionTitle: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", marginBottom: 8 },
  list: { gap: 10, paddingBottom: 12 },
  row: { borderWidth: 1, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14 },
});
