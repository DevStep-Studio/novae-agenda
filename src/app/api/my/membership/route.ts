import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { clients, customerMemberships } from "@/db/schema";
import { requireAuth, unauthorized } from "@/lib/auth";
import { getCustomerMembershipDetails } from "@/lib/membership/membership-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth) {
    return Response.json(
      { data: null },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const { searchParams } = new URL(request.url);
  const companyIdParam = searchParams.get("companyId");

  const userId = auth.user.userId;

  // Find client records associated with this authenticated user
  const clientRecords = await db
    .select({
      id: clients.id,
      companyId: clients.companyId,
    })
    .from(clients)
    .where(
      or(
        eq(clients.userId, userId),
        auth.user.email ? eq(clients.email, auth.user.email) : undefined,
      ),
    );

  if (clientRecords.length === 0) {
    return Response.json({ data: null });
  }

  const clientIds = clientRecords.map((c) => c.id);

  const membershipQuery = and(
    inArray(customerMemberships.clientId, clientIds),
    eq(customerMemberships.status, "active"),
    companyIdParam ? eq(customerMemberships.companyId, companyIdParam) : undefined,
  );

  const [activeMembership] = await db
    .select({
      id: customerMemberships.id,
      companyId: customerMemberships.companyId,
    })
    .from(customerMemberships)
    .where(membershipQuery)
    .limit(1);

  if (!activeMembership) {
    return Response.json({ data: null });
  }

  const details = await getCustomerMembershipDetails(
    activeMembership.companyId,
    activeMembership.id,
  );

  return Response.json({ data: details });
}
