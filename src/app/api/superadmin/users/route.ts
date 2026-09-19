import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSuperadmin } from "@/lib/auth";
import { AdminService } from "@/lib/admin/admin-service";

export const dynamic = "force-dynamic";

const createUserSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres."),
  email: z.string().email("E-mail inválido."),
  phone: z.string().optional(),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres.").optional(),
  role: z.enum(["superadmin", "owner", "employee", "customer"]),
  companyId: z.string().optional(),
  companyName: z.string().optional(),
  businessType: z.string().optional(),
  planSlug: z.string().optional(),
  accessType: z.enum(["trial", "courtesy", "pending"]).optional(),
  grantCourtesy: z.boolean().optional(),
  reason: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q") || searchParams.get("search") || undefined;
    const role = (searchParams.get("role") as any) ?? "all";
    const status = (searchParams.get("status") as any) ?? "all";
    const companyId = searchParams.get("companyId") ?? undefined;
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 20;

    const result = await AdminService.listUsers({
      q,
      role,
      status,
      companyId,
      page,
      limit,
    });

    return Response.json({
      success: true,
      data: result.items,
      items: result.items,
      stats: result.stats,
      pagination: result.pagination,
    });
  } catch (error: any) {
    console.error("[Superadmin API Users] Error:", error);
    return Response.json({ error: error.message || "Erro ao listar usuários." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  try {
    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const result = await AdminService.createUserManual(
      parsed.data,
      { id: gate.auth.user.userId, email: gate.auth.user.email },
      request
    );

    return Response.json(result, { status: 201 });
  } catch (error: any) {
    console.error("[Superadmin API Create User] Error:", error);
    return Response.json(
      { error: error.message || "Erro ao criar usuário no banco de dados." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  try {
    const body = await request.json();
    const ids = Array.isArray(body.ids) ? body.ids : [];
    const mode = body.mode === "hard" ? "hard" : "soft";
    const reason = body.reason || "Exclusão em massa de usuários via Super Admin";

    if (!ids.length) {
      return Response.json({ error: "Nenhum usuário selecionado para exclusão." }, { status: 400 });
    }

    const result = await AdminService.bulkDeleteUsers(
      ids,
      mode,
      reason,
      { id: gate.auth.user.userId, email: gate.auth.user.email },
      request
    );

    return Response.json({
      ...result,
      message: `${result.deletedCount} usuários ${mode === "hard" ? "excluídos definitivamente" : "desativados"} com sucesso.`,
    });
  } catch (error: any) {
    console.error("[Superadmin API Bulk Delete Users] Error:", error);
    return Response.json({ error: error.message || "Erro ao excluir usuários em massa." }, { status: 500 });
  }
}
