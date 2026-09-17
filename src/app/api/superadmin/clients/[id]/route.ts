import { NextRequest } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { requireSuperadmin } from "@/lib/auth";
import { AdminService } from "@/lib/admin/admin-service";
import { logAdminAction } from "@/lib/admin/audit";

export const dynamic = "force-dynamic";

const updateClientSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional(),
  document: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateClientSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message || "Dados inválidos." }, { status: 400 });
    }

    const [existing] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
    if (!existing) return Response.json({ error: "Cliente não encontrado." }, { status: 404 });

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.email !== undefined) updates.email = parsed.data.email;
    if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone;
    if (parsed.data.document !== undefined) updates.document = parsed.data.document;
    if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
    if (parsed.data.active !== undefined) updates.active = parsed.data.active;

    await db.update(clients).set(updates).where(eq(clients.id, id));

    await logAdminAction({
      adminUserId: gate.auth.user.userId,
      adminEmail: gate.auth.user.email,
      action: "UPDATE_CLIENT",
      entity: "client",
      entityId: id,
      entityName: existing.name,
      beforeState: existing as any,
      afterState: { ...existing, ...updates },
      request,
    });

    return Response.json({ success: true, message: "Cliente atualizado com sucesso." });
  } catch (error: any) {
    console.error("[Superadmin API Update Client] Error:", error);
    return Response.json({ error: error.message || "Erro ao atualizar cliente." }, { status: 400 });
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
    const reason = searchParams.get("reason") || "Exclusão administrativa via Superadmin";

    if (isHard) {
      await AdminService.hardDeleteClient(
        id,
        reason,
        { id: gate.auth.user.userId, email: gate.auth.user.email },
        request
      );
      return Response.json({ success: true, message: "Cliente excluído definitivamente." });
    }

    await AdminService.softDeleteClient(
      id,
      reason,
      { id: gate.auth.user.userId, email: gate.auth.user.email },
      request
    );
    return Response.json({ success: true, message: "Cliente desativado (Soft Delete)." });
  } catch (error: any) {
    console.error("[Superadmin API Delete Client] Error:", error);
    return Response.json({ error: error.message || "Erro ao remover cliente." }, { status: 400 });
  }
}
