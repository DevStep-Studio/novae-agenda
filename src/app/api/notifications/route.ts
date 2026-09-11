import { requireAuth, unauthorized } from "@/lib/auth";
import { NotificationService, type NotificationCategory } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const { searchParams } = new URL(request.url);
  const category = (searchParams.get("category") as NotificationCategory) || "all";
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

  const result = await NotificationService.getNotifications(auth.user.companyId, {
    userId: auth.user.userId,
    role: auth.user.role,
    isSuperadmin: auth.user.isSuperadmin,
    category,
    limit,
    offset,
  });

  return Response.json({
    data: {
      notifications: result.notifications,
      total: result.total,
      unreadCount: result.unreadCount,
    },
  });
}

export async function POST() {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  await NotificationService.markAllAsRead(auth.user.companyId, auth.user.userId);

  return Response.json({ data: { ok: true } });
}
