import { z } from "zod";
import { forbidden, requireAuth, unauthorized } from "@/lib/auth";
import { bookBatchAppointments } from "@/lib/membership/membership-service";

export const dynamic = "force-dynamic";

const batchSchema = z.object({
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
  serviceId: z.string().optional(),
  employeeId: z.string().optional(),
});

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  if (auth.user.role === "client") return forbidden("Acesso restrito à equipe.");

  try {
    const json = await request.json();
    const parsed = batchSchema.parse(json);

    const result = await bookBatchAppointments(
      auth.user.companyId,
      {
        customerMembershipId: id,
        slots: parsed.slots,
        serviceId: parsed.serviceId,
        employeeId: parsed.employeeId,
      },
      auth.user.userId,
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
      { error: err.message ?? "Erro ao agendar sessões do mês." },
      { status: 400 },
    );
  }
}
