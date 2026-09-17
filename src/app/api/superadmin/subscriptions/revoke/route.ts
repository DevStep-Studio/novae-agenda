import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSuperadmin } from "@/lib/auth";
import { AdminService } from "@/lib/admin/admin-service";

export const dynamic = "force-dynamic";

const revokeSubscriptionSchema = z.object({
  companyId: z.string().min(1, "ID da empresa é obrigatório."),
  immediately: z.boolean().default(true),
  reason: z.string().min(3, "Motivo obrigatório com no mínimo 3 caracteres para auditoria."),
});

export async function POST(request: NextRequest) {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  try {
    const body = await request.json();
    const parsed = revokeSubscriptionSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message || "Dados inválidos." }, { status: 400 });
    }

    const result = await AdminService.revokeSubscriptionManual(
      parsed.data,
      { id: gate.auth.user.userId, email: gate.auth.user.email },
      request
    );

    return Response.json({
      ...result,
      message: parsed.data.immediately
        ? "Assinatura revogada/cancelada imediatamente."
        : "Assinatura agendada para encerramento ao final do ciclo.",
    });
  } catch (error: any) {
    console.error("[Superadmin Revoke Subscription] Error:", error);
    return Response.json({ error: error.message || "Erro ao revogar assinatura." }, { status: 400 });
  }
}
