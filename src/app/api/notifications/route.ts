import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireAuth, unauthorized } from "@/lib/auth";
import type { NotificationDTO } from "@/shared/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.companyId, auth.user.companyId))
    .orderBy(desc(notifications.createdAt))
    .limit(40);

  const dtos: NotificationDTO[] = rows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    entityType: n.entityType,
    entityId: n.entityId,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  }));

  const unreadCount = dtos.filter((n) => !n.readAt).length;

  return Response.json({ data: { notifications: dtos, unreadCount } });
}

export async function POST() {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  // Mark all unread notifications as read
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.companyId, auth.user.companyId), isNull(notifications.readAt)));

  return Response.json({ data: { ok: true } });
}
