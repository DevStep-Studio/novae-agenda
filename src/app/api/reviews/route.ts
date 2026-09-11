import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, clients, employees, reviews, services } from "@/db/schema";
import { requireAuth, requireRole, unauthorized } from "@/lib/auth";
import { isUuid } from "@/lib/domain";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const companyId = auth.user.companyId;
  if (!companyId) return Response.json({ error: "Empresa não informada." }, { status: 400 });

  const rows = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      status: reviews.status,
      createdAt: reviews.createdAt,
      clientName: clients.name,
      employeeName: employees.name,
      serviceName: services.name,
    })
    .from(reviews)
    .innerJoin(clients, eq(reviews.clientId, clients.id))
    .innerJoin(employees, eq(reviews.employeeId, employees.id))
    .leftJoin(services, eq(reviews.serviceId, services.id))
    .where(eq(reviews.companyId, companyId))
    .orderBy(desc(reviews.createdAt))
    .limit(100);

  const [stats] = await db
    .select({
      count: sql<number>`count(*)`,
      avgRating: sql<number>`coalesce(avg(${reviews.rating}), 0)`,
    })
    .from(reviews)
    .where(eq(reviews.companyId, companyId));

  return Response.json({
    data: {
      total: Number(stats?.count ?? 0),
      averageRating: Number(Number(stats?.avgRating ?? 0).toFixed(1)),
      reviews: rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        status: r.status,
        clientName: r.clientName,
        employeeName: r.employeeName,
        serviceName: r.serviceName ?? "Atendimento",
        createdAt: r.createdAt.toISOString(),
      })),
    },
  });
}

const createReviewSchema = z.object({
  appointmentId: z.string().uuid("Atendimento inválido."),
  rating: z.number().int().min(1, "A nota mínima é 1 estrela.").max(5, "A nota máxima é 5 estrelas."),
  comment: z.string().max(1000, "Comentário muito longo.").optional().nullable(),
});

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const body = await request.json().catch(() => null);
  const parsed = createReviewSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const { appointmentId, rating, comment } = parsed.data;

  const [apt] = await db
    .select({
      id: appointments.id,
      companyId: appointments.companyId,
      clientId: appointments.clientId,
      employeeId: appointments.employeeId,
      status: appointments.status,
    })
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  if (!apt) {
    return Response.json({ error: "Atendimento não encontrado." }, { status: 404 });
  }

  if (apt.status !== "completed") {
    return Response.json({ error: "Somente atendimentos finalizados podem ser avaliados." }, { status: 400 });
  }

  const [existingReview] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(eq(reviews.appointmentId, appointmentId))
    .limit(1);

  if (existingReview) {
    return Response.json({ error: "Este atendimento já foi avaliado." }, { status: 409 });
  }

  const reviewId = crypto.randomUUID();
  const trimmedComment = comment?.trim() || null;

  await db
    .insert(reviews)
    .values({
      id: reviewId,
      companyId: apt.companyId,
      appointmentId,
      clientId: apt.clientId,
      employeeId: apt.employeeId,
      rating,
      comment: trimmedComment,
      status: "approved",
    });

  return Response.json({
    data: {
      id: reviewId,
      rating,
      comment: trimmedComment,
      status: "approved",
    },
  });
}
