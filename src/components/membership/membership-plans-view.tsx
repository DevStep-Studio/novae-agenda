"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Sparkles,
  Plus,
  Pencil,
  Users,
  CheckCircle2,
  Calendar,
  Layers,
  TrendingUp,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { formatCurrency } from "@/lib/client-utils";
import type { MembershipPlanDTO, ServiceDTO, EmployeeDTO } from "@/shared/types";
import { MembershipPlanEditor } from "./membership-plan-editor";

export function MembershipPlansView({
  services,
  employees,
  notify,
}: {
  services: ServiceDTO[];
  employees: EmployeeDTO[];
  notify: (msg: string, type?: "success" | "error") => void;
}) {
  const [plans, setPlans] = useState<MembershipPlanDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [editingPlan, setEditingPlan] = useState<MembershipPlanDTO | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const loadPlans = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await api<MembershipPlanDTO[]>("/api/membership-plans?includeInactive=true");
      setPlans(data || []);
    } catch (err: any) {
      notify(err instanceof ApiError ? err.message : "Erro ao carregar planos.", "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const data = await api<MembershipPlanDTO[]>("/api/membership-plans?includeInactive=true");
        if (!cancelled) setPlans(data || []);
      } catch (err: any) {
        if (!cancelled) notify(err instanceof ApiError ? err.message : "Erro ao carregar planos.", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [notify]);

  const handleToggleActive = async (plan: MembershipPlanDTO) => {
    try {
      const updated = await api<MembershipPlanDTO>(`/api/membership-plans/${plan.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !plan.active }),
      });
      setPlans((prev) => prev.map((p) => (p.id === plan.id ? updated : p)));
      notify(`Plano ${updated.active ? "ativado" : "desativado"} com sucesso!`);
    } catch (err: any) {
      notify(err instanceof ApiError ? err.message : "Erro ao alterar status do plano.", "error");
    }
  };

  const visiblePlans = plans.filter((p) => {
    if (filter === "active") return p.active;
    if (filter === "inactive") return !p.active;
    return true;
  });

  const totalActiveMembers = plans.reduce((acc, p) => acc + (p.activeMembersCount || 0), 0);
  const averagePrice =
    plans.length > 0
      ? Math.round(plans.reduce((acc, p) => acc + p.price, 0) / plans.length)
      : 0;

  return (
    <div className="membership-plans-container">
      {/* Page Header matching standard app view */}
      <div className="page-intro" style={{ marginBottom: 0 }}>
        <div>
          <p className="eyebrow">Recorrência & Mensalistas</p>
          <h1>Planos Mensais</h1>
          <p className="intro-copy">
            Ofereça mensalidades personalizadas para fidelizar seus clientes e garantir receita previsível.
          </p>
        </div>
        <button
          type="button"
          className="button"
          onClick={() => setIsCreating(true)}
          style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
        >
          <Plus size={16} />
          <span>Novo plano mensal</span>
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="metrics-grid membership-metrics-grid">
        <div className="metric-card">
          <div className="metric-icon metric-teal">
            <Users size={18} />
          </div>
          <div className="metric-copy">
            <p>Mensalistas ativos</p>
            <strong>{totalActiveMembers}</strong>
            <span className="metric-detail">em planos recorrentes</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon metric-teal">
            <Layers size={18} />
          </div>
          <div className="metric-copy">
            <p>Planos cadastrados</p>
            <strong>{plans.length}</strong>
            <span className="metric-detail">{plans.filter((p) => p.active).length} ativos para adesão</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon metric-teal">
            <TrendingUp size={18} />
          </div>
          <div className="metric-copy">
            <p>Preço médio</p>
            <strong>{formatCurrency(averagePrice)}</strong>
            <span className="metric-detail">por mensalidade</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs when plans exist */}
      {plans.length > 0 && (
        <div className="category-tabs" style={{ marginBottom: 4 }}>
          <button
            type="button"
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            Todos ({plans.length})
          </button>
          <button
            type="button"
            className={filter === "active" ? "active" : ""}
            onClick={() => setFilter("active")}
          >
            Ativos ({plans.filter((p) => p.active).length})
          </button>
          <button
            type="button"
            className={filter === "inactive" ? "active" : ""}
            onClick={() => setFilter("inactive")}
          >
            Inativos ({plans.filter((p) => !p.active).length})
          </button>
        </div>
      )}

      {/* Grid of Membership Plans */}
      {visiblePlans.length > 0 ? (
        <div className="membership-plan-grid">
          {visiblePlans.map((plan) => {
            const freqLabel =
              plan.frequencyType === "WEEKLY_CALENDAR_BASED"
                ? plan.weeklyFrequency === 1
                  ? "Semanal (4 a 5 sessões/mês)"
                  : `${plan.weeklyFrequency}x por semana`
                : `${plan.sessionsPerPeriod} sessões/mês (fixo)`;

            return (
              <article
                key={plan.id}
                className={`membership-plan-card ${!plan.active ? "inactive" : ""}`}
              >
                {/* Header with Frequency Tag & Edit Action */}
                <div className="membership-card-head">
                  <span className="membership-freq-badge">
                    <Calendar size={12} />
                    <span>{freqLabel}</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => setEditingPlan(plan)}
                    className="client-action-btn view"
                    title="Editar plano mensal"
                  >
                    <Pencil size={13} />
                  </button>
                </div>

                {/* Plan Info */}
                <div className="membership-plan-info">
                  <h3 className="membership-plan-title">{plan.name}</h3>
                  {plan.description && (
                    <p className="membership-plan-desc">{plan.description}</p>
                  )}
                </div>

                {/* Price Block */}
                <div className="membership-price-block">
                  <div>
                    <span className="membership-price-label">Mensalidade</span>
                    <div className="membership-price-val">
                      <strong>{formatCurrency(plan.price)}</strong>
                      <span>/mês</span>
                    </div>
                  </div>

                  <div className="membership-billing-mode">
                    <span>Cobrança</span>
                    <strong>Presencial</strong>
                  </div>
                </div>

                {/* Included Services */}
                <div className="membership-services-section">
                  <span className="membership-services-header">Serviços Incluídos</span>
                  <div className="membership-services-list">
                    {plan.services.map((s) => (
                      <div key={s.id} className="membership-service-item">
                        <span className="membership-service-name">
                          <CheckCircle2 size={13} className="membership-check-icon" />
                          <span>{s.name}</span>
                        </span>
                        <span className="membership-service-meta">
                          {formatCurrency(s.price)} avulso ({s.durationMinutes} min)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rules Summary */}
                <div className="membership-rules-block">
                  <div className="membership-rule-item">
                    <span>Remarcação:</span>
                    <strong>
                      {plan.allowReschedule
                        ? `Até ${plan.rescheduleHoursNotice}h antes`
                        : "Não permitida"}
                    </strong>
                  </div>
                  <div className="membership-rule-item">
                    <span>Expiração:</span>
                    <strong>
                      {plan.allowCarryOver ? "Acumula para o próximo mês" : "Expira no final do mês"}
                    </strong>
                  </div>
                </div>

                {/* Footer with Subscribers count & Status Switch */}
                <div className="membership-card-footer">
                  <div className="membership-members-count">
                    <Users size={14} />
                    <strong>{plan.activeMembersCount || 0}</strong>
                    <span>{plan.activeMembersCount === 1 ? "mensalista" : "mensalistas"}</span>
                  </div>

                  <div className="membership-status-toggle">
                    <span
                      className={`membership-status-label ${
                        plan.active ? "active" : "paused"
                      }`}
                    >
                      {plan.active ? "Ativo" : "Pausado"}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={plan.active}
                      className={`service-toggle-btn ${plan.active ? "active" : ""}`}
                      onClick={() => handleToggleActive(plan)}
                      title={
                        plan.active
                          ? "Clique para desativar novas adesões"
                          : "Clique para ativar plano"
                      }
                    >
                      <span className="service-toggle-thumb" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : !loading ? (
        <div
          className="empty-state"
          style={{
            minHeight: 280,
            border: "1px dashed var(--border)",
            borderRadius: 12,
            background: "var(--surface)",
            padding: "40px 20px",
          }}
        >
          <div className="empty-icon">
            <Sparkles size={22} />
          </div>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-primary)",
              margin: "6px 0 2px",
            }}
          >
            Nenhum plano mensal cadastrado
          </h3>
          <p
            style={{
              maxWidth: 380,
              color: "var(--text-secondary)",
              fontSize: 12,
              lineHeight: 1.5,
              margin: "0 auto 16px",
            }}
          >
            Crie planos mensais para fidelizar seus clientes com agendamentos automáticos e previsibilidade de receita.
          </p>
          <button
            type="button"
            className="button"
            onClick={() => setIsCreating(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, margin: "0 auto" }}
          >
            <Plus size={16} />
            <span>Criar Primeiro Plano</span>
          </button>
        </div>
      ) : null}

      {/* Create Modal */}
      {isCreating && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCreating(false);
          }}
        >
          <div className="modal modal-wide">
            <div className="modal-header">
              <div>
                <span className="modal-eyebrow">Novo Plano</span>
                <h3 className="modal-title">Cadastrar Plano Mensal Recorrente</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsCreating(false)}
                title="Fechar"
                aria-label="Fechar modal"
              >
                <X size={17} />
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: "78vh", overflowY: "auto", padding: "20px 24px" }}>
              <MembershipPlanEditor
                services={services}
                employees={employees}
                onDone={(saved) => {
                  setIsCreating(false);
                  if (saved) {
                    setPlans((prev) => [saved, ...prev]);
                  }
                }}
                notify={notify}
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingPlan && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingPlan(null);
          }}
        >
          <div className="modal modal-wide">
            <div className="modal-header">
              <div>
                <span className="modal-eyebrow">Editar Plano</span>
                <h3 className="modal-title">{editingPlan.name}</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditingPlan(null)}
                title="Fechar"
                aria-label="Fechar modal"
              >
                <X size={17} />
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: "78vh", overflowY: "auto", padding: "20px 24px" }}>
              <MembershipPlanEditor
                plan={editingPlan}
                services={services}
                employees={employees}
                onDone={(saved) => {
                  setEditingPlan(null);
                  if (saved) {
                    setPlans((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
                  }
                }}
                notify={notify}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
