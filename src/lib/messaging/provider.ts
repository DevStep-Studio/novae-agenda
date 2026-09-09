import { sendMail, bookingConfirmationEmail } from "@/lib/mailer";
import { formatPhoneForWhatsApp } from "@/lib/api-client";

export type BookingNotificationPayload = {
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  companyName: string;
  serviceName: string;
  date: string;
  time: string;
  bookingId: string;
  link?: string;
};

export type NotificationResult = {
  ok: boolean;
  channel: "email" | "whatsapp" | "in_app";
  error?: string;
  deepLink?: string;
};

export interface MessagingProvider {
  sendBookingConfirmation(payload: BookingNotificationPayload): Promise<NotificationResult>;
  sendBookingReminder(payload: BookingNotificationPayload): Promise<NotificationResult>;
  sendCancellation(payload: BookingNotificationPayload): Promise<NotificationResult>;
  sendReschedule(payload: BookingNotificationPayload): Promise<NotificationResult>;
}

export class EmailMessagingProvider implements MessagingProvider {
  async sendBookingConfirmation(payload: BookingNotificationPayload): Promise<NotificationResult> {
    if (!payload.customerEmail) {
      return { ok: false, channel: "email", error: "missing_email" };
    }
    const message = bookingConfirmationEmail({
      customerName: payload.customerName,
      companyName: payload.companyName,
      serviceName: payload.serviceName,
      date: payload.date,
      time: payload.time,
      link: payload.link,
    });
    message.to = payload.customerEmail;
    const res = await sendMail(message);
    return { ok: res.ok, channel: "email", error: res.error };
  }

  async sendBookingReminder(payload: BookingNotificationPayload): Promise<NotificationResult> {
    if (!payload.customerEmail) return { ok: false, channel: "email", error: "missing_email" };
    const res = await sendMail({
      to: payload.customerEmail,
      subject: `Lembrete: Atendimento amanhã em ${payload.companyName}`,
      html: `<p>Olá, ${payload.customerName}! Lembrando que seu horário para <strong>${payload.serviceName}</strong> em <strong>${payload.companyName}</strong> está confirmado para <strong>${payload.date} às ${payload.time}</strong>.</p>`,
      text: `Olá, ${payload.customerName}! Lembrando que seu atendimento de ${payload.serviceName} em ${payload.companyName} é dia ${payload.date} às ${payload.time}.`,
    });
    return { ok: res.ok, channel: "email", error: res.error };
  }

  async sendCancellation(payload: BookingNotificationPayload): Promise<NotificationResult> {
    if (!payload.customerEmail) return { ok: false, channel: "email", error: "missing_email" };
    const res = await sendMail({
      to: payload.customerEmail,
      subject: `Agendamento cancelado: ${payload.serviceName} em ${payload.companyName}`,
      html: `<p>Olá, ${payload.customerName}. Seu atendimento de <strong>${payload.serviceName}</strong> no dia <strong>${payload.date} às ${payload.time}</strong> foi cancelado.</p>`,
      text: `Olá, ${payload.customerName}. Seu atendimento de ${payload.serviceName} no dia ${payload.date} às ${payload.time} foi cancelado.`,
    });
    return { ok: res.ok, channel: "email", error: res.error };
  }

  async sendReschedule(payload: BookingNotificationPayload): Promise<NotificationResult> {
    if (!payload.customerEmail) return { ok: false, channel: "email", error: "missing_email" };
    const res = await sendMail({
      to: payload.customerEmail,
      subject: `Agendamento remarcado: ${payload.serviceName} em ${payload.companyName}`,
      html: `<p>Olá, ${payload.customerName}. Seu atendimento de <strong>${payload.serviceName}</strong> foi remarcado para <strong>${payload.date} às ${payload.time}</strong>.</p>`,
      text: `Olá, ${payload.customerName}. Seu atendimento de ${payload.serviceName} foi remarcado para ${payload.date} às ${payload.time}.`,
    });
    return { ok: res.ok, channel: "email", error: res.error };
  }
}

export class WhatsAppMessagingProvider implements MessagingProvider {
  private apiUrl = process.env.WHATSAPP_API_URL;
  private apiToken = process.env.WHATSAPP_API_TOKEN;

  buildWhatsAppUrl(phone: string, text: string): string {
    const formatted = formatPhoneForWhatsApp(phone);
    return `https://wa.me/${formatted}?text=${encodeURIComponent(text)}`;
  }

