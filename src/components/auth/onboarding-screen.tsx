"use client";

import { useState, Fragment } from "react";
import { ArrowRight, ArrowLeft, Building2, Clock3, Scissors, UserRound, Check } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { ReserveiLogo } from "@/components/brand/novae-logo";

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

export function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [openTime, setOpenTime] = useState("09:00");
  const [closeTime, setCloseTime] = useState("18:00");
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [employeeName, setEmployeeName] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [servicePrice, setServicePrice] = useState("");
  const [serviceDuration, setServiceDuration] = useState("60");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleDay = (value: number) => {
    setWorkingDays((current) => (current.includes(value) ? current.filter((d) => d !== value) : [...current, value]));
  };

  const stepError = (target: number) => {
    if (target === 0 && name.trim().length < 2) return "Dê um nome para o seu estabelecimento.";
    if (target === 2 && serviceName.trim().length < 2) return "Dê um nome para o seu primeiro serviço.";
    if (target === 3 && employeeName.trim().length < 2) return "Informe o nome do profissional.";
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

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const err = stepError(step);
    if (err) { setError(err); return; }
    setError(null);
    setLoading(true);
    try {
      await api("/api/auth/onboarding", {
        method: "POST",
        body: JSON.stringify({
          name,
          businessType,
          openTime,
          closeTime,
          workingDays,
          employeeName,
          serviceName,
          servicePrice: Number(servicePrice) || 0,
          serviceDuration: Number(serviceDuration) || 60,
        }),
      });
      onComplete();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível concluir. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell onboarding-shell">
      <div className="auth-brand"><ReserveiLogo size={32} priority /></div>

      <div className="onboarding-card">
        <div className="onboarding-intro">
          <h1>Vamos configurar o seu espaço</h1>
          <p>Leva menos de um minuto. Você poderá mudar tudo depois.</p>
        </div>

        <div className="onboarding-progress">
          {STEPS.map((s, i) => (
            <Fragment key={s.key}>
              <div className={`onboarding-progress-step ${i === step ? "current" : ""} ${i < step ? "done" : ""}`}>
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
              <div className="step-heading"><span className="step-icon"><Building2 size={16} /></span><div><h2>Seu estabelecimento</h2><p>Como quer que ele apareça para você e sua equipe.</p></div></div>
              <div className="settings-form">
                <label className="field"><span className="field-label">Nome</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Studio Prime" required minLength={2} autoFocus /></label>
                <label className="field"><span className="field-label">Tipo de negócio (opcional)</span><div className="business-chips">{BUSINESS_TYPES.map((type) => <button type="button" key={type} className={businessType === type ? "chip active" : "chip"} onClick={() => setBusinessType(businessType === type ? null : type)}>{type}</button>)}</div></label>
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="onboarding-step">
              <div className="step-heading"><span className="step-icon"><Clock3 size={16} /></span><div><h2>Horário de funcionamento</h2><p>O padrão usado para sua agenda.</p></div></div>
              <div className="working-days">
                <div className="day-picker">{DAYS.map((day) => <button type="button" key={day.value} className={workingDays.includes(day.value) ? "day active" : "day"} onClick={() => toggleDay(day.value)}>{day.label}</button>)}</div>
                <div className="time-range"><input className="input" type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} /><span>até</span><input className="input" type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} /></div>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="onboarding-step">
              <div className="step-heading"><span className="step-icon"><Scissors size={16} /></span><div><h2>Primeiro serviço</h2><p>Adicione o serviço mais comum do seu espaço.</p></div></div>
              <div className="settings-form">
                <label className="field"><span className="field-label">Nome do serviço</span><input className="input" value={serviceName} onChange={(e) => setServiceName(e.target.value)} placeholder="Ex.: Corte" required minLength={2} autoFocus /></label>
                <div className="field"><span className="field-label">Valor e duração</span><div className="inline-fields"><div className="input-with-prefix"><span>R$</span><input className="input" type="number" min="0" step="1" value={servicePrice} onChange={(e) => setServicePrice(e.target.value)} placeholder="50" /></div><div className="input-with-suffix"><input className="input" type="number" min="5" step="5" value={serviceDuration} onChange={(e) => setServiceDuration(e.target.value)} placeholder="60" /><span>min</span></div></div></div>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="onboarding-step">
              <div className="step-heading"><span className="step-icon"><UserRound size={16} /></span><div><h2>Primeiro profissional</h2><p>Quem realiza os atendimentos (pode ser você).</p></div></div>
              <label className="field"><span className="field-label">Nome do profissional</span><input className="input" value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} placeholder="Ex.: Ana" required minLength={2} autoFocus /></label>
            </section>
          )}

          <div className="onboarding-actions">
            {step > 0 ? (
              <button type="button" className="onboarding-back" onClick={goBack}><ArrowLeft size={15} /> Voltar</button>
            ) : (
              <span className="form-note">Tudo isso poderá ser editado nas configurações.</span>
            )}
            {isLast ? (
              <button type="submit" className="auth-submit" disabled={loading}>{loading ? "Configurando..." : "Ir para minha agenda"} {!loading && <ArrowRight size={16} />}</button>
            ) : (
              <button type="button" className="auth-submit" onClick={goNext}>Continuar <ArrowRight size={16} /></button>
            )}
          </div>
        </form>
      </div>
      <p className="auth-footer">Agenda · gestão simples para o seu negócio</p>
    </div>
  );
}
