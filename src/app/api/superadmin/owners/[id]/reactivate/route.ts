import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSuperadmin } from "@/lib/auth";
import { AdminService } from "@/lib/admin/admin-service";

export const dynamic = "force-dynamic";

const reactivateSchema = z.object({
  reason: z.string().optional(),
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
    const parsed = reactivateSchema.safeParse(body);

    const reason = parsed.success && parsed.data.reason ? parsed.data.reason : "Reativação autorizada via Super Admin";

    const result = await AdminService.reactivateCompany(
      id,
      reason,
      { id: gate.auth.user.userId, email: gate.auth.user.email },
      request
    );

    return Response.json(result);
  } catch (error: any) {
    console.error("[Superadmin API Reactivate Company] Error:", error);
    return Response.json({ error: error.message || "Erro ao reativar empresa." }, { status: 400 });
  }
}
