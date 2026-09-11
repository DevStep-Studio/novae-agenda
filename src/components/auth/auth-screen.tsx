"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  KeyRound,
  CheckCircle2,
  MailCheck,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { useStore } from "@/store/store";
import { ReserveiLogo } from "@/components/brand/novae-logo";

type Mode = "login" | "register" | "forgot-password";
type RecoveryStep = "request_email" | "email_sent";

export function AuthScreen({ onAuthenticated }: { onAuthenticated: (needsOnboarding: boolean) => void }) {
  const { reloadSession } = useStore();
  const [mode, setMode] = useState<Mode>("login");
  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>("request_email");

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  // Recovery states
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Feedback states
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Resend cooldown timer countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setError(null);
    setSuccessBanner(null);
    if (newMode === "forgot-password") {
      setRecoveryStep("request_email");
      setRecoveryEmail(email);
    }
  };

  const handleOpenForgotPassword = () => {
    setRecoveryEmail(email);
    setRecoveryStep("request_email");
    setError(null);
    setSuccessBanner(null);
    setMode("forgot-password");
  };

  // Submit for Login / Register
  const submitAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccessBanner(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await api<{ data: { userId: string; targetPortal?: string } }>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const updatedSession = await reloadSession();
        onAuthenticated(Boolean(!updatedSession?.company?.onboarded && updatedSession?.primaryRole !== "client"));
      } else {
        await api("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({ name: name.trim(), email: email.trim(), password, confirmPassword }),
        });
        const updatedSession = await reloadSession();
        onAuthenticated(Boolean(!updatedSession?.company?.onboarded && updatedSession?.primaryRole !== "client"));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível concluir. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // Submit email for Forgot Password (Google-style Step 1)
  const submitRecoveryEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!recoveryEmail.trim()) {
      setError("Informe seu endereço de e-mail.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api<{ success: boolean; message: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: recoveryEmail.trim() }),
      });
      setRecoveryStep("email_sent");
      setResendCooldown(30);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível processar a recuperação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // Resend recovery email
  const handleResendRecoveryEmail = async () => {
    if (resendCooldown > 0 || loading) return;
    setError(null);
    setLoading(true);
    try {
      await api<{ success: boolean; message: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: recoveryEmail.trim() }),
      });
      setResendCooldown(30);
      setSuccessBanner("Instruções reenviadas com sucesso!");
      setTimeout(() => setSuccessBanner(null), 4000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao reenviar e-mail.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-brand">
        <ReserveiLogo size={40} priority />
      </div>

      <div className="auth-card">
        {/* ========================================================= */}
        {/* RECOVERY MODE (Esqueci minha senha - Inspirado no Google) */}
        {/* ========================================================= */}
        {mode === "forgot-password" ? (
          <div className="auth-view-animated">
            {recoveryStep === "request_email" && (
              <>
                <div className="auth-recovery-header">
                  <div className="auth-recovery-badge">
                    <KeyRound size={13} />
                    Recuperação de conta
                  </div>
                  <h1>Recuperar acesso</h1>
                  <p className="auth-subtitle">
                    Informe o e-mail cadastrado na sua conta para receber as instruções de recuperação.
                  </p>
                </div>

                {error && (
                  <div className="auth-error">
                    <span>{error}</span>
                  </div>
                )}

                <div className="auth-info-banner">
                  <ShieldCheck size={16} />
                  <div>
                    <strong>Recuperação segura</strong>
                    <div>Enviaremos um link de confirmação para validar a propriedade da sua conta.</div>
                  </div>
                </div>

                <form onSubmit={submitRecoveryEmail} className="auth-form">
                  <label className="field">
                    <span className="field-label">E-mail cadastrado</span>
                    <div className="input-with-icon">
                      <Mail size={15} />
                      <input
                        className="input"
                        type="email"
                        value={recoveryEmail}
                        onChange={(e) => setRecoveryEmail(e.target.value)}
                        placeholder="voce@email.com"
                        autoComplete="email"
                        required
                        autoFocus
                      />
                    </div>
                  </label>

                  <div className="auth-actions-split">
                    <button
                      type="button"
                      className="auth-dark-btn"
                      onClick={() => handleModeChange("login")}
                    >
                      <ArrowLeft size={14} /> Voltar ao login
                    </button>
                    <button type="submit" className="auth-submit" disabled={loading}>
                      {loading ? "Aguarde..." : "Avançar"} {!loading && <ArrowRight size={16} />}
                    </button>
                  </div>
                </form>
              </>
            )}

            {recoveryStep === "email_sent" && (
              <>
                <div className="auth-recovery-header">
                  <div className="auth-recovery-badge">
                    <MailCheck size={13} />
                    Instruções enviadas
                  </div>
                  <h1>Verifique seu e-mail</h1>
                  <p className="auth-subtitle">
                    Instruções de redefinição foram enviadas para o endereço informado.
                  </p>
                </div>

                {successBanner && (
                  <div className="auth-success-banner">
                    <CheckCircle2 size={15} />
                    <span>{successBanner}</span>
                  </div>
                )}
                {error && (
                  <div className="auth-error">
                    <span>{error}</span>
                  </div>
                )}

                <div className="auth-success-card">
                  <div className="auth-success-icon">
                    <MailCheck size={26} />
                  </div>
                  <div className="auth-email-pill">
                    <Mail size={13} />
                    <span>{recoveryEmail}</span>
                  </div>
                  <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "12px", lineHeight: 1.5, maxWidth: "320px" }}>
                    Abra sua caixa de entrada e clique no link de recuperação. O link expira em 1 hora.
                  </p>
                </div>

                <div className="auth-actions-split">
                  <button
                    type="button"
                    className="auth-submit"
                    onClick={() => handleModeChange("login")}
                  >
                    <ArrowLeft size={14} /> Voltar ao login
                  </button>
                </div>

                <div className="auth-resend-row">
                  <span>Não recebeu o e-mail?</span>
                  <button
                    type="button"
                    className="auth-link"
                    disabled={resendCooldown > 0 || loading}
                    onClick={handleResendRecoveryEmail}
                    style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                  >
                    <RotateCcw size={12} />
                    {resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : "Reenviar e-mail"}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          /* ========================================================= */
          /* LOGIN / REGISTER MODE                                      */
          /* ========================================================= */
          <div className="auth-view-animated">
            <h1>
              {mode === "login" ? "Bem-vindo ao Nova(e)" : "Crie sua conta"}
            </h1>
            <p className="auth-subtitle">
              {mode === "login"
                ? "Entre com seu e-mail e senha para acessar o sistema."
                : "Agendamentos simples e gestão completa em um só lugar."}
            </p>

            <div className="auth-tabs">
              <button
                type="button"
                className={mode === "login" ? "active" : ""}
                onClick={() => handleModeChange("login")}
              >
                Entrar
              </button>
              <button
                type="button"
                className={mode === "register" ? "active" : ""}
                onClick={() => handleModeChange("register")}
              >
                Criar conta
              </button>
            </div>

            {successBanner && (
              <div className="auth-success-banner">
                <CheckCircle2 size={15} />
                <span>{successBanner}</span>
              </div>
            )}

            {error && (
              <div className="auth-error">
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={submitAuth} className="auth-form">
              {mode === "register" && (
                <label className="field">
                  <span className="field-label">Nome</span>
                  <div className="input-with-icon">
                    <User size={15} />
                    <input
                      className="input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Seu nome completo"
                      autoComplete="name"
                      required
                      minLength={2}
                    />
                  </div>
                </label>
              )}
              <label className="field">
                <span className="field-label">E-mail</span>
                <div className="input-with-icon">
                  <Mail size={15} />
                  <input
                    className="input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@email.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </label>
              <label className="field">
                <span className="field-label">Senha</span>
                <div className="input-with-icon">
                  <Lock size={15} />
                  <input
                    className="input"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    className="input-eye"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label="Mostrar senha"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {mode === "register" && <span className="field-hint">Pelo menos 8 caracteres</span>}
              </label>
              {mode === "register" && (
                <label className="field">
                  <span className="field-label">Confirmar senha</span>
                  <div className="input-with-icon">
                    <Lock size={15} />
                    <input
                      className="input"
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                      minLength={8}
                    />
                  </div>
                </label>
              )}

              {mode === "login" && (
                <div className="auth-row">
                  <label className="remember">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                    />
                    <span>Lembrar meu acesso</span>
                  </label>
                  <button
                    type="button"
                    className="auth-link"
                    onClick={handleOpenForgotPassword}
                  >
                    Esqueci minha senha
                  </button>
                </div>
              )}

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}{" "}
                {!loading && <ArrowRight size={16} />}
              </button>
            </form>

            <button
              type="button"
              className="auth-back"
              onClick={() => handleModeChange(mode === "login" ? "register" : "login")}
            >
              <ArrowLeft size={14} /> {mode === "login" ? "Ainda não tenho conta" : "Já tenho uma conta"}
            </button>
          </div>
        )}
      </div>
      <p className="auth-footer">reservei · gestão e agendamento inteligente</p>
    </div>
  );
}
