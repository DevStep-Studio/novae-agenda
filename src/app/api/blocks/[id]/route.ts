import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { scheduleBlocks } from "@/db/schema";
import { hasMinRole, requireRole } from "@/lib/auth";
import { isUuid } from "@/lib/domain";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireRole("employee");
  if (gate.response) return gate.response;
  const { auth } = gate;
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Bloqueio não encontrado." }, { status: 404 });

  const [block] = await db
    .select({ id: scheduleBlocks.id, employeeId: scheduleBlocks.employeeId })
    .from(scheduleBlocks)
    .where(and(eq(scheduleBlocks.id, id), eq(scheduleBlocks.companyId, auth.user.companyId)))
    .limit(1);
  if (!block) return Response.json({ error: "Bloqueio não encontrado." }, { status: 404 });

  if (!hasMinRole(auth.user.role, "manager") && block.employeeId !== auth.user.employeeId) {
    return Response.json({ error: "Você só pode remover bloqueios da sua agenda." }, { status: 403 });
  }

  await db.delete(scheduleBlocks).where(eq(scheduleBlocks.id, id));
  return Response.json({ data: { id: block.id } });
}
