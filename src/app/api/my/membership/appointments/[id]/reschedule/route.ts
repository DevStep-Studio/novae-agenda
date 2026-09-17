import { z } from "zod";
import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { bookingMembershipUsage, clients, customerMemberships } from "@/db/schema";
import { requireAuth, unauthorized } from "@/lib/auth";
import { rescheduleMembershipAppointment } from "@/lib/membership/membership-service";
import { bookingError } from "@/lib/booking/errors";

export const dynamic = "force-dynamic";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido."),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const { id: appointmentId } = await params;

  try {
    const parsed = schema.parse(await request.json());

    const clientRecords = await db
      .select({ id: clients.id })
      .from(clients)
      .where(
        or(
          eq(clients.userId, auth.user.userId),
          auth.user.email ? eq(clients.email, auth.user.email) : undefined,
        ),
      );
    if (clientRecords.length === 0) {
      return Response.json({ error: "Perfil de cliente não encontrado." }, { status: 404 });
    }
    const clientIds = clientRecords.map((c) => c.id);

    const [usage] = await db
      .select({ companyId: bookingMembershipUsage.companyId, customerMembershipId: bookingMembershipUsage.customerMembershipId })
      .from(bookingMembershipUsage)
      .where(eq(bookingMembershipUsage.appointmentId, appointmentId));
    if (!usage) {
      return Response.json({ error: "Agendamento não encontrado." }, { status: 404 });
    }

    const [ownedMembership] = await db
      .select({ id: customerMemberships.id })
      .from(customerMemberships)
      .where(and(eq(customerMemberships.id, usage.customerMembershipId), inArray(customerMemberships.clientId, clientIds)));
    if (!ownedMembership) {
      return Response.json({ error: "Este agendamento não pertence à sua conta." }, { status: 403 });
    }

    const result = await rescheduleMembershipAppointment(
      usage.companyId,
      appointmentId,
      parsed.date,
      parsed.startTime,
      auth.user.userId,
      { enforceCustomerLeadTime: true },
    );

    return Response.json({ data: result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: err.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
    }
    return bookingError(err);
  }
}
