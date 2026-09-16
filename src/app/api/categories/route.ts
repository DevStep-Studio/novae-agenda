import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { serviceCategories, services } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { requireAuth, requireRole, unauthorized } from "@/lib/auth";
import type { ServiceCategoryDTO } from "@/shared/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const categories = await db
    .select()
    .from(serviceCategories)
    .where(eq(serviceCategories.companyId, auth.user.companyId))
    .orderBy(asc(serviceCategories.name));

  const dto: ServiceCategoryDTO[] = await Promise.all(
    categories.map(async (category) => {
      const rows = await db.select({ id: services.id }).from(services).where(eq(services.categoryId, category.id));
      return { id: category.id, name: category.name, count: rows.length };
    }),
  );

  return Response.json({ data: dto });
}

const schema = z.object({ name: z.string().min(2, "Informe o nome da categoria.").max(80) });

export async function POST(request: Request) {
  const gate = await requireRole("employee");
  if (gate.response) return gate.response;
  const { auth } = gate;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const categoryId = crypto.randomUUID();
  const trimmedName = parsed.data.name.trim();
  await db
    .insert(serviceCategories)
    .values({ id: categoryId, companyId: auth.user.companyId, name: trimmedName });

  await recordAudit({
    companyId: auth.user.companyId,
    userId: auth.user.userId,
    action: "category.created",
    entity: "service_category",
    entityId: categoryId,
    metadata: { name: trimmedName },
  });

  return Response.json({ data: { id: categoryId, name: trimmedName, count: 0 } }, { status: 201 });
}

const patchSchema = z.object({
  id: z.string().uuid("Categoria inválida."),
  name: z.string().min(2, "Informe o nome da categoria.").max(80),
});

export async function PATCH(request: Request) {
  const gate = await requireRole("employee");
  if (gate.response) return gate.response;
  const { auth } = gate;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const { id, name } = parsed.data;
  const trimmedName = name.trim();

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

export async function DELETE(request: Request) {
  const gate = await requireRole("employee");
  if (gate.response) return gate.response;
  const { auth } = gate;

  const url = new URL(request.url);
  const idFromQuery = url.searchParams.get("id");
  const body = await request.json().catch(() => null);
  const id = idFromQuery || body?.id;

  if (!id || typeof id !== "string") {
    return Response.json({ error: "ID da categoria obrigatório." }, { status: 400 });
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
