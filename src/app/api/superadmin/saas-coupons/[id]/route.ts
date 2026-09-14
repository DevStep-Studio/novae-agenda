import { db } from "@/db";
import { saasCoupons } from "@/db/schema";
import { requireSuperadmin } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateCouponSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  maxRedemptions: z.number().int().positive().optional().nullable(),
  maxRedemptionsPerBusiness: z.number().int().positive().optional(),
  expiresAt: z.string().optional().nullable(),
});

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  const { id } = await props.params;

  const body = await request.json().catch(() => null);
  const parsed = updateCouponSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  try {
    const [coupon] = await db
      .select()
      .from(saasCoupons)
      .where(eq(saasCoupons.id, id))
      .limit(1);

    if (!coupon) {
      return Response.json({ error: "Cupom não encontrado." }, { status: 404 });
    }

    const updates: any = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;
    if (parsed.data.maxRedemptions !== undefined) updates.maxRedemptions = parsed.data.maxRedemptions;
    if (parsed.data.maxRedemptionsPerBusiness !== undefined) updates.maxRedemptionsPerBusiness = parsed.data.maxRedemptionsPerBusiness;
    if (parsed.data.expiresAt !== undefined) updates.expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;

    await db.update(saasCoupons).set(updates).where(eq(saasCoupons.id, id));

    return Response.json({
      data: {
        success: true,
        message: "Cupom atualizado com sucesso.",
      },
    });
  } catch (error: any) {
    console.error("[Superadmin Coupon Patch API] Error:", error);
    return Response.json({ error: error.message || "Erro ao atualizar cupom." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  const { id } = await props.params;

  try {
    // Soft deactivate
    await db
      .update(saasCoupons)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(saasCoupons.id, id));

    return Response.json({
      data: {
        success: true,
        message: "Cupom desativado com sucesso.",
      },
    });
  } catch (error: any) {
    console.error("[Superadmin Coupon Delete API] Error:", error);
    return Response.json({ error: "Erro ao desativar cupom." }, { status: 500 });
  }
}
