import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { appointmentServices, appointments, payments } from "@/db/schema";
import { requireAuth, unauthorized } from "@/lib/auth";
import { isUuid } from "@/lib/domain";
import type { PaymentMethod } from "@/shared/types";

export const dynamic = "force-dynamic";

const finishSchema = z.object({
  amount: z.number().min(0, "O valor não pode ser negativo."),
  method: z.enum(["pix", "cash", "debit", "credit", "other"]),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Atendimento não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = finishSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const { amount, method } = parsed.data;

  const [apt] = await db
    .select({ id: appointments.id, status: appointments.status })
    .from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.companyId, auth.user.companyId)))
    .limit(1);

  if (!apt) return Response.json({ error: "Atendimento não encontrado." }, { status: 404 });
  if (apt.status === "completed") {
    return Response.json({ error: "Este atendimento já foi finalizado." }, { status: 409 });
  }
  if (apt.status === "cancelled" || apt.status === "no_show") {
    return Response.json({ error: "Não é possível finalizar um atendimento cancelado." }, { status: 409 });
  }

  const [existingPayment] = await db.select({ id: payments.id }).from(payments).where(eq(payments.appointmentId, id)).limit(1);
  if (existingPayment) {
    return Response.json({ error: "Este atendimento já possui pagamento registrado." }, { status: 409 });
  }

  // transaction-like sequence: update appointment + create payment + snapshot commissions already stored
  await db.transaction(async (tx) => {
    await tx
      .update(appointments)
      .set({ status: "completed", total: amount.toFixed(2) })
      .where(and(eq(appointments.id, id), eq(appointments.companyId, auth.user.companyId)));

    await tx.insert(payments).values({
      companyId: auth.user.companyId,
      appointmentId: id,
      amount: amount.toFixed(2),
      method: method as PaymentMethod,
      status: "paid",
      paidAt: new Date(),
    });
  });

  return Response.json({ data: { id, status: "completed", amount, method } });
}
