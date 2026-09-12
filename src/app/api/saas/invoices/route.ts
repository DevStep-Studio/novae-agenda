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
    const invoices = await db
      .select()
      .from(subscriptionInvoices)
      .where(eq(subscriptionInvoices.companyId, auth.user.companyId))
      .orderBy(desc(subscriptionInvoices.createdAt))
      .limit(50);

    const data = invoices.map((inv) => ({
      id: inv.id,
      number: inv.number,
      planSlug: inv.planSlug,
      billingInterval: inv.billingInterval,
      subtotal: inv.subtotal ? Number(inv.subtotal) : Number(inv.amount),
      discount: Number(inv.discount ?? 0),
      total: inv.total ? Number(inv.total) : Number(inv.amount),
      amount: Number(inv.amount),
      currency: inv.currency,
      paymentMethod: inv.paymentMethod,
      status: inv.status,
      dueAt: inv.dueAt?.toISOString() ?? null,
      paidAt: inv.paidAt?.toISOString() ?? null,
      pixQrCode: inv.pixQrCode,
      pixCopiaECola: inv.pixCopiaECola,
      pixExpiresAt: inv.pixExpiresAt?.toISOString() ?? null,
      gatewayPaymentId: inv.mercadoPagoPaymentId,
      gatewayStatus: inv.gatewayStatus,
      invoiceUrl: inv.invoiceUrl,
      createdAt: inv.createdAt.toISOString(),
    }));

    return Response.json({ data });
  } catch (error) {
    console.error("[SaaS Invoices API] Error fetching invoices:", error);
    return Response.json({ error: "Erro ao buscar faturas." }, { status: 500 });
  }
}
