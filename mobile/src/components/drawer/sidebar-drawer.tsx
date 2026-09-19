import {
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  Globe,
  Home,
  LogOut,
  Plus,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Tag,
  User,
  UserRound,
  Users,
  WalletCards,
  X,
} from "lucide-react-native";
import { Image } from "expo-image";
import { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius } from "@/constants/design-tokens";
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

  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);
  const [activeLocationId, setActiveLocationId] = useState<string | null>(
    session?.locations?.[0]?.id || null
  );
  const [logoLoadError, setLogoLoadError] = useState(false);
  const [avatarLoadError, setAvatarLoadError] = useState(false);

  const companyName = session?.company?.name || "Moa Tattoo";
  const initials = companyName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  const rawLogoUrl = session?.company?.logoUrl || session?.avatarUrl;
  const logoUrl = resolveImageUrl(rawLogoUrl);
  const publicSlug = session?.company?.publicSlug || session?.company?.slug;

  const locations = session?.locations || [
    { id: "main", name: "Unidade Principal", address: null, phone: null, openTime: "08:00", closeTime: "19:00", active: true },
  ];

  const activeLoc =
    locations.find((l) => l.id === activeLocationId) || locations[0];

  const navigateTo = (path: string) => {
    onClose();
    router.push(path as any);
  };

  const handleShareLink = async () => {
    onClose();
    const slug = publicSlug || "moatattoo";
    const url = `https://usereservei.com.br/${slug}`;
    try {
      await Share.share({
        message: `Agende seu horário no ${companyName}: ${url}`,
        url,
      });
    } catch {
      router.push("/(owner)/perfil" as any);
    }
  };

  const handleLogout = () => {
    Alert.alert("Sair da conta", "Tem certeza que deseja encerrar sua sessão?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          onClose();
          await signOut();
          router.replace("/(auth)/login");
        },
      },
    ]);
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
      icon: SlidersHorizontal,
      path: "/(owner)/configuracoes",
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
      <View
        className="flex-1 flex-row"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.7)" }}
      >
        {/* Drawer Container */}
        <View
          className="h-full border-r justify-between"
          style={{
            width: "80%",
            maxWidth: 310,
            backgroundColor: "#0d0e11",
            borderRightColor: "rgba(255, 255, 255, 0.08)",
            paddingTop: Math.max(insets.top, 14),
            paddingBottom: Math.max(insets.bottom, 14),
          }}
        >
          {/* Top Brand Logo & Close Button (Exact Screenshot) */}
          <View
            className="px-4 pb-3.5 flex-row items-center justify-between"
            style={{ borderBottomWidth: 1, borderBottomColor: "rgba(255, 255, 255, 0.06)" }}
          >
            {/* Logo: reservei✦ */}
            <View className="flex-row items-center gap-0.5">
              <Text
                style={{
                  color: "#ffffff",
                  fontSize: 20,
                  fontWeight: "800",
                  letterSpacing: -0.6,
                }}
              >
                reservei
              </Text>
              <Text
                style={{
                  color: "#ccff00",
                  fontSize: 16,
                  fontWeight: "900",
                  marginLeft: 1,
                }}
              >
                ✦
              </Text>
            </View>

            {/* Close Button: X */}
            <Pressable
              onPress={onClose}
              hitSlop={10}
              className="items-center justify-center rounded-xl border"
              style={{
                width: 36,
                height: 36,
                backgroundColor: "#18191e",
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <X size={17} color="#ffffff" strokeWidth={2.2} />
            </Pressable>
          </View>

          {/* Workspace / Tenant Switcher Card (Exact Screenshot) */}
          <View className="px-3 pt-3 pb-1">
            <Pressable
              onPress={() => setWorkspaceDropdownOpen((prev) => !prev)}
              className="flex-row items-center justify-between p-2.5 rounded-xl border"
              style={{
                backgroundColor: "#16171b",
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <View className="flex-row items-center gap-2.5 flex-1 min-w-0 pr-2">
                {/* Logo Box / Initials MT */}
                <View
                  className="items-center justify-center rounded-lg border overflow-hidden"
                  style={{
                    width: 34,
                    height: 34,
                    backgroundColor: "#222328",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                  }}
                >
                  <Text
                    style={{
                      color: "#ffffff",
                      fontSize: 12.5,
                      fontWeight: "800",
                      letterSpacing: 0.5,
                    }}
                  >
                    {initials}
                  </Text>
                </View>

                {/* Info Text */}
                <View className="flex-1 min-w-0">
                  <Text
                    style={{
                      color: "#ffffff",
                      fontSize: 13.5,
                      fontWeight: "700",
                      letterSpacing: -0.2,
                    }}
                    numberOfLines={1}
                  >
                    {companyName}
                  </Text>
                  <Text
                    style={{
                      color: "#9ca3af",
                      fontSize: 11,
                      marginTop: 1,
                    }}
                    numberOfLines={1}
                  >
                    {activeLoc?.name || "Unidade Principal"}
                  </Text>
                </View>
              </View>

              <ChevronDown
                size={15}
                color="#9ca3af"
                style={{
                  transform: [{ rotate: workspaceDropdownOpen ? "180deg" : "0deg" }],
                }}
              />
            </Pressable>

            {/* Dropdown Options for Locations */}
            {workspaceDropdownOpen && (
              <View
                className="mt-1.5 p-1.5 rounded-xl border gap-1"
                style={{
                  backgroundColor: "#16171b",
                  borderColor: "rgba(255, 255, 255, 0.1)",
                }}
              >
                <Text
                  style={{
                    color: "#6b7280",
                    fontSize: 10,
                    fontWeight: "700",
                    textTransform: "uppercase",
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                  }}
                >
                  Suas unidades
                </Text>

                {locations.map((loc) => {
                  const isSelected = (activeLoc?.id || "main") === loc.id;
                  return (
                    <Pressable
                      key={loc.id}
                      onPress={() => {
                        setActiveLocationId(loc.id);
                        setWorkspaceDropdownOpen(false);
                      }}
                      className="flex-row items-center justify-between p-2 rounded-lg"
                      style={{
                        backgroundColor: isSelected
                          ? "rgba(255, 255, 255, 0.08)"
                          : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          color: isSelected ? "#ffffff" : "#9ca3af",
                          fontSize: 12.5,
                          fontWeight: isSelected ? "700" : "500",
                        }}
                      >
                        {loc.name}
                      </Text>
                      {isSelected ? <Check size={14} color="#ccff00" /> : null}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* Navigation Links List (Exact Screenshot) */}
          <ScrollView
            className="flex-1 px-3 py-2"
            contentContainerStyle={{ gap: 3 }}
            showsVerticalScrollIndicator={false}
          >
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.path &&
                (pathname === item.path ||
                  (item.path === "/(owner)" &&
                    (pathname === "/(owner)" || pathname === "/")));

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
                      color={isActive ? "#ffffff" : "#9ca3af"}
                      strokeWidth={isActive ? 2.2 : 1.8}
                    />
                    <Text
                      style={{
                        color: isActive ? "#ffffff" : "#9ca3af",
                        fontSize: 14,
                        fontWeight: isActive ? "700" : "500",
                      }}
                    >
                      {item.label}
                    </Text>
                  </View>

                  {item.badge !== null && item.badge !== undefined ? (
                    <View
                      className="items-center justify-center px-2 py-0.5 rounded-md"
                      style={{
                        backgroundColor: isActive
                          ? "rgba(255, 255, 255, 0.12)"
                          : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          color: "#9ca3af",
                          fontSize: 12,
                          fontWeight: "600",
                        }}
                      >
                        {item.badge}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* User Profile Card & Logout (Exact Screenshot) */}
          <View
            className="px-3 pt-2"
            style={{ borderTopWidth: 1, borderTopColor: "rgba(255, 255, 255, 0.06)" }}
          >
            <View
              className="flex-row items-center justify-between p-2.5 rounded-xl border"
              style={{
                backgroundColor: "#16171b",
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              {/* Profile Link Clickable area */}
              <Pressable
                onPress={() => navigateTo("/(owner)/perfil")}
                className="flex-row items-center gap-2.5 flex-1 min-w-0 pr-2"
              >
                {/* Avatar with Logo */}
                <View
                  className="items-center justify-center rounded-full overflow-hidden border"
                  style={{
                    width: 36,
                    height: 36,
                    backgroundColor: "#222328",
                    borderColor: "rgba(255, 255, 255, 0.12)",
                  }}
                >
                  {logoUrl && !avatarLoadError ? (
                    <Image
                      source={{ uri: logoUrl }}
                      style={{ width: 36, height: 36 }}
                      contentFit="cover"
                      onError={() => setAvatarLoadError(true)}
                    />
                  ) : (
                    <Text
                      style={{
                        color: "#ffffff",
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      {initials}
                    </Text>
                  )}
                </View>

                {/* Name & Role */}
                <View className="flex-1 min-w-0">
                  <Text
                    style={{
                      color: "#ffffff",
                      fontSize: 13.5,
                      fontWeight: "700",
                    }}
                    numberOfLines={1}
                  >
                    {companyName}
                  </Text>
                  <Text
                    style={{
                      color: "#9ca3af",
                      fontSize: 11,
                      marginTop: 1,
                    }}
                    numberOfLines={1}
                  >
                    Proprietário
                  </Text>
                </View>
              </Pressable>

              {/* Logout Button */}
              <Pressable
                onPress={handleLogout}
                hitSlop={10}
                className="p-2 rounded-lg"
              >
                <LogOut size={18} color="#9ca3af" />
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
