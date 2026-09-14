"use client";

import { useState, useMemo } from "react";
import { X, Printer, Download, Wallet, CreditCard, Banknote, Landmark } from "lucide-react";
import type { AppointmentDTO, EmployeeDTO, LocationDTO, StatsResponse } from "@/shared/types";
import { formatCurrency, PAYMENT_LABELS } from "@/lib/client-utils";

type Props = {
  onClose: () => void;
  appointments: AppointmentDTO[];
  employees: EmployeeDTO[];
  locations: LocationDTO[];
  stats: StatsResponse | null;
  companyName: string;
};

export function CashClosingModal({ onClose, appointments, employees, locations, stats, companyName }: Props) {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedLocation, setSelectedLocation] = useState<string>("all");

  const dayAppointments = useMemo(() => {
    return appointments.filter((a) => {
      const matchDate = a.date === selectedDate;
      const matchLoc = selectedLocation === "all" || a.locationId === selectedLocation;
      return matchDate && matchLoc;
    });
  }, [appointments, selectedDate, selectedLocation]);

  const completed = useMemo(() => dayAppointments.filter((a) => a.status === "completed"), [dayAppointments]);

  // Totals by payment method
  const methodTotals = useMemo(() => {
    const totals: Record<string, number> = {
      pix: 0,
      cash: 0,
      debit: 0,
      credit: 0,
      other: 0,
    };

    completed.forEach((apt) => {
      const m = apt.paymentMethod || "pix";
      totals[m] = (totals[m] || 0) + (apt.total || 0);
    });

    return totals;
  }, [completed]);

  const totalReceived = useMemo(() => {
    return Object.values(methodTotals).reduce((sum, val) => sum + val, 0);
  }, [methodTotals]);

  // Estimated Commissions
  const employeeCommissions = useMemo(() => {
    const map = new Map<string, { name: string; count: number; commission: number }>();

    completed.forEach((apt) => {
      const emp = employees.find((e) => e.id === apt.employeeId);
      const name = apt.employeeName || emp?.name || "Profissional";
      const current = map.get(name) || { name, count: 0, commission: 0 };
      current.count += 1;

      let commVal = 0;
      if (emp?.commissionType === "percentage") {
        commVal = ((apt.total || 0) * (emp.commissionValue || 0)) / 100;
      } else if (emp?.commissionType === "fixed") {
        commVal = emp.commissionValue || 0;
      } else {
        commVal = (apt.total || 0) * 0.3; // Default 30%
      }

      current.commission += commVal;
      map.set(name, current);
    });

    return Array.from(map.values());
  }, [completed, employees]);

  const totalCommissions = useMemo(() => {
    return employeeCommissions.reduce((sum, e) => sum + e.commission, 0);
  }, [employeeCommissions]);

  const netRevenue = Math.max(0, totalReceived - totalCommissions);

  const handleExportCsv = () => {
    const headers = ["Data", "Unidade", "Cliente", "Profissional", "Servico", "Valor (R$)", "Forma de Pagamento", "Status"];
    const rows = completed.map((apt) => [
      apt.date,
      apt.locationName || "Principal",
      apt.clientName,
      apt.employeeName,
      apt.serviceName,
      (apt.total || 0).toFixed(2),
      PAYMENT_LABELS[apt.paymentMethod || "other"] || "Outro",
      apt.status,
    ]);

    const csvContent = [
      headers.join(";"),
      ...rows.map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(";")),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fechamento-caixa-${selectedDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          width: "100%",
          maxWidth: 640,
          maxHeight: "90vh",
          overflowY: "auto",
          color: "var(--text-primary)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <header
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <span style={{ fontSize: 12, color: "var(--primary)", fontWeight: 700, textTransform: "uppercase" }}>
              Gestão Financeira
            </span>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "4px 0 0", color: "var(--text-primary)" }}>
              Fechamento de Caixa Diário
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </header>

        <div style={{ padding: "20px 24px" }}>
          {/* Controls: Date & Location */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
                Data do Fechamento
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "var(--surface-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--text-primary)",
                  fontSize: 14,
                }}
              />
            </div>
            {locations.length > 1 && (
              <div>
                <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
                  Unidade
                </label>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "var(--surface-secondary)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--text-primary)",
                    fontSize: 14,
                  }}
                >
                  <option value="all">Todas as unidades</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
            <div
              style={{
                background: "var(--surface-secondary)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "14px 16px",
              }}
            >
              <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>
                Total Recebido
              </span>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--primary)", marginTop: 4 }}>
                {formatCurrency(totalReceived)}
              </div>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                {completed.length} {completed.length === 1 ? "atendimento" : "atendimentos"}
              </span>
            </div>

            <div
              style={{
                background: "var(--surface-secondary)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "14px 16px",
              }}
            >
              <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>
                Comissões
              </span>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--danger)", marginTop: 4 }}>
                {formatCurrency(totalCommissions)}
              </div>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                {employeeCommissions.length} profissionais
              </span>
            </div>

            <div
              style={{
                background: "var(--surface-secondary)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "14px 16px",
              }}
            >
              <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>
                Líquido Casa
              </span>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--success)", marginTop: 4 }}>
                {formatCurrency(netRevenue)}
              </div>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                Após comissões
              </span>
            </div>
          </div>

          {/* Breakdown by Payment Method */}
          <section style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
              Detalhamento por Meio de Pagamento
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: "var(--surface-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-primary)" }}>
                  <Landmark size={15} color="var(--success)" /> PIX
                </span>
                <strong style={{ fontSize: 14, color: "var(--text-primary)" }}>{formatCurrency(methodTotals.pix)}</strong>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: "var(--surface-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-primary)" }}>
                  <Banknote size={15} color="var(--primary)" /> Dinheiro
                </span>
                <strong style={{ fontSize: 14, color: "var(--text-primary)" }}>{formatCurrency(methodTotals.cash)}</strong>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: "var(--surface-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-primary)" }}>
                  <CreditCard size={15} color="var(--info)" /> Cartão de Débito
                </span>
                <strong style={{ fontSize: 14, color: "var(--text-primary)" }}>{formatCurrency(methodTotals.debit)}</strong>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: "var(--surface-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-primary)" }}>
                  <CreditCard size={15} color="var(--purple)" /> Cartão de Crédito
                </span>
                <strong style={{ fontSize: 14, color: "var(--text-primary)" }}>{formatCurrency(methodTotals.credit)}</strong>
              </div>

              {methodTotals.other > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    background: "var(--surface-secondary)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    gridColumn: "span 2",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-primary)" }}>
                    <Wallet size={15} color="var(--text-muted)" /> Outros Meios
                  </span>
                  <strong style={{ fontSize: 14, color: "var(--text-primary)" }}>{formatCurrency(methodTotals.other)}</strong>
                </div>
              )}
            </div>
          </section>

          {/* Commissions Summary */}
          {employeeCommissions.length > 0 && (
            <section style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
                Comissões por Profissional
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {employeeCommissions.map((emp) => (
                  <div
                    key={emp.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      background: "var(--surface-secondary)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: "var(--text-primary)" }}>{emp.name} ({emp.count} atendimentos)</span>
                    <strong style={{ color: "var(--danger)" }}>{formatCurrency(emp.commission)}</strong>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <button
              type="button"
              onClick={handleExportCsv}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 16px",
                background: "var(--surface-secondary)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text-primary)",
                fontSize: 13,
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              <Download size={15} /> Exportar CSV
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 20px",
                background: "var(--primary)",
                border: "none",
                borderRadius: 8,
                color: "var(--primary-foreground, #ffffff)",
                fontSize: 13,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              <Printer size={15} /> Imprimir Resumo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
