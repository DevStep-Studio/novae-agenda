import { CalendarDays, CircleDollarSign, Home, Users } from "lucide-react-native";
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { BottomTabBar } from "@/components/ui/bottom-tab-bar";
import { colors } from "@/constants/design-tokens";
import { useSession } from "@/lib/session-context";
import { useTheme } from "@/hooks/use-theme";

export default function OwnerLayout() {
  const { session, loading } = useSession();
  const { primaryColor } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={primaryColor} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <BottomTabBar {...props} />}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: "Agenda",
          tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="clientes"
        options={{
          title: "Clientes",
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="financeiro"
        options={{
          title: "Financeiro",
          tabBarIcon: ({ color, size }) => <CircleDollarSign color={color} size={size} />,
        }}
      />
      <Tabs.Screen name="mais" options={{ href: null }} />
      <Tabs.Screen name="ajuda" options={{ href: null }} />
      <Tabs.Screen name="assinatura" options={{ href: null }} />
      <Tabs.Screen name="avaliacoes" options={{ href: null }} />
      <Tabs.Screen name="clubes" options={{ href: null }} />
      <Tabs.Screen name="configuracoes" options={{ href: null }} />
      <Tabs.Screen name="equipe" options={{ href: null }} />
      <Tabs.Screen name="lista-espera" options={{ href: null }} />
      <Tabs.Screen name="link-agendamento" options={{ href: null }} />
      <Tabs.Screen name="notificacoes" options={{ href: null }} />
      <Tabs.Screen name="perfil" options={{ href: null }} />
      <Tabs.Screen name="relatorios" options={{ href: null }} />
      <Tabs.Screen name="servicos" options={{ href: null }} />
    </Tabs>
  );
}
