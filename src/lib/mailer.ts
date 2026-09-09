/**
 * Provider-agnostic transactional e-mail.
 *
 * Transport is chosen by EMAIL_TRANSPORT:
 *   - "console" (default) — logs the message to the server console. Nothing leaves the machine.
 *   - "resend"            — POSTs to the Resend API. Requires RESEND_API_KEY and EMAIL_FROM.
 *
 * No SDK dependency: Resend is called with fetch so the architecture stays swappable.
 */

export type MailMessage = {
  idempotencyKey?: string;
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendResult = { ok: boolean; transport: string; error?: string };

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function transport(): "console" | "resend" {
  return process.env.EMAIL_TRANSPORT === "resend" ? "resend" : "console";
}

export async function sendMail(message: MailMessage): Promise<SendResult> {
  const kind = transport();

  if (kind === "resend") {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) {
      console.error("[mailer] EMAIL_TRANSPORT=resend but RESEND_API_KEY / EMAIL_FROM are missing");
      return { ok: false, transport: "resend", error: "missing_config" };
    }
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", ...(message.idempotencyKey ? {"Idempotency-Key":message.idempotencyKey} : {}) },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ from, to: message.to, subject: message.subject, html: message.html, text: message.text }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error(`[mailer] resend responded ${res.status}: ${detail}`);
        return { ok: false, transport: "resend", error: `http_${res.status}` };
      }
      return { ok: true, transport: "resend" };
    } catch (error) {
      console.error("[mailer] resend request failed", error);
      return { ok: false, transport: "resend", error: "network" };
    }
  }

  console.info(
    `\n──────────── e-mail (console transport) ────────────\n` +
      `To:      ${message.to}\n` +
      `Subject: ${message.subject}\n\n` +
      `${message.text}\n` +
      `───────────────────────────────────────────────────\n`,
  );
  return { ok: true, transport: "console" };
}

/* ---------- Templates (Reservei identity: dark forest #12231b, electric lime #dcff4c) ---------- */

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function layout(heading: string, bodyHtml: string, cta?: { label: string; href: string }): string {
  const button = cta
    ? `<a href="${cta.href}" style="display:inline-block;margin:24px 0;padding:12px 24px;background:#dcff4c;color:#12231b;border-radius:8px;font-weight:700;text-decoration:none">${cta.label}</a>`
    : "";
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#0f1f18;font-family:Arial,Helvetica,sans-serif;color:#f2f7f4">
<div style="max-width:520px;margin:0 auto;padding:32px 16px">
  <div style="font-weight:700;font-size:22px;letter-spacing:-0.5px;color:#dcff4c;margin-bottom:24px">Reservei</div>
  <div style="background:#162a22;border:1px solid rgba(220,255,76,0.2);border-radius:16px;padding:28px">
    <h1 style="margin:0 0 12px;font-size:18px">${heading}</h1>
    ${bodyHtml}
    ${button}
    ${cta ? `<p style="margin:16px 0 0;font-size:12px;color:#6f7d79;word-break:break-all">Se o botão não funcionar, copie e cole este endereço no navegador:<br>${cta.href}</p>` : ""}
  </div>
  <p style="margin:20px 0 0;font-size:11px;color:#98a5a1;text-align:center">Reservei · plataforma comercial de agendamentos e gestão</p>
</div></body></html>`;
}

export function verificationEmail(name: string, link: string): MailMessage {
  const first = name.split(" ")[0] || name;
  return {
    to: "",
    subject: "Reservei: Confirme seu endereço de e-mail",
    html: layout(
      "Confirme seu e-mail",
      `<p style="margin:0;font-size:14px;line-height:1.6">Olá, ${escapeHtml(first)}. Falta um passo para ativar sua conta no Reservei. Confirme que este endereço é seu clicando no botão abaixo. O link expira em 24 horas.</p>`,
      { label: "Confirmar meu e-mail", href: link },
    ),
    text: `Olá, ${first}.\n\nConfirme seu e-mail para ativar sua conta no Reservei:\n${link}\n\nO link expira em 24 horas. Se você não criou esta conta, ignore este e-mail.`,
  };
}

export function passwordResetEmail(name: string, link: string): MailMessage {
  const first = name.split(" ")[0] || name;
  return {
    to: "",
    subject: "Reservei: Solicitação de redefinição de senha",
    html: layout(
      "Redefina sua senha",
      `<p style="margin:0;font-size:14px;line-height:1.6">Olá, ${escapeHtml(first)}. Recebemos um pedido para redefinir a senha da sua conta no Reservei. Clique no botão abaixo para escolher uma nova senha. O link expira em 1 hora.</p>`,
      { label: "Redefinir minha senha", href: link },
    ),
    text: `Olá, ${first}.\n\nRecebemos um pedido para redefinir sua senha no Reservei:\n${link}\n\nO link expira em 1 hora. Se não foi você, ignore este e-mail — sua senha continua a mesma.`,
  };
}

export function bookingConfirmationEmail(input: {
  customerName: string;
  companyName: string;
  serviceName: string;
  date: string;
  time: string;
  link?: string;
}): MailMessage {
  const first = input.customerName.split(" ")[0] || input.customerName;
  return {
    to: "",
    subject: `Agendamento confirmado: ${input.serviceName} em ${input.companyName}`,
    html: layout(
      "Agendamento Confirmado!",
      `<p style="margin:0 0 16px;font-size:14px;line-height:1.6">Olá, ${escapeHtml(first)}. Seu agendamento foi confirmado com sucesso.</p>
       <div style="background:#0f1f18;padding:16px;border-radius:8px;margin-bottom:16px">
         <p style="margin:4px 0;font-size:13px"><strong>Estabelecimento:</strong> ${escapeHtml(input.companyName)}</p>
         <p style="margin:4px 0;font-size:13px"><strong>Serviço:</strong> ${escapeHtml(input.serviceName)}</p>
         <p style="margin:4px 0;font-size:13px"><strong>Data:</strong> ${escapeHtml(input.date)} às ${escapeHtml(input.time)}</p>
       </div>`,
      input.link ? { label: "Ver agendamento", href: input.link } : undefined,
    ),
    text: `Olá, ${first}.\n\nSeu agendamento de ${input.serviceName} no ${input.companyName} foi confirmado para ${input.date} às ${input.time}.`,
  };
}
