import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSuperadmin } from "@/lib/auth";
import { AdminService } from "@/lib/admin/admin-service";

export const dynamic = "force-dynamic";

const createOwnerSchema = z.object({
  name: z.string().min(2, "Nome da empresa deve ter pelo menos 2 caracteres."),
  ownerName: z.string().min(2, "Nome do proprietário deve ter pelo menos 2 caracteres."),
  email: z.string().email("E-mail inválido."),
  phone: z.string().optional(),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres.").optional(),
  businessType: z.string().optional(),
  cnpjOrCpf: z.string().optional(),
  planSlug: z.string().optional(),
  accessType: z.enum(["trial", "courtesy", "pending"]).optional(),
  grantCourtesy: z.boolean().optional(),
  couponCode: z.string().optional(),
  reason: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q") || searchParams.get("search") || undefined;
    const status = (searchParams.get("status") as any) ?? "all";
    const plan = searchParams.get("plan") ?? undefined;
    const startDate = searchParams.get("startDate") ?? undefined;
    const endDate = searchParams.get("endDate") ?? undefined;
    const couponCode = searchParams.get("couponCode") ?? undefined;
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 20;

    const result = await AdminService.listOwners({
      q,
      status,
      plan,
      startDate,
      endDate,
      couponCode,
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
    console.error("[Superadmin API Owners] Error:", error);
    return Response.json({ error: "Erro ao listar proprietários." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  try {
    const body = await request.json();
    const parsed = createOwnerSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message || "Dados inválidos." }, { status: 400 });
    }

    const result = await AdminService.createOwnerManual(
      parsed.data,
      { id: gate.auth.user.userId, email: gate.auth.user.email },
      request
    );

    return Response.json({ success: true, ...result }, { status: 201 });
  } catch (error: any) {
    console.error("[Superadmin API Create Owner] Error:", error);
    return Response.json({ error: error.message || "Erro ao criar proprietário." }, { status: 400 });
  }
}
