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
import { Screen } from "@/components/ui/screen";
import { colors, fontFamily, radius, typography } from "@/constants/design-tokens";
import { useSession } from "@/lib/session-context";

export default function EmployeeMoreScreen() {
  const { session, signOut } = useSession();

  return (
    <Screen style={{ paddingTop: 12, gap: 16 }}>
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
