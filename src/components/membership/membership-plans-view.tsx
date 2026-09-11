"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  Plus,
  Pencil,
  Tag,
  Clock3,
  Users,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
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

  const loadPlans = async () => {
    setLoading(true);
    try {
      const data = await api<MembershipPlanDTO[]>("/api/membership-plans?includeInactive=true");
      setPlans(data || []);
    } catch (err: any) {
      notify(err instanceof ApiError ? err.message : "Erro ao carregar planos.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

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
      {/* Top Banner & KPI Bar */}
      <div
        className="membership-intro-card"
        style={{
          background: "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.06) 100%)",
          border: "1px solid rgba(99,102,241,0.25)",
          borderRadius: "var(--radius-lg, 12px)",
          padding: "20px 24px",
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--brand, #6366f1)" }}>
            <Sparkles size={18} />
            <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Planos Recorrentes & Mensalistas
            </span>
          </div>
          <h2 style={{ fontSize: "1.4rem", margin: "4px 0 6px", fontWeight: 700 }}>
            Planos Mensais para Clientes
          </h2>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem", maxWidth: 620 }}>
            Ofereça planos semanais ou franquias mensais personalizadas para barbeiros, psicólogos, professores,
            manicures, personal trainers e clínicas. Garanta receita recorrente com agendamento do mês inteiro.
          </p>
        </div>

        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div
            style={{
              padding: "10px 16px",
              background: "var(--bg-card, #1e1e1e)",
              border: "1px solid var(--border-color, #333)",
              borderRadius: "var(--radius-md, 8px)",
              textAlign: "center",
            }}
          >
            <small style={{ color: "var(--text-secondary)", display: "block", fontSize: "0.75rem" }}>
              Mensalistas Ativos
            </small>
            <strong style={{ fontSize: "1.2rem", color: "var(--brand, #6366f1)" }}>
              {totalActiveMembers}
            </strong>
          </div>

          <div
            style={{
              padding: "10px 16px",
              background: "var(--bg-card, #1e1e1e)",
              border: "1px solid var(--border-color, #333)",
              borderRadius: "var(--radius-md, 8px)",
              textAlign: "center",
            }}
          >
            <small style={{ color: "var(--text-secondary)", display: "block", fontSize: "0.75rem" }}>
              Planos Criados
            </small>
            <strong style={{ fontSize: "1.2rem" }}>{plans.length}</strong>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={() => setIsCreating(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 20px",
              fontWeight: 600,
            }}
          >
            <Plus size={18} />
            <span>Novo Plano Mensal</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      {plans.length > 0 && (
        <div className="category-tabs" style={{ marginBottom: 20 }}>
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
      <div
        className="membership-plan-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: 20,
        }}
      >
        {visiblePlans.map((plan) => {
          const badgeBg = plan.badgeColor || "#6366f1";
          return (
            <article
              key={plan.id}
              className={`membership-plan-card ${!plan.active ? "inactive" : ""}`}
              style={{
                background: "var(--bg-card, #1e1e1e)",
                border: plan.active ? "1px solid var(--border-color, #333)" : "1px dashed var(--border-color, #444)",
                borderRadius: "var(--radius-lg, 12px)",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                position: "relative",
                transition: "transform 0.15s ease, border-color 0.15s ease",
                opacity: plan.active ? 1 : 0.7,
              }}
            >
              <div>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <span
                    style={{
                      background: `${badgeBg}22`,
                      color: badgeBg,
                      border: `1px solid ${badgeBg}55`,
                      padding: "4px 10px",
                      borderRadius: "16px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Calendar size={12} />
                    {plan.frequencyType === "WEEKLY_CALENDAR_BASED"
                      ? plan.weeklyFrequency === 1
                        ? "Semanal (4 a 5 sessões/mês)"
                        : `${plan.weeklyFrequency}x por semana`
                      : `${plan.sessionsPerPeriod} sessões/mês (fixo)`}
                  </span>

                  <button
                    type="button"
                    onClick={() => setEditingPlan(plan)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: "0.8rem",
                      padding: "4px 8px",
                      borderRadius: 6,
                    }}
                    title="Editar plano"
                  >
                    <Pencil size={13} />
                    <span>Editar</span>
                  </button>
                </div>

                {/* Plan Title & Desc */}
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 6px" }}>
                  {plan.name}
                </h3>
                {plan.description && (
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: "0 0 16px", lineHeight: 1.4 }}>
                    {plan.description}
                  </p>
                )}

                {/* Price Display */}
                <div
                  style={{
                    background: "var(--bg-secondary, #252525)",
                    padding: "12px 16px",
                    borderRadius: "var(--radius-md, 8px)",
                    marginBottom: 16,
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "block" }}>
                      Mensalidade do Cliente
                    </span>
                    <strong style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--brand, #6366f1)" }}>
                      {formatCurrency(plan.price)}
                    </strong>
                    <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginLeft: 4 }}>
                      /mês
                    </span>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block" }}>
                      Cobrança
                    </span>
                    <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Presencial</span>
                  </div>
                </div>

                {/* Included Services */}
                <div style={{ marginBottom: 16 }}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "var(--text-secondary)",
                      display: "block",
                      marginBottom: 8,
                      fontWeight: 700,
                    }}
                  >
                    Serviços Incluídos
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {plan.services.map((s) => (
                      <div
                        key={s.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: "0.85rem",
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <CheckCircle2 size={14} color={badgeBg} />
                          <span>{s.name}</span>
                        </span>
                        <small style={{ color: "var(--text-secondary)" }}>
                          {formatCurrency(s.price)} avulso ({s.durationMinutes} min)
                        </small>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rules Summary */}
                <div
                  style={{
                    borderTop: "1px solid var(--border-color, #333)",
                    paddingTop: 12,
                    marginBottom: 16,
                    fontSize: "0.8rem",
                    color: "var(--text-secondary)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <div>
                    ✓ Remarcação: {plan.allowReschedule ? `Permitida até ${plan.rescheduleHoursNotice}h antes` : "Não permitida"}
                  </div>
                  <div>
                    ✓ Expiração: {plan.allowCarryOver ? "Acumula para o próximo mês" : "Expira no final do mês"}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div
                style={{
                  borderTop: "1px solid var(--border-color, #333)",
                  paddingTop: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Users size={15} color="var(--text-secondary)" />
                  <strong style={{ fontSize: "0.85rem" }}>
                    {plan.activeMembersCount || 0}{" "}
                    <span style={{ fontWeight: 400, color: "var(--text-secondary)" }}>
                      mensalistas
                    </span>
                  </strong>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "0.8rem", color: plan.active ? "#10b981" : "var(--text-secondary)" }}>
                    {plan.active ? "Ativo" : "Pausado"}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={plan.active}
                    className={`service-toggle-btn ${plan.active ? "active" : ""}`}
                    onClick={() => handleToggleActive(plan)}
                    title={plan.active ? "Clique para desativar novas adesões" : "Clique para ativar plano"}
                  >
                    <span className="service-toggle-thumb" />
                  </button>
                </div>
              </div>
            </article>
          );
        })}

        {/* Add Plan Card */}
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          style={{
            background: "transparent",
            border: "2px dashed var(--border-color, #333)",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "32px 20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            color: "var(--text-secondary)",
            cursor: "pointer",
            minHeight: 280,
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--brand, #6366f1)";
            e.currentTarget.style.color = "var(--brand, #6366f1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border-color, #333)";
            e.currentTarget.style.color = "var(--text-secondary)";
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "rgba(99,102,241,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--brand, #6366f1)",
            }}
          >
            <Plus size={24} />
          </div>
          <strong style={{ fontSize: "1.05rem", color: "var(--text-primary)" }}>
            Criar Novo Plano Mensal
          </strong>
          <small style={{ textAlign: "center", maxWidth: 220, fontSize: "0.8rem" }}>
            Defina preço, serviços incluídos e recorrência semanal ou fixa
          </small>
        </button>
      </div>

      {/* Empty State */}
      {visiblePlans.length === 0 && !loading && (
        <div
          style={{
            textAlign: "center",
            padding: "48px 20px",
            background: "var(--bg-card, #1e1e1e)",
            borderRadius: "var(--radius-lg, 12px)",
            border: "1px solid var(--border-color, #333)",
            marginTop: 20,
          }}
        >
          <Sparkles size={36} color="var(--brand, #6366f1)" style={{ margin: "0 auto 12px" }} />
          <h3 style={{ fontSize: "1.1rem", marginBottom: 6 }}>Nenhum plano mensal cadastrado</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", maxWidth: 460, margin: "0 auto 16px" }}>
            Crie planos mensais para fidelizar seus clientes com agendamentos automáticos e pagamento recorrente.
          </p>
          <button type="button" className="btn-primary" onClick={() => setIsCreating(true)}>
            <Plus size={16} /> Criar Primeiro Plano
          </button>
        </div>
      )}

      {/* Create Modal */}
      {isCreating && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCreating(false);
          }}
        >
          <div className="modal-dialog modal-dialog--wide">
            <div className="modal-header">
              <div>
                <span className="modal-eyebrow">Novo Plano</span>
                <h3 className="modal-title">Cadastrar Plano Mensal Recorrente</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsCreating(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: "75vh", overflowY: "auto", padding: "20px 24px" }}>
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
          <div className="modal-dialog modal-dialog--wide">
            <div className="modal-header">
              <div>
                <span className="modal-eyebrow">Editar Plano</span>
                <h3 className="modal-title">{editingPlan.name}</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditingPlan(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: "75vh", overflowY: "auto", padding: "20px 24px" }}>
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
