"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Clock3,
  Check,
  Sparkles,
  AlertTriangle,
  ChevronRight,
  CalendarCheck,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import type {
  CustomerMembershipDTO,
  MonthSlotDay,
  BatchBookingConflict,
  BatchBookingResultDTO,
} from "@/shared/types";

export function MonthSchedulerModal({
  customerMembershipId,
  clientName,
  isOpen,
  onClose,
  onSuccess,
  notify,
  isOwnerView = false,
}: {
  customerMembershipId: string;
  clientName?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  notify: (msg: string, type?: "success" | "error") => void;
  isOwnerView?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState<MonthSlotDay[]>([]);
  const [membership, setMembership] = useState<CustomerMembershipDTO | null>(null);
  const [allowance, setAllowance] = useState(4);
  const [selectedSlots, setSelectedSlots] = useState<Record<string, string>>({}); // { "2026-10-01": "14:00" }
  const [conflicts, setConflicts] = useState<BatchBookingConflict[]>([]);
  const [step, setStep] = useState<"schedule" | "confirm">("schedule");
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current/upcoming month

  const loadMonthData = useCallback(async (offset = 0) => {
    setLoading(true);
    try {
      const now = new Date();
      now.setMonth(now.getMonth() + offset);
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      const res = await api<{
        membership: CustomerMembershipDTO;
        period: any;
        days: MonthSlotDay[];
        allowance: number;
      }>(
        isOwnerView
          ? `/api/customer-memberships/${customerMembershipId}/month-slots?year=${year}&month=${month}`
          : `/api/my/membership/month-slots?year=${year}&month=${month}`,
      );

      setConflicts([]);
      setMembership(res.membership);
      setDays(res.days);
      setAllowance(res.allowance);

      // Pre-fill already booked appointments or preferred time
      const initial: Record<string, string> = {};
      for (const d of res.days) {
        if (d.isBooked && d.existingAppointment) {
          initial[d.date] = d.existingAppointment.startTime;
        } else if (d.selectedStartTime && d.availableSlots.some((s) => s.startTime === d.selectedStartTime)) {
          initial[d.date] = d.selectedStartTime;
        }
      }
      setSelectedSlots(initial);
    } catch (err: any) {
      notify(err instanceof ApiError ? err.message : "Erro ao carregar horários do mês.", "error");
    } finally {
      setLoading(false);
    }
  }, [isOwnerView, customerMembershipId, notify]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function init() {
      try {
        const now = new Date();
        now.setMonth(now.getMonth() + monthOffset);
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        const res = await api<{
          membership: CustomerMembershipDTO;
          period: any;
          days: MonthSlotDay[];
          allowance: number;
        }>(
          isOwnerView
            ? `/api/customer-memberships/${customerMembershipId}/month-slots?year=${year}&month=${month}`
            : `/api/my/membership/month-slots?year=${year}&month=${month}`,
        );

        if (!cancelled) {
          setConflicts([]);
          setMembership(res.membership);
          setDays(res.days);
          setAllowance(res.allowance);

          const initial: Record<string, string> = {};
          for (const d of res.days) {
            if (d.isBooked && d.existingAppointment) {
              initial[d.date] = d.existingAppointment.startTime;
            } else if (d.selectedStartTime && d.availableSlots.some((s) => s.startTime === d.selectedStartTime)) {
              initial[d.date] = d.selectedStartTime;
            }
          }
          setSelectedSlots(initial);
        }
      } catch (err: any) {
        if (!cancelled) {
          notify(err instanceof ApiError ? err.message : "Erro ao carregar horários do mês.", "error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [isOpen, monthOffset, isOwnerView, customerMembershipId, notify]);

  const selectedCount = Object.keys(selectedSlots).filter((d) => Boolean(selectedSlots[d])).length;
  const progressPercent = Math.min(100, Math.round((selectedCount / allowance) * 100));

  // Action: "Usar este horário em todas as datas disponíveis"
  const handleUseTimeInAll = (timeToApply: string) => {
    const updated = { ...selectedSlots };
    let appliedCount = 0;
    for (const d of days) {
      if (d.availableSlots.some((s) => s.startTime === timeToApply)) {
        updated[d.date] = timeToApply;
        appliedCount++;
      }
    }
    setSelectedSlots(updated);
    notify(`Horário ${timeToApply} aplicado em ${appliedCount} data(s) disponível(is)!`);
  };

  // Action: "Sugerir melhores horários"
  const handleSuggestSlots = () => {
    const updated = { ...selectedSlots };
    const preferred = membership?.preferredTime || "14:00";

    for (const d of days) {
      if (updated[d.date]) continue; // keep existing selection

      // Try exact preferred time
      const exact = d.availableSlots.find((s) => s.startTime === preferred);
      if (exact) {
        updated[d.date] = exact.startTime;
        continue;
      }
      // Otherwise pick the closest available afternoon slot or first slot
      if (d.availableSlots.length > 0) {
        const afternoon = d.availableSlots.find((s) => s.startTime >= "12:00") || d.availableSlots[0];
        updated[d.date] = afternoon.startTime;
      }
    }
    setSelectedSlots(updated);
    notify("Horários sugeridos com base na disponibilidade!");
  };

  // Confirm and Submit Batch
  const handleConfirmBatch = async () => {
    const slotsToBook = Object.entries(selectedSlots)
      .filter(([_, time]) => Boolean(time))
      .map(([date, startTime]) => ({
        date,
        startTime,
        serviceId: membership?.includedServices?.[0]?.id,
        employeeId: membership?.preferredProfessionalId ?? undefined,
      }));

    if (slotsToBook.length === 0) {
      notify("Selecione pelo menos um horário para agendar.", "error");
      return;
    }

    setBusy(true);
    try {
      const endpoint = isOwnerView
        ? `/api/customer-memberships/${customerMembershipId}/book-batch`
        : "/api/my/membership/book-period";

      const res = await api<BatchBookingResultDTO>(endpoint, {
        method: "POST",
        body: JSON.stringify({
          customerMembershipId,
          slots: slotsToBook,
        }),
      });

      if (res.conflicts && res.conflicts.length > 0) {
        setConflicts(res.conflicts);
        // Clear conflicting slots from selection so user can pick alternate
        const updated = { ...selectedSlots };
        for (const c of res.conflicts) {
          delete updated[c.date];
        }
        setSelectedSlots(updated);

        if (res.bookedCount > 0) {
          notify(
            `${res.bookedCount} reserva(s) confirmada(s)! Porém ${res.conflicts.length} data(s) tiveram conflito. Escolha outro horário para as datas pendentes.`,
            "error",
          );
        } else {
          notify("Houve conflito de horários. Por favor, ajuste as opções destacadas.", "error");
        }
        setStep("schedule");
      } else {
        notify(`${res.bookedCount} horários do mês agendados com sucesso!`, "success");
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      notify(err instanceof ApiError ? err.message : "Erro ao confirmar agendamentos.", "error");
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
      <div
        className="modal modal-wide membership-scheduler-modal"
        style={{
          maxWidth: 680,
          width: "94%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          overflow: "hidden",
        }}
      >
        {/* Modal Header */}
        <div
          className="modal-header"
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-color, #333)",
            background: "var(--bg-secondary, #222)",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--brand, #6366f1)" }}>
              <CalendarCheck size={16} />
              <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase" }}>
                {membership?.membershipPlanName ?? "Plano Mensal"}
              </span>
            </div>
            <h3 className="modal-title" style={{ fontSize: "1.2rem", margin: "2px 0 0" }}>
              Agendar Horários do Mês
            </h3>
            {clientName && (
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                Cliente: <strong>{clientName}</strong>
              </p>
            )}
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={busy}
          >
            <X size={18} />
          </button>
        </div>

        {/* Progress & Quick Actions Bar */}
        <div
          style={{
            padding: "12px 20px",
            background: "var(--bg-card, #1c1c1c)",
            borderBottom: "1px solid var(--border-color, #333)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ flex: "1 1 200px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: 4 }}>
              <strong>
                {selectedCount} de {allowance} horários escolhidos
              </strong>
              <span style={{ color: selectedCount >= allowance ? "#10b981" : "var(--brand, #6366f1)" }}>
                {progressPercent}%
              </span>
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 3,
                background: "var(--border-color, #333)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progressPercent}%`,
                  background: selectedCount >= allowance ? "#10b981" : "var(--brand, #6366f1)",
                  transition: "width 0.2s ease",
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleSuggestSlots}
              style={{
                fontSize: "0.8rem",
                padding: "6px 12px",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Sparkles size={13} color="var(--brand, #6366f1)" />
              <span>Sugerir Horários</span>
            </button>
          </div>
        </div>

        {/* Conflict Warning Alert */}
        {conflicts.length > 0 && (
          <div
            style={{
              padding: "12px 20px",
              background: "rgba(239, 68, 68, 0.15)",
              borderBottom: "1px solid rgba(239, 68, 68, 0.3)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "#fca5a5",
              fontSize: "0.85rem",
            }}
          >
            <AlertTriangle size={18} color="#ef4444" />
            <div>
              <strong>Conflito em {conflicts.length} data(s):</strong> Escolha outro horário disponível para as
              datas destacadas em vermelho.
            </div>
          </div>
        )}

        {/* Content Body: Vertical Mobile-First Days List */}
        <div
          className="modal-body"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)" }}>
              <Clock3 size={28} className="animate-spin" style={{ margin: "0 auto 8px" }} />
              <p>Consultando disponibilidade real da agenda...</p>
            </div>
          ) : step === "schedule" ? (
            <>
              {days.map((day, idx) => {
                const isSelected = Boolean(selectedSlots[day.date]);
                const chosenTime = selectedSlots[day.date];
                const conflict = conflicts.find((c) => c.date === day.date);

                return (
                  <div
                    key={day.date}
                    className={`day-slot-card ${conflict ? "has-conflict" : ""}`}
                    style={{
                      background: isSelected
                        ? "var(--bg-secondary, #222)"
                        : "var(--bg-card, #1c1c1c)",
                      border: conflict
                        ? "1.5px solid #ef4444"
                        : isSelected
                        ? "1.5px solid var(--brand, #6366f1)"
                        : "1px solid var(--border-color, #333)",
                      borderRadius: "var(--radius-md, 10px)",
                      padding: "14px 16px",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {/* Day Header */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 10,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            background: isSelected ? "var(--brand, #6366f1)" : "var(--border-color, #333)",
                            color: "#fff",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 4,
                            textTransform: "uppercase",
                          }}
                        >
                          {day.weekdayLabel}
                        </span>
                        <strong style={{ fontSize: "0.95rem" }}>{day.shortDateLabel}</strong>
                        {day.isBooked && (
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "#10b981",
                              background: "rgba(16,185,129,0.15)",
                              padding: "2px 6px",
                              borderRadius: 4,
                            }}
                          >
                            <Check size={11} style={{ display: "inline-block", verticalAlign: "middle", marginRight: 3 }} />
                            Já agendado
                          </span>
                        )}
                      </div>

                      {chosenTime && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              fontSize: "0.85rem",
                              fontWeight: 700,
                              color: "var(--brand, #6366f1)",
                            }}
                          >
                            {chosenTime}
                          </span>
                          {idx === 0 && days.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleUseTimeInAll(chosenTime)}
                              style={{
                                background: "rgba(99,102,241,0.15)",
                                border: "1px solid rgba(99,102,241,0.3)",
                                color: "var(--brand, #6366f1)",
                                borderRadius: 6,
                                padding: "3px 8px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                              title="Tenta aplicar este mesmo horário em todas as outras datas do mês"
                            >
                              Usar em todas
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {conflict && (
                      <p style={{ margin: "0 0 8px", fontSize: "0.8rem", color: "#ef4444", display: "flex", alignItems: "center", gap: 4 }}>
                        <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                        <span>{conflict.reason} Escolha outro horário abaixo.</span>
                      </p>
                    )}

                    {/* Time Slots Options */}
                    {day.availableSlots.length > 0 ? (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                          marginTop: 6,
                        }}
                      >
                        {day.availableSlots.map((slot) => {
                          const activeSlot = chosenTime === slot.startTime;
                          return (
                            <button
                              key={slot.startTime}
                              type="button"
                              onClick={() => {
                                setSelectedSlots((prev) => ({
                                  ...prev,
                                  [day.date]: activeSlot ? "" : slot.startTime,
                                }));
                              }}
                              style={{
                                padding: "6px 12px",
                                borderRadius: 6,
                                fontSize: "0.85rem",
                                fontWeight: activeSlot ? 700 : 500,
                                border: activeSlot
                                  ? "1px solid var(--brand, #6366f1)"
                                  : "1px solid var(--border-color, #333)",
                                background: activeSlot
                                  ? "var(--brand, #6366f1)"
                                  : "var(--bg-secondary, #2a2a2a)",
                                color: activeSlot ? "#fff" : "var(--text-primary)",
                                cursor: "pointer",
                                transition: "all 0.1s ease",
                              }}
                            >
                              {slot.startTime}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        Nenhum horário disponível para esta data.
                      </p>
                    )}
                  </div>
                );
              })}
            </>
          ) : (
            /* Confirm Step */
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  background: "var(--bg-secondary, #222)",
                  padding: "16px 20px",
                  borderRadius: "var(--radius-md, 8px)",
                  border: "1px solid var(--border-color, #333)",
                }}
              >
                <h4 style={{ fontSize: "1rem", margin: "0 0 12px", fontWeight: 700 }}>
                  Resumo dos Atendimentos Selecionados
                </h4>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {Object.entries(selectedSlots)
                    .filter(([_, t]) => Boolean(t))
                    .map(([date, time]) => {
                      const dayMeta = days.find((d) => d.date === date);
                      return (
                        <div
                          key={date}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: "0.9rem",
                            padding: "6px 0",
                            borderBottom: "1px solid var(--border-color, #333)",
                          }}
                        >
                          <div>
                            <strong>{dayMeta?.shortDateLabel ?? date}</strong>
                            <span style={{ color: "var(--text-secondary)", marginLeft: 6 }}>
                              às {time}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: "0.8rem",
                              fontWeight: 700,
                              color: "#10b981",
                              background: "rgba(16,185,129,0.12)",
                              padding: "2px 8px",
                              borderRadius: 4,
                            }}
                          >
                            INCLUÍDO NO PLANO
                          </span>
                        </div>
                      );
                    })}
                </div>

                <div
                  style={{
                    marginTop: 16,
                    paddingTop: 12,
                    borderTop: "1px solid var(--border-color, #333)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "0.95rem",
                  }}
                >
                  <span>Total desta confirmação:</span>
                  <strong style={{ color: "#10b981" }}>R$ 0,00 (Sem cobrança avulsa)</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer / Sticky CTA */}
        <div
          className="modal-footer"
          style={{
            padding: "14px 20px",
            borderTop: "1px solid var(--border-color, #333)",
            background: "var(--bg-secondary, #222)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {step === "confirm" ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setStep("schedule")}
              disabled={busy}
            >
              Voltar e Ajustar
            </button>
          ) : (
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cancelar
            </button>
          )}

          <button
            type="button"
            className="btn-primary"
            onClick={step === "schedule" ? () => setStep("confirm") : handleConfirmBatch}
            disabled={selectedCount === 0 || busy}
            style={{
              minWidth: 180,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontWeight: 700,
            }}
          >
            {busy ? (
              "Confirmando..."
            ) : step === "schedule" ? (
              <>
                <span>Avançar ({selectedCount}/{allowance})</span>
                <ChevronRight size={16} />
              </>
            ) : (
              <>
                <Check size={16} />
                <span>Confirmar Todas as Reservas</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
