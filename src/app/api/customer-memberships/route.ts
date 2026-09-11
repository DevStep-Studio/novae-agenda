import { z } from "zod";
import { forbidden, requireAuth, unauthorized } from "@/lib/auth";
import {
  assignCustomerMembership,
  listCustomerMemberships,
} from "@/lib/membership/membership-service";

export const dynamic = "force-dynamic";

const assignSchema = z.object({
  clientId: z.string().min(1, "Cliente é obrigatório."),
  membershipPlanId: z.string().min(1, "Plano é obrigatório."),
  preferredProfessionalId: z.string().optional().nullable(),
  preferredWeekdays: z.array(z.number().int().min(0).max(6)).default([4]),
  preferredTime: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  initialPaymentRecorded: z.boolean().default(false),
  initialPaymentMethod: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (auth.user.role === "client") return forbidden("Acesso restrito.");

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;

  const memberships = await listCustomerMemberships(auth.user.companyId, {
    clientId,
    status,
  });

  return Response.json({ data: memberships });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (auth.user.role === "client") return forbidden("Acesso restrito à gestão.");

  try {
    const json = await request.json();
    const parsed = assignSchema.parse(json);

    const membership = await assignCustomerMembership(
      auth.user.companyId,
      parsed,
    );
    return Response.json({ data: membership }, { status: 201 });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return Response.json(
        { error: err.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }
    return Response.json(
      { error: err.message ?? "Erro ao vincular plano ao cliente." },
      { status: 400 },
    );
  }
}
