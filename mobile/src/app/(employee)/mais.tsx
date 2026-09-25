import {
  Bell,
  Briefcase,
  ChevronRight,
  CircleDollarSign,
  HelpCircle,
  LogOut,
  Scissors,
  Shield,
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

export default function EmployeeMoreScreen() {
  const { session, signOut } = useSession();
  const { isTablet, isCompact } = useResponsive();

  return (
    <Screen header={<TopBar title="Menu" showBack={false} />} style={{ paddingTop: 16, gap: 16 }}>
      <PageHeader
        eyebrow="PAINEL DO PROFISSIONAL"
        title="Mais Opções"
        subtitle="Acesse configurações, notificações e sua conta profissional."
      />

      {/* Header do Profissional */}
      <View
        className="flex-row items-center gap-3.5 rounded-xl border p-4"
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
      >
        <Avatar name={session?.name || "Profissional"} size="lg" />
        <View className="gap-0.5 flex-1">
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 17,
              fontFamily: fontFamily.display,
            }}
          >
            {session?.name}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            {session?.email}
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
                Membro da Equipe
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 24 }}>
        <Pressable
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radius.md,
            padding: 16,
            gap: 8,
          }}
          onPress={() => router.push("/(employee)/notificacoes" as any)}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2.5">
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: radius.sm,
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Bell size={18} color={colors.primary} />
              </View>
              <View>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: 15,
                    fontWeight: "600",
                  }}
                >
                  Notificações
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  Avisos de novos atendimentos e alterações
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </View>
        </Pressable>

        <Pressable
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radius.md,
            padding: 16,
            gap: 8,
          }}
          onPress={() => router.push("/(employee)/clientes")}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2.5">
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: radius.sm,
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <User size={18} color={colors.primary} />
              </View>
              <View>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: 15,
                    fontWeight: "600",
                  }}
                >
                  Base de Clientes
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  Consulte a lista de clientes, contatos e histórico
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </View>
        </Pressable>

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
            <Briefcase size={18} color={colors.primary} />
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 15,
                fontWeight: "600",
              }}
            >
              Painel do Profissional
            </Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
            Acompanhe sua agenda em tempo real, visualize os clientes agendados para o dia e os serviços vinculados.
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
