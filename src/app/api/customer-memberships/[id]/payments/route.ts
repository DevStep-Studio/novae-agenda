import { z } from "zod";
import { forbidden, requireAuth, unauthorized } from "@/lib/auth";
import { recordMembershipPeriodPayment } from "@/lib/membership/membership-service";

export const dynamic = "force-dynamic";

const paymentSchema = z.object({
  periodId: z.string().min(1, "ID do período é obrigatório."),
  method: z.enum(["pix", "cash", "debit", "credit", "other"]),
  amount: z.number().min(0).optional(),
  notes: z.string().optional().nullable(),
});

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (auth.user.role === "client") return forbidden("Acesso restrito.");

  try {
    const json = await request.json();
    const parsed = paymentSchema.parse(json);

    const res = await recordMembershipPeriodPayment(
      auth.user.companyId,
      id,
      parsed.periodId,
      {
        method: parsed.method,
        amount: parsed.amount,
        notes: parsed.notes,
      },
    );

    return Response.json({ data: res });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return Response.json(
        { error: err.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }
    return Response.json(
      { error: err.message ?? "Erro ao registrar pagamento da mensalidade." },
      { status: 400 },
    );
  }
}
