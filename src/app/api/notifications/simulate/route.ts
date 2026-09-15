import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, clients } from "@/db/schema";
import { requireAuth, unauthorized } from "@/lib/auth";
import { processBookingNotifications } from "@/lib/booking/notifications";
import { NotificationService } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Endpoint de simulação desativado em ambiente de produção." },
      { status: 403 }
    );
  }

  try {
    const auth = await requireAuth();
    if (!auth) return unauthorized();

    const companyId = auth.user.companyId;
    if (!companyId) {
      return NextResponse.json({ error: "Empresa não encontrada para a sessão atual." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const type = body.type || "reminder_2h"; // 'reminder_2h' | 'new_booking' | 'cancellation' | 'payment'

    if (type === "reminder_2h") {
      // Find latest appointment
      const [apt] = await db
        .select({
          id: appointments.id,
          startTime: appointments.startTime,
          clientName: clients.name,
        })
        .from(appointments)
        .leftJoin(clients, eq(appointments.clientId, clients.id))
        .where(eq(appointments.companyId, companyId))
        .orderBy(desc(appointments.appointmentDate))
        .limit(1);

      const timeFormatted = apt?.startTime ? apt.startTime.slice(0, 5) : "15:00";
      const customer = apt?.clientName || "Cliente VIP";
      const title = "⏰ Lembrete de Agendamento (Simulação)";
      const messageBody = `Lembrete automático: ${customer} possui agendamento hoje às ${timeFormatted}.`;

      const notifId = await NotificationService.createNotification({
        companyId,
        userId: auth.user.userId,
        type: "booking.reminder",
        title,
        body: messageBody,
        entityType: "appointment",
        entityId: apt?.id || null,
      });

      // Force-process any pending notification logs
      let processed = 0;
      try {
        processed = await processBookingNotifications(10);
      } catch {}

      return NextResponse.json({
        data: {
          ok: true,
          id: notifId,
          type: "reminder_2h",
          title,
          body: messageBody,
          processedLogs: processed,
          timestamp: new Date().toISOString(),
        },
      });
    }

    if (type === "new_booking") {
      const title = "📅 Novo agendamento online";
      const messageBody = "Um cliente acabou de agendar um horário pelo seu link público!";
      const notifId = await NotificationService.createNotification({
        companyId,
        userId: auth.user.userId,
        type: "booking.created",
        title,
        body: messageBody,
        entityType: "appointment",
      });

      return NextResponse.json({
        data: {
          ok: true,
          id: notifId,
          type: "new_booking",
          title,
          body: messageBody,
          timestamp: new Date().toISOString(),
        },
      });
    }

    if (type === "payment") {
      const title = "💰 Pagamento confirmado";
      const messageBody = "Recebimento de R$ 120,00 via PIX confirmado com sucesso.";
      const notifId = await NotificationService.createNotification({
        companyId,
        userId: auth.user.userId,
        type: "payment.received",
        title,
        body: messageBody,
        entityType: "financial",
      });

      return NextResponse.json({
        data: {
          ok: true,
          id: notifId,
          type: "payment",
          title,
          body: messageBody,
          timestamp: new Date().toISOString(),
        },
      });
    }

    const notifId = await NotificationService.createNotification({
      companyId,
      userId: auth.user.userId,
      type: "system.alert",
      title: "🔔 Alerta do Sistema",
      body: "Simulação de notificação do sistema executada com sucesso.",
      entityType: "system",
    });

    return NextResponse.json({
      data: {
        ok: true,
        id: notifId,
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
