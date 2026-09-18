import { NextRequest } from "next/server";
import { requireSuperadmin } from "@/lib/auth";
import { AdminService } from "@/lib/admin/admin-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q") || searchParams.get("search") || undefined;
    const companyId = searchParams.get("companyId") ?? undefined;
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 20;

    const result = await AdminService.listClients({
      q,
      companyId,
      page,
      limit,
    });

    return Response.json({
      success: true,
      data: result.items,
      items: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("[Superadmin API Clients] Error:", error);
    return Response.json({ error: "Erro ao listar clientes." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  try {
    const body = await request.json();
    const ids = Array.isArray(body.ids) ? body.ids : [];
    const mode = body.mode === "hard" ? "hard" : "soft";
    const reason = body.reason || "Exclusão em massa de clientes via Super Admin";

    if (!ids.length) {
      return Response.json({ error: "Nenhum cliente selecionado para exclusão." }, { status: 400 });
    }

    const result = await AdminService.bulkDeleteClients(
      ids,
      mode,
      reason,
      { id: gate.auth.user.userId, email: gate.auth.user.email },
      request
    );

    return Response.json({
      ...result,
      message: `${result.deletedCount} clientes ${mode === "hard" ? "excluídos definitivamente" : "desativados"} com sucesso.`,
    });
  } catch (error: any) {
    console.error("[Superadmin API Bulk Delete Clients] Error:", error);
    return Response.json({ error: error.message || "Erro ao excluir clientes em massa." }, { status: 500 });
  }
}
