import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSuperadmin } from "@/lib/auth";
import { AdminService } from "@/lib/admin/admin-service";

export const dynamic = "force-dynamic";

const updateOwnerSchema = z.object({
  name: z.string().min(2).optional(),
  businessType: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  cnpjOrCpf: z.string().optional(),
  ownerName: z.string().min(2).optional(),
  ownerPhone: z.string().optional(),
  active: z.boolean().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  try {
    const { id } = await params;
    const details = await AdminService.getOwnerDetails(id);

    if (!details) {
      return Response.json({ error: "Empresa não encontrada." }, { status: 404 });
    }

    return Response.json({ data: details });
  } catch (error) {
    console.error("[Superadmin API Owner Details] Error:", error);
    return Response.json({ error: "Erro ao carregar detalhes do proprietário." }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateOwnerSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message || "Dados inválidos." }, { status: 400 });
    }

    await AdminService.updateOwner(
      id,
      parsed.data,
      { id: gate.auth.user.userId, email: gate.auth.user.email },
      request
    );

    return Response.json({ success: true, message: "Dados atualizados com sucesso." });
  } catch (error: any) {
    console.error("[Superadmin API Update Owner] Error:", error);
    return Response.json({ error: error.message || "Erro ao atualizar dados." }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const isHard = searchParams.get("hard") === "true";
    const confirmedName = searchParams.get("confirmedName") ?? "";
    const reason = searchParams.get("reason") || "Exclusão solicitada via Superadmin";

    if (isHard) {
      await AdminService.hardDeleteOwner(
        id,
        confirmedName,
        reason,
        { id: gate.auth.user.userId, email: gate.auth.user.email },
        request
      );

      return Response.json({ success: true, message: "Empresa excluída definitivamente do sistema." });
    }

    // Soft delete by default
    await AdminService.softDeleteOwner(
      id,
      reason,
      { id: gate.auth.user.userId, email: gate.auth.user.email },
      request
    );

    return Response.json({ success: true, message: "Empresa desativada (Soft Delete)." });
  } catch (error: any) {
    console.error("[Superadmin API Delete Owner] Error:", error);
    return Response.json({ error: error.message || "Erro ao excluir empresa." }, { status: 400 });
  }
}
