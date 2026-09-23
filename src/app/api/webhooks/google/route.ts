import { NextResponse } from "next/server";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Webhook para Real-Time Developer Notifications (RTDN) do Google Play
 * Recebe mensagens publicadas via Google Cloud Pub/Sub
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body?.message?.data) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    // Decodifica a mensagem Base64 do Google Cloud Pub/Sub
    const decodedString = Buffer.from(body.message.data, "base64").toString("utf-8");
    const notification = JSON.parse(decodedString);

    const subNotification = notification?.subscriptionNotification;
    if (subNotification?.purchaseToken) {
      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.gatewaySubscriptionId, subNotification.purchaseToken))
        .limit(1);

      if (sub) {
        // Notification types: 1=RECOVERED, 2=RENEWED, 3=CANCELED, 5=ON_HOLD, 6=IN_GRACE_PERIOD, 12=REVOKED, 13=EXPIRED
        const notifType = subNotification.notificationType;
        let newStatus = sub.status;

        if (notifType === 1 || notifType === 2) {
          newStatus = "active";
        } else if (notifType === 3) {
          newStatus = "cancelled";
        } else if (notifType === 5 || notifType === 6) {
          newStatus = "past_due";
        } else if (notifType === 12 || notifType === 13) {
          newStatus = "expired";
        }

        await db
          .update(subscriptions)
          .set({ status: newStatus, updatedAt: new Date() })
          .where(eq(subscriptions.id, sub.id));
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[webhooks/google] Erro ao processar RTDN:", error);
    return NextResponse.json({ error: "Erro interno no processamento do webhook." }, { status: 500 });
  }
}