  private async dispatchOrGenerateLink(
    phone: string | undefined | null,
    text: string,
  ): Promise<NotificationResult> {
    if (!phone) {
      return { ok: false, channel: "whatsapp", error: "missing_phone" };
    }

    const deepLink = this.buildWhatsAppUrl(phone, text);

    // If external WhatsApp API provider is configured, dispatch HTTP POST
    if (this.apiUrl && this.apiToken) {
      try {
        const res = await fetch(this.apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiToken}`,
          },
          body: JSON.stringify({
            phone: formatPhoneForWhatsApp(phone),
            message: text,
          }),
          signal: AbortSignal.timeout(10000),
        });
        return { ok: res.ok, channel: "whatsapp", deepLink };
      } catch (err) {
        console.error("[WhatsAppProvider] API dispatch error:", err);
        return { ok: false, channel: "whatsapp", error: "api_failed", deepLink };
      }
    }

    // Default development mode: link ready for manual or automated dispatch
    console.info(`[WhatsAppProvider] Link gerado: ${deepLink}`);
    return { ok: true, channel: "whatsapp", deepLink };
  }

  async sendBookingConfirmation(payload: BookingNotificationPayload): Promise<NotificationResult> {
    const text = `Olá, ${payload.customerName}! Seu agendamento de *${payload.serviceName}* no *${payload.companyName}* foi confirmado para *${payload.date} às ${payload.time}*.`;
    return this.dispatchOrGenerateLink(payload.customerPhone, text);
  }

  async sendBookingReminder(payload: BookingNotificationPayload): Promise<NotificationResult> {
    const text = `Olá, ${payload.customerName}! Lembrando do seu atendimento de *${payload.serviceName}* no *${payload.companyName}* amanhã, *${payload.date} às ${payload.time}*.`;
    return this.dispatchOrGenerateLink(payload.customerPhone, text);
  }

  async sendCancellation(payload: BookingNotificationPayload): Promise<NotificationResult> {
    const text = `Olá, ${payload.customerName}. Seu agendamento de *${payload.serviceName}* no *${payload.companyName}* (${payload.date} às ${payload.time}) foi cancelado.`;
    return this.dispatchOrGenerateLink(payload.customerPhone, text);
  }

  async sendReschedule(payload: BookingNotificationPayload): Promise<NotificationResult> {
    const text = `Olá, ${payload.customerName}! Seu atendimento de *${payload.serviceName}* no *${payload.companyName}* foi remarcado para *${payload.date} às ${payload.time}*.`;
    return this.dispatchOrGenerateLink(payload.customerPhone, text);
  }
}

export class CompositeMessagingProvider implements MessagingProvider {
  private emailProvider = new EmailMessagingProvider();
  private whatsappProvider = new WhatsAppMessagingProvider();

  async sendBookingConfirmation(payload: BookingNotificationPayload): Promise<NotificationResult> {
    if (payload.customerPhone) {
      this.whatsappProvider.sendBookingConfirmation(payload).catch((e) => console.error(e));
    }
    if (payload.customerEmail) {
      return this.emailProvider.sendBookingConfirmation(payload);
    }
    return { ok: true, channel: "whatsapp" };
  }

  async sendBookingReminder(payload: BookingNotificationPayload): Promise<NotificationResult> {
    if (payload.customerPhone) {
      this.whatsappProvider.sendBookingReminder(payload).catch((e) => console.error(e));
    }
    if (payload.customerEmail) {
      return this.emailProvider.sendBookingReminder(payload);
    }
    return { ok: true, channel: "whatsapp" };
  }

  async sendCancellation(payload: BookingNotificationPayload): Promise<NotificationResult> {
    if (payload.customerPhone) {
      this.whatsappProvider.sendCancellation(payload).catch((e) => console.error(e));
    }
    if (payload.customerEmail) {
      return this.emailProvider.sendCancellation(payload);
    }
    return { ok: true, channel: "whatsapp" };
  }

  async sendReschedule(payload: BookingNotificationPayload): Promise<NotificationResult> {
    if (payload.customerPhone) {
      this.whatsappProvider.sendReschedule(payload).catch((e) => console.error(e));
    }
    if (payload.customerEmail) {
      return this.emailProvider.sendReschedule(payload);
    }
    return { ok: true, channel: "whatsapp" };
  }
}

export const messagingProvider = new CompositeMessagingProvider();
