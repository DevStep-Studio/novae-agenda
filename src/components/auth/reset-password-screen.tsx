"use client";

import { useState } from "react";
import { ArrowLeft, Check, Eye, EyeOff, KeyRound, Lock } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";

import { ReserveiLogo } from "@/components/brand/novae-logo";

export function ResetPasswordScreen({ token, onDone }: { token: string; onDone: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 8) {
      setError("A nova senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível redefinir a senha. Tente novamente.");
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
        <div className="auth-view-animated">
          {done ? (
            <>
              <div className="auth-recovery-header">
                <div className="auth-recovery-badge">
                  <Check size={13} />
                  Senha redefinida
                </div>
                <h1>Tudo certo</h1>
                <p className="auth-subtitle">Sua senha foi atualizada. Entre novamente com a nova senha.</p>
              </div>
              <button type="button" className="auth-submit" onClick={onDone}>
                Ir para o login
              </button>
            </>
          ) : (
            <>
              <div className="auth-recovery-header">
                <div className="auth-recovery-badge">
                  <KeyRound size={13} />
                  Nova senha
                </div>
                <h1>Definir nova senha</h1>
                <p className="auth-subtitle">Crie uma nova senha segura para a sua conta.</p>
              </div>

              {error && (
                <div className="auth-error">
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={submit} className="auth-form">
                <label className="field">
                  <span className="field-label">Nova senha</span>
                  <div className="input-with-icon">
                    <Lock size={15} />
                    <input
                      className="input"
                      type={show ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo de 8 caracteres"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      autoFocus
                    />
                    <button type="button" className="input-eye" onClick={() => setShow((v) => !v)} aria-label="Mostrar senha">
                      {show ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </label>

                <label className="field">
                  <span className="field-label">Confirmar nova senha</span>
                  <div className="input-with-icon">
                    <Lock size={15} />
                    <input
                      className="input"
                      type={show ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                      autoComplete="new-password"
                      required
                      minLength={8}
                    />
                  </div>
                </label>

                <div className="auth-actions-split">
                  <button type="button" className="auth-dark-btn" onClick={onDone}>
                    <ArrowLeft size={14} /> Voltar ao login
                  </button>
                  <button type="submit" className="auth-submit" disabled={loading}>
                    {loading ? "Salvando..." : "Salvar senha"} {!loading && <Check size={16} />}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
      <p className="auth-footer">reservei · gestão e agendamento inteligente</p>
    </div>
  );
}
