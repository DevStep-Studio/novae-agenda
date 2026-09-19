import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";

import { useSession } from "@/lib/session-context";
import { colors } from "@/constants/design-tokens";

/**
 * Root redirect gate. Mirrors targetPortal from GET /api/auth/session (the same
 * value the web app's login response uses to route staff/customers to the right
 * area) — see src/shared/types.ts `SessionInfo.targetPortal` in the root project.
 */
export default function Index() {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;

  switch (session.role) {
    case "owner":
    case "admin":
    case "manager":
      return <Redirect href="/(owner)" />;
    case "employee":
      return <Redirect href="/(employee)" />;
    case "client":
      return <Redirect href="/(customer)" />;
    default:
      // superadmin or fallback
      return <Redirect href="/(customer)" />;
  }
}
