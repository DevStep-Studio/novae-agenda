"use client";

import { useState } from "react";
import {
  Sparkles,
  Plus,
  DollarSign,
  CalendarPlus,
  X,
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
      <div
        className="customer-membership-empty-card"
        style={{
          background: "var(--bg-secondary, #222)",
          borderRadius: "var(--radius-md, 8px)",
          padding: "16px",
          border: "1px dashed var(--border-color, #333)",
          marginTop: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-secondary)" }}>
            <Sparkles size={15} color="var(--brand, #6366f1)" />
            <strong style={{ fontSize: "0.9rem", color: "var(--text-primary)" }}>
              Cliente Avulso (Sem Plano)
            </strong>
          </div>
          <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            Fidelize este cliente com uma mensalidade recorrente e horários garantidos.
          </p>
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={() => setAssignOpen(true)}
          style={{ fontSize: "0.85rem", padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Plus size={15} />
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
    <div
      className="customer-membership-card"
      style={{
        background: "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(30,30,30,1) 100%)",
        borderRadius: "var(--radius-md, 10px)",
        padding: "18px",
        border: "1px solid rgba(99,102,241,0.3)",
        marginTop: 16,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <span
            style={{
              background: "rgba(99,102,241,0.18)",
              color: "var(--brand, #6366f1)",
              border: "1px solid rgba(99,102,241,0.4)",
              padding: "2px 8px",
              borderRadius: 12,
              fontSize: "0.7rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Plano Ativo
          </span>
          <h4 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "4px 0 2px" }}>
            {membership.membershipPlanName}
          </h4>
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            {formatCurrency(membership.monthlyPriceSnapshot)}/mês •{" "}
            {membership.frequencyType === "WEEKLY_CALENDAR_BASED" ? "Semanal" : "Franquia Fixa"}
          </span>
        </div>

        <div style={{ textAlign: "right" }}>
          <span
            style={{
              fontSize: "0.75rem",
              padding: "3px 8px",
              borderRadius: 4,
              fontWeight: 600,
              background: isPaid ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
              color: isPaid ? "#10b981" : "#f59e0b",
            }}
          >
            {isPaid ? "✓ Mensalidade Paga" : "⚠️ Mensalidade Pendente"}
          </span>
        </div>
      </div>

      {/* Quota Progress */}
      <div
        style={{
          background: "var(--bg-secondary, #222)",
          padding: "12px",
          borderRadius: "var(--radius-md, 8px)",
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: 6 }}>
          <span>
            Franquia do período: <strong>{sessionsBooked} de {sessionAllowance} agendadas</strong>
          </span>
          <span style={{ color: sessionsRemaining > 0 ? "var(--brand, #6366f1)" : "#10b981", fontWeight: 700 }}>
            {sessionsRemaining > 0 ? `${sessionsRemaining} restante(s)` : "Todas agendadas"}
          </span>
        </div>

        <div style={{ height: 6, borderRadius: 3, background: "var(--border-color, #333)", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, (sessionsBooked / sessionAllowance) * 100)}%`,
              background: "var(--brand, #6366f1)",
            }}
          />
        </div>
      </div>

      {/* Booked Sessions List */}
      {period?.bookings && period.bookings.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: 6, textTransform: "uppercase" }}>
            Agendamentos deste Mês ({period.bookings.length})
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {period.bookings.slice(0, 4).map((b) => (
              <div
                key={b.appointmentId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.85rem",
                  padding: "6px 8px",
                  background: "var(--bg-secondary, #222)",
                  borderRadius: 6,
                }}
              >
                <span>
                  <strong>{b.date.slice(8, 10)}/{b.date.slice(5, 7)}</strong> às {b.startTime} • {b.serviceName}
                </span>
                <small style={{ color: "#10b981", fontWeight: 600 }}>Incluído</small>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setSchedulerOpen(true)}
          style={{ flex: "1 1 140px", fontSize: "0.8rem", padding: "8px 12px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          <CalendarPlus size={15} />
          <span>Agendar Mês</span>
        </button>

        {!isPaid && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setPayModalOpen(true)}
            style={{ flex: "1 1 140px", fontSize: "0.8rem", padding: "8px 12px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <DollarSign size={15} color="#10b981" />
            <span>Registrar Pagamento</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleCancelMembership}
          disabled={cancelling}
          style={{
            background: "transparent",
            border: "1px solid var(--border-color, #333)",
            color: "var(--text-secondary)",
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: "0.8rem",
            cursor: "pointer",
          }}
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
