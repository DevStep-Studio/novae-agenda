import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireAuth, unauthorized } from "@/lib/auth";
import { isUuid } from "@/lib/domain";

export const dynamic = "force-dynamic";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Notificação não encontrada." }, { status: 404 });

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.companyId, auth.user.companyId)));

  return Response.json({ data: { ok: true } });
}
