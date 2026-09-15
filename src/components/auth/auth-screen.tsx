"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  MailCheck,
  RotateCcw,
  Sparkles,
  Sun,
  Moon,
  User,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { useOptionalStore } from "@/store/store";
import { ReserveiLogo } from "@/components/brand/novae-logo";
import { applyTheme, getStoredTheme, resolveTheme } from "@/lib/theme";
import { PasswordStrengthMeter } from "./password-strength-meter";

export type AuthMode = "login" | "register" | "forgot-password" | "reservas";
type RecoveryStep = "request_email" | "email_sent";

interface AuthScreenProps {
  onAuthenticated?: (needsOnboarding: boolean) => void;
  initialMode?: AuthMode;
}

export function AuthScreen({ onAuthenticated, initialMode }: AuthScreenProps) {
  const store = useOptionalStore();

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      return resolveTheme(getStoredTheme());
    }
    return "dark";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const initial = resolveTheme(getStoredTheme());
      setTheme(initial);
      applyTheme(initial);
    }
  }, []);

  const handleSetTheme = (nextTheme: "light" | "dark") => {
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  const greenBtnBg = "#dcff4c";
  const greenBtnHover = "#c8ed32";
  const greenBtnText = "#0a0a0a";
  const greenText = theme === "dark" ? "#dcff4c" : "#3f6212";

  const [mode, setMode] = useState<AuthMode>(() => {
    if (initialMode) return initialMode;
    if (typeof window !== "undefined") {
      const urlMode = new URLSearchParams(window.location.search).get("mode");
      if (
        urlMode === "register" ||
        urlMode === "forgot-password" ||
        urlMode === "reservas"
      ) {
        return urlMode;
      }
    }
    return "login";
  });

  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>("request_email");

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

  const handleModeChange = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setSuccessBanner(null);
    if (newMode === "forgot-password") {
      setRecoveryStep("request_email");
      setRecoveryEmail(email);
    }
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (newMode === "login") {
        url.searchParams.delete("mode");
      } else {
        url.searchParams.set("mode", newMode);
      }
      window.history.replaceState({}, "", url.toString());
    }
  };

  const handleOpenForgotPassword = () => {
    setRecoveryEmail(email);
    setRecoveryStep("request_email");
    setError(null);
    setSuccessBanner(null);
    handleModeChange("forgot-password");
  };

  // Submit for Login, Register or Reservas
  const submitAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccessBanner(null);
    setLoading(true);

    try {
      if (mode === "login" || mode === "reservas") {
        const response = await api<{
          data: { userId: string; targetPortal?: string; role?: string };
        }>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: email.trim(), password }),
        });

        const updatedSession = store ? await store.reloadSession() : null;

        if (mode === "reservas" || response.data?.targetPortal === "/cliente") {
          if (onAuthenticated) {
            onAuthenticated(false);
          } else {
            window.location.assign("/minhas-reservas");
          }
          return;
        }

        if (onAuthenticated) {
          onAuthenticated(
            Boolean(
              !updatedSession?.company?.onboarded &&
                updatedSession?.primaryRole !== "client"
            )
          );
        } else {
          window.location.assign(response.data?.targetPortal || "/gestao");
        }
      } else if (mode === "register") {
        if (password !== confirmPassword) {
          setError("As senhas informadas não conferem.");
          setLoading(false);
          return;
        }

        await api("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            password,
            confirmPassword,
            accountType: "professional",
          }),
        });

        const updatedSession = store ? await store.reloadSession() : null;
        if (onAuthenticated) {
          onAuthenticated(
            Boolean(
              !updatedSession?.company?.onboarded &&
                updatedSession?.primaryRole !== "client"
            )
          );
        } else {
          window.location.assign("/gestao");
        }
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível concluir a ação. Verifique suas credenciais."
      );
    } finally {
      setLoading(false);
    }
  };

  // Quick 1-click Demo for Carlos Silva (Reservas / Cliente)
  const handleCustomerDemo = async () => {
    setError(null);
    setSuccessBanner(null);
    setLoading(true);
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "cliente@email.com",
          password: "senha123",
        }),
      });

      if (store) await store.reloadSession();

      if (onAuthenticated) {
        onAuthenticated(false);
      } else {
        window.location.assign("/minhas-reservas");
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Erro ao entrar como demo."
      );
    } finally {
      setLoading(false);
    }
  };

  // Submit email for Forgot Password
  const submitRecoveryEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!recoveryEmail.trim()) {
      setError("Informe seu endereço de e-mail.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api<{ success: boolean; message: string }>(
        "/api/auth/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({ email: recoveryEmail.trim() }),
        }
      );
      setRecoveryStep("email_sent");
      setResendCooldown(30);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível processar a recuperação. Tente novamente."
      );
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
      await api<{ success: boolean; message: string }>(
        "/api/auth/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({ email: recoveryEmail.trim() }),
        }
      );
      setResendCooldown(30);
      setSuccessBanner("Instruções reenviadas com sucesso!");
      setTimeout(() => setSuccessBanner(null), 4000);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Erro ao reenviar e-mail."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-split-layout">
      {/* ========================================================= */}
      {/* PAINEL ESQUERDO: IMAGEM FORNECIDA PELO USUÁRIO            */}
      {/* ========================================================= */}
      <div className="auth-split-image-pane">
        <Image
          src="/login-img.png"
          alt="Reservei - Agende com facilidade"
          fill
          priority
          sizes="(max-width: 900px) 100vw, 52vw"
          style={{ objectFit: "cover", objectPosition: "center" }}
        />
      </div>

      {/* ========================================================= */}
      {/* PAINEL DIREITO: FORMULÁRIOS DE AUTENTICAÇÃO               */}
      {/* ========================================================= */}
      <div className="auth-split-form-pane">
        {/* Topbar com logo Reservei e seletor de tema Claro / Escuro */}
        <div className="auth-split-topbar">
          <ReserveiLogo size={34} priority />
          <div
            className="auth-split-theme-pill"
            role="radiogroup"
            aria-label="Seletor de tema claro ou escuro"
          >
            <button
              type="button"
              className={`auth-split-theme-btn ${theme === "light" ? "active" : ""}`}
              onClick={() => handleSetTheme("light")}
              aria-label="Ativar tema claro"
            >
              <Sun size={13} />
              <span>Claro</span>
            </button>
            <button
              type="button"
              className={`auth-split-theme-btn ${theme === "dark" ? "active" : ""}`}
              onClick={() => handleSetTheme("dark")}
              aria-label="Ativar tema escuro"
            >
              <Moon size={13} />
              <span>Escuro</span>
            </button>
          </div>
        </div>

        <div className="auth-split-form-container">
          {/* Feedback de erro */}
          {error && (
            <div className="auth-split-error" role="alert">
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Feedback de sucesso */}
          {successBanner && (
            <div className="auth-split-success" role="status">
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              <span>{successBanner}</span>
            </div>
          )}

          {/* ======================================================= */}
          {/* MODO 1: LOGIN (Acesse sua conta)                         */}
          {/* ======================================================= */}
          {mode === "login" && (
            <>
              <h1 className="auth-split-title">Acesse sua conta</h1>
              <p className="auth-split-subtitle">
                Entre para gerenciar seu plano e acessar todos os seus recursos.
              </p>

              <form onSubmit={submitAuth} className="auth-split-form">
                <div className="auth-split-field">
                  <label className="auth-split-label">
                    E-mail <span className="auth-split-asterisk">*</span>
                  </label>
                  <div className="auth-split-input-wrap">
                    <Mail className="auth-split-input-icon" size={17} />
                    <input
                      className="auth-split-input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div className="auth-split-field">
                  <label className="auth-split-label">
                    Senha <span className="auth-split-asterisk">*</span>
                  </label>
                  <div className="auth-split-input-wrap">
                    <Lock className="auth-split-input-icon" size={17} />
                    <input
                      className="auth-split-input"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      className="auth-split-input-eye"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={
                        showPassword ? "Ocultar senha" : "Exibir senha"
                      }
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="auth-split-row">
                  <label className="auth-split-remember">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      style={{ accentColor: theme === "dark" ? "#dcff4c" : "#4d7c0f" }}
                    />
                    <span>Lembrar de mim</span>
                  </label>
                  <button
                    type="button"
                    className="auth-split-link-btn"
                    onClick={handleOpenForgotPassword}
                    style={{ color: greenText }}
                  >
                    Esqueci minha senha
                  </button>
                </div>

                <button
                  type="submit"
                  className="auth-split-primary-btn"
                  disabled={loading}
                  style={{ backgroundColor: greenBtnBg, color: greenBtnText, boxShadow: "none" }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="auth-split-spinner" style={{ color: greenBtnText }} />
                      <span>Entrando...</span>
                    </>
                  ) : (
                    <span>Entrar</span>
                  )}
                </button>
              </form>

              <div className="auth-split-divider">
                <div className="auth-split-divider-line" />
                <span className="auth-split-divider-text">ou acesse com</span>
                <div className="auth-split-divider-line" />
              </div>

              <button
                type="button"
                className="auth-split-secondary-btn"
                onClick={() => handleModeChange("reservas")}
              >
                <CalendarDays size={16} />
                <span>Ver minhas reservas</span>
              </button>

              <div className="auth-split-switch-row">
                Não tem conta?{" "}
                <button
                  type="button"
                  onClick={() => handleModeChange("register")}
                  style={{ color: greenText }}
                >
                  Criar conta grátis
                </button>
              </div>
            </>
          )}

          {/* ======================================================= */}
          {/* MODO 2: REGISTRO (Crie sua conta)                        */}
          {/* ======================================================= */}
          {mode === "register" && (
            <>
              <h1 className="auth-split-title">Crie sua conta</h1>
              <p className="auth-split-subtitle">
                Comece gratuitamente e modernize seus agendamentos hoje mesmo.
              </p>

              <form onSubmit={submitAuth} className="auth-split-form">
                <div className="auth-split-field">
                  <label className="auth-split-label">
                    Nome completo <span className="auth-split-asterisk">*</span>
                  </label>
                  <div className="auth-split-input-wrap">
                    <User className="auth-split-input-icon" size={17} />
                    <input
                      className="auth-split-input"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Seu nome completo"
                      autoComplete="name"
                      required
                      minLength={2}
                    />
                  </div>
                </div>

                <div className="auth-split-field">
                  <label className="auth-split-label">
                    E-mail <span className="auth-split-asterisk">*</span>
                  </label>
                  <div className="auth-split-input-wrap">
                    <Mail className="auth-split-input-icon" size={17} />
                    <input
                      className="auth-split-input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div className="auth-split-field">
                  <label className="auth-split-label">
                    Senha <span className="auth-split-asterisk">*</span>
                  </label>
                  <div className="auth-split-input-wrap">
                    <Lock className="auth-split-input-icon" size={17} />
                    <input
                      className="auth-split-input"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      className="auth-split-input-eye"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={
                        showPassword ? "Ocultar senha" : "Exibir senha"
                      }
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {password ? (
                    <PasswordStrengthMeter password={password} />
                  ) : (
                    <span className="auth-split-field-hint">
                      Pelo menos 8 caracteres
                    </span>
                  )}
                </div>

                <div className="auth-split-field">
                  <label className="auth-split-label">
                    Confirmar senha <span className="auth-split-asterisk">*</span>
                  </label>
                  <div className="auth-split-input-wrap">
                    <Lock className="auth-split-input-icon" size={17} />
                    <input
                      className="auth-split-input"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      className="auth-split-input-eye"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      aria-label={
                        showConfirmPassword ? "Ocultar senha" : "Exibir senha"
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && (
                    <span
                      style={{
                        fontSize: "11.5px",
                        marginTop: "2px",
                        fontWeight: 600,
                        color:
                          password === confirmPassword ? "#10b981" : "#ef4444",
                      }}
                    >
                      {password === confirmPassword
                        ? "✓ As senhas coincidem"
                        : "✕ As senhas não coincidem"}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  className="auth-split-primary-btn"
                  disabled={loading}
                  style={{ backgroundColor: greenBtnBg, color: greenBtnText, boxShadow: "none" }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="auth-split-spinner" style={{ color: greenBtnText }} />
                      <span>Criando conta...</span>
                    </>
                  ) : (
                    <span>Criar conta grátis</span>
                  )}
                </button>
              </form>

              <div className="auth-split-divider">
                <div className="auth-split-divider-line" />
                <span className="auth-split-divider-text">ou acesse com</span>
                <div className="auth-split-divider-line" />
              </div>

              <button
                type="button"
                className="auth-split-secondary-btn"
                onClick={() => handleModeChange("reservas")}
              >
                <CalendarDays size={16} />
                <span>Ver minhas reservas</span>
              </button>

              <div className="auth-split-switch-row">
                Já tem uma conta?{" "}
                <button
                  type="button"
                  onClick={() => handleModeChange("login")}
                  style={{ color: greenText }}
                >
                  Entrar
                </button>
              </div>
            </>
          )}

          {/* ======================================================= */}
          {/* MODO 3: RECUPERAR SENHA (Esqueci a senha)                */}
          {/* ======================================================= */}
          {mode === "forgot-password" && (
            <>
              {recoveryStep === "request_email" ? (
                <>
                  <h1 className="auth-split-title">Recuperar senha</h1>
                  <p className="auth-split-subtitle">
                    Informe o e-mail cadastrado na sua conta para receber as
                    instruções de recuperação.
                  </p>

                  <form onSubmit={submitRecoveryEmail} className="auth-split-form">
                    <div className="auth-split-field">
                      <label className="auth-split-label">
                        E-mail cadastrado{" "}
                        <span className="auth-split-asterisk">*</span>
                      </label>
                      <div className="auth-split-input-wrap">
                        <Mail className="auth-split-input-icon" size={17} />
                        <input
                          className="auth-split-input"
                          type="email"
                          value={recoveryEmail}
                          onChange={(e) => setRecoveryEmail(e.target.value)}
                          placeholder="seu@email.com"
                          autoComplete="email"
                          required
                          autoFocus
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="auth-split-primary-btn"
                      disabled={loading}
                      style={{ backgroundColor: greenBtnBg, color: greenBtnText, boxShadow: "none" }}
                    >
                      {loading ? (
                        <>
                          <Loader2 size={18} className="auth-split-spinner" style={{ color: greenBtnText }} />
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <span>Enviar instruções</span>
                      )}
                    </button>
                  </form>

                  <div className="auth-split-divider">
                    <div className="auth-split-divider-line" />
                    <span className="auth-split-divider-text">
                      ou continue para
                    </span>
                    <div className="auth-split-divider-line" />
                  </div>

                  <button
                    type="button"
                    className="auth-split-secondary-btn"
                    onClick={() => handleModeChange("reservas")}
                  >
                    <CalendarDays size={16} />
                    <span>Ver minhas reservas</span>
                  </button>

                  <div className="auth-split-switch-row">
                    Lembrou sua senha?{" "}
                    <button
                      type="button"
                      onClick={() => handleModeChange("login")}
                      style={{ color: greenText }}
                    >
                      Voltar ao login
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h1 className="auth-split-title">Verifique seu e-mail</h1>
                  <p className="auth-split-subtitle">
                    Enviamos as orientações de redefinição para o endereço
                    abaixo.
                  </p>

                  <div className="auth-split-card-sent">
                    <div className="auth-split-card-sent-icon">
                      <MailCheck size={26} />
                    </div>
                    <div className="auth-split-email-pill">
                      <Mail size={14} />
                      <span>{recoveryEmail}</span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "12.5px",
                        color: "var(--text-secondary)",
                        lineHeight: 1.5,
                      }}
                    >
                      Abra sua caixa de entrada e clique no link de recuperação
                      para definir uma nova senha. O link expira em 1 hora.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="auth-split-primary-btn"
                    onClick={() => handleModeChange("login")}
                    style={{ backgroundColor: greenBtnBg, color: greenBtnText, boxShadow: "none" }}
                  >
                    Voltar ao login
                  </button>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      marginTop: "16px",
                      fontSize: "13px",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <span>Não recebeu o e-mail?</span>
                    <button
                      type="button"
                      className="auth-split-link-btn"
                      disabled={resendCooldown > 0 || loading}
                      onClick={handleResendRecoveryEmail}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <RotateCcw size={13} />
                      {resendCooldown > 0
                        ? `Reenviar em ${resendCooldown}s`
                        : "Reenviar e-mail"}
                    </button>
                  </div>

                  <div className="auth-split-divider">
                    <div className="auth-split-divider-line" />
                    <span className="auth-split-divider-text">
                      ou continue para
                    </span>
                    <div className="auth-split-divider-line" />
                  </div>

                  <button
                    type="button"
                    className="auth-split-secondary-btn"
                    onClick={() => handleModeChange("reservas")}
                  >
                    <CalendarDays size={16} />
                    <span>Ver minhas reservas</span>
                  </button>
                </>
              )}
            </>
          )}

          {/* ======================================================= */}
          {/* MODO 4: VER MINHAS RESERVAS (Portal do Cliente)          */}
          {/* ======================================================= */}
          {mode === "reservas" && (
            <>
              <h1 className="auth-split-title">Minhas Reservas</h1>
              <p className="auth-split-subtitle">
                Acesse sua conta para consultar, remarcar ou cancelar seus
                agendamentos.
              </p>

              <form onSubmit={submitAuth} className="auth-split-form">
                <div className="auth-split-field">
                  <label className="auth-split-label">
                    E-mail cadastrado{" "}
                    <span className="auth-split-asterisk">*</span>
                  </label>
                  <div className="auth-split-input-wrap">
                    <Mail className="auth-split-input-icon" size={17} />
                    <input
                      className="auth-split-input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div className="auth-split-field">
                  <label className="auth-split-label">
                    Senha <span className="auth-split-asterisk">*</span>
                  </label>
                  <div className="auth-split-input-wrap">
                    <Lock className="auth-split-input-icon" size={17} />
                    <input
                      className="auth-split-input"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      className="auth-split-input-eye"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={
                        showPassword ? "Ocultar senha" : "Exibir senha"
                      }
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="auth-split-row">
                  <label className="auth-split-remember">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      style={{ accentColor: theme === "dark" ? "#dcff4c" : "#4d7c0f" }}
                    />
                    <span>Lembrar de mim</span>
                  </label>
                  <button
                    type="button"
                    className="auth-split-link-btn"
                    onClick={handleOpenForgotPassword}
                    style={{ color: greenText }}
                  >
                    Esqueci minha senha
                  </button>
                </div>

                <button
                  type="submit"
                  className="auth-split-primary-btn"
                  disabled={loading}
                  style={{ backgroundColor: greenBtnBg, color: greenBtnText, boxShadow: "none" }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="auth-split-spinner" style={{ color: greenBtnText }} />
                      <span>Acessando...</span>
                    </>
                  ) : (
                    <span>Acessar minhas reservas</span>
                  )}
                </button>

                {/* Acesso rápido para testes em modo desenvolvimento */}
                <button
                  type="button"
                  className="auth-split-demo-btn"
                  onClick={handleCustomerDemo}
                  disabled={loading}
                >
                  <Sparkles size={14} />
                  <span>⚡ Demo: Entrar como Carlos Silva (1-clique)</span>
                </button>
              </form>

              <div className="auth-split-divider">
                <div className="auth-split-divider-line" />
                <span className="auth-split-divider-text">
                  ou painel de gestão
                </span>
                <div className="auth-split-divider-line" />
              </div>

              <button
                type="button"
                className="auth-split-secondary-btn"
                onClick={() => handleModeChange("login")}
              >
                <ArrowLeft size={15} />
                <span>Entrar no painel do estabelecimento</span>
              </button>

              <div className="auth-split-switch-row">
                Ainda não tem agendamento?{" "}
                <button
                  type="button"
                  onClick={() => handleModeChange("register")}
                  style={{ color: greenText }}
                >
                  Criar conta de profissional
                </button>
              </div>
            </>
          )}
        </div>

        {/* Rodapé com termos e privacidade */}
        <div className="auth-split-footer">
          Ao continuar, você concorda com nossos{" "}
          <a href="/termos" target="_blank" rel="noreferrer">
            Termos de Uso
          </a>{" "}
          e{" "}
          <a href="/privacidade" target="_blank" rel="noreferrer">
            Política de Privacidade
          </a>
          .
        </div>
      </div>
    </div>
  );
}
