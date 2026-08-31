import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { services } from "@/db/schema";
import { requireAuth, unauthorized } from "@/lib/auth";
import { centsToNumber, isUuid } from "@/lib/domain";
import type { ServiceDTO } from "@/shared/types";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  categoryId: z.string().nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  price: z.number().min(0).max(1000000).optional(),
  durationMinutes: z.number().min(5).max(1440).optional(),
  color: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Serviço não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  const data = parsed.data;
  if (data.name !== undefined) patch.name = data.name.trim();
  if (data.description !== undefined) patch.description = data.description?.trim() || null;
  if (data.price !== undefined) patch.price = data.price.toFixed(2);
  if (data.durationMinutes !== undefined) patch.durationMinutes = data.durationMinutes;
  if (data.color !== undefined) patch.color = data.color || null;
  if (data.active !== undefined) patch.active = data.active;
  if (data.categoryId !== undefined) patch.categoryId = data.categoryId;

  const [updated] = await db
    .update(services)
    .set(patch)
    .where(and(eq(services.id, id), eq(services.companyId, auth.user.companyId)))
    .returning();

  if (!updated) return Response.json({ error: "Serviço não encontrado." }, { status: 404 });

  const dto: ServiceDTO = {
    id: updated.id,
    name: updated.name,
    categoryId: updated.categoryId,
    categoryName: null,
    description: updated.description,
    price: centsToNumber(updated.price),
    durationMinutes: updated.durationMinutes,
    color: updated.color,
    active: updated.active,
  };

  return Response.json({ data: dto });
}
