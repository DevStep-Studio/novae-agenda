import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { clients, companies, customerMemberships } from "@/db/schema";
import { requireAuth, unauthorized } from "@/lib/auth";
import { getCustomerMembershipDetails } from "@/lib/membership/membership-service";
import { normalizePhoneDigits } from "@/lib/domain";

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
  let companyId = searchParams.get("companyId");
  const companySlug = searchParams.get("companySlug");

  if (!companyId && companySlug) {
    const [comp] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.publicSlug, companySlug))
      .limit(1);
    if (comp) companyId = comp.id;
  }

  const userId = auth.user.userId;
  const userPhone = auth.user.phone ? normalizePhoneDigits(auth.user.phone) : null;

  // Find client records associated with this authenticated user
  let clientRecords = await db
    .select({
      id: clients.id,
      companyId: clients.companyId,
      phone: clients.phone,
      userId: clients.userId,
    })
    .from(clients)
    .where(
      or(
        eq(clients.userId, userId),
        auth.user.email ? eq(clients.email, auth.user.email) : undefined,
      ),
    );

  // If no direct client records found or if phone is available, check for clients by phone
  if (userPhone && (!clientRecords.length || (companyId && !clientRecords.some((c) => c.companyId === companyId)))) {
    const allClients = await db.select({ id: clients.id, companyId: clients.companyId, phone: clients.phone, userId: clients.userId }).from(clients);
    const matched = allClients.filter((c) => c.phone && normalizePhoneDigits(c.phone) === userPhone);
    if (matched.length > 0) {
      for (const m of matched) {
        if (!m.userId) {
          await db.update(clients).set({ userId }).where(eq(clients.id, m.id)).catch(() => {});
        }
      }
      clientRecords = [...clientRecords, ...matched];
    }
  }

  if (clientRecords.length === 0) {
    return Response.json({ data: null });
  }

  const clientIds = Array.from(new Set(clientRecords.map((c) => c.id)));

  const membershipQuery = and(
    inArray(customerMemberships.clientId, clientIds),
    eq(customerMemberships.status, "active"),
    companyId ? eq(customerMemberships.companyId, companyId) : undefined,
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
