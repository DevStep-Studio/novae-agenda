"use client";

import { useState, Fragment } from "react";
import { ArrowRight, ArrowLeft, Building2, Clock3, Scissors, UserRound, Check, LogOut, SkipForward, MessageSquare, Lightbulb } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { ReserveiLogo } from "@/components/brand/novae-logo";
import { useStore } from "@/store/store";

const BUSINESS_TYPES = ["Barbearia", "Salão", "Manicure", "Clínica", "Consultório", "Estética", "Tatuagem", "Outro"];

const DAYS = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

const STEPS = [
  { key: "business", label: "Estabelecimento", icon: Building2 },
  { key: "hours", label: "Horário", icon: Clock3 },
  { key: "service", label: "Serviço", icon: Scissors },
  { key: "team", label: "Equipe", icon: UserRound },
];

export function OnboardingScreen({
  onComplete,
  onLogout,
}: {
  onComplete: () => void;
  onLogout?: () => void;
}) {
  const store = useStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [openTime, setOpenTime] = useState("09:00");
  const [closeTime, setCloseTime] = useState("18:00");
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [employeeName, setEmployeeName] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [servicePrice, setServicePrice] = useState("");
  const [isQuote, setIsQuote] = useState(false);
  const [durationUnit, setDurationUnit] = useState<"min" | "hora">("min");
  const [serviceDuration, setServiceDuration] = useState("60");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      void store.logout();
    }
  };

  const toggleDay = (value: number) => {
    setWorkingDays((current) => (current.includes(value) ? current.filter((d) => d !== value) : [...current, value]));
  };

  const stepError = (target: number) => {
    if (target === 0 && name.trim().length > 0 && name.trim().length < 2) {
      return "O nome do estabelecimento deve ter pelo menos 2 caracteres.";
    }
    return null;
  };

  const goNext = () => {
    const err = stepError(step);
    if (err) { setError(err); return; }
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const isLast = step === STEPS.length - 1;

  const executeSubmit = async () => {
    setError(null);
    setLoading(true);

    let finalDurationMinutes = 30;
    if (durationUnit === "hora") {
      const hrs = parseFloat(serviceDuration) || 1;
      finalDurationMinutes = Math.max(1, Math.round(hrs * 60));
    } else {
      const mins = parseInt(serviceDuration, 10);
      finalDurationMinutes = isNaN(mins) || mins < 1 ? 30 : mins;
    }

    try {
      await api("/api/auth/onboarding", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim() || undefined,
          businessType,
          openTime: openTime || "09:00",
          closeTime: closeTime || "18:00",
          workingDays: workingDays.length > 0 ? workingDays : [1, 2, 3, 4, 5],
          employeeName: employeeName.trim() || undefined,
          serviceName: serviceName.trim() || undefined,
          servicePrice: isQuote ? 0 : Number(servicePrice) || 0,
          serviceDuration: finalDurationMinutes,
        }),
      });
      onComplete();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível concluir. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const err = stepError(step);
    if (err) { setError(err); return; }
    await executeSubmit();
  };

  const handleSkipToDashboard = async () => {
    await executeSubmit();
  };

  return (
    <div className="auth-shell">
      <div className="auth-brand" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", maxWidth: "560px", marginBottom: "16px" }}>
        <ReserveiLogo size={32} priority />
        <button
          type="button"
          onClick={handleLogout}
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "6px 12px",
            fontSize: "12.5px",
            fontWeight: 600,
            color: "var(--text-secondary)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            transition: "all 0.15s ease",
          }}
          title="Sair ou entrar com outra conta"
        >
          <LogOut size={13} />
          <span>Fazer login</span>
        </button>
      </div>

      <div className="onboarding-card">
        <div className="onboarding-intro">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
            <h1>Vamos configurar o seu espaço</h1>
            <button
              type="button"
              onClick={handleSkipToDashboard}
              disabled={loading}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--primary)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                whiteSpace: "nowrap",
                textDecoration: "underline",
              }}
              title="Ir direto para a agenda"
            >
              <SkipForward size={13} />
              <span>Configurar depois</span>
            </button>
          </div>
          <p>Leva menos de um minuto. Você poderá mudar ou preencher tudo depois.</p>
        </div>

        <div className="onboarding-progress">
          {STEPS.map((s, i) => (
            <Fragment key={s.key}>
              <div
                className={`onboarding-progress-step ${i === step ? "current" : ""} ${i < step ? "done" : ""}`}
                style={{ cursor: "pointer" }}
                onClick={() => {
                  if (i <= step || !stepError(step)) {
                    setError(null);
                    setStep(i);
                  }
                }}
              >
                <span className="onboarding-progress-dot">{i < step ? <Check size={12} /> : i + 1}</span>
                {i === step && <span className="onboarding-progress-label">{s.label}</span>}
              </div>
              {i < STEPS.length - 1 && <span className={`onboarding-progress-line ${i < step ? "done" : ""}`} />}
            </Fragment>
          ))}
        </div>

        {error && <div className="auth-error"><span>{error}</span></div>}

        <form onSubmit={submit} className="onboarding-form">
          {step === 0 && (
            <section className="onboarding-step">
              <div className="step-heading">
                <span className="step-icon"><Building2 size={16} /></span>
                <div>
                  <h2>Seu estabelecimento</h2>
                  <p>Como quer que ele apareça para você e sua equipe.</p>
                </div>
              </div>
              <div className="settings-form">
                <label className="field">
                  <span className="field-label">Nome do estabelecimento</span>
                  <input
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex.: Studio Prime"
                    autoFocus
                  />
                </label>
                <label className="field">
                  <span className="field-label">Tipo de negócio (opcional)</span>
                  <div className="business-chips">
                    {BUSINESS_TYPES.map((type) => (
                      <button
                        type="button"
                        key={type}
                        className={businessType === type ? "chip active" : "chip"}
                        onClick={() => setBusinessType(businessType === type ? null : type)}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </label>
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="onboarding-step">
              <div className="step-heading">
                <span className="step-icon"><Clock3 size={16} /></span>
                <div>
                  <h2>Horário de funcionamento</h2>
                  <p>O padrão usado para a sua agenda semanal.</p>
                </div>
              </div>
              <div className="working-days">
                <div className="day-picker">
                  {DAYS.map((day) => (
                    <button
                      type="button"
                      key={day.value}
                      className={workingDays.includes(day.value) ? "day active" : "day"}
                      onClick={() => toggleDay(day.value)}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                <div className="time-range">
                  <input className="input" type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} />
                  <span>até</span>
                  <input className="input" type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
                </div>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="onboarding-step">
              <div className="step-heading">
                <span className="step-icon"><Scissors size={16} /></span>
                <div>
                  <h2>Primeiro serviço <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-muted)" }}>(Opcional)</span></h2>
                  <p>Adicione o serviço principal ou adicione depois no painel.</p>
                </div>
              </div>
              <div className="settings-form">
                <label className="field">
                  <span className="field-label">Nome do serviço</span>
                  <input
                    className="input"
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    placeholder="Ex.: Corte de Cabelo / Consulta"
                    autoFocus
                  />
                </label>
                <div className="field">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span className="field-label" style={{ margin: 0 }}>Valor e duração</span>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-secondary)", cursor: "pointer", userSelect: "none" }}>
                      <input
                        type="checkbox"
                        checked={isQuote}
                        onChange={(e) => {
                          setIsQuote(e.target.checked);
                          if (e.target.checked) setServicePrice("0");
                        }}
                        style={{ accentColor: "var(--primary)" }}
                      />
                      <span>Orçamento direto / Sob consulta</span>
                    </label>
                  </div>
                  <div className="inline-fields">
                    {isQuote ? (
                      <div style={{ flex: 1, padding: "9px 12px", borderRadius: "8px", background: "var(--surface-secondary)", border: "1px dashed var(--border-strong)", fontSize: "12.5px", color: "var(--primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <MessageSquare size={13} /> Preço sob consulta (Orçamento direto)
                        </span>
                      </div>
                    ) : (
                      <div className="input-with-prefix" style={{ flex: 1 }}>
                        <span>R$</span>
                        <input className="input" type="number" min="0" step="1" value={servicePrice} onChange={(e) => setServicePrice(e.target.value)} placeholder="50" />
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <input
                        className="input"
                        type="number"
                        min={durationUnit === "hora" ? "0.1" : "1"}
                        step={durationUnit === "hora" ? "0.5" : "5"}
                        value={serviceDuration}
                        onChange={(e) => setServiceDuration(e.target.value)}
                        placeholder={durationUnit === "hora" ? "1" : "60"}
                        style={{ width: "70px" }}
                      />
                      <select
                        className="input"
                        value={durationUnit}
                        onChange={(e) => {
                          const next = e.target.value as "min" | "hora";
                          if (next === "hora" && durationUnit === "min") {
                            const mins = Number(serviceDuration) || 60;
                            setServiceDuration((mins / 60).toString());
                          } else if (next === "min" && durationUnit === "hora") {
                            const hrs = Number(serviceDuration) || 1;
                            setServiceDuration(Math.round(hrs * 60).toString());
                          }
                          setDurationUnit(next);
                        }}
                        style={{ width: "auto", padding: "8px 8px", fontSize: "12.5px", fontWeight: 600 }}
                      >
                        <option value="min">min</option>
                        <option value="hora">hora(s)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="onboarding-step">
              <div className="step-heading">
                <span className="step-icon"><UserRound size={16} /></span>
                <div>
                  <h2>Primeiro profissional <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-muted)" }}>(Opcional)</span></h2>
                  <p>Quem realiza os atendimentos (pode ser você ou você pode cadastrar depois).</p>
                </div>
              </div>
              <label className="field">
                <span className="field-label">Nome do profissional</span>
                <input
                  className="input"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  placeholder="Ex.: Seu nome ou profissional"
                  autoFocus
                />
              </label>
              <div style={{ marginTop: "10px", fontSize: "12.5px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
                <Lightbulb size={13} style={{ flexShrink: 0, color: "var(--primary)" }} />
                <span>Você pode pular esta etapa e gerenciar sua equipe completa no menu &ldquo;Equipe&rdquo; a qualquer momento.</span>
              </div>
            </section>
          )}

          <div className="onboarding-actions">
            {step > 0 ? (
              <button type="button" className="onboarding-back" onClick={goBack}>
                <ArrowLeft size={15} /> Voltar
              </button>
            ) : (
              <span className="form-note">Tudo isso poderá ser editado nas configurações.</span>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto" }}>
              {isLast ? (
                <button type="submit" className="auth-submit" disabled={loading}>
                  {loading ? "Configurando..." : "Ir para minha agenda"} {!loading && <ArrowRight size={16} />}
                </button>
              ) : (
                <>
                  {step >= 2 && (
                    <button
                      type="button"
                      className="onboarding-back"
                      onClick={() => setStep((s) => s + 1)}
                      style={{ fontSize: "12.5px" }}
                    >
                      Pular etapa
                    </button>
                  )}
                  <button type="button" className="auth-submit" onClick={goNext}>
                    Continuar <ArrowRight size={16} />
                  </button>
                </>
              )}
            </div>
          </div>
        </form>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", marginTop: "16px" }}>
        <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Já possui uma conta de acesso?</span>
        <button
          type="button"
          onClick={handleLogout}
          style={{
            background: "none",
            border: "none",
            color: "var(--primary)",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            textDecoration: "underline",
            padding: 0,
          }}
        >
          Fazer login
        </button>
      </div>

      <p className="auth-footer" style={{ marginTop: "12px" }}>Agenda · gestão simples para o seu negócio</p>
    </div>
  );
}
