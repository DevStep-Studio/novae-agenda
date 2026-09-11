import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { customerMemberships } from "@/db/schema";
import { forbidden, requireAuth, unauthorized } from "@/lib/auth";
import { getCustomerMembershipDetails } from "@/lib/membership/membership-service";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z
    .enum(["active", "paused", "cancelled", "expired", "pending"])
    .optional(),
  preferredProfessionalId: z.string().optional().nullable(),
  preferredWeekdays: z.array(z.number().int().min(0).max(6)).optional(),
  preferredTime: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (auth.user.role === "client") return forbidden("Acesso restrito.");

  const details = await getCustomerMembershipDetails(auth.user.companyId, id);
  if (!details) {
    return Response.json(
      { error: "Assinatura do cliente não encontrada." },
      { status: 404 },
    );
  }

  return Response.json({ data: details });
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (auth.user.role === "client") return forbidden("Acesso restrito.");

  try {
    const json = await request.json();
    const parsed = patchSchema.parse(json);

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (parsed.status !== undefined) updateData.status = parsed.status;
    if (parsed.preferredProfessionalId !== undefined) {
      updateData.preferredProfessionalId = parsed.preferredProfessionalId;
    }
    if (parsed.preferredWeekdays !== undefined) {
      updateData.preferredWeekdays = parsed.preferredWeekdays;
    }
    if (parsed.preferredTime !== undefined) {
      updateData.preferredTime = parsed.preferredTime;
    }
    if (parsed.notes !== undefined) updateData.notes = parsed.notes;

    await db
      .update(customerMemberships)
      .set(updateData)
      .where(
        and(
          eq(customerMemberships.id, id),
          eq(customerMemberships.companyId, auth.user.companyId),
        ),
      );

    const details = await getCustomerMembershipDetails(auth.user.companyId, id);
    return Response.json({ data: details });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return Response.json(
        { error: err.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }
    return Response.json(
      { error: err.message ?? "Erro ao atualizar assinatura." },
      { status: 400 },
    );
  }
}
