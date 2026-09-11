import { requireAuth, unauthorized } from "@/lib/auth";
import { NotificationService } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const unreadCount = await NotificationService.getUnreadCount(auth.user.companyId, {
    userId: auth.user.userId,
    role: auth.user.role,
    isSuperadmin: auth.user.isSuperadmin,
  });

  return Response.json({ data: { unreadCount } });
}
