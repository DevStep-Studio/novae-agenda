import {
  Bell,
  Calendar,
  ChevronRight,
  HelpCircle,
  KeyRound,
  Lock,
  LogOut,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { colors, fontFamily, radius, typography } from "@/constants/design-tokens";
import { useResponsive } from "@/hooks/use-responsive";
import { scaleFont } from "@/lib/responsive";
import { useSession } from "@/lib/session-context";

export default function CustomerMoreScreen() {
  const { session, signOut } = useSession();
  const { isTablet, isCompact } = useResponsive();

  return (
    <Screen header={<TopBar title="Menu" showBack={false} />} style={{ paddingTop: 16, gap: 16 }}>
      <PageHeader
        eyebrow="CONTA DO CLIENTE"
        title="Menu do Cliente"
        subtitle="Gerencie seus dados, preferências e segurança do PIN."
      />

      {/* Header do Cliente */}
      <View
        className="flex-row items-center gap-3.5 rounded-xl border p-4"
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
      >
        <Avatar name={session?.name || "Cliente"} size="lg" />
        <View className="gap-0.5 flex-1">
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 17,
              fontFamily: fontFamily.display,
            }}
          >
            {session?.name || "Cliente Reservei"}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            {session?.email || session?.phone || "Acesso via PIN rápido"}
          </Text>
          <View className="flex-row items-center gap-1.5 mt-0.5">
            <View
              style={{
                backgroundColor: colors.primarySoft,
                paddingHorizontal: 7,
                paddingVertical: 2,
                borderRadius: radius.pill,
              }}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 10,
                  fontWeight: "700",
                  textTransform: "uppercase",
                }}
              >
                Conta de Cliente
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 24 }}>
        {/* Notificações */}
        <Pressable
          onPress={() => router.push("/(customer)/notificacoes" as any)}
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radius.md,
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View className="flex-row items-center gap-3">
            <Bell size={18} color={colors.primary} />
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 15,
                fontWeight: "600",
              }}
            >
              Notificações e Avisos
            </Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </Pressable>

        {/* Segurança do PIN */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radius.md,
            padding: 16,
            gap: 10,
          }}
        >
          <View className="flex-row items-center gap-2">
            <ShieldCheck size={18} color={colors.primary} />
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 15,
                fontWeight: "600",
              }}
            >
              Segurança e Acesso Rápido
            </Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
            Você pode acessar todos os seus agendamentos rapidamente através do seu número de telefone e PIN de 6 dígitos.
          </Text>
        </View>

        {/* Botão Sair */}
        <View style={{ marginTop: 12 }}>
          <Button
            label="Sair da Conta"
            variant="ghost"
            onPress={async () => {
              await signOut();
              router.replace("/(auth)/login");
            }}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
