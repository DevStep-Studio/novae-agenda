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
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
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

/* ---------- Templates (Nova(e) identity: teal #1f6f66, white, soft borders) ---------- */

function layout(heading: string, bodyHtml: string, cta?: { label: string; href: string }): string {
  const button = cta
    ? `<a href="${cta.href}" style="display:inline-block;margin:24px 0;padding:12px 22px;background:#1f6f66;color:#ffffff;border-radius:8px;font-weight:600;text-decoration:none">${cta.label}</a>`
    : "";
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f5f8f7;font-family:Arial,Helvetica,sans-serif;color:#172522">
<div style="max-width:520px;margin:0 auto;padding:32px 16px">
  <div style="font-weight:700;font-size:20px;letter-spacing:-0.5px;color:#1f6f66;margin-bottom:24px">Nova(e)</div>
  <div style="background:#ffffff;border:1px solid #e3ebe8;border-radius:16px;padding:28px">
    <h1 style="margin:0 0 12px;font-size:18px">${heading}</h1>
    ${bodyHtml}
    ${button}
    ${cta ? `<p style="margin:16px 0 0;font-size:12px;color:#6f7d79;word-break:break-all">Se o botão não funcionar, copie e cole este endereço no navegador:<br>${cta.href}</p>` : ""}
  </div>
  <p style="margin:20px 0 0;font-size:11px;color:#98a5a1;text-align:center">Nova(e) · gestão de agenda para o seu negócio</p>
</div></body></html>`;
}

export function verificationEmail(name: string, link: string): MailMessage {
  const first = name.split(" ")[0] || name;
  return {
    to: "",
    subject: "Confirme seu endereço de e-mail",
    html: layout(
      "Confirme seu e-mail",
      `<p style="margin:0;font-size:14px;line-height:1.6">Olá, ${first}. Falta um passo para ativar sua conta na Nova(e). Confirme que este endereço é seu clicando no botão abaixo. O link expira em 24 horas.</p>`,
      { label: "Confirmar meu e-mail", href: link },
    ),
    text: `Olá, ${first}.\n\nConfirme seu e-mail para ativar sua conta na Nova(e):\n${link}\n\nO link expira em 24 horas. Se você não criou esta conta, ignore este e-mail.`,
  };
}

export function passwordResetEmail(name: string, link: string): MailMessage {
  const first = name.split(" ")[0] || name;
  return {
    to: "",
    subject: "Solicitação de redefinição de senha",
    html: layout(
      "Redefina sua senha",
      `<p style="margin:0;font-size:14px;line-height:1.6">Olá, ${first}. Recebemos um pedido para redefinir a senha da sua conta Nova(e). Clique no botão abaixo para escolher uma nova senha. O link expira em 1 hora.</p>`,
      { label: "Redefinir minha senha", href: link },
    ),
    text: `Olá, ${first}.\n\nRecebemos um pedido para redefinir sua senha na Nova(e):\n${link}\n\nO link expira em 1 hora. Se não foi você, ignore este e-mail — sua senha continua a mesma.`,
  };
}
