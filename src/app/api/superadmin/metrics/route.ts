import { NextRequest } from "next/server";
import { requireSuperadmin } from "@/lib/auth";
import { AdminService } from "@/lib/admin/admin-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const period = (searchParams.get("period") || "30d") as any;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const data = await AdminService.getSystemOverviewMetrics({
      period,
      startDate,
      endDate,
    });

    return Response.json({ data });
  } catch (error: any) {
    console.error("[Superadmin Metrics API Error]:", error);
    return Response.json({ error: error.message || "Erro ao carregar métricas" }, { status: 500 });
  }
}
