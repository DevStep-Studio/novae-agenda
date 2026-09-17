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

    // Find the owner user
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

    if (!membership) {
      return Response.json({ error: "Proprietário não encontrado para esta empresa." }, { status: 404 });
    }

    // Log the impersonation action before creating session
    await logAdminAction({
      adminUserId: gate.auth.user.userId,
      adminEmail: gate.auth.user.email,
      action: "IMPERSONATE_OWNER",
      entity: "company",
      entityId: companyId,
      entityName: company.name,
      reason: `Acesso de suporte à conta de ${membership.userName} (${membership.userEmail})`,
      afterState: {
        impersonatedUserId: membership.userId,
        impersonatedUserEmail: membership.userEmail,
        companyId,
      },
      request,
    });

    // Create session cookie for the owner
    await createSession(membership.userId);

    return Response.json({
      success: true,
      message: `Sessão iniciada como ${membership.userName}. Redirecionando...`,
      redirectUrl: "/gestao",
    });
  } catch (error: any) {
    console.error("[Superadmin Impersonate] Error:", error);
    return Response.json({ error: error.message || "Erro ao assumir conta do proprietário." }, { status: 500 });
  }
}
