import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { locations } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { isUuid } from "@/lib/domain";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  address: z.string().max(255).optional(),
  phone: z.string().max(20).optional(),
  openTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireRole("admin");
  if (gate.response) return gate.response;
  const { auth } = gate;
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Unidade não encontrada." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name.trim();
  if (parsed.data.address !== undefined) patch.address = parsed.data.address.trim() || null;
  if (parsed.data.phone !== undefined) patch.phone = parsed.data.phone.trim() || null;
  if (parsed.data.openTime !== undefined) patch.openTime = `${parsed.data.openTime}:00`;
  if (parsed.data.closeTime !== undefined) patch.closeTime = `${parsed.data.closeTime}:00`;
  if (parsed.data.active !== undefined) patch.active = parsed.data.active;

  const [existing] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.id, id), eq(locations.companyId, auth.user.companyId)));

  if (!existing) return Response.json({ error: "Unidade não encontrada." }, { status: 404 });

  await db
    .update(locations)
    .set(patch)
    .where(and(eq(locations.id, id), eq(locations.companyId, auth.user.companyId)));

  await recordAudit({
    companyId: auth.user.companyId,
    userId: auth.user.userId,
    action: "location.updated",
    entity: "location",
    entityId: id,
    metadata: patch,
  });

  return Response.json({ data: { id } });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireRole("admin");
  if (gate.response) return gate.response;
  const { auth } = gate;
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Unidade não encontrada." }, { status: 404 });

  const [existing] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.id, id), eq(locations.companyId, auth.user.companyId)));

  if (!existing) return Response.json({ error: "Unidade não encontrada." }, { status: 404 });

  await db
    .update(locations)
    .set({ active: false })
    .where(and(eq(locations.id, id), eq(locations.companyId, auth.user.companyId)));

  await recordAudit({
    companyId: auth.user.companyId,
    userId: auth.user.userId,
    action: "location.deactivated",
    entity: "location",
    entityId: id,
  });

  return Response.json({ data: { id } });
}
