"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Sparkles, Calendar, Clock3, User, Coins, ShieldCheck, X } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { formatCurrency } from "@/lib/client-utils";
import type { MembershipPlanDTO, EmployeeDTO, CustomerMembershipDTO } from "@/shared/types";

const WEEKDAYS = [
  { id: 0, label: "Domingo" },
  { id: 1, label: "Segunda-feira" },
  { id: 2, label: "Terça-feira" },
  { id: 3, label: "Quarta-feira" },
  { id: 4, label: "Quinta-feira" },
  { id: 5, label: "Sexta-feira" },
  { id: 6, label: "Sábado" },
];

export function AssignMembershipModal({
  clientId,
  clientName,
  isOpen,
  onClose,
  onSuccess,
  notify,
}: {
  clientId: string;
  clientName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (membership: CustomerMembershipDTO) => void;
  notify: (msg: string, type?: "success" | "error") => void;
}) {
  const [plans, setPlans] = useState<MembershipPlanDTO[]>([]);
  const [employees, setEmployees] = useState<EmployeeDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [preferredProfessionalId, setPreferredProfessionalId] = useState("");
  const [preferredWeekdays, setPreferredWeekdays] = useState<number[]>([4]); // Thursday
  const [preferredTime, setPreferredTime] = useState("14:00");
  const [initialPaymentRecorded, setInitialPaymentRecorded] = useState(false);
  const [initialPaymentMethod, setInitialPaymentMethod] = useState<"pix" | "cash" | "card">("pix");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      Promise.all([
        api<MembershipPlanDTO[]>("/api/membership-plans"),
        api<EmployeeDTO[]>("/api/employees"),
      ])
        .then(([plansData, empData]) => {
          setPlans(plansData || []);
          setEmployees(empData || []);
          if (plansData?.length > 0) {
            setSelectedPlanId(plansData[0].id);
          }
        })
        .catch(() => {
          notify("Erro ao carregar planos disponíveis.", "error");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen]);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  const toggleWeekday = (id: number) => {
    setPreferredWeekdays((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((d) => d !== id) : prev) : [...prev, id],
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId) {
      setError("Selecione um plano mensal.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const created = await api<CustomerMembershipDTO>("/api/customer-memberships", {
        method: "POST",
        body: JSON.stringify({
          clientId,
          membershipPlanId: selectedPlanId,
          preferredProfessionalId: preferredProfessionalId || undefined,
          preferredWeekdays,
          preferredTime: preferredTime || undefined,
          initialPaymentRecorded,
          initialPaymentMethod: initialPaymentRecorded ? initialPaymentMethod : undefined,
          notes: notes.trim() || undefined,
        }),
      });

      notify(`Cliente vinculado ao plano ${selectedPlan?.name} com sucesso!`);
      onSuccess(created);
      onClose();
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : "Erro ao vincular plano.");
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="modal-dialog" style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <div>
            <span className="modal-eyebrow">Mensalista</span>
            <h3 className="modal-title">Vincular Plano Mensal</h3>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              Cliente: <strong>{clientName}</strong>
            </p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} disabled={busy}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body" style={{ padding: "20px" }}>
          {error && (
            <div className="alert-banner alert-banner--error" style={{ marginBottom: 14 }}>
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>Carregando planos...</div>
          ) : plans.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-secondary)" }}>
              Nenhum plano mensal ativo encontrado. Cadastre um plano primeiro em Serviços → Planos Mensais.
            </div>
          ) : (
            <>
              {/* Select Plan */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label htmlFor="select-plan">Selecione o Plano *</label>
                <select
                  id="select-plan"
                  className="input-select"
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  required
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatCurrency(p.price)}/mês (
                      {p.frequencyType === "WEEKLY_CALENDAR_BASED"
                        ? `${p.weeklyFrequency ?? 1}x/semana`
                        : `${p.sessionsPerPeriod} sessões`}
                      )
                    </option>
                  ))}
                </select>
              </div>

              {selectedPlan && (
                <div
                  style={{
                    background: "var(--bg-secondary, #222)",
                    padding: "12px 14px",
                    borderRadius: "var(--radius-md, 8px)",
                    marginBottom: 16,
                    fontSize: "0.85rem",
                  }}
                >
                  <strong style={{ color: "var(--brand, #6366f1)" }}>{selectedPlan.name}</strong>
                  <div style={{ color: "var(--text-secondary)", marginTop: 4 }}>
                    {formatCurrency(selectedPlan.price)}/mês • Serviços:{" "}
                    {selectedPlan.services.map((s) => s.name).join(", ")}
                  </div>
                </div>
              )}

              {/* Preferred Professional */}
              {employees.length > 0 && (
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label htmlFor="pref-emp">Profissional Preferido (Opcional)</label>
                  <select
                    id="pref-emp"
                    className="input-select"
                    value={preferredProfessionalId}
                    onChange={(e) => setPreferredProfessionalId(e.target.value)}
                  >
                    <option value="">Qualquer profissional disponível</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Preferred Weekdays */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Dia(s) da Semana Preferido(s)</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  {WEEKDAYS.map((wd) => {
                    const isSelected = preferredWeekdays.includes(wd.id);
                    return (
                      <button
                        key={wd.id}
                        type="button"
                        onClick={() => toggleWeekday(wd.id)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 6,
                          fontSize: "0.8rem",
                          fontWeight: isSelected ? 700 : 500,
                          border: isSelected ? "1px solid var(--brand, #6366f1)" : "1px solid var(--border-color, #333)",
                          background: isSelected ? "var(--brand, #6366f1)" : "var(--bg-secondary, #2a2a2a)",
                          color: isSelected ? "#fff" : "var(--text-primary)",
                          cursor: "pointer",
                        }}
                      >
                        {wd.label.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Preferred Time */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label htmlFor="pref-time">Horário Preferido</label>
                <input
                  id="pref-time"
                  type="time"
                  className="input-text"
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                />
              </div>

              {/* Initial Payment Checkbox */}
              <div
                style={{
                  background: "var(--bg-secondary, #222)",
                  padding: "14px",
                  borderRadius: "var(--radius-md, 8px)",
                  marginBottom: 16,
                }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={initialPaymentRecorded}
                    onChange={(e) => setInitialPaymentRecorded(e.target.checked)}
                  />
                  <strong style={{ fontSize: "0.85rem" }}>Registrar Pagamento da 1ª Mensalidade</strong>
                </label>

                {initialPaymentRecorded && (
                  <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                    {(["pix", "cash", "card"] as const).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setInitialPaymentMethod(method)}
                        style={{
                          flex: 1,
                          padding: "6px",
                          borderRadius: 6,
                          fontSize: "0.8rem",
                          border: initialPaymentMethod === method ? "1px solid var(--brand, #6366f1)" : "1px solid var(--border-color, #333)",
                          background: initialPaymentMethod === method ? "rgba(99,102,241,0.2)" : "transparent",
                          color: initialPaymentMethod === method ? "var(--brand, #6366f1)" : "var(--text-secondary)",
                          cursor: "pointer",
                          textTransform: "uppercase",
                          fontWeight: 700,
                        }}
                      >
                        {method === "cash" ? "Dinheiro" : method === "card" ? "Cartão" : "PIX"}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="form-group">
                <label htmlFor="mem-notes">Observações</label>
                <textarea
                  id="mem-notes"
                  className="input-textarea"
                  rows={2}
                  placeholder="Ex: Pagamento todo dia 05, prefere atendimentos à tarde..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Submit Buttons */}
              <div
                style={{
                  marginTop: 20,
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  borderTop: "1px solid var(--border-color, #333)",
                  paddingTop: 14,
                }}
              >
                <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={busy}>
                  {busy ? "Salvando..." : "Ativar Plano Mensal"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
