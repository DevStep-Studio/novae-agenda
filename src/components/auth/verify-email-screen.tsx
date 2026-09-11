"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, LogOut, MailCheck, RotateCcw } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { ReserveiLogo } from "@/components/brand/novae-logo";

type Props = {
  /** Present when the user arrived from a "?verify=" e-mail link. */
  token?: string;
  /** The address we're waiting on, shown in the pending state. */
  email?: string;
  /** Whether a session exists (enables the in-app "resend" button). */
  authenticated: boolean;
  onVerified: () => void;
  onLogout?: () => void;
};

export function VerifyEmailScreen({ token, email, authenticated, onVerified, onLogout }: Props) {
  const [status, setStatus] = useState<"idle" | "checking" | "ok" | "error">(token ? "checking" : "idle");
  const [message, setMessage] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    (async () => {
      try {
        await api("/api/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) });
        setStatus("ok");
        setMessage("E-mail confirmado com sucesso.");
        setTimeout(onVerified, 1200);
      } catch (err) {
        setStatus("error");
        setMessage(err instanceof ApiError ? err.message : "Não foi possível confirmar o e-mail.");
      }
    })();
  }, [token, onVerified]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((v) => (v <= 1 ? 0 : v - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const resend = async () => {
    if (resending || cooldown > 0) return;
    setResending(true);
    setMessage(null);
    try {
      const res = await api<{ message: string }>("/api/auth/resend-verification", { method: "POST" });
      setMessage(res?.message ?? "Enviamos um novo link de confirmação.");
      setCooldown(30);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Erro ao reenviar. Tente novamente.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-brand">
        <ReserveiLogo size={40} priority />
      </div>

      <div className="auth-card">
        <div className="auth-view-animated">
          <div className="auth-recovery-header">
            <div className="auth-recovery-badge">
              <MailCheck size={13} />
              Confirmação de e-mail
            </div>
            <h1>
              {status === "checking" && "Confirmando..."}
              {status === "ok" && "E-mail confirmado"}
              {status === "error" && "Não foi possível confirmar"}
              {status === "idle" && "Confirme seu e-mail"}
            </h1>
            <p className="auth-subtitle">
              {status === "checking" && "Validando seu link de confirmação."}
              {status === "ok" && "Sua conta está ativada. Redirecionando..."}
              {status === "error" && (message ?? "O link é inválido ou expirou.")}
              {status === "idle" && (
                <>
                  Enviamos um link de confirmação
                  {email ? (
                    <>
                      {" "}
                      para <strong>{email}</strong>
                    </>
                  ) : null}
                  . Abra o e-mail para ativar sua conta.
                </>
              )}
            </p>
          </div>

          {status === "ok" && (
            <div className="auth-success-banner">
              <CheckCircle2 size={15} />
              <span>{message}</span>
            </div>
          )}
          {status !== "ok" && message && status !== "error" && (
            <div className="auth-success-banner">
              <CheckCircle2 size={15} />
              <span>{message}</span>
            </div>
          )}
          {status === "error" && message && (
            <div className="auth-error">
              <span>{message}</span>
            </div>
          )}

          {status !== "ok" && status !== "checking" && (
            <div className="auth-actions-split">
              {authenticated ? (
                <button type="button" className="auth-submit" onClick={resend} disabled={resending || cooldown > 0}>
                  <RotateCcw size={14} />
                  {cooldown > 0 ? `Reenviar em ${cooldown}s` : resending ? "Enviando..." : "Reenviar e-mail"}
                </button>
              ) : (
                <button type="button" className="auth-submit" onClick={onVerified}>
                  Ir para o login
                </button>
              )}
              {onLogout && (
                <button type="button" className="auth-dark-btn" onClick={onLogout}>
                  <LogOut size={14} /> Sair
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <p className="auth-footer">reservei · gestão e agendamento inteligente</p>
    </div>
  );
}
