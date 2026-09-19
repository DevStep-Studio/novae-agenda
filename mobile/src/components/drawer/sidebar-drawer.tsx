import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronDown,
  Globe,
  HelpCircle,
  Home,
  LogOut,
  Settings2,
  Sparkles,
  Tag,
  User,
  UserRound,
  Users,
  WalletCards,
  X,
} from "lucide-react-native";
import { Image } from "expo-image";
import {
  Modal,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, typography } from "@/constants/design-tokens";
import { resolveImageUrl } from "@/lib/api-client";
import { useSession } from "@/lib/session-context";

interface SidebarDrawerProps {
  visible: boolean;
  onClose: () => void;
  unreadCount?: number;
}

export function SidebarDrawer({ visible, onClose, unreadCount = 0 }: SidebarDrawerProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { session, signOut } = useSession();

  const companyName = session?.company?.name || "Moa Tattoo";
  const initials = companyName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  const rawLogoUrl = session?.company?.logoUrl || session?.avatarUrl;
  const logoUrl = resolveImageUrl(rawLogoUrl);
  const publicSlug = session?.company?.publicSlug;

  const navigateTo = (path: string) => {
    onClose();
    router.push(path as any);
  };

  const handleShareLink = async () => {
    onClose();
    if (publicSlug) {
      const url = `https://usereservei.com.br/${publicSlug}`;
      try {
        await Share.share({
          message: `Agende seu horário no ${companyName}: ${url}`,
          url,
        });
      } catch {
        // ignore
      }
    } else {
      router.push("/(owner)/configuracoes" as any);
    }
  };

  const menuItems = [
    {
      id: "inicio",
      label: "Início",
      icon: Home,
      path: "/(owner)",
      badge: null,
    },
    {
      id: "agenda",
      label: "Agenda",
      icon: CalendarDays,
      path: "/(owner)/agenda",
      badge: "0",
    },
    {
      id: "clientes",
      label: "Clientes",
      icon: Users,
      path: "/(owner)/clientes",
      badge: null,
    },
    {
      id: "servicos",
      label: "Serviços",
      icon: Tag,
      path: "/(owner)/servicos",
      badge: null,
    },
    {
      id: "equipe",
      label: "Equipe",
      icon: UserRound,
      path: "/(owner)/equipe",
      badge: null,
    },
    {
      id: "financeiro",
      label: "Financeiro",
      icon: WalletCards,
      path: "/(owner)/financeiro",
      badge: null,
    },
    {
      id: "relatorios",
      label: "Relatórios",
      icon: BarChart3,
      path: "/(owner)/relatorios",
      badge: null,
    },
    {
      id: "notificacoes",
      label: "Notificações",
      icon: Bell,
      path: "/(owner)/notificacoes",
      badge: unreadCount > 0 ? String(unreadCount) : null,
    },
    {
      id: "perfil",
      label: "Meu Perfil",
      icon: User,
      path: "/(owner)/perfil",
      badge: null,
    },
    {
      id: "link",
      label: "Link de agendamento",
      icon: Globe,
      action: handleShareLink,
      badge: null,
    },
    {
      id: "assinatura",
      label: "Minha assinatura",
      icon: Sparkles,
      path: "/(owner)/assinatura",
      badge: null,
    },
    {
      id: "configuracoes",
      label: "Configurações",
      icon: Settings2,
      path: "/(owner)/configuracoes",
      badge: null,
    },
    {
      id: "ajuda",
      label: "Ajuda & Suporte",
      icon: HelpCircle,
      path: "/(owner)/ajuda",
      badge: null,
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 flex-row" style={{ backgroundColor: "rgba(0, 0, 0, 0.65)" }}>
        {/* Drawer Panel */}
        <View
          className="h-full border-r justify-between"
          style={{
            width: "82%",
            maxWidth: 320,
            backgroundColor: "#0d0e11",
            borderRightColor: "rgba(255, 255, 255, 0.08)",
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: Math.max(insets.bottom, 16),
          }}
        >
          {/* Top Brand & Close Button */}
          <View className="px-4 pb-3 border-b flex-row items-center justify-between" style={{ borderBottomColor: "rgba(255, 255, 255, 0.06)" }}>
            <View className="flex-row items-center gap-1.5">
              <Text style={{ color: "#ffffff", fontSize: 20, fontWeight: "800", letterSpacing: -0.5 }}>
                reservei
              </Text>
              <Text style={{ color: "#ccff00", fontSize: 16, fontWeight: "900" }}>✦</Text>
            </View>

            <Pressable
              onPress={onClose}
              hitSlop={10}
              className="items-center justify-center rounded-lg"
              style={{
                width: 36,
                height: 36,
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <X size={18} color="#ffffff" />
            </Pressable>
          </View>

          {/* Tenant Switcher Card */}
          <View className="px-3 pt-3 pb-1">
            <View
              className="flex-row items-center justify-between p-2.5 rounded-xl border"
              style={{
                backgroundColor: "#16171b",
                borderColor: "rgba(255, 255, 255, 0.09)",
              }}
            >
              <View className="flex-row items-center gap-2.5 flex-1 min-w-0 pr-2">
                <View
                  className="items-center justify-center rounded-lg overflow-hidden"
                  style={{
                    width: 34,
                    height: 34,
                    backgroundColor: "#2a2b30",
                  }}
                >
                  {logoUrl ? (
                    <Image source={{ uri: logoUrl }} style={{ width: 34, height: 34 }} resizeMode="cover" />
                  ) : (
                    <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700" }}>
                      {initials}
                    </Text>
                  )}
                </View>

                <View className="flex-1 min-w-0">
                  <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "700" }} numberOfLines={1}>
                    {companyName}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }} numberOfLines={1}>
                    Unidade Principal
                  </Text>
                </View>
              </View>

              <ChevronDown size={16} color={colors.textMuted} />
            </View>
          </View>

          {/* Navigation Links */}
          <ScrollView
            className="flex-1 px-3 py-2"
            contentContainerStyle={{ gap: 2 }}
            showsVerticalScrollIndicator={false}
          >
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.path &&
                (pathname === item.path ||
                  (item.path === "/(owner)" && (pathname === "/(owner)" || pathname === "/")));

              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    if (item.action) {
                      item.action();
                    } else if (item.path) {
                      navigateTo(item.path);
                    }
                  }}
                  className="flex-row items-center justify-between px-3 py-2.5 rounded-xl"
                  style={{
                    backgroundColor: isActive ? "#222328" : "transparent",
                  }}
                >
                  <View className="flex-row items-center gap-3">
                    <Icon
                      size={18}
                      color={isActive ? "#ffffff" : colors.textSecondary}
                      strokeWidth={isActive ? 2.2 : 1.8}
                    />
                    <Text
                      style={{
                        color: isActive ? "#ffffff" : colors.textSecondary,
                        fontSize: 14,
                        fontWeight: isActive ? "700" : "500",
                      }}
                    >
                      {item.label}
                    </Text>
                  </View>

                  {item.badge ? (
                    <View
                      className="items-center justify-center px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: isActive ? "rgba(255, 255, 255, 0.15)" : "transparent",
                      }}
                    >
                      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600" }}>
                        {item.badge}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* User Profile Card & Logout */}
          <View className="px-3 pt-2 border-t" style={{ borderTopColor: "rgba(255, 255, 255, 0.06)" }}>
            <View
              className="flex-row items-center justify-between p-2.5 rounded-xl border"
              style={{
                backgroundColor: "#16171b",
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <View className="flex-row items-center gap-2.5 flex-1 min-w-0 pr-2">
                <View
                  className="items-center justify-center rounded-full overflow-hidden"
                  style={{
                    width: 32,
                    height: 32,
                    backgroundColor: "#2a2b30",
                  }}
                >
                  {logoUrl ? (
                    <Image source={{ uri: logoUrl }} style={{ width: 32, height: 32 }} resizeMode="cover" />
                  ) : (
                    <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "700" }}>
                      {initials}
                    </Text>
                  )}
                </View>

                <View className="flex-1 min-w-0">
                  <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700" }} numberOfLines={1}>
                    {companyName}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }} numberOfLines={1}>
                    Proprietário
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={async () => {
                  onClose();
                  await signOut();
                  router.replace("/(auth)/login");
                }}
                hitSlop={8}
                className="p-2 rounded-lg"
              >
                <LogOut size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Right Backdrop area to close */}
        <Pressable className="flex-1" onPress={onClose} />
      </View>
    </Modal>
  );
}
