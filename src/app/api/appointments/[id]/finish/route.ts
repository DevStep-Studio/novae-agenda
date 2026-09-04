import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { appointments, notifications, payments } from "@/db/schema";
import { hasMinRole, requireRole } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { centsToNumber, isUuid } from "@/lib/domain";
import type { PaymentMethod } from "@/shared/types";

export const dynamic = "force-dynamic";

const finishSchema = z.object({
  amount: z.number().min(0, "O valor não pode ser negativo.").max(1_000_000),
  discount: z.number().min(0).max(1_000_000).optional(),
  method: z.enum(["pix", "cash", "debit", "credit", "other"]),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireRole("employee");
  if (gate.response) return gate.response;
  const { auth } = gate;
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Atendimento não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = finishSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const { amount, discount, method } = parsed.data;

  const [apt] = await db
    .select({ id: appointments.id, status: appointments.status, total: appointments.total, employeeId: appointments.employeeId })
    .from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.companyId, auth.user.companyId)))
    .limit(1);

  if (!apt) return Response.json({ error: "Atendimento não encontrado." }, { status: 404 });
  if (auth.user.role === "employee" && apt.employeeId !== auth.user.employeeId) {
    return Response.json({ error: "Você não pode finalizar este atendimento." }, { status: 403 });
  }
  if (apt.status === "completed") {
    return Response.json({ error: "Este atendimento já foi finalizado." }, { status: 409 });
  }
  if (apt.status === "cancelled" || apt.status === "no_show") {
    return Response.json({ error: "Não é possível finalizar um atendimento cancelado." }, { status: 409 });
  }

  // Changing the charged amount away from the scheduled price requires a manager+.
  const scheduledTotal = centsToNumber(apt.total);
  const totalWithDiscount = scheduledTotal - (discount ?? 0);
  const valueChanged = Math.abs(amount - totalWithDiscount) > 0.001 || (discount && discount > 0);
  if (valueChanged && !hasMinRole(auth.user.role, "manager")) {
    return Response.json(
      { error: "Você não tem permissão para alterar o valor ou conceder desconto no atendimento." },
      { status: 403 },
    );
  }

  const [existingPayment] = await db.select({ id: payments.id }).from(payments).where(eq(payments.appointmentId, id)).limit(1);
  if (existingPayment) {
    return Response.json({ error: "Este atendimento já possui pagamento registrado." }, { status: 409 });
  }

  // Atomic transaction: mark completed + register payment with discount.
  await db.transaction(async (tx) => {
    await tx
      .update(appointments)
      .set({ status: "completed" })
      .where(and(eq(appointments.id, id), eq(appointments.companyId, auth.user.companyId)));

    await tx.insert(payments).values({
      companyId: auth.user.companyId,
      appointmentId: id,
      amount: amount.toFixed(2),
      discount: (discount ?? 0).toFixed(2),
      method: method as PaymentMethod,
      status: "paid",
      paidAt: new Date(),
    });
  });

  await recordAudit({
    companyId: auth.user.companyId,
    userId: auth.user.userId,
    action: valueChanged ? "appointment.finished_value_changed" : "appointment.finished",
    entity: "appointment",
    entityId: id,
    metadata: { method, amount, discount: discount ?? 0, scheduledTotal, valueChanged },
  });

  await db.insert(notifications).values({
    companyId: auth.user.companyId,
    type: "appointment_completed",
    title: "Atendimento finalizado",
    body: `Recebido: R$ ${amount.toFixed(2)} · ${method.toUpperCase()}`,
    entityType: "appointment",
    entityId: id,
  });

  return Response.json({ data: { id, status: "completed", amount, discount: discount ?? 0, method } });
}
