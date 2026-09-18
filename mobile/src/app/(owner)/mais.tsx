import { ChevronRight } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { colors } from "@/constants/design-tokens";
import { useSession } from "@/lib/session-context";

// Real screens are surfaced here rather than in the bottom tab bar, matching
// the web: `.mobile-bottom-nav` only ever has Início/Agenda/[+Novo]/
// Clientes/Menu (globals.css:8589-8704) — every other section (Equipe,
// Serviços, ...) lives in the sidebar and is reached through the mobile
// "Menu" button, which this tab stands in for.
const BUILT_SECTIONS: Array<{ label: string; href: "/(owner)/equipe" | "/(owner)/servicos" | "/(owner)/financeiro" }> = [
  { label: "Equipe e permissões", href: "/(owner)/equipe" },
  { label: "Serviços", href: "/(owner)/servicos" },
  { label: "Financeiro", href: "/(owner)/financeiro" },
];

// Everything below is not built yet — listed honestly rather than faked.
// See the engagement report for the phased plan (Section 13 of the build prompt).
// "Relatórios" is a distinct nav item from "Financeiro" on web (separate
// icon/route in app-shell.tsx's navItems) — kept as its own pending entry
// rather than folded into the Financeiro row above, since that screen only
// covers the KPIs + team ranking, not a reports section.
const PENDING_SECTIONS = [
  "Relatórios",
  "Link de agendamento público",
  "Identidade / branding (somente leitura — o Page Builder visual é exclusivo da web)",
  "Assinatura Reservei (planos e pagamento)",
];

export default function OwnerMoreScreen() {
  const { session, signOut } = useSession();

  return (
    <Screen style={{ paddingTop: 8, gap: 20 }}>
      <View className="gap-0.5">
        <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "700" }}>{session?.name}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{session?.email}</Text>
      </View>

      <ScrollView contentContainerClassName="gap-2.5 pb-3">
        {BUILT_SECTIONS.map((section) => (
          <Pressable
            key={section.label}
            className="h-12 flex-row items-center justify-between rounded-md border px-3.5"
            style={{ borderColor: colors.border }}
            onPress={() => router.push(section.href)}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "500" }}>{section.label}</Text>
            <ChevronRight size={18} color={colors.textMuted} />
          </Pressable>
        ))}

        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", marginTop: 8, marginBottom: 2 }}>
          Em construção
        </Text>
        {PENDING_SECTIONS.map((section) => (
          <View key={section} className="rounded-md border px-3.5 py-3" style={{ borderColor: colors.border }}>
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
