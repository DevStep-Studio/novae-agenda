import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSuperadmin } from "@/lib/auth";
import { AdminService } from "@/lib/admin/admin-service";

export const dynamic = "force-dynamic";

const updateUserSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  role: z.string().optional(),
  isSuperadmin: z.boolean().optional(),
  active: z.boolean().optional(),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres.").optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const result = await AdminService.updateUserRoleAndStatus(
      id,
      parsed.data,
      { id: gate.auth.user.userId, email: gate.auth.user.email },
      request
    );

    return Response.json(result);
  } catch (error: any) {
    console.error("[Superadmin API Update User] Error:", error);
    return Response.json(
      { error: error.message || "Erro ao atualizar usuário." },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const mode = body.mode === "hard" ? "hard" : "soft";
    const reason = body.reason || "Exclusão via Super Admin";

    const result = await AdminService.deleteUser(
      id,
      mode,
      reason,
      { id: gate.auth.user.userId, email: gate.auth.user.email },
      request
    );

    return Response.json(result);
  } catch (error: any) {
    console.error("[Superadmin API Delete User] Error:", error);
    return Response.json(
      { error: error.message || "Erro ao excluir usuário." },
      { status: 400 }
    );
  }
}
