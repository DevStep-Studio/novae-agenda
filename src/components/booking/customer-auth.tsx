"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api-client";
import { b, ErrorMessage } from "./primitives";
export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  emailVerified: boolean;
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
      <p className={b.muted} role="status">
        Verificando sua conta…
      </p>
    );
  if (user)
    return (
      <div className={b.auth}>
        <h3>Olá, {user.name.split(" ")[0]}.</h3>
        <p className={b.muted}>
          Enviamos um link para <strong>{user.email}</strong>. Confirme seu
          e-mail para concluir a reserva. Sua seleção está salva neste
          navegador.
        </p>
        <ErrorMessage message={error} />
        {message && <p role="status">{message}</p>}
        <button
          className={`${b.button} ${b.wide}`}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await refresh();
              setMessage(
                "Se já confirmou, sua conta será atualizada. Você também pode abrir o link recebido por e-mail.",
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Já confirmei meu e-mail
        </button>
        <button
          className={b.textButton}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api("/api/auth/resend-verification", {
                method: "POST",
                body: JSON.stringify({ returnTo }),
              });
              setMessage("Um novo link de confirmação foi enviado.");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Reenviar confirmação
        </button>
        <button
          className={b.textButton}
          onClick={async () => {
            await api("/api/auth/logout", { method: "POST" });
            setUser(null);
          }}
        >
          Entrar com outra conta
        </button>
      </div>
    );
  return (
    <div className={b.auth}>
      <div className={b.authTabs}>
        <button
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
