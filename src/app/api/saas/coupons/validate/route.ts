import { requireRole } from "@/lib/auth";
import { SaasCouponService } from "@/lib/saas/coupon-service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const validateCouponSchema = z.object({
  couponCode: z.string().min(1, "Informe o código do cupom."),
  planSlug: z.string().min(1, "Selecione um plano válido."),
  billingInterval: z.enum(["monthly", "yearly"]).default("monthly"),
});

export async function POST(request: Request) {
  const gate = await requireRole("owner");
  if (gate.response) return gate.response;
  const { auth } = gate;

  const body = await request.json().catch(() => null);
  const parsed = validateCouponSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  try {
    const result = await SaasCouponService.validateCoupon({
      code: parsed.data.couponCode,
      planSlug: parsed.data.planSlug,
      billingInterval: parsed.data.billingInterval,
      companyId: auth.user.companyId,
    });

    return Response.json({
      data: {
        valid: true,
        coupon: result.coupon,
        originalPrice: result.originalPrice,
        discountAmount: result.discountAmount,
        finalPrice: result.finalPrice,
        isZeroTotal: result.isZeroTotal,
      },
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 422;
    return Response.json(
      {
        valid: false,
        error: error.message || "Cupom inválido ou expirado.",
      },
      { status: statusCode }
    );
  }
}
