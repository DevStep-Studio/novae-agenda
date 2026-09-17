import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSuperadmin } from "@/lib/auth";
import { AdminService } from "@/lib/admin/admin-service";

export const dynamic = "force-dynamic";

const suspendSchema = z.object({
  reason: z.string().min(3, "O motivo da suspensão deve ter pelo menos 3 caracteres."),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = suspendSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message || "Motivo inválido para suspensão." },
        { status: 400 }
      );
    }

    const result = await AdminService.suspendCompany(
      id,
      parsed.data.reason,
      { id: gate.auth.user.userId, email: gate.auth.user.email },
      request
    );

    return Response.json(result);
  } catch (error: any) {
    console.error("[Superadmin API Suspend Company] Error:", error);
    return Response.json({ error: error.message || "Erro ao suspender empresa." }, { status: 400 });
  }
}
