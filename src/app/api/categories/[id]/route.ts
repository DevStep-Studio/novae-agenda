import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { serviceCategories, services } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { isUuid } from "@/lib/domain";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(2, "Informe o nome da categoria.").max(80),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireRole("employee");
  if (gate.response) return gate.response;
  const { auth } = gate;
  const { id } = await params;

  if (!isUuid(id)) {
    return Response.json({ error: "Categoria não encontrada." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const trimmedName = parsed.data.name.trim();

  const [existing] = await db
    .select()
    .from(serviceCategories)
    .where(and(eq(serviceCategories.id, id), eq(serviceCategories.companyId, auth.user.companyId)));

  if (!existing) {
    return Response.json({ error: "Categoria não encontrada." }, { status: 404 });
  }

  await db
    .update(serviceCategories)
    .set({ name: trimmedName })
    .where(and(eq(serviceCategories.id, id), eq(serviceCategories.companyId, auth.user.companyId)));

  await recordAudit({
    companyId: auth.user.companyId,
    userId: auth.user.userId,
    action: "category.updated",
    entity: "service_category",
    entityId: id,
    metadata: { oldName: existing.name, newName: trimmedName },
  });

  return Response.json({ data: { id, name: trimmedName } });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireRole("employee");
  if (gate.response) return gate.response;
  const { auth } = gate;
  const { id } = await params;

  if (!isUuid(id)) {
    return Response.json({ error: "Categoria não encontrada." }, { status: 404 });
  }

  const [existing] = await db
    .select()
    .from(serviceCategories)
    .where(and(eq(serviceCategories.id, id), eq(serviceCategories.companyId, auth.user.companyId)));

  if (!existing) {
    return Response.json({ error: "Categoria não encontrada." }, { status: 404 });
  }

  await db
    .update(services)
    .set({ categoryId: null })
    .where(and(eq(services.categoryId, id), eq(services.companyId, auth.user.companyId)));

  await db
    .delete(serviceCategories)
    .where(and(eq(serviceCategories.id, id), eq(serviceCategories.companyId, auth.user.companyId)));

  await recordAudit({
    companyId: auth.user.companyId,
    userId: auth.user.userId,
    action: "category.deleted",
    entity: "service_category",
    entityId: id,
    metadata: { name: existing.name },
  });

  return Response.json({ success: true });
}
