import { requireRole } from "@/lib/auth";
import { getCompanySubscription, PLANS } from "@/lib/subscriptions";
import { createSubscriptionCheckout, activateSubscription } from "@/lib/mercadopago";
import { db } from "@/db";
import { subscriptionInvoices } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireRole("manager");
  if (gate.response) return gate.response;
  const { auth } = gate;

  const sub = await getCompanySubscription(auth.user.companyId);

  const invoices = await db
    .select()
    .from(subscriptionInvoices)
    .where(eq(subscriptionInvoices.companyId, auth.user.companyId))
    .orderBy(desc(subscriptionInvoices.createdAt))
    .limit(20);

  return Response.json({
    data: {
      subscription: sub,
      plans: PLANS,
      invoices: invoices.map((inv) => ({
        id: inv.id,
        amount: Number(inv.amount),
        status: inv.status,
        paidAt: inv.paidAt?.toISOString() ?? null,
        invoiceUrl: inv.invoiceUrl,
        createdAt: inv.createdAt.toISOString(),
      })),
    },
  });
}

const checkoutSchema = z.object({
  planKey: z.enum(["pro_monthly", "pro_yearly"]),
  simulate: z.boolean().optional(),
});

export async function POST(request: Request) {
  const gate = await requireRole("owner");
  if (gate.response) return gate.response;
  const { auth } = gate;

  const body = await request.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Plano inválido selecionado." }, { status: 400 });
  }

  const { planKey, simulate } = parsed.data;

  // If simulate flag is passed (e.g. testing or immediate dev confirmation)
  if (simulate) {
    await activateSubscription(auth.user.companyId, planKey);
    const updated = await getCompanySubscription(auth.user.companyId);
    return Response.json({ data: { ok: true, subscription: updated } });
  }

  const origin = request.headers.get("origin") || process.env.APP_URL || "http://localhost:3100";
  const backUrl = `${origin}/gestao`;

  const checkout = await createSubscriptionCheckout({
    companyId: auth.user.companyId,
    companyName: auth.user.name,
    planKey,
    payerEmail: auth.user.email,
    payerName: auth.user.name,
    backUrl,
  });

  return Response.json({ data: checkout });
}
