import { Redirect } from "expo-router";

import { useSession } from "@/lib/session-context";

/**
 * Root redirect gate. Mirrors targetPortal from GET /api/auth/session (the same
 * value the web app's login response uses to route staff/customers to the right
 * area) — see src/shared/types.ts `SessionInfo.targetPortal` in the root project.
 */
export default function Index() {
  const { session } = useSession();

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
      // superadmin: the mobile app doesn't implement the platform ops console —
      // it's desktop-only tooling (see Section 0 exception for the Page Builder;
      // same reasoning applies here). Fall back to the customer view rather than
      // a dead end.
      return <Redirect href="/(customer)" />;
  }
}
