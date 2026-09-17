import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { companyMemberships, companies, users } from "@/db/schema";
import { createSession, requireSuperadmin } from "@/lib/auth";
import { logAdminAction } from "@/lib/admin/audit";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  try {
    const { id: companyId } = await params;

    const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
    if (!company) return Response.json({ error: "Empresa não encontrada." }, { status: 404 });

    // Find the owner user via memberships first, then direct companyId
    let ownerUser: { userId: string; userName: string; userEmail: string } | null = null;

    const [membership] = await db
      .select({
        userId: companyMemberships.userId,
        userName: users.name,
        userEmail: users.email,
      })
      .from(companyMemberships)
      .innerJoin(users, eq(users.id, companyMemberships.userId))
      .where(and(eq(companyMemberships.companyId, companyId), eq(companyMemberships.role, "owner")))
      .limit(1);

    if (membership) {
      ownerUser = membership;
    } else {
      const [direct] = await db
        .select({
          userId: users.id,
          userName: users.name,
          userEmail: users.email,
        })
        .from(users)
        .where(and(eq(users.companyId, companyId), eq(users.role, "owner")))
        .limit(1);
      if (direct) ownerUser = direct;
    }

    if (!ownerUser) {
      return Response.json({ error: "Nenhum proprietário associado a esta empresa." }, { status: 404 });
    }

    // Log the impersonation action before creating session
    await logAdminAction({
      adminUserId: gate.auth.user.userId,
      adminEmail: gate.auth.user.email,
      action: "IMPERSONATE_OWNER",
      entity: "company",
      entityId: companyId,
      entityName: company.name,
      reason: `Acesso de suporte administrativo à conta de ${ownerUser.userName} (${ownerUser.userEmail})`,
      afterState: {
        impersonatedUserId: ownerUser.userId,
        impersonatedUserEmail: ownerUser.userEmail,
        companyId,
      },
      request,
    });

    // Create session cookie for the owner
    await createSession(ownerUser.userId);

    return Response.json({
      success: true,
      message: `Sessão iniciada como ${ownerUser.userName}. Redirecionando...`,
      data: {
        redirectUrl: "/gestao",
      },
      redirectUrl: "/gestao",
    });
  } catch (error: any) {
    console.error("[Superadmin Impersonate] Error:", error);
    return Response.json({ error: error.message || "Erro ao assumir conta do proprietário." }, { status: 500 });
  }
}
