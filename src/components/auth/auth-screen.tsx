"use client";

import { useState } from "react";
import { Sparkles, ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, User, Shield, UserRound } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";

type Mode = "login" | "register";
type Role = "user" | "admin";

export function AuthScreen({ onAuthenticated }: { onAuthenticated: (needsOnboarding: boolean) => void }) {
  const [role, setRole] = useState<Role>("user");
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRoleChange = (newRole: Role) => {
    setRole(newRole);
    setMode("login");
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        const loginEndpoint = role === "admin" ? "/api/auth/admin/login" : "/api/auth/login";
        await api(loginEndpoint, { method: "POST", body: JSON.stringify({ email, password }) });
        const session = await api<{ data: { userId: string } }>("/api/auth/session");
        void session;
        onAuthenticated(false);
      } else {
        await api("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({ name, email, password, confirmPassword }),
        });
        onAuthenticated(true);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível concluir. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-brand">
        <div className="auth-brand-mark"><Sparkles size={18} strokeWidth={2.4} /></div>
        <span className="auth-brand-name">agenda<span>.</span></span>
      </div>

      {/* Role selector */}
      <div className="auth-role-selector">
        <button
          id="btn-role-user"
          className={`auth-role-chip ${role === "user" ? "active" : ""}`}
          onClick={() => handleRoleChange("user")}
        >
          <UserRound size={14} />
          Usuário
        </button>
        <button
          id="btn-role-admin"
          className={`auth-role-chip ${role === "admin" ? "active admin" : ""}`}
          onClick={() => handleRoleChange("admin")}
        >
          <Shield size={14} />
          Admin
        </button>
      </div>

      <div className={`auth-card ${role === "admin" ? "auth-card--admin" : ""}`}>
        {role === "admin" && (
          <div className="auth-admin-badge">
            <Shield size={12} />
            Acesso Administrativo
          </div>
        )}
        <h1>{mode === "login" ? (role === "admin" ? "Painel Admin" : "Bem-vindo de volta") : "Crie sua conta"}</h1>
        <p className="auth-subtitle">
          {mode === "login"
            ? role === "admin"
              ? "Entre com suas credenciais de administrador."
              : "Entre para acessar sua agenda e seus clientes."
            : "Organize seu negócio em poucos segundos."}
        </p>

        {role === "user" && (
          <div className="auth-tabs">
            <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Entrar</button>
            <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Criar conta</button>
          </div>
        )}

        {error && <div className="auth-error"><span>{error}</span></div>}

        <form onSubmit={submit} className="auth-form">
          {mode === "register" && (
            <label className="field">
              <span className="field-label">Nome</span>
              <div className="input-with-icon"><User size={15} /><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" autoComplete="name" required minLength={2} /></div>
            </label>
          )}
          <label className="field">
            <span className="field-label">E-mail</span>
            <div className="input-with-icon"><Mail size={15} /><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" autoComplete="email" required /></div>
          </label>
          <label className="field">
            <span className="field-label">Senha</span>
            <div className="input-with-icon"><Lock size={15} /><input className="input" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} /><button type="button" className="input-eye" onClick={() => setShowPassword((v) => !v)} aria-label="Mostrar senha">{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button></div>
            {mode === "register" && <span className="field-hint">Pelo menos 8 caracteres</span>}
          </label>
          {mode === "register" && (
            <label className="field">
              <span className="field-label">Confirmar senha</span>
              <div className="input-with-icon"><Lock size={15} /><input className="input" type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" required minLength={8} /></div>
            </label>
          )}

          {mode === "login" && (
            <div className="auth-row">
              <label className="remember"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span>Lembrar meu acesso</span></label>
              <button type="button" className="auth-link" onClick={() => setError("Recuperação enviada para seu e-mail.")}>Esqueci minha senha</button>
            </div>
          )}

          <button type="submit" className="auth-submit" disabled={loading}>{loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"} {!loading && <ArrowRight size={16} />}</button>
        </form>

        <button type="button" className="auth-back" onClick={() => setMode((m) => (m === "login" ? "register" : "login"))}>
          <ArrowLeft size={14} /> {mode === "login" ? "Ainda não tenho conta" : "Já tenho uma conta"}
        </button>
      </div>
      <p className="auth-footer">Agenda · gestão simples para o seu negócio</p>
    </div>
  );
}
