import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSuperadmin } from "@/lib/auth";
import { AdminService } from "@/lib/admin/admin-service";

export const dynamic = "force-dynamic";

const grantSubscriptionSchema = z.object({
  companyId: z.string().min(1, "ID da empresa é obrigatório."),
  planSlug: z.string().min(1, "Slug do plano é obrigatório."),
  originType: z.enum(["manual_courtesy", "manual_paid"]).default("manual_courtesy"),
  periodDays: z.number().int().positive().default(30),
  reason: z.string().min(3, "Motivo obrigatório com no mínimo 3 caracteres para auditoria."),
});

export async function POST(request: NextRequest) {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  try {
    const body = await request.json();
    const parsed = grantSubscriptionSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message || "Dados inválidos." }, { status: 400 });
    }

    const result = await AdminService.grantSubscriptionManual(
      parsed.data,
      { id: gate.auth.user.userId, email: gate.auth.user.email },
      request
    );

    return Response.json({
      ...result,
      message: `Assinatura do plano '${parsed.data.planSlug}' concedida com sucesso até ${result.periodEnd.toLocaleDateString("pt-BR")}.`,
    });
  } catch (error: any) {
    console.error("[Superadmin Grant Subscription] Error:", error);
    return Response.json({ error: error.message || "Erro ao conceder assinatura." }, { status: 400 });
  }
}
