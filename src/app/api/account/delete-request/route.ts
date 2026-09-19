import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, customerCredentials, pushDevices, clients, companyMemberships } from "@/db/schema";
import { destroySession, getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const confirmation = body.confirmation;

    if (confirmation !== "EXCLUIR") {
      return NextResponse.json(
        { error: "Confirmação inválida. Digite EXCLUIR para prosseguir." },
        { status: 400 }
      );
    }

    const userId = session.userId;

    // 1. Deactivate push devices
    await db
      .update(pushDevices)
      .set({ isActive: false, lastError: "Account deleted by user request" })
      .where(eq(pushDevices.userId, userId));

    // 2. Delete customer credentials
    await db
      .delete(customerCredentials)
      .where(eq(customerCredentials.userId, userId));

    // 3. Deactivate memberships
    await db
      .update(companyMemberships)
      .set({ active: false })
      .where(eq(companyMemberships.userId, userId));

    // 4. Anonymize CRM client entry if exists
    await db
      .update(clients)
      .set({
        name: "Cliente Excluído",
        email: null,
        phone: "00000000000",
        notes: "Dados pessoais excluídos pelo titular sob a LGPD.",
        active: false,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(clients.userId, userId));

    // 5. Mark user record as deleted / anonymized
    await db
      .update(users)
      .set({
        email: `deleted_${userId.slice(0, 8)}_${Date.now()}@anonymized.usereservei.com.br`,
        name: "Usuário Excluído",
        phone: null,
        active: false,
        avatarUrl: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // 6. Terminate session cookie
    await destroySession();

    return NextResponse.json({
      success: true,
      message: "Sua conta e dados pessoais foram excluídos com sucesso.",
    });
  } catch (error: any) {
    console.error("[Account Deletion Error]:", error);
    return NextResponse.json(
      { error: "Erro ao processar exclusão de conta." },
      { status: 500 }
    );
  }
}
