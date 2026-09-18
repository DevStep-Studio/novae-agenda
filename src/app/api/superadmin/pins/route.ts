import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSuperadmin } from "@/lib/auth";
import { AdminService } from "@/lib/admin/admin-service";

export const dynamic = "force-dynamic";

const resetPinSchema = z.object({
  userId: z.string().min(1, "ID do usuário é obrigatório."),
  pin: z.string().optional(),
  newPhone: z.string().optional(),
  unlock: z.boolean().optional(),
});

const patchPinSchema = z.object({
  userId: z.string().min(1, "ID do usuário é obrigatório."),
  action: z.enum(["unlock", "remove"]),
});

export async function GET(request: NextRequest) {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q") || searchParams.get("search") || undefined;
    const role = (searchParams.get("role") as any) ?? "all";
    const pinStatus = (searchParams.get("pinStatus") as any) ?? "all";
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 20;

    const result = await AdminService.listUserPins({
      q,
      role,
      pinStatus,
      page,
      limit,
    });

    return Response.json({
      success: true,
      items: result.items,
      pagination: result.pagination,
      stats: result.stats,
    });
  } catch (error: any) {
    console.error("[Superadmin API Pins GET] Error:", error);
    return Response.json(
      { error: error.message || "Erro ao listar PINs de usuários." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  try {
    const body = await request.json();
    const parsed = resetPinSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const result = await AdminService.resetUserPin(
      parsed.data.userId,
      parsed.data,
      { id: gate.auth.user.userId, email: gate.auth.user.email },
      request
    );

    return Response.json(result);
  } catch (error: any) {
    console.error("[Superadmin API Reset PIN POST] Error:", error);
    return Response.json(
      { error: error.message || "Erro ao redefinir PIN do usuário." },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  try {
    const body = await request.json();
    const parsed = patchPinSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    if (parsed.data.action === "unlock") {
      const result = await AdminService.unlockUserPin(
        parsed.data.userId,
        { id: gate.auth.user.userId, email: gate.auth.user.email },
        request
      );
      return Response.json(result);
    }

    if (parsed.data.action === "remove") {
      const result = await AdminService.removeUserPin(
        parsed.data.userId,
        { id: gate.auth.user.userId, email: gate.auth.user.email },
        request
      );
      return Response.json(result);
    }

    return Response.json({ error: "Ação não suportada." }, { status: 400 });
  } catch (error: any) {
    console.error("[Superadmin API PIN PATCH] Error:", error);
    return Response.json(
      { error: error.message || "Erro ao alterar credencial PIN." },
      { status: 400 }
    );
  }
}
