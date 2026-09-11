import { z } from "zod";
import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { clients, customerMemberships } from "@/db/schema";
import { requireAuth, unauthorized } from "@/lib/auth";
import { bookBatchAppointments } from "@/lib/membership/membership-service";

export const dynamic = "force-dynamic";

const clientBatchSchema = z.object({
  customerMembershipId: z.string().optional(),
  serviceId: z.string().optional(),
  employeeId: z.string().optional(),
  slots: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
        startTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido."),
        serviceId: z.string().optional(),
        employeeId: z.string().optional(),
      }),
    )
    .min(1, "Selecione ao menos um horário para agendar."),
});

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const userId = auth.user.userId;

  try {
    const json = await request.json();
    const parsed = clientBatchSchema.parse(json);

    let targetMembershipId = parsed.customerMembershipId;

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
        return Response.json({ error: "Nenhum plano ativo encontrado." }, { status: 404 });
      }

      targetMembershipId = active.id;
    }

    const [membership] = await db
      .select({ id: customerMemberships.id, companyId: customerMemberships.companyId })
      .from(customerMemberships)
      .where(eq(customerMemberships.id, targetMembershipId));

    if (!membership) {
      return Response.json({ error: "Plano mensal não encontrado." }, { status: 404 });
    }

    const result = await bookBatchAppointments(
      membership.companyId,
      {
        customerMembershipId: membership.id,
        slots: parsed.slots,
        serviceId: parsed.serviceId,
        employeeId: parsed.employeeId,
      },
      userId,
    );

    return Response.json({ data: result });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return Response.json(
        { error: err.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }
    return Response.json(
      { error: err.message ?? "Erro ao confirmar agendamentos do mês." },
      { status: 400 },
    );
  }
}
