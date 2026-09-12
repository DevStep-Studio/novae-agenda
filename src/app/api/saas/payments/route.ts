import { db } from "@/db";
import { subscriptionInvoices } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireRole("owner");
  if (gate.response) return gate.response;
  const { auth } = gate;

  try {
    const payments = await db
      .select()
      .from(subscriptionInvoices)
      .where(eq(subscriptionInvoices.companyId, auth.user.companyId))
      .orderBy(desc(subscriptionInvoices.createdAt))
      .limit(50);

    const data = payments.map((p) => ({
      id: p.id,
      paymentId: p.mercadoPagoPaymentId,
      subscriptionId: p.subscriptionId,
      planSlug: p.planSlug,
      billingInterval: p.billingInterval,
      amount: Number(p.amount),
      subtotal: p.subtotal ? Number(p.subtotal) : Number(p.amount),
      discount: Number(p.discount ?? 0),
      paymentMethod: p.paymentMethod,
      status: p.status,
      paidAt: p.paidAt?.toISOString() ?? null,
      failedAt: p.failedAt?.toISOString() ?? null,
      gatewayStatus: p.gatewayStatus,
      gatewayStatusDetail: p.gatewayStatusDetail,
      createdAt: p.createdAt.toISOString(),
    }));

    return Response.json({ data });
  } catch (error) {
    console.error("[SaaS Payments API] Error fetching payments:", error);
    return Response.json({ error: "Erro ao buscar histórico de pagamentos." }, { status: 500 });
  }
}
