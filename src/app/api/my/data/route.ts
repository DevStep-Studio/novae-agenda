import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { appointments, clients, payments, reviews, users } from "@/db/schema";
import { requireAuth, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const userId = auth.user.userId;

  // 1. User profile data
  const [userProfile] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // 2. Client profile links
  const clientRecords = await db
    .select({
      id: clients.id,
      companyId: clients.companyId,
      name: clients.name,
      phone: clients.phone,
      email: clients.email,
      createdAt: clients.createdAt,
    })
    .from(clients)
    .where(or(eq(clients.userId, userId), eq(clients.email, auth.user.email)));

  const clientIds = clientRecords.map((c) => c.id);

  // 3. Appointments
  const userAppointments = clientIds.length
    ? await db
        .select({
          id: appointments.id,
          date: appointments.appointmentDate,
          startTime: appointments.startTime,
          endTime: appointments.endTime,
          status: appointments.status,
          total: appointments.total,
          createdAt: appointments.createdAt,
        })
        .from(appointments)
        .where(or(...clientIds.map((cid) => eq(appointments.clientId, cid))))
    : [];

  // 4. Reviews
  const userReviews = clientIds.length
    ? await db
        .select({
          id: reviews.id,
          rating: reviews.rating,
          comment: reviews.comment,
          createdAt: reviews.createdAt,
        })
        .from(reviews)
        .where(or(...clientIds.map((cid) => eq(reviews.clientId, cid))))
    : [];

  return Response.json({
    data: {
      profile: userProfile,
      clientProfiles: clientRecords,
      appointments: userAppointments,
      reviews: userReviews,
      exportedAt: new Date().toISOString(),
      legalNotice: "Dados exportados em conformidade com o Artigo 18 da Lei Geral de Proteção de Dados (LGPD).",
    },
  });
}
