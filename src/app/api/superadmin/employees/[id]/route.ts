import { NextRequest } from "next/server";
import { requireSuperadmin } from "@/lib/auth";
import { AdminService } from "@/lib/admin/admin-service";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  try {
    const { id } = await params;
    let actionOnAppointments: "cancel" | "keep" = "cancel";
    let reason = "Desligamento administrativo via Super Admin";

    const body = await request.json().catch(() => null);
    if (body) {
      if (body.actionOnAppointments) {
        actionOnAppointments = body.actionOnAppointments;
      } else if (body.cancelFutureAppointments === false) {
        actionOnAppointments = "keep";
      }
      if (body.reason) reason = body.reason;
    } else {
      const searchParams = request.nextUrl.searchParams;
      const paramAction = searchParams.get("actionOnAppointments");
      if (paramAction === "cancel" || paramAction === "keep") {
        actionOnAppointments = paramAction;
      }
      const paramReason = searchParams.get("reason");
      if (paramReason) reason = paramReason;
    }

    const result = await AdminService.deleteEmployee(
      id,
      actionOnAppointments,
      reason,
      { id: gate.auth.user.userId, email: gate.auth.user.email },
      request
    );

    return Response.json({
      ...result,
      message: `Profissional excluído com sucesso. Agendamentos cancelados: ${result.cancelledAppointments}.`,
    });
  } catch (error: any) {
    console.error("[Superadmin API Delete Employee] Error:", error);
    return Response.json({ error: error.message || "Erro ao remover funcionário." }, { status: 400 });
  }
}
