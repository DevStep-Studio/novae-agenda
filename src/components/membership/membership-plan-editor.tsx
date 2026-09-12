"use client";

import { useState, type FormEvent } from "react";
import {
  Sparkles,
  Tag,
  Users,
  Check,
  Calendar,
  ShieldCheck,
  Plus,
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

      {/* Basic Info Card */}
      <div className="membership-editor-card">
        <div className="membership-editor-card-header">
          <Sparkles size={16} className="membership-card-icon" />
          <div>
            <h4 className="membership-card-title">Identificação do Plano</h4>
            <p className="membership-card-subtitle">Defina o nome comercial, descrição e preço da assinatura</p>
          </div>
        </div>

        <div className="membership-form-group">
          <label htmlFor="plan-name" className="membership-form-label">
            Nome do Plano <span className="req">*</span>
          </label>
          <input
            id="plan-name"
            type="text"
            className="membership-input"
            placeholder="Ex: Corte Semanal, Terapia Semanal, Aulas 2x/Semana..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="membership-form-group">
          <label htmlFor="plan-desc" className="membership-form-label">
            Descrição / Benefícios
          </label>
          <textarea
            id="plan-desc"
            className="membership-textarea"
            rows={2}
            placeholder="Descreva o que está incluído para encantar os seus clientes..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="membership-form-grid-2">
          <div className="membership-form-group">
            <label htmlFor="plan-price" className="membership-form-label">
              Preço Mensal (R$) <span className="req">*</span>
            </label>
            <div className="membership-price-input-wrap">
              <span className="membership-price-prefix">R$</span>
              <input
                id="plan-price"
                type="number"
                step="0.01"
                min="1"
                className="membership-input membership-input-price"
                placeholder="160,00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="membership-form-group">
            <label className="membership-form-label">
              Cor de Destaque / Badge
            </label>
            <div className="membership-color-picker-row">
              {BADGE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setBadgeColor(c)}
                  className={`membership-color-btn ${badgeColor === c ? "active" : ""}`}
                  style={{ backgroundColor: c }}
                  title={`Selecionar cor ${c}`}
                  aria-label={`Selecionar cor ${c}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Services Included Card */}
      <div className="membership-editor-card">
        <div className="membership-editor-card-header">
          <Tag size={16} className="membership-card-icon" />
          <div>
            <h4 className="membership-card-title">Serviços Incluídos no Plano</h4>
            <p className="membership-card-subtitle">Selecione os serviços do catálogo que fazem parte deste pacote</p>
          </div>
        </div>

        <div className="membership-service-cards-grid">
          {services.map((svc) => {
            const isSelected = selectedServiceIds.includes(svc.id);
            return (
              <button
                type="button"
                key={svc.id}
                onClick={() => toggleService(svc.id)}
                className={`membership-service-select-card ${isSelected ? "selected" : ""}`}
              >
                <div className="membership-service-select-info">
                  <strong className="membership-service-select-name">{svc.name}</strong>
                  <span className="membership-service-select-meta">
                    {formatCurrency(svc.price)} • {svc.durationMinutes} min
                  </span>
                </div>
                {isSelected ? (
                  <div className="membership-service-check">
                    <Check size={14} />
                  </div>
                ) : (
                  <div className="membership-service-plus">
                    <Plus size={13} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {selectedServices.length > 0 && (
          <div className="membership-services-sum-bar">
            <span>Soma avulsa dos serviços:</span>
            <strong>{formatCurrency(estimatedSumAvulso)}</strong>
            <span className="membership-sum-note">por atendimento</span>
          </div>
        )}
      </div>

      {/* Frequency & Calendar Rules Card */}
      <div className="membership-editor-card">
        <div className="membership-editor-card-header">
          <Calendar size={16} className="membership-card-icon" />
          <div>
            <h4 className="membership-card-title">Modelo de Frequência & Calendário</h4>
            <p className="membership-card-subtitle">Como o sistema deve calcular e agendar as sessões mensais</p>
          </div>
        </div>

        <div className="membership-freq-options-grid">
          <label
            className={`membership-freq-option-card ${frequencyType === "WEEKLY_CALENDAR_BASED" ? "active" : ""}`}
            onClick={() => setFrequencyType("WEEKLY_CALENDAR_BASED")}
          >
            <div className="membership-freq-option-header">
              <input
                type="radio"
                name="frequencyType"
                value="WEEKLY_CALENDAR_BASED"
                checked={frequencyType === "WEEKLY_CALENDAR_BASED"}
                onChange={() => setFrequencyType("WEEKLY_CALENDAR_BASED")}
                className="membership-radio"
              />
              <strong className="membership-freq-option-title">Recorrência Semanal</strong>
            </div>
            <p className="membership-freq-option-desc">
              Calcula ocorrências reais no mês (ex: 4 ou 5 semanas conforme o dia escolhido no calendário).
            </p>
          </label>

          <label
            className={`membership-freq-option-card ${frequencyType === "FIXED_MONTHLY_QUOTA" ? "active" : ""}`}
            onClick={() => setFrequencyType("FIXED_MONTHLY_QUOTA")}
          >
            <div className="membership-freq-option-header">
              <input
                type="radio"
                name="frequencyType"
                value="FIXED_MONTHLY_QUOTA"
                checked={frequencyType === "FIXED_MONTHLY_QUOTA"}
                onChange={() => setFrequencyType("FIXED_MONTHLY_QUOTA")}
                className="membership-radio"
              />
              <strong className="membership-freq-option-title">Franquia Mensal Fixa</strong>
            </div>
            <p className="membership-freq-option-desc">
              Quantidade fixa de sessões por mês (ex: sempre 4 ou 8 atendimentos/mês, independente das semanas).
            </p>
          </label>
        </div>

        {frequencyType === "WEEKLY_CALENDAR_BASED" ? (
          <div className="membership-form-group" style={{ marginTop: 14 }}>
            <label htmlFor="weekly-freq" className="membership-form-label">
              Frequência Semanal
            </label>
            <select
              id="weekly-freq"
              className="membership-select"
              value={weeklyFrequency}
              onChange={(e) => setWeeklyFrequency(Number(e.target.value))}
            >
              <option value={1}>1 atendimento por semana (4 ou 5 no mês)</option>
              <option value={2}>2 atendimentos por semana (ex: Terça + Quinta)</option>
              <option value={3}>3 atendimentos por semana</option>
              <option value={4}>4 atendimentos por semana</option>
              <option value={5}>5 atendimentos por semana</option>
            </select>
          </div>
        ) : (
          <div className="membership-form-group" style={{ marginTop: 14 }}>
            <label htmlFor="sessions-period" className="membership-form-label">
              Sessões Fixas por Mês
            </label>
            <input
              id="sessions-period"
              type="number"
              min="1"
              max="60"
              className="membership-input"
              value={sessionsPerPeriod}
              onChange={(e) => setSessionsPerPeriod(Number(e.target.value))}
            />
          </div>
        )}
      </div>

      {/* Available Employees Card */}
      {employees.length > 0 && (
        <div className="membership-editor-card">
          <div className="membership-editor-card-header">
            <Users size={16} className="membership-card-icon" />
            <div>
              <h4 className="membership-card-title">Profissionais Disponíveis</h4>
              <p className="membership-card-subtitle">Selecione quais profissionais podem atender por este plano (vazio = todos)</p>
            </div>
          </div>

          <div className="membership-employees-chips-wrap">
            {employees.map((emp) => {
              const isSelected = selectedEmployeeIds.includes(emp.id);
              return (
                <button
                  type="button"
                  key={emp.id}
                  onClick={() => toggleEmployee(emp.id)}
                  className={`membership-emp-chip ${isSelected ? "selected" : ""}`}
                >
                  <span>{emp.name}</span>
                  <span className="chip-indicator">{isSelected ? "✓" : "+"}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Policies Card */}
      <div className="membership-editor-card">
        <div className="membership-editor-card-header">
          <ShieldCheck size={16} className="membership-card-icon" />
          <div>
            <h4 className="membership-card-title">Políticas e Regras de Sessão</h4>
            <p className="membership-card-subtitle">Regras de remarcação, faltas e validade das sessões</p>
          </div>
        </div>

        <div className="membership-policies-list">
          <label className="membership-policy-toggle">
            <input
              type="checkbox"
              checked={allowReschedule}
              onChange={(e) => setAllowReschedule(e.target.checked)}
              className="membership-checkbox"
            />
            <div className="policy-info">
              <span className="policy-title">Permitir remarcação de sessões agendadas</span>
              <span className="policy-desc">Cliente pode trocar o horário de uma sessão do plano</span>
            </div>
          </label>

          {allowReschedule && (
            <div className="membership-reschedule-hours-row">
              <span className="reschedule-label">Antecedência mínima para remarcar:</span>
              <input
                type="number"
                min="0"
                max="72"
                value={rescheduleHoursNotice}
                onChange={(e) => setRescheduleHoursNotice(Number(e.target.value))}
                className="membership-input-mini"
              />
              <span className="reschedule-unit">horas</span>
            </div>
          )}

          <label className="membership-policy-toggle">
            <input
              type="checkbox"
              checked={allowCarryOver}
              onChange={(e) => setAllowCarryOver(e.target.checked)}
              className="membership-checkbox"
            />
            <div className="policy-info">
              <span className="policy-title">Acumular sessões não utilizadas para o mês seguinte</span>
              <span className="policy-desc">Sessões não realizadas no mês corrente não expiram</span>
            </div>
          </label>

          <label className="membership-policy-toggle">
            <input
              type="checkbox"
              checked={noShowConsumesSession}
              onChange={(e) => setNoShowConsumesSession(e.target.checked)}
              className="membership-checkbox"
            />
            <div className="policy-info">
              <span className="policy-title">Falta sem aviso prévio (No-show) consome a sessão</span>
              <span className="policy-desc">Não permite reagendar sessão perdida por não comparecimento</span>
            </div>
          </label>

          <label className="membership-policy-toggle">
            <input
              type="checkbox"
              checked={lateCancelConsumesSession}
              onChange={(e) => setLateCancelConsumesSession(e.target.checked)}
              className="membership-checkbox"
            />
            <div className="policy-info">
              <span className="policy-title">Cancelamento tardio fora do prazo consome a sessão</span>
              <span className="policy-desc">Cancelamentos em cima da hora contam como utilizados</span>
            </div>
          </label>
        </div>
      </div>

      {/* Active Status Card */}
      <div className="membership-editor-card">
        <label className="membership-policy-toggle">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="membership-checkbox"
          />
          <div className="policy-info">
            <span className="policy-title">Plano Ativo para Novas Adesões</span>
            <span className="policy-desc">Se desativado, mensalistas existentes continuam normalmente mas novos clientes não podem aderir</span>
          </div>
        </label>
      </div>

      {/* Footer Buttons */}
      <div className="membership-editor-footer">
        <button
          type="button"
          className="membership-btn-secondary"
          onClick={() => onDone()}
          disabled={busy}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="membership-btn-primary"
          disabled={busy}
        >
          {busy ? "Salvando..." : plan?.id ? "Salvar Alterações" : "Criar Plano Mensal"}
        </button>
      </div>
    </form>
  );
}
