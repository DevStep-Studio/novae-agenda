import { z } from "zod";
import { forbidden, requireAuth, unauthorized } from "@/lib/auth";
import {
  createMembershipPlan,
  listMembershipPlans,
} from "@/lib/membership/membership-service";

export const dynamic = "force-dynamic";

const createPlanSchema = z.object({
  name: z.string().min(2, "Nome do plano é obrigatório."),
  description: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  price: z.number().min(0, "Preço deve ser positivo."),
  billingPeriod: z.enum(["monthly"]).default("monthly"),
  frequencyType: z.enum([
    "WEEKLY_CALENDAR_BASED",
    "FIXED_MONTHLY_QUOTA",
    "CUSTOM_WEEKLY_FREQUENCY",
  ]),
  sessionsPerPeriod: z.number().int().min(1).default(4),
  weeklyFrequency: z.number().int().min(1).default(1),
  allowReschedule: z.boolean().default(true),
  rescheduleHoursNotice: z.number().int().min(0).default(2),
  allowCarryOver: z.boolean().default(false),
  noShowConsumesSession: z.boolean().default(true),
  lateCancelConsumesSession: z.boolean().default(true),
  badgeColor: z.string().optional().nullable(),
  serviceIds: z.array(z.string()).min(1, "Selecione ao menos um serviço."),
  employeeIds: z.array(z.string()).optional(),
});

export async function GET() {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (auth.user.role === "client") return forbidden("Acesso restrito à gestão.");

  const plans = await listMembershipPlans(auth.user.companyId, true);
  return Response.json({ data: plans });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (auth.user.role === "client" || auth.user.role === "employee") {
    return forbidden("Acesso restrito a administradores.");
  }

  try {
    const json = await request.json();
    const parsed = createPlanSchema.parse(json);

    const plan = await createMembershipPlan(auth.user.companyId, parsed);
    return Response.json({ data: plan }, { status: 201 });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return Response.json(
        { error: err.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }
    return Response.json(
      { error: err.message ?? "Erro ao criar plano." },
      { status: 400 },
    );
  }
}
