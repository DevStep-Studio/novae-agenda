import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { companyMemberships, companies } from "@/db/schema";
import { isSecureCookie, requireAuth, forbidden, unauthorized } from "@/lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const switchSchema = z.object({
  companyId: z.string().uuid("ID de empresa inválido."),
});

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const body = await request.json().catch(() => null);
  const parsed = switchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const { companyId } = parsed.data;

  // Check company exists
  const [company] = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (!company) {
    return Response.json({ error: "Empresa não encontrada." }, { status: 404 });
  }

  // Superadmin has universal switch rights
  if (auth.user.isSuperadmin) {
    const cookieStore = await cookies();
    cookieStore.set("active_company_id", companyId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: isSecureCookie(),
      maxAge: 60 * 60 * 24 * 30,
    });
    return Response.json({ data: { ok: true, companyId, companyName: company.name } });
  }

  // Check user belongs to company (users.companyId or companyMemberships)
  const isDirect = auth.user.companyId === companyId;

  const [membership] = await db
    .select({ role: companyMemberships.role })
    .from(companyMemberships)
    .where(
      and(
        eq(companyMemberships.userId, auth.user.userId),
        eq(companyMemberships.companyId, companyId),
        eq(companyMemberships.active, true),
      ),
    )
    .limit(1);

  if (!isDirect && !membership) {
    return forbidden("Você não possui vínculo ativo com esta empresa.");
  }

  const cookieStore = await cookies();
  cookieStore.set("active_company_id", companyId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookie(),
    maxAge: 60 * 60 * 24 * 30,
  });

  return Response.json({
    data: {
      ok: true,
      companyId,
      companyName: company.name,
      role: membership?.role ?? auth.user.role,
    },
  });
}
