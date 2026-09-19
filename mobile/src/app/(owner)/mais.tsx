import {
  BarChart3,
  Bell,
  ChevronRight,
  CircleDollarSign,
  Clock,
  CreditCard,
  Crown,
  LogOut,
  Scissors,
  Settings,
  Sparkles,
  Star,
  Users,
} from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { colors, fontFamily, radius, typography } from "@/constants/design-tokens";
import { useSession } from "@/lib/session-context";

type SectionItem = {
  label: string;
  subtitle: string;
  icon: any;
  iconColor: string;
  badge?: string;
  badgeColor?: string;
  href:
    | "/(owner)/equipe"
    | "/(owner)/servicos"
    | "/(owner)/financeiro"
    | "/(owner)/relatorios"
    | "/(owner)/avaliacoes"
    | "/(owner)/lista-espera"
    | "/(owner)/clubes"
    | "/(owner)/notificacoes"
    | "/(owner)/configuracoes"
    | "/(owner)/assinatura";
};

const SECTIONS: SectionItem[] = [
  {
    label: "Equipe e Permissões",
    subtitle: "Membros, horários e comissões",
    icon: Users,
    iconColor: colors.primary,
    href: "/(owner)/equipe",
  },
  {
    label: "Catálogo de Serviços",
    subtitle: "Preços, durações e ativação",
    icon: Scissors,
    iconColor: colors.primary,
    href: "/(owner)/servicos",
  },
  {
    label: "Financeiro & Comissões",
    subtitle: "Faturamento, extrato e ranking",
    icon: CircleDollarSign,
    iconColor: colors.primary,
    href: "/(owner)/financeiro",
  },
  {
    label: "Relatórios & Analytics",
    subtitle: "DRE, ticket médio e ocupação",
    icon: BarChart3,
    iconColor: colors.info,
    href: "/(owner)/relatorios",
  },
  {
    label: "Avaliações dos Clientes",
    subtitle: "Feedbacks e notas de 1 a 5 estrelas",
    icon: Star,
    iconColor: "#f59e0b",
    href: "/(owner)/avaliacoes",
  },
  {
    label: "Lista de Espera",
    subtitle: "Clientes aguardando vagas e horários",
    icon: Clock,
    iconColor: colors.warning,
    href: "/(owner)/lista-espera",
  },
  {
    label: "Clubes de Assinatura",
    subtitle: "Mensalistas VIP e planos recorrentes",
    icon: Crown,
    iconColor: colors.primary,
    href: "/(owner)/clubes",
  },
  {
    label: "Central de Notificações",
    subtitle: "Alertas de agendamentos e novidades",
    icon: Bell,
    iconColor: colors.info,
    href: "/(owner)/notificacoes",
  },
  {
    label: "Link Público & Configurações",
    subtitle: "Dados da empresa, WhatsApp e regras",
    icon: Settings,
    iconColor: colors.textSecondary,
    href: "/(owner)/configuracoes",
  },
  {
    label: "Assinatura SaaS Reservei",
    subtitle: "Plano do estabelecimento e faturas",
    icon: Sparkles,
    iconColor: colors.primary,
    badge: "15 DIAS GRÁTIS",
    badgeColor: colors.primary,
    href: "/(owner)/assinatura",
  },
];

export default function OwnerMoreScreen() {
  const { session, signOut } = useSession();

  return (
    <Screen style={{ paddingTop: 12, gap: 16 }}>
      {/* Header do Usuário / Estabelecimento */}
      <View
        className="flex-row items-center gap-3.5 rounded-xl border p-4"
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
      >
        <Avatar name={session?.name || "Gestor"} size="lg" />
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
                {session?.role === "owner" ? "Proprietário / Gestor" : session?.role}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Lista de Seções */}
      <ScrollView
        contentContainerStyle={{ gap: 8, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {SECTIONS.map((section) => {
          const IconComponent = section.icon;

          return (
            <Pressable
              key={section.label}
              className="flex-row items-center justify-between rounded-xl border px-3.5 py-3"
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
              }}
              onPress={() => router.push(section.href)}
            >
              <View className="flex-row items-center gap-3 flex-1 pr-2">
                <View
                  style={{
                    backgroundColor: colors.surfaceSecondary,
                    padding: 8,
                    borderRadius: radius.sm,
                  }}
                >
                  <IconComponent size={20} color={section.iconColor} />
                </View>

                <View className="gap-0.5 flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontSize: 14,
                        fontWeight: "600",
                      }}
                    >
                      {section.label}
                    </Text>

                    {section.badge && (
                      <View
                        style={{
                          backgroundColor: colors.primarySoft,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: radius.pill,
                        }}
                      >
                        <Text
                          style={{
                            color: section.badgeColor || colors.primary,
                            fontSize: 9,
                            fontWeight: "800",
                          }}
                        >
                          {section.badge}
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text
                    style={{
                      color: colors.textMuted,
                      fontSize: 12,
                    }}
                  >
                    {section.subtitle}
                  </Text>
                </View>
              </View>

              <ChevronRight size={18} color={colors.textMuted} />
            </Pressable>
          );
        })}

        {/* Botão Sair */}
        <View style={{ marginTop: 8 }}>
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
