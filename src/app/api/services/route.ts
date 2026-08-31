import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { serviceCategories, services } from "@/db/schema";
import { requireAuth, unauthorized } from "@/lib/auth";
import { centsToNumber } from "@/lib/domain";
import type { ServiceDTO } from "@/shared/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const rows = await db
    .select({
      id: services.id,
      name: services.name,
      categoryId: services.categoryId,
      categoryName: serviceCategories.name,
      description: services.description,
      price: services.price,
      durationMinutes: services.durationMinutes,
      color: services.color,
      active: services.active,
    })
    .from(services)
    .leftJoin(serviceCategories, eq(services.categoryId, serviceCategories.id))
    .where(eq(services.companyId, auth.user.companyId))
    .orderBy(asc(services.name));

  const dto: ServiceDTO[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    description: row.description,
    price: centsToNumber(row.price),
    durationMinutes: row.durationMinutes,
    color: row.color,
    active: row.active,
  }));

  return Response.json({ data: dto });
}

const createSchema = z.object({
  name: z.string().min(2, "Informe o nome do serviço.").max(120),
  categoryId: z.string().optional().nullable(),
  description: z.string().max(1000).optional(),
  price: z.number().min(0, "O valor não pode ser negativo.").max(1000000),
  durationMinutes: z.number().min(5, "A duração mínima é de 5 minutos.").max(1440),
  color: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const { name, categoryId, description, price, durationMinutes, color } = parsed.data;

  let validCategoryId: string | null = null;
  if (categoryId) {
    const [category] = await db
      .select({ id: serviceCategories.id })
      .from(serviceCategories)
      .where(eq(serviceCategories.id, categoryId))
      .limit(1);
    if (category) validCategoryId = category.id;
  }

  const [created] = await db
    .insert(services)
    .values({
      companyId: auth.user.companyId,
      name: name.trim(),
      categoryId: validCategoryId,
      description: description?.trim() || null,
      price: price.toFixed(2),
      durationMinutes,
      color: color || null,
      active: true,
    })
    .returning();

  const dto: ServiceDTO = {
    id: created.id,
    name: created.name,
    categoryId: created.categoryId,
    categoryName: null,
    description: created.description,
    price: centsToNumber(created.price),
    durationMinutes: created.durationMinutes,
    color: created.color,
    active: created.active,
  };

  return Response.json({ data: dto }, { status: 201 });
}
