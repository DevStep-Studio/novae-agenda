import { db } from "@/db";
import { subscriptionInvoices } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireRole("owner");
  if (gate.response) return gate.response;
  const { auth } = gate;

  const { searchParams } = new URL(request.url);
  const invoiceId = searchParams.get("invoiceId");
  const paymentId = searchParams.get("paymentId");

  if (!invoiceId && !paymentId) {
    return Response.json({ error: "Informe invoiceId ou paymentId." }, { status: 400 });
  }

  try {
    let invoice = null;
    if (invoiceId) {
      const [inv] = await db
        .select()
        .from(subscriptionInvoices)
        .where(and(eq(subscriptionInvoices.id, invoiceId), eq(subscriptionInvoices.companyId, auth.user.companyId)))
        .limit(1);
      invoice = inv;
    } else if (paymentId) {
      const [inv] = await db
        .select()
        .from(subscriptionInvoices)
        .where(and(eq(subscriptionInvoices.mercadoPagoPaymentId, paymentId), eq(subscriptionInvoices.companyId, auth.user.companyId)))
        .limit(1);
      invoice = inv;
    }

    if (!invoice) {
      return Response.json({ error: "Fatura não encontrada." }, { status: 404 });
    }

    return Response.json({
      data: {
        invoiceId: invoice.id,
        status: invoice.status,
        paid: invoice.status === "paid",
        paidAt: invoice.paidAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("[SaaS Status API] Error checking status:", error);
    return Response.json({ error: "Erro ao verificar status do pagamento." }, { status: 500 });
  }
}
