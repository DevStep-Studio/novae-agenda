import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { clients, customerMemberships } from "@/db/schema";
import { requireAuth, unauthorized } from "@/lib/auth";
import { getMonthScheduleSlots } from "@/lib/membership/membership-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1), 10);
  const employeeId = searchParams.get("employeeId") ?? undefined;
  const serviceId = searchParams.get("serviceId") ?? undefined;
  const membershipIdParam = searchParams.get("membershipId");

  const userId = auth.user.userId;

  let targetMembershipId = membershipIdParam;

  if (!targetMembershipId) {
    const clientRecords = await db
      .select({ id: clients.id, companyId: clients.companyId })
      .from(clients)
      .where(
        or(
          eq(clients.userId, userId),
          auth.user.email ? eq(clients.email, auth.user.email) : undefined,
        ),
      );

    if (clientRecords.length === 0) {
      return Response.json({ error: "Perfil de cliente não encontrado." }, { status: 404 });
    }

    const clientIds = clientRecords.map((c) => c.id);
    const [active] = await db
      .select({ id: customerMemberships.id, companyId: customerMemberships.companyId })
      .from(customerMemberships)
      .where(
        and(
          inArray(customerMemberships.clientId, clientIds),
          eq(customerMemberships.status, "active"),
        ),
      )
      .limit(1);

    if (!active) {
      return Response.json({ error: "Nenhum plano mensal ativo encontrado." }, { status: 404 });
    }

    targetMembershipId = active.id;
  }

  const [membershipRow] = await db
    .select({ companyId: customerMemberships.companyId })
    .from(customerMemberships)
    .where(eq(customerMemberships.id, targetMembershipId));

  if (!membershipRow) {
    return Response.json({ error: "Plano não encontrado." }, { status: 404 });
  }

  try {
    const monthData = await getMonthScheduleSlots(
      membershipRow.companyId,
      targetMembershipId,
      year,
      month,
      employeeId,
      serviceId,
    );

    return Response.json({ data: monthData });
  } catch (err: any) {
    return Response.json(
      { error: err.message ?? "Erro ao carregar horários do mês." },
      { status: 400 },
    );
  }
}
