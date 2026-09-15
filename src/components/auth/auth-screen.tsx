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
  Phone,
  RotateCcw,
  Sun,
  Moon,
  User,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { useOptionalStore } from "@/store/store";
import { ReserveiLogo } from "@/components/brand/novae-logo";
import { applyTheme, getStoredTheme, resolveTheme } from "@/lib/theme";
import { PasswordStrengthMeter } from "./password-strength-meter";
import { PinInput } from "@/components/booking/pin-input";

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
      applyTheme(theme);
    }
  }, [theme]);


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
  const [phone, setPhone] = useState("");
  const [useEmailForReservas, setUseEmailForReservas] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  const formatPhoneInput = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits.length ? `(${digits}` : "";
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  // Progressive Reservas Flow (Celular + PIN 6 dígitos)
  type ReservasFlowStep =
    | "phone"
    | "pin_login"
    | "pin_setup"
    | "not_found"
    | "pin_reset_confirm";

  const [reservasStep, setReservasStep] = useState<ReservasFlowStep>("phone");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [resetDestination, setResetDestination] = useState("");

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
    if (newMode !== "reservas") {
      setReservasStep("phone");
      setPin("");
      setConfirmPin("");
      setResetOtp("");
      setUseEmailForReservas(false);
    }
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

  // ─── Fluxo do Cliente: Checagem de Celular (Etapa 1) ───
  const handlePhoneContinue = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const cleanDigits = phone.replace(/\D/g, "");
    if (cleanDigits.length < 8) {
      setError("Por favor, digite um número de celular válido com DDD.");
      return;
    }
    setError(null);
    setSuccessBanner(null);
    setLoading(true);

    try {
      const response = await api<{
        data: {
          exists: boolean;
          status: "HAS_PIN" | "NEEDS_PIN_SETUP" | "NOT_FOUND";
          maskedPhone: string;
          hasEmail: boolean;
          emailHint?: string;
        };
      }>("/api/customer-access/check-phone", {
        method: "POST",
        body: JSON.stringify({ phone: phone.trim() }),
      });

      setMaskedPhone(response.data.maskedPhone);
      setPin("");
      setConfirmPin("");

      if (response.data.status === "HAS_PIN") {
        setReservasStep("pin_login");
      } else if (response.data.status === "NEEDS_PIN_SETUP") {
        setReservasStep("pin_setup");
      } else {
        setReservasStep("not_found");
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não encontramos reservas vinculadas a este número.",
      );
    } finally {
      setLoading(false);
    }
  };

  // ─── Fluxo do Cliente: Login com PIN (Etapa 2A) ───
  const handlePinLogin = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (pin.length !== 6) {
      setError("Digite os 6 números do seu PIN.");
      return;
    }
    setError(null);
    setSuccessBanner(null);
    setLoading(true);

    try {
      await api("/api/customer-access/pin/login", {
        method: "POST",
        body: JSON.stringify({ phone: phone.trim(), pin }),
      });

      if (store) await store.reloadSession();

      if (onAuthenticated) {
        onAuthenticated(false);
      } else {
        window.location.assign("/cliente");
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "PIN incorreto. Verifique os números digitados.",
      );
    } finally {
      setLoading(false);
    }
  };

  // ─── Fluxo do Cliente: Primeiro Acesso / Criar PIN (Etapa 2B) ───
  const handlePinSetup = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (pin.length !== 6) {
      setError("O PIN deve conter exatamente 6 números.");
      return;
    }
    if (confirmPin.length !== 6) {
      setError("Confirme seu PIN digitando os 6 números.");
      return;
    }
    if (pin !== confirmPin) {
      setError("Os PINs não coincidem.");
      return;
    }
    setError(null);
    setSuccessBanner(null);
    setLoading(true);

    try {
      await api("/api/customer-access/pin/setup", {
        method: "POST",
        body: JSON.stringify({
          phone: phone.trim(),
          pin,
          confirmPin,
        }),
      });

      if (store) await store.reloadSession();

      if (onAuthenticated) {
        onAuthenticated(false);
      } else {
        window.location.assign("/cliente");
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível criar o PIN. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  };

  // ─── Fluxo do Cliente: Solicitar Redefinição de PIN ───
  const handleRequestPinReset = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await api<{
        data: {
          success: boolean;
          message: string;
          channel: "email" | "whatsapp" | "console";
          destination: string;
        };
      }>("/api/customer-access/pin/reset/request", {
        method: "POST",
        body: JSON.stringify({ phone: phone.trim() }),
      });

      setResetDestination(response.data.destination || maskedPhone);
      setSuccessBanner(response.data.message);
      setResetOtp("");
      setPin("");
      setConfirmPin("");
      setReservasStep("pin_reset_confirm");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível solicitar a recuperação do PIN.",
      );
    } finally {
      setLoading(false);
    }
  };

  // ─── Fluxo do Cliente: Confirmar Redefinição de PIN ───
  const handleConfirmPinReset = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (resetOtp.trim().length < 6) {
      setError("Informe o código de verificação recebido.");
      return;
    }
    if (pin.length !== 6) {
      setError("O novo PIN deve conter exatamente 6 números.");
      return;
    }
    if (pin !== confirmPin) {
      setError("Os PINs não coincidem.");
      return;
    }
    setError(null);
    setSuccessBanner(null);
    setLoading(true);

    try {
      await api("/api/customer-access/pin/reset/confirm", {
        method: "POST",
        body: JSON.stringify({
          phone: phone.trim(),
          otp: resetOtp.trim(),
          newPin: pin,
          confirmNewPin: confirmPin,
        }),
      });

      if (store) await store.reloadSession();

      if (onAuthenticated) {
        onAuthenticated(false);
      } else {
        window.location.assign("/cliente");
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Código inválido ou expirado. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  };


  // Submit for Login, Register or Reservas
  const submitAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccessBanner(null);
    setLoading(true);

    try {
      if (mode === "reservas" && !useEmailForReservas) {
        const cleanDigits = phone.replace(/\D/g, "");
        if (cleanDigits.length < 8) {
          setError("Por favor, digite um número de celular válido com DDD.");
          setLoading(false);
          return;
        }

        const response = await api<{
          data: { userId: string; targetPortal?: string; role?: string };
        }>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ phone: phone.trim() }),
        });

        const updatedSession = store ? await store.reloadSession() : null;

        if (onAuthenticated) {
          onAuthenticated(false);
        } else {
          window.location.assign("/cliente");
        }
        return;
      }

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
            window.location.assign("/cliente");
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
          {/* MODO 4: VER MINHAS RESERVAS (Portal do Cliente - PIN)    */}
          {/* ======================================================= */}
          {mode === "reservas" && (
            <>
              {useEmailForReservas ? (
                <>
                  <h1 className="auth-split-title">Minhas Reservas</h1>
                  <p className="auth-split-subtitle">
                    Acesse suas reservas utilizando seu e-mail e senha cadastrados.
                  </p>

                  <form onSubmit={submitAuth} className="auth-split-form">
                    <div className="auth-split-field">
                      <label className="auth-split-label">
                        E-mail cadastrado <span className="auth-split-asterisk">*</span>
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
                          aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="auth-split-row">
                      <button
                        type="button"
                        className="auth-split-link-btn"
                        onClick={() => {
                          setUseEmailForReservas(false);
                          setReservasStep("phone");
                          setError(null);
                        }}
                        style={{ color: greenText }}
                      >
                        ← Voltar para celular
                      </button>
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
                  </form>
                </>
              ) : reservasStep === "phone" ? (
                <>
                  <h1 className="auth-split-title">Minhas Reservas</h1>
                  <p className="auth-split-subtitle">
                    Informe seu celular para consultar, remarcar ou acompanhar seus agendamentos.
                  </p>

                  <form onSubmit={handlePhoneContinue} className="auth-split-form">
                    <div className="auth-split-field">
                      <label className="auth-split-label">
                        Número de celular / WhatsApp <span className="auth-split-asterisk">*</span>
                      </label>
                      <div className="auth-split-input-wrap">
                        <Phone className="auth-split-input-icon" size={17} />
                        <input
                          className="auth-split-input"
                          type="tel"
                          inputMode="tel"
                          value={phone}
                          onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                          placeholder="(11) 99999-9999"
                          autoComplete="tel"
                          required
                          autoFocus
                        />
                      </div>
                      <span
                        style={{
                          fontSize: "12px",
                          color: theme === "dark" ? "#a1a1aa" : "#64748b",
                          marginTop: "4px",
                          display: "block",
                        }}
                      >
                        Digite o mesmo número informado no seu agendamento.
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "-4px", marginBottom: "4px" }}>
                      <button
                        type="button"
                        className="auth-split-link-btn"
                        onClick={() => {
                          setUseEmailForReservas(true);
                          setError(null);
                        }}
                        style={{ color: greenText, fontSize: "12.5px" }}
                      >
                        Acessar com e-mail e senha
                      </button>
                    </div>

                    <button
                      type="submit"
                      className="auth-split-primary-btn"
                      disabled={loading || phone.replace(/\D/g, "").length < 8}
                      style={{ backgroundColor: greenBtnBg, color: greenBtnText, boxShadow: "none" }}
                    >
                      {loading ? (
                        <>
                          <Loader2 size={18} className="auth-split-spinner" style={{ color: greenBtnText }} />
                          <span>Continuando...</span>
                        </>
                      ) : (
                        <span>Continuar</span>
                      )}
                    </button>

                  </form>
                </>
              ) : reservasStep === "pin_login" ? (
                <>
                  <h1 className="auth-split-title">Bem-vindo de volta</h1>
                  <p className="auth-split-subtitle">
                    Digite seu PIN de 6 dígitos para acessar suas reservas.
                  </p>

                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      backgroundColor: theme === "dark" ? "#18181b" : "#f4f4f5",
                      fontSize: "13px",
                      textAlign: "center",
                      marginBottom: "20px",
                      color: theme === "dark" ? "#a1a1aa" : "#71717a",
                    }}
                  >
                    PIN para:{" "}
                    <strong style={{ color: theme === "dark" ? "#fafafa" : "#09090b" }}>
                      {maskedPhone || phone}
                    </strong>
                  </div>

                  <form onSubmit={handlePinLogin} className="auth-split-form">
                    <div className="auth-split-field" style={{ alignItems: "center" }}>
                      <PinInput
                        id="pin-login-input"
                        value={pin}
                        onChange={setPin}
                        length={6}
                        autoFocus
                        error={Boolean(error)}
                        theme={theme}
                      />
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                      <button
                        type="button"
                        className="auth-split-link-btn"
                        onClick={() => {
                          setReservasStep("phone");
                          setPin("");
                          setError(null);
                        }}
                        style={{ color: theme === "dark" ? "#a1a1aa" : "#64748b", fontSize: "12.5px" }}
                      >
                        ← Usar outro número
                      </button>

                      <button
                        type="button"
                        className="auth-split-link-btn"
                        onClick={handleRequestPinReset}
                        disabled={loading}
                        style={{ color: greenText, fontSize: "12.5px" }}
                      >
                        Esqueci meu PIN
                      </button>
                    </div>

                    <button
                      type="submit"
                      className="auth-split-primary-btn"
                      disabled={loading || pin.length !== 6}
                      style={{ backgroundColor: greenBtnBg, color: greenBtnText, boxShadow: "none", marginTop: "12px" }}
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
                </>
              ) : reservasStep === "pin_setup" ? (
                <>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: greenText, fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>
                    <ShieldCheck size={16} /> Primeiro Acesso
                  </div>
                  <h1 className="auth-split-title">Proteja suas reservas</h1>
                  <p className="auth-split-subtitle">
                    Crie um PIN de 6 dígitos que você usará junto ao seu celular para acessar suas reservas.
                  </p>

                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      backgroundColor: theme === "dark" ? "#18181b" : "#f4f4f5",
                      fontSize: "13px",
                      textAlign: "center",
                      marginBottom: "16px",
                      color: theme === "dark" ? "#a1a1aa" : "#71717a",
                    }}
                  >
                    Celular:{" "}
                    <strong style={{ color: theme === "dark" ? "#fafafa" : "#09090b" }}>
                      {maskedPhone || phone}
                    </strong>
                  </div>

                  <form onSubmit={handlePinSetup} className="auth-split-form">
                    <div className="auth-split-field">
                      <label className="auth-split-label" style={{ textAlign: "center", width: "100%", marginBottom: "8px" }}>
                        Crie seu PIN (6 dígitos) <span className="auth-split-asterisk">*</span>
                      </label>
                      <PinInput
                        id="setup-pin-val"
                        value={pin}
                        onChange={setPin}
                        length={6}
                        autoFocus
                        theme={theme}
                      />
                    </div>

                    <div className="auth-split-field" style={{ marginTop: "8px" }}>
                      <label className="auth-split-label" style={{ textAlign: "center", width: "100%", marginBottom: "8px" }}>
                        Confirme seu PIN <span className="auth-split-asterisk">*</span>
                      </label>
                      <PinInput
                        id="setup-pin-confirm"
                        value={confirmPin}
                        onChange={setConfirmPin}
                        length={6}
                        theme={theme}
                      />
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-start", marginTop: "4px" }}>
                      <button
                        type="button"
                        className="auth-split-link-btn"
                        onClick={() => {
                          setReservasStep("phone");
                          setPin("");
                          setConfirmPin("");
                          setError(null);
                        }}
                        style={{ color: theme === "dark" ? "#a1a1aa" : "#64748b", fontSize: "12.5px" }}
                      >
                        ← Usar outro número
                      </button>
                    </div>

                    <button
                      type="submit"
                      className="auth-split-primary-btn"
                      disabled={loading || pin.length !== 6 || confirmPin.length !== 6}
                      style={{ backgroundColor: greenBtnBg, color: greenBtnText, boxShadow: "none", marginTop: "12px" }}
                    >
                      {loading ? (
                        <>
                          <Loader2 size={18} className="auth-split-spinner" style={{ color: greenBtnText }} />
                          <span>Criando PIN...</span>
                        </>
                      ) : (
                        <span>Criar PIN</span>
                      )}
                    </button>
                  </form>
                </>
              ) : reservasStep === "not_found" ? (
                <>
                  <h1 className="auth-split-title">Minhas Reservas</h1>
                  <p className="auth-split-subtitle">
                    Não encontramos reservas vinculadas a este número.
                  </p>

                  <div
                    style={{
                      padding: "16px",
                      borderRadius: "8px",
                      border: `1px solid ${theme === "dark" ? "#27272a" : "#e2e8f0"}`,
                      backgroundColor: theme === "dark" ? "#121215" : "#fafafa",
                      marginBottom: "20px",
                      textAlign: "center",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: "14px", color: theme === "dark" ? "#d4d4d8" : "#3f3f46" }}>
                      Número pesquisado: <strong>{maskedPhone || phone}</strong>
                    </p>
                    <p style={{ margin: "8px 0 0", fontSize: "12.5px", color: theme === "dark" ? "#a1a1aa" : "#71717a" }}>
                      Se você ainda não agendou um horário, escolha um serviço para reservar agora mesmo.
                    </p>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <a
                      href="/explorar"
                      className="auth-split-primary-btn"
                      style={{
                        backgroundColor: greenBtnBg,
                        color: greenBtnText,
                        boxShadow: "none",
                        textDecoration: "none",
                        textAlign: "center",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      Agendar um horário
                    </a>

                    <button
                      type="button"
                      className="auth-split-secondary-btn"
                      onClick={() => {
                        setReservasStep("phone");
                        setError(null);
                      }}
                    >
                      ← Verificar outro número
                    </button>

                    <button
                      type="button"
                      className="auth-split-link-btn"
                      onClick={() => {
                        setUseEmailForReservas(true);
                        setError(null);
                      }}
                      style={{ color: greenText, textAlign: "center", marginTop: "8px", fontSize: "13px" }}
                    >
                      Acessar com e-mail e senha
                    </button>
                  </div>
                </>
              ) : reservasStep === "pin_reset_confirm" ? (
                <>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: greenText, fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>
                    <KeyRound size={16} /> Redefinir PIN
                  </div>
                  <h1 className="auth-split-title">Recuperação de PIN</h1>
                  <p className="auth-split-subtitle">
                    Informe o código de 6 números enviado para {resetDestination || maskedPhone} e defina o novo PIN.
                  </p>

                  <form onSubmit={handleConfirmPinReset} className="auth-split-form">
                    <div className="auth-split-field">
                      <label className="auth-split-label" style={{ textAlign: "center", width: "100%", marginBottom: "8px" }}>
                        Código de verificação (6 dígitos) <span className="auth-split-asterisk">*</span>
                      </label>
                      <PinInput
                        id="reset-otp-input"
                        value={resetOtp}
                        onChange={setResetOtp}
                        length={6}
                        mask={false}
                        autoFocus
                        theme={theme}
                      />
                    </div>

                    <div className="auth-split-field" style={{ marginTop: "10px" }}>
                      <label className="auth-split-label" style={{ textAlign: "center", width: "100%", marginBottom: "8px" }}>
                        Novo PIN (6 dígitos) <span className="auth-split-asterisk">*</span>
                      </label>
                      <PinInput
                        id="reset-new-pin-input"
                        value={pin}
                        onChange={setPin}
                        length={6}
                        theme={theme}
                      />
                    </div>

                    <div className="auth-split-field" style={{ marginTop: "10px" }}>
                      <label className="auth-split-label" style={{ textAlign: "center", width: "100%", marginBottom: "8px" }}>
                        Confirme o novo PIN <span className="auth-split-asterisk">*</span>
                      </label>
                      <PinInput
                        id="reset-confirm-new-pin-input"
                        value={confirmPin}
                        onChange={setConfirmPin}
                        length={6}
                        theme={theme}
                      />
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-start", marginTop: "4px" }}>
                      <button
                        type="button"
                        className="auth-split-link-btn"
                        onClick={() => {
                          setReservasStep("pin_login");
                          setError(null);
                        }}
                        style={{ color: theme === "dark" ? "#a1a1aa" : "#64748b", fontSize: "12.5px" }}
                      >
                        ← Voltar para login
                      </button>
                    </div>

                    <button
                      type="submit"
                      className="auth-split-primary-btn"
                      disabled={loading || resetOtp.length < 6 || pin.length !== 6 || confirmPin.length !== 6}
                      style={{ backgroundColor: greenBtnBg, color: greenBtnText, boxShadow: "none", marginTop: "12px" }}
                    >
                      {loading ? (
                        <>
                          <Loader2 size={18} className="auth-split-spinner" style={{ color: greenBtnText }} />
                          <span>Redefinindo...</span>
                        </>
                      ) : (
                        <span>Redefinir PIN e entrar</span>
                      )}
                    </button>
                  </form>
                </>
              ) : null}

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
