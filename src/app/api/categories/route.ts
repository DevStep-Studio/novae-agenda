import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { serviceCategories, services } from "@/db/schema";
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

  return Response.json({ data: { id: categoryId, name: trimmedName, count: 0 } }, { status: 201 });
}
