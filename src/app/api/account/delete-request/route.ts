import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, customerCredentials, pushDevices, clients } from "@/db/schema";
import { getSession } from "@/lib/auth";

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
      .set({ isActive: false, lastError: "Account deleted" })
      .where(eq(pushDevices.userId, userId));

    // 2. Anonymize/delete customer credentials if customer
    await db
      .delete(customerCredentials)
      .where(eq(customerCredentials.userId, userId));

    // 3. Mark user record as deleted / anonymized
    await db
      .update(users)
      .set({
        email: `deleted_${userId}@anonymized.usereservei.com.br`,
        name: "Usuário Excluído",
        phone: null,
        active: false,
        avatarUrl: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

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
