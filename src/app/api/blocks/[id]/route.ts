import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { scheduleBlocks } from "@/db/schema";
import { requireAuth, unauthorized } from "@/lib/auth";
import { isUuid } from "@/lib/domain";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Bloqueio não encontrado." }, { status: 404 });

  const [deleted] = await db
    .delete(scheduleBlocks)
    .where(and(eq(scheduleBlocks.id, id), eq(scheduleBlocks.companyId, auth.user.companyId)))
    .returning({ id: scheduleBlocks.id });

  if (!deleted) return Response.json({ error: "Bloqueio não encontrado." }, { status: 404 });

  return Response.json({ data: { id: deleted.id } });
}
