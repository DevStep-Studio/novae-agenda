import { z } from "zod";
import { forbidden, requireAuth, unauthorized } from "@/lib/auth";
import {
  getMembershipPlan,
  updateMembershipPlan,
} from "@/lib/membership/membership-service";

export const dynamic = "force-dynamic";

const updatePlanSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  price: z.number().min(0).optional(),
  frequencyType: z
    .enum([
      "WEEKLY_CALENDAR_BASED",
      "FIXED_MONTHLY_QUOTA",
      "CUSTOM_WEEKLY_FREQUENCY",
    ])
    .optional(),
  sessionsPerPeriod: z.number().int().min(1).optional(),
  weeklyFrequency: z.number().int().min(1).optional(),
  allowReschedule: z.boolean().optional(),
  rescheduleHoursNotice: z.number().int().min(0).optional(),
  allowCarryOver: z.boolean().optional(),
  noShowConsumesSession: z.boolean().optional(),
  lateCancelConsumesSession: z.boolean().optional(),
  badgeColor: z.string().optional().nullable(),
  active: z.boolean().optional(),
  serviceIds: z.array(z.string()).optional(),
  employeeIds: z.array(z.string()).optional(),
});

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (auth.user.role === "client") return forbidden("Acesso restrito.");

  const plan = await getMembershipPlan(auth.user.companyId, id);
  if (!plan) {
    return Response.json({ error: "Plano não encontrado." }, { status: 404 });
  }

  return Response.json({ data: plan });
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (auth.user.role === "client" || auth.user.role === "employee") {
    return forbidden("Acesso restrito a administradores.");
  }

  try {
    const json = await request.json();
    const parsed = updatePlanSchema.parse(json);

    const updated = await updateMembershipPlan(auth.user.companyId, id, parsed);
    return Response.json({ data: updated });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return Response.json(
        { error: err.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }
    return Response.json(
      { error: err.message ?? "Erro ao atualizar plano." },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (auth.user.role === "client" || auth.user.role === "employee") {
    return forbidden("Acesso restrito a administradores.");
  }

  // Soft delete / deactivate plan
  const updated = await updateMembershipPlan(auth.user.companyId, id, {
    active: false,
  });

  return Response.json({ data: updated });
}
