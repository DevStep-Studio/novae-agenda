import { processBookingNotifications } from "@/lib/booking/notifications";

export const dynamic = "force-dynamic";

/**
 * Triggers the booking reminder/confirmation worker (24h + 2h before the
 * appointment). The queueing logic (notification_logs, dedupe, revision-aware
 * skip on reschedule/cancel) already exists in lib/booking/notifications.ts —
 * this route is just the missing "someone calls it on a schedule" piece.
 * Without an external trigger hitting this URL periodically, no reminder is
 * ever sent in production.
 *
 * Works with any of:
 *  - Vercel Cron Jobs (add to vercel.json, see docs/agendamento-publico.md)
 *  - an external pinger (cron-job.org, GitHub Actions schedule, UptimeRobot)
 *  - a traditional crontab: `curl -fsS https://.../api/cron/booking-notifications?secret=$CRON_SECRET`
 *
 * Protected by CRON_SECRET (checked via `Authorization: Bearer <secret>` or
 * `?secret=` query param) so it can't be triggered by a random visitor.
 */
export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/booking-notifications] CRON_SECRET is not configured — refusing to run.");
    return Response.json(
      { error: "CRON_SECRET não configurado no servidor." },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const queryParam = new URL(request.url).searchParams.get("secret");
  const provided = bearer ?? queryParam;

  if (provided !== secret) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const processed = await processBookingNotifications();
    return Response.json({ data: { processed } });
  } catch (error) {
    console.error("[cron/booking-notifications] failed:", error);
    return Response.json(
      { error: "Falha ao processar lembretes." },
      { status: 500 },
    );
  }
}
