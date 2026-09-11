import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, bookings, companies, notificationLogs, notifications, users } from "@/db/schema";
import { getIdentity } from "@/lib/auth";
import { processBookingNotifications } from "@/lib/booking/notifications";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getIdentity();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const companyId = user.companyId;
    if (!companyId) {
      return NextResponse.json({ error: "Empresa não encontrada para o usuário." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const type = body.type || "reminder_2h"; // 'reminder_2h' | 'new_booking' | 'cancellation' | 'payment'

    if (type === "reminder_2h") {
      // Find latest confirmed appointment or booking
      const [apt] = await db
        .select()
        .from(appointments)
        .where(and(eq(appointments.companyId, companyId), eq(appointments.status, "confirmed")))
        .orderBy(desc(appointments.appointmentDate))
        .limit(1);

      const title = "⏰ Lembrete de Agendamento (Simulação)";
      const messageBody = apt
        ? `Lembrete automático: Atendimento agendado para hoje às ${apt.startTime.slice(0, 5)}.`
        : "Lembrete automático: Você possui agendamentos programados para hoje.";

      // Insert in-app notification
      const notifId = crypto.randomUUID();
      await db.insert(notifications).values({
        id: notifId,
        companyId,
        userId: user.id,
        type: "reminder",
        title,
        body: messageBody,
        createdAt: new Date(),
      });

      // Force-process any pending notification logs
      let processed = 0;
      try {
        processed = await processBookingNotifications(10);
      } catch {}

      return NextResponse.json({
        data: {
          ok: true,
          type: "reminder_2h",
          title,
          body: messageBody,
          processedLogs: processed,
          timestamp: new Date().toISOString(),
        },
      });
    }

    if (type === "new_booking") {
      const notifId = crypto.randomUUID();
      const title = "📅 Novo agendamento online";
      const messageBody = "Um cliente acabou de agendar um horário pelo seu link público!";
      await db.insert(notifications).values({
        id: notifId,
        companyId,
        userId: user.id,
        type: "booking.created",
        title,
        body: messageBody,
        createdAt: new Date(),
      });

      return NextResponse.json({
        data: {
          ok: true,
          type: "new_booking",
          title,
          body: messageBody,
          timestamp: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json({
      data: {
        ok: true,
        message: "Simulação executada com sucesso.",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao simular notificação." },
      { status: 500 },
    );
  }
}
