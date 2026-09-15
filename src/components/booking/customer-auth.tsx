"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api-client";
import { b, ErrorMessage } from "./primitives";
import {
  Mail,
  CheckCircle2,
  RefreshCw,
  Send,
  LogOut,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export type Customer = {
  id: string;
  name: string;
  email?: string;
  phone: string | null;
  emailVerified?: boolean;
  hasPin?: boolean;
};

export function CustomerAuth({
  onReady,
  returnTo = "/meus-agendamentos",
  requireVerified = true,
}: {
  onReady: (user: Customer) => void;
  returnTo?: string;
  requireVerified?: boolean;
}) {
  const [mode, setMode] = useState<"register" | "login">("register"),
    [user, setUser] = useState<Customer | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");

  async function refresh() {
    const identity = await api<Customer | null>("/api/my/session");
    setUser(identity);
    if (identity && (!requireVerified || identity.emailVerified))
      onReady(identity);
  }

  useEffect(() => {
    let active = true;
    api<Customer | null>("/api/my/session")
      .then((identity) => {
        if (active) {
          setUser(identity);
          setLoading(false);
          if (identity && (!requireVerified || identity.emailVerified))
            onReady(identity);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [onReady, requireVerified]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const data = new FormData(e.currentTarget);
    try {
      const password = String(data.get("password"));
      await api(`/api/auth/${mode === "register" ? "register" : "login"}`, {
        method: "POST",
        body: JSON.stringify({
          email: data.get("email"),
          password,
          ...(mode === "register"
            ? {
                name: data.get("name"),
                phone: data.get("phone"),
                confirmPassword: password,
                accountType: "customer",
                returnTo,
              }
            : {}),
        }),
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <div className={b.authLoading} role="status">
        <RefreshCw className={b.spin} size={16} />
        <span>Verificando sua conta…</span>
      </div>
    );

  if (user) {
    const firstName = user.name ? user.name.split(" ")[0] : "Cliente";

    return (
      <div className={b.authVerifyCard}>
        <div className={b.authVerifyHeader}>
          <div className={b.authVerifyIconBadge}>
            <Mail size={22} />
          </div>
          <div className={b.authVerifyHeaderText}>
            <span className={b.authVerifyTag}>
              <Sparkles size={11} /> Quase pronto
            </span>
            <h3 className={b.authVerifyTitle}>Olá, {firstName}</h3>
          </div>
        </div>

        <div className={b.authEmailBox}>
          <div className={b.authEmailInfo}>
            <span className={b.authEmailLabel}>Link de confirmação enviado para</span>
            <strong className={b.authEmailValue}>{user.email}</strong>
          </div>
          <span className={b.authEmailStatusBadge}>
            Enviado
          </span>
        </div>

        <div className={b.authInfoNotice}>
          <ShieldCheck size={16} className={b.authInfoNoticeIcon} />
          <p>
            Confirme seu e-mail para concluir a reserva. Sua seleção de serviços e horários está salva neste navegador.
          </p>
        </div>

        <ErrorMessage message={error} />
        {message && (
          <div className={b.authStatusBanner} role="status">
            <CheckCircle2 size={16} />
            <span>{message}</span>
          </div>
        )}

        <button
          type="button"
          className={`${b.button} ${b.wide}`}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            setMessage("");
            try {
              const identity = await api<Customer | null>("/api/my/session");
              setUser(identity);
              if (identity?.emailVerified) {
                onReady(identity);
              } else {
                setMessage(
                  "E-mail ainda não verificado. Abra a mensagem recebida na sua caixa de entrada e clique no link de ativação.",
                );
              }
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? (
            <>
              <RefreshCw size={15} className={b.spin} />
              <span>Verificando…</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={16} />
              <span>Já confirmei meu e-mail</span>
            </>
          )}
        </button>

        <div className={b.authSecondaryActions}>
          <button
            type="button"
            className={b.authSecondaryBtn}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              setMessage("");
              try {
                await api("/api/auth/resend-verification", {
                  method: "POST",
                  body: JSON.stringify({ returnTo }),
                });
                setMessage("Um novo link de confirmação foi enviado para seu e-mail.");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Send size={13} />
            <span>Reenviar confirmação</span>
          </button>
          <button
            type="button"
            className={b.authSecondaryBtn}
            onClick={async () => {
              await api("/api/auth/logout", { method: "POST" });
              setUser(null);
            }}
          >
            <LogOut size={13} />
            <span>Entrar com outra conta</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={b.auth}>
      <div className={b.authTabs}>
        <button
          type="button"
          className={mode === "register" ? b.activeTab : ""}
          onClick={() => setMode("register")}
        >
          Criar minha conta
        </button>
        <button
          className={mode === "login" ? b.activeTab : ""}
          onClick={() => setMode("login")}
        >
          Já tenho uma conta
        </button>
      </div>
      <form onSubmit={submit}>
        <ErrorMessage message={error} />
        {mode === "register" && (
          <>
            <label className={b.field}>
              Seu nome
              <input
                name="name"
                autoComplete="name"
                required
                minLength={2}
                maxLength={120}
              />
            </label>
            <label className={b.field}>
              Telefone com DDD
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                required
                minLength={8}
                maxLength={25}
                placeholder="(11) 99999-9999"
              />
            </label>
          </>
        )}
        <label className={b.field}>
          E-mail
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label className={b.field}>
          Senha
          <input
            name="password"
            type="password"
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
            minLength={mode === "register" ? 8 : 1}
            maxLength={72}
            required
          />
        </label>
        <button className={`${b.button} ${b.wide}`} disabled={busy}>
          {busy
            ? "Aguarde…"
            : mode === "register"
              ? "Criar conta e continuar"
              : "Entrar e continuar"}
        </button>

        {mode === "login" && (
          <button
            type="button"
            className={b.textButton}
            onClick={async () => {
              const email = (
                document.querySelector(
                  'input[name="email"]',
                ) as HTMLInputElement
              )?.value;
              if (!email) {
                setError("Informe seu e-mail para recuperar a senha.");
                return;
              }
              try {
                await api("/api/auth/forgot-password", {
                  method: "POST",
                  body: JSON.stringify({ email }),
                });
                setMessage(
                  "Se o e-mail estiver cadastrado, você receberá instruções para recuperar a senha.",
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Esqueci minha senha
          </button>
        )}
        {message && (
          <p role="status" className={b.muted}>
            {message}
          </p>
        )}
      </form>
      <p className={b.muted}>
        Sua conta permite acompanhar, cancelar e remarcar seus horários.
      </p>
    </div>
  );
}
