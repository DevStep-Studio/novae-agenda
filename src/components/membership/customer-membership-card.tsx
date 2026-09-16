"use client";

import { useState } from "react";
import {
  Sparkles,
  Plus,
  DollarSign,
  CalendarPlus,
  X,
  Check,
  AlertTriangle,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { formatCurrency } from "@/lib/client-utils";
import type { CustomerMembershipDTO } from "@/shared/types";
import { MonthSchedulerModal } from "./month-scheduler-modal";
import { AssignMembershipModal } from "./assign-membership-modal";

export function CustomerMembershipCard({
  clientId,
  clientName,
  membership,
  onRefresh,
  notify,
}: {
  clientId: string;
  clientName: string;
  membership?: CustomerMembershipDTO | null;
  onRefresh: () => void;
  notify: (msg: string, type?: "success" | "error") => void;
}) {
  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<"pix" | "cash" | "card">("pix");
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const period = membership?.currentPeriod;
  const isPaid = period?.paymentStatus === "paid";
  const sessionAllowance = period?.sessionAllowance ?? 4;
  const sessionsBooked = period?.sessionsBooked ?? 0;
  const sessionsRemaining = period?.sessionsRemaining ?? 0;

  const handleRecordPayment = async () => {
    if (!membership || !period) return;
    setPaying(true);
    try {
      await api(`/api/customer-memberships/${membership.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          periodId: period.id,
          method: payMethod,
          amount: membership.monthlyPriceSnapshot,
          notes: "Pagamento presencial de mensalidade",
        }),
      });
      notify("Pagamento da mensalidade registrado com sucesso!");
      setPayModalOpen(false);
      onRefresh();
    } catch (err: any) {
      notify(err instanceof ApiError ? err.message : "Erro ao registrar pagamento.", "error");
    } finally {
      setPaying(false);
    }
  };

  const handleCancelMembership = async () => {
    if (!membership) return;
    if (!confirm("Deseja realmente cancelar este plano mensal? O histórico e reservas já criadas serão preservados.")) {
      return;
    }

    setCancelling(true);
    try {
      await api(`/api/customer-memberships/${membership.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled" }),
      });
      notify("Plano mensal cancelado com sucesso.");
      onRefresh();
    } catch (err: any) {
      notify(err instanceof ApiError ? err.message : "Erro ao cancelar plano.", "error");
    } finally {
      setCancelling(false);
    }
  };

  if (!membership || membership.status !== "active") {
    return (
      <div className="customer-membership-empty-card">
        <div className="membership-empty-info">
          <div className="membership-empty-header">
            <span className="membership-empty-icon-wrap">
              <Sparkles size={14} />
            </span>
            <strong className="membership-empty-title">
              Cliente Avulso (Sem Plano)
            </strong>
          </div>
          <p className="membership-empty-subtitle">
            Fidelize este cliente com uma mensalidade recorrente e horários garantidos.
          </p>
        </div>

        <button
          type="button"
          className="membership-bind-btn"
          onClick={() => setAssignOpen(true)}
        >
          <Plus size={14} />
          <span>Vincular Plano Mensal</span>
        </button>

        <AssignMembershipModal
          clientId={clientId}
          clientName={clientName}
          isOpen={assignOpen}
          onClose={() => setAssignOpen(false)}
          onSuccess={() => {
            setAssignOpen(false);
            onRefresh();
          }}
          notify={notify}
        />
      </div>
    );
  }

  return (
    <div className="customer-membership-card">
      {/* Header */}
      <div className="membership-card-head">
        <div className="membership-plan-info">
          <span className="membership-status-badge">
            Plano Ativo
          </span>
          <h4 className="membership-plan-title">
            {membership.membershipPlanName}
          </h4>
          <span className="membership-plan-pricing">
            {formatCurrency(membership.monthlyPriceSnapshot)}/mês •{" "}
            {membership.frequencyType === "WEEKLY_CALENDAR_BASED" ? "Semanal" : "Franquia Fixa"}
          </span>
        </div>

        <div className="membership-head-status">
          <span className={`membership-pay-pill ${isPaid ? "paid" : "pending"}`} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            {isPaid ? (
              <>
                <Check size={13} />
                <span>Mensalidade Paga</span>
              </>
            ) : (
              <>
                <AlertTriangle size={13} />
                <span>Mensalidade Pendente</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* Quota Progress */}
      <div className="membership-quota-card">
        <div className="membership-quota-header">
          <span>
            Franquia do período: <strong>{sessionsBooked} de {sessionAllowance} agendadas</strong>
          </span>
          <span className={sessionsRemaining > 0 ? "quota-remaining" : "quota-full"}>
            {sessionsRemaining > 0 ? `${sessionsRemaining} restante(s)` : "Todas agendadas"}
          </span>
        </div>

        <div className="membership-progress-track">
          <div
            className="membership-progress-bar"
            style={{
              width: `${Math.min(100, (sessionsBooked / sessionAllowance) * 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Booked Sessions List */}
      {period?.bookings && period.bookings.length > 0 && (
        <div className="membership-booked-wrap">
          <span className="membership-booked-title">
            Agendamentos deste Mês ({period.bookings.length})
          </span>
          <div className="membership-booked-list">
            {period.bookings.slice(0, 4).map((b) => (
              <div key={b.appointmentId} className="membership-booked-item">
                <span>
                  <strong>{b.date.slice(8, 10)}/{b.date.slice(5, 7)}</strong> às {b.startTime} • {b.serviceName}
                </span>
                <small className="membership-included-tag">Incluído</small>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="membership-card-actions">
        <button
          type="button"
          className="membership-btn-primary"
          onClick={() => setSchedulerOpen(true)}
        >
          <CalendarPlus size={14} />
          <span>Agendar Mês</span>
        </button>

        {!isPaid && (
          <button
            type="button"
            className="membership-btn-payment"
            onClick={() => setPayModalOpen(true)}
          >
            <DollarSign size={14} />
            <span>Registrar Pagamento</span>
          </button>
        )}

        <button
          type="button"
          className="membership-btn-cancel"
          onClick={handleCancelMembership}
          disabled={cancelling}
          title="Cancelar plano mensal"
        >
          {cancelling ? "Cancelando..." : "Cancelar"}
        </button>
      </div>

      {/* Month Scheduler Modal */}
      <MonthSchedulerModal
        customerMembershipId={membership.id}
        clientName={clientName}
        isOpen={schedulerOpen}
        onClose={() => setSchedulerOpen(false)}
        onSuccess={() => {
          setSchedulerOpen(false);
          onRefresh();
        }}
        notify={notify}
        isOwnerView
      />

      {/* Payment Recording Modal */}
      {payModalOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !paying) setPayModalOpen(false);
          }}
        >
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div>
                <span className="modal-eyebrow">Financeiro</span>
                <h3 className="modal-title">Registrar Mensalidade Paga</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setPayModalOpen(false)}
                title="Fechar"
                aria-label="Fechar modal"
              >
                <X size={17} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: 20 }}>
              <p style={{ margin: "0 0 14px", fontSize: "0.9rem" }}>
                Valor da mensalidade: <strong>{formatCurrency(membership.monthlyPriceSnapshot)}</strong>
              </p>

              <label style={{ fontSize: "0.85rem", display: "block", marginBottom: 6 }}>
                Forma de Pagamento Presencial:
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                {(["pix", "cash", "card"] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPayMethod(method)}
                    style={{
                      padding: "10px",
                      borderRadius: 8,
                      border: payMethod === method ? "2px solid var(--brand, #6366f1)" : "1px solid var(--border-color, #333)",
                      background: payMethod === method ? "rgba(99,102,241,0.15)" : "var(--bg-secondary, #222)",
                      color: payMethod === method ? "var(--brand, #6366f1)" : "var(--text-primary)",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: "0.85rem",
                    }}
                  >
                    {method === "cash" ? "Dinheiro" : method === "card" ? "Cartão" : "PIX"}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" className="btn-secondary" onClick={() => setPayModalOpen(false)} disabled={paying}>
                  Cancelar
                </button>
                <button type="button" className="btn-primary" onClick={handleRecordPayment} disabled={paying}>
                  {paying ? "Registrando..." : "Confirmar Recebimento"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
