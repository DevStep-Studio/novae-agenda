"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertTriangle,
  ArrowRight,
  LogOut,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { ReserveiLogo } from "@/components/brand/novae-logo";
import { useStore } from "@/store/store";
import type { SessionInfo } from "@/shared/types";
import styles from "./admin-login.module.css";

interface AdminLoginScreenProps {
  currentSession?: SessionInfo | null;
  onAuthenticated?: () => void;
}

export function AdminLoginScreen({ currentSession, onAuthenticated }: AdminLoginScreenProps) {
  const { reloadSession, logout } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Informe o e-mail e a senha de administrador.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await api<{ data: { userId: string; role?: string; targetPortal?: string } }>(
        "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        }
      );

      const updated = await reloadSession();
      if (!updated?.isSuperadmin && updated?.primaryRole !== "superadmin") {
        setError("Esta conta não possui privilégios de Administrador Geral (Superadmin).");
        return;
      }

      if (onAuthenticated) {
        onAuthenticated();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "E-mail ou senha incorretos.");
      } else {
        setError("Falha ao autenticar como administrador. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const fillDefaultAdmin = () => {
    setEmail("admin@reservei.com.br");
    setPassword("Admin@Reservei2026");
    setError("");
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logoRow}>
            <ReserveiLogo size={36} />
          </div>
          <div className={styles.badge}>
            <ShieldCheck size={14} />
            <span>Acesso Super Admin</span>
          </div>
          <h1 className={styles.title}>Portal do Administrador</h1>
          <p className={styles.subtitle}>
            Acesso exclusivo para controle global, métricas financeiras e gestão multi-tenant.
          </p>
        </div>

        {currentSession && !currentSession.isSuperadmin && (
          <div className={styles.sessionNotice}>
            <div className={styles.sessionNoticeHeader}>
              <AlertTriangle size={15} />
              <span>Sessão comum ativa</span>
            </div>
            <p>
              Conectado como <strong>{currentSession.name}</strong> ({currentSession.email}).
              Entre abaixo com uma conta com privilégios de Super Admin para desbloquear o painel.
            </p>
          </div>
        )}

        {error && (
          <div className={styles.errorBanner} role="alert">
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="admin-email" className={styles.label}>
              E-mail do Administrador
            </label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}>
                <Mail size={16} />
              </span>
              <input
                id="admin-email"
                type="email"
                autoComplete="email"
                required
                autoFocus
                placeholder="admin@reservei.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="admin-password" className={styles.label}>
              Senha
            </label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}>
                <Lock size={16} />
              </span>
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
              />
              <button
                type="button"
                className={styles.togglePassword}
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Autenticando...</span>
              </>
            ) : (
              <>
                <span>Acessar Painel Super Admin</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className={styles.quickFillBox}>
          <div className={styles.quickFillTitle}>Acesso Master Criado</div>
          <div className={styles.quickFillRow}>
            <span className={styles.quickFillText}>admin@reservei.com.br</span>
            <button type="button" onClick={fillDefaultAdmin} className={styles.quickFillBtn}>
              Preencher dados
            </button>
          </div>
        </div>

        <div className={styles.footerActions}>
          <Link href="/gestao" className={styles.backLink}>
            ← Ir para o painel da empresa
          </Link>
          {currentSession && (
            <button type="button" onClick={() => void logout()} className={styles.logoutBtn}>
              <LogOut size={13} />
              <span>Desconectar</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
