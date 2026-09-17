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
    const status = searchParams.get("status") || undefined;
    const plan = searchParams.get("plan") || undefined;
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 20;

    const result = await AdminService.listSubscriptions({
      q,
      status,
      plan,
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
    console.error("[Superadmin Subscriptions API] Error:", error);
    return Response.json({ error: "Erro ao listar assinaturas." }, { status: 500 });
  }
}
