"use client";

import { useState, type FormEvent } from "react";
import {
  Sparkles,
  Tag,
  Users,
  Check,
  Calendar,
  ShieldCheck,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { formatCurrency } from "@/lib/client-utils";
import type {
  MembershipFrequencyType,
  MembershipPlanDTO,
  ServiceDTO,
  EmployeeDTO,
} from "@/shared/types";

const BADGE_COLORS = [
  "#6366f1", // Indigo
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#f59e0b", // Amber
  "#10b981", // Emerald
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#64748b", // Slate
];

export function MembershipPlanEditor({
  plan,
  services,
  employees,
  onDone,
  notify,
}: {
  plan?: MembershipPlanDTO | null;
  services: ServiceDTO[];
  employees: EmployeeDTO[];
  onDone: (savedPlan?: MembershipPlanDTO) => void;
  notify: (msg: string, type?: "success" | "error") => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState(plan?.name ?? "");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [price, setPrice] = useState<number | string>(plan?.price ?? "");
  const [frequencyType, setFrequencyType] = useState<MembershipFrequencyType>(
    plan?.frequencyType ?? "WEEKLY_CALENDAR_BASED",
  );
  const [weeklyFrequency, setWeeklyFrequency] = useState<number>(
    plan?.weeklyFrequency ?? 1,
  );
  const [sessionsPerPeriod, setSessionsPerPeriod] = useState<number>(
    plan?.sessionsPerPeriod ?? 4,
  );

  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(
    plan?.serviceIds ?? (services[0]?.id ? [services[0].id] : []),
  );
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>(
    plan?.employeeIds ?? [],
  );

  const [allowReschedule, setAllowReschedule] = useState(plan?.allowReschedule ?? true);
  const [rescheduleHoursNotice, setRescheduleHoursNotice] = useState<number>(
    plan?.rescheduleHoursNotice ?? 2,
  );
  const [allowCarryOver, setAllowCarryOver] = useState(plan?.allowCarryOver ?? false);
  const [noShowConsumesSession, setNoShowConsumesSession] = useState(
    plan?.noShowConsumesSession ?? true,
  );
  const [lateCancelConsumesSession, setLateCancelConsumesSession] = useState(
    plan?.lateCancelConsumesSession ?? true,
  );
  const [badgeColor, setBadgeColor] = useState(plan?.badgeColor ?? "#6366f1");
  const [active, setActive] = useState(plan?.active ?? true);

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id],
    );
  };

  const toggleEmployee = (id: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((eId) => eId !== id) : [...prev, id],
    );
  };

  const selectedServices = services.filter((s) => selectedServiceIds.includes(s.id));
  const estimatedSumAvulso = selectedServices.reduce((acc, s) => acc + s.price, 0);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Informe o nome do plano.");
      return;
    }
    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      setError("Informe um preço mensal válido.");
      return;
    }
    if (selectedServiceIds.length === 0) {
      setError("Selecione pelo menos um serviço incluído.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        price: numPrice,
        billingPeriod: "monthly" as const,
        frequencyType,
        weeklyFrequency: frequencyType === "WEEKLY_CALENDAR_BASED" ? weeklyFrequency : undefined,
        sessionsPerPeriod: frequencyType === "FIXED_MONTHLY_QUOTA" ? sessionsPerPeriod : undefined,
        serviceIds: selectedServiceIds,
        employeeIds: selectedEmployeeIds.length > 0 ? selectedEmployeeIds : undefined,
        allowReschedule,
        rescheduleHoursNotice,
        allowCarryOver,
        noShowConsumesSession,
        lateCancelConsumesSession,
        badgeColor,
        active,
      };

      let saved: MembershipPlanDTO;
      if (plan?.id) {
        saved = await api<MembershipPlanDTO>(`/api/membership-plans/${plan.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        notify("Plano mensal atualizado com sucesso!");
      } else {
        saved = await api<MembershipPlanDTO>("/api/membership-plans", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        notify("Plano mensal criado com sucesso!");
      }

      onDone(saved);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : "Erro ao salvar plano.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="membership-plan-editor-form">
      {error && (
        <div className="alert-banner alert-banner--error" style={{ marginBottom: 16 }}>
          <span>{error}</span>
        </div>
      )}

      {/* Basic Info */}
      <div className="form-section">
        <h4 className="section-title">
          <Sparkles size={15} /> Identificação do Plano
        </h4>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label htmlFor="plan-name" style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>
            Nome do Plano *
          </label>
          <input
            id="plan-name"
            type="text"
            className="input-text"
            placeholder="Ex: Corte Semanal, Terapia Semanal, Aulas 2x/Semana, Manutenção..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ width: "100%", height: 38, padding: "0 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontSize: 13 }}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 12 }}>
          <label htmlFor="plan-desc" style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>
            Descrição / Benefícios
          </label>
          <textarea
            id="plan-desc"
            className="input-textarea"
            rows={2}
            placeholder="Descreva o que está incluído para encantar os seus clientes..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontSize: 12, resize: "vertical" }}
          />
        </div>

        <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="form-group">
            <label htmlFor="plan-price" style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>
              Preço Mensal (R$) *
            </label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <span style={{ position: "absolute", left: 12, fontSize: 12, color: "var(--text-muted)" }}>R$</span>
              <input
                id="plan-price"
                type="number"
                step="0.01"
                min="1"
                className="input-text"
                placeholder="160,00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                style={{ width: "100%", height: 38, paddingLeft: 36, paddingRight: 12, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontSize: 13 }}
              />
            </div>
          </div>

          <div className="form-group">
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>
              Cor de Destaque
            </label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", height: 38 }}>
              {BADGE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setBadgeColor(c)}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    backgroundColor: c,
                    border: badgeColor === c ? "2px solid var(--text-primary)" : "1px solid transparent",
                    boxShadow: "none",
                    cursor: "pointer",
                    padding: 0,
                    outline: "none",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Services Included */}
      <div className="form-section" style={{ marginTop: 20 }}>
        <h4 className="section-title">
          <Tag size={15} /> Serviços Incluídos no Plano
        </h4>
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 10px" }}>
          Selecione um ou mais serviços do catálogo que fazem parte deste pacote recorrente.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
          {services.map((svc) => {
            const isSelected = selectedServiceIds.includes(svc.id);
            return (
              <button
                type="button"
                key={svc.id}
                onClick={() => toggleService(svc.id)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: isSelected ? "1px solid var(--primary)" : "1px solid var(--border)",
                  background: isSelected ? "var(--primary-soft)" : "var(--surface-secondary)",
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  boxShadow: "none",
                  transition: "all 0.15s ease",
                }}
              >
                <div>
                  <strong style={{ display: "block", fontSize: 12, color: "var(--text-primary)" }}>{svc.name}</strong>
                  <small style={{ color: "var(--text-muted)", fontSize: 11 }}>
                    {formatCurrency(svc.price)} • {svc.durationMinutes} min
                  </small>
                </div>
                {isSelected && <Check size={16} color="var(--primary)" />}
              </button>
            );
          })}
        </div>
        {selectedServices.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
            Soma avulsa dos serviços: <strong style={{ color: "var(--text-primary)" }}>{formatCurrency(estimatedSumAvulso)}</strong> por atendimento.
          </div>
        )}
      </div>

      {/* Frequency & Calendar Rules */}
      <div className="form-section" style={{ marginTop: 20 }}>
        <h4 className="section-title">
          <Calendar size={15} /> Modelo de Frequência & Calendário
        </h4>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
          <label
            style={{
              padding: "12px 14px",
              borderRadius: 8,
              border: frequencyType === "WEEKLY_CALENDAR_BASED" ? "1px solid var(--primary)" : "1px solid var(--border)",
              background: frequencyType === "WEEKLY_CALENDAR_BASED" ? "var(--primary-soft)" : "var(--surface-secondary)",
              cursor: "pointer",
              display: "block",
              boxShadow: "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="radio"
                name="frequencyType"
                value="WEEKLY_CALENDAR_BASED"
                checked={frequencyType === "WEEKLY_CALENDAR_BASED"}
                onChange={() => setFrequencyType("WEEKLY_CALENDAR_BASED")}
              />
              <strong style={{ fontSize: 13, color: "var(--text-primary)" }}>Recorrência Semanal</strong>
            </div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0 20px" }}>
              Calcula ocorrências reais no mês (ex: 4 ou 5 semanas conforme o dia escolhido).
            </p>
          </label>

          <label
            style={{
              padding: "12px 14px",
              borderRadius: 8,
              border: frequencyType === "FIXED_MONTHLY_QUOTA" ? "1px solid var(--primary)" : "1px solid var(--border)",
              background: frequencyType === "FIXED_MONTHLY_QUOTA" ? "var(--primary-soft)" : "var(--surface-secondary)",
              cursor: "pointer",
              display: "block",
              boxShadow: "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="radio"
                name="frequencyType"
                value="FIXED_MONTHLY_QUOTA"
                checked={frequencyType === "FIXED_MONTHLY_QUOTA"}
                onChange={() => setFrequencyType("FIXED_MONTHLY_QUOTA")}
              />
              <strong style={{ fontSize: 13, color: "var(--text-primary)" }}>Franquia Mensal Fixa</strong>
            </div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0 20px" }}>
              Quantidade fixa de sessões por mês (ex: sempre 4 ou 8 atendimentos/mês).
            </p>
          </label>
        </div>

        {frequencyType === "WEEKLY_CALENDAR_BASED" ? (
          <div className="form-group" style={{ marginTop: 12 }}>
            <label htmlFor="weekly-freq" style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>
              Frequência Semanal
            </label>
            <select
              id="weekly-freq"
              className="input-select"
              value={weeklyFrequency}
              onChange={(e) => setWeeklyFrequency(Number(e.target.value))}
              style={{ width: "100%", height: 38, padding: "0 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontSize: 12 }}
            >
              <option value={1}>1 atendimento por semana (4 ou 5 no mês)</option>
              <option value={2}>2 atendimentos por semana (ex: Terça + Quinta)</option>
              <option value={3}>3 atendimentos por semana</option>
              <option value={4}>4 atendimentos por semana</option>
              <option value={5}>5 atendimentos por semana</option>
            </select>
          </div>
        ) : (
          <div className="form-group" style={{ marginTop: 12 }}>
            <label htmlFor="sessions-period" style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>
              Sessões Fixas por Mês
            </label>
            <input
              id="sessions-period"
              type="number"
              min="1"
              max="60"
              className="input-text"
              value={sessionsPerPeriod}
              onChange={(e) => setSessionsPerPeriod(Number(e.target.value))}
              style={{ width: "100%", height: 38, padding: "0 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontSize: 13 }}
            />
          </div>
        )}
      </div>

      {/* Available Employees */}
      {employees.length > 0 && (
        <div className="form-section" style={{ marginTop: 20 }}>
          <h4 className="section-title">
            <Users size={15} /> Profissionais Disponíveis
          </h4>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 10px" }}>
            Selecione quais profissionais podem atender por este plano (deixe em branco para permitir todos).
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {employees.map((emp) => {
              const isSelected = selectedEmployeeIds.includes(emp.id);
              return (
                <button
                  type="button"
                  key={emp.id}
                  onClick={() => toggleEmployee(emp.id)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    fontSize: 12,
                    border: isSelected ? "1px solid var(--primary)" : "1px solid var(--border)",
                    background: isSelected ? "var(--primary)" : "var(--surface-secondary)",
                    color: isSelected ? "var(--primary-foreground)" : "var(--text-secondary)",
                    cursor: "pointer",
                    boxShadow: "none",
                  }}
                >
                  {emp.name} {isSelected ? "✓" : "+"}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Rules and Policies */}
      <div className="form-section" style={{ marginTop: 20 }}>
        <h4 className="section-title">
          <ShieldCheck size={15} /> Políticas e Regras de Sessão
        </h4>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={allowReschedule}
              onChange={(e) => setAllowReschedule(e.target.checked)}
            />
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Permitir remarcação de sessões agendadas</span>
          </label>

          {allowReschedule && (
            <div style={{ marginLeft: 22, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Antecedência mínima para remarcar:
              </span>
              <input
                type="number"
                min="0"
                max="72"
                value={rescheduleHoursNotice}
                onChange={(e) => setRescheduleHoursNotice(Number(e.target.value))}
                style={{ width: 56, height: 28, padding: "0 6px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontSize: 12 }}
              />
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>horas</span>
            </div>
          )}

          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={allowCarryOver}
              onChange={(e) => setAllowCarryOver(e.target.checked)}
            />
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              Acumular sessões não utilizadas para o próximo mês (padrão: não acumula)
            </span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={noShowConsumesSession}
              onChange={(e) => setNoShowConsumesSession(e.target.checked)}
            />
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              Falta sem aviso prévio (No-show) consome a sessão do período
            </span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={lateCancelConsumesSession}
              onChange={(e) => setLateCancelConsumesSession(e.target.checked)}
            />
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              Cancelamento tardio fora do prazo consome a sessão do período
            </span>
          </label>
        </div>
      </div>

      {/* Active Status */}
      <div className="form-section" style={{ marginTop: 20 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          <div>
            <strong style={{ fontSize: 12, color: "var(--text-primary)", display: "block" }}>
              Plano Ativo para Novas Adesões
            </strong>
            <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>
              Se desativado, mensalistas existentes continuam com o plano normalmente.
            </p>
          </div>
        </label>
      </div>

      {/* Footer Buttons */}
      <div
        style={{
          marginTop: 24,
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
          borderTop: "1px solid var(--border)",
          paddingTop: 16,
        }}
      >
        <button
          type="button"
          className="button button-secondary"
          onClick={() => onDone()}
          disabled={busy}
          style={{ height: 36, padding: "0 16px", borderRadius: 8, fontSize: 12 }}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="button"
          disabled={busy}
          style={{ height: 36, padding: "0 18px", borderRadius: 8, fontSize: 12 }}
        >
          {busy ? "Salvando..." : plan?.id ? "Salvar Alterações" : "Criar Plano Mensal"}
        </button>
      </div>
    </form>
  );
}
