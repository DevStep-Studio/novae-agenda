import { NextRequest } from "next/server";
import { requireSuperadmin } from "@/lib/auth";
import { AdminService } from "@/lib/admin/admin-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q") ?? undefined;
    const companyId = searchParams.get("companyId") ?? undefined;
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 20;

    const result = await AdminService.listClients({
      q,
      companyId,
      page,
      limit,
    });

    return Response.json(result);
  } catch (error) {
    console.error("[Superadmin API Clients] Error:", error);
    return Response.json({ error: "Erro ao listar clientes." }, { status: 500 });
  }
}
