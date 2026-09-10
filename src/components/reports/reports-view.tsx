"use client";

import { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  Clock3,
  Calendar,
  Users,
  Download,
  Percent,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  UserCheck,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/client-utils";

type ReportData = {
  range: string;
  fromDate: string;
  toDate: string;
  metrics: {
    totalAppointments: number;
    completedAppointments: number;
    cancelledAppointments: number;
    noShowAppointments: number;
    realizedRevenue: number;
    forecastRevenue: number;
    totalDiscounts: number;
    averageTicket: number;
    occupancyRate: number;
    newClients: number;
    recurringClients: number;
  };
  peakHours: Array<{ hour: string; count: number }>;
  busyDays: Array<{ day: string; count: number }>;
  byEmployee: Array<{
    employeeId: string;
    name: string;
    appointments: number;
    revenue: number;
    commission: number;
  }>;
  byMethod: Array<{ method: string; total: number }>;
};

const RANGES = [
  { id: "today", label: "Hoje" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "month", label: "Este mês" },
  { id: "prev_month", label: "Mês anterior" },
] as const;

function formatDateDisplay(dateStr?: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatMethodName(method: string): string {
  const map: Record<string, string> = {
    pix: "Pix",
    credit: "Cartão de Crédito",
    credit_card: "Cartão de Crédito",
    debit: "Cartão de Débito",
    debit_card: "Cartão de Débito",
    cash: "Dinheiro",
    dinheiro: "Dinheiro",
    card: "Cartão",
    transfer: "Transferência",
    other: "Outro",
  };
  return map[method.toLowerCase()] || method.charAt(0).toUpperCase() + method.slice(1);
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join("");
}

export function ReportsView() {
  const [range, setRange] = useState<"today" | "7d" | "30d" | "month" | "prev_month">("month");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    api<ReportData | { data: ReportData }>(`/api/reports?range=${range}`)
      .then((res: any) => {
        if (active) {
          const report = res?.data ?? res;
          if (report && report.metrics) {
            setData(report);
          } else {
            setError("Nenhum dado retornado para o período selecionado.");
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          console.error("Erro ao carregar relatórios:", err);
          setError("Não foi possível carregar os relatórios. Tente novamente.");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [range]);

  const handleExportCsv = () => {
    if (!data) return;
    const headers = ["Métrica", "Valor"];
    const rows = [
      ["Período", `${formatDateDisplay(data.fromDate)} a ${formatDateDisplay(data.toDate)}`],
      ["Receita Realizada (R$)", (data.metrics.realizedRevenue ?? 0).toFixed(2)],
      ["Receita Prevista (R$)", (data.metrics.forecastRevenue ?? 0).toFixed(2)],
      ["Ticket Médio (R$)", (data.metrics.averageTicket ?? 0).toFixed(2)],
      ["Taxa de Ocupação (%)", `${data.metrics.occupancyRate ?? 0}%`],
      ["Total de Atendimentos", data.metrics.totalAppointments ?? 0],
      ["Atendimentos Concluídos", data.metrics.completedAppointments ?? 0],
      ["Cancelamentos", data.metrics.cancelledAppointments ?? 0],
      ["Não Compareceu (No-show)", data.metrics.noShowAppointments ?? 0],
      ["Novos Clientes", data.metrics.newClients ?? 0],
      ["Clientes Recorrentes", data.metrics.recurringClients ?? 0],
    ];

    const csvContent = [
      headers.join(";"),
      ...rows.map((r) => `"${r[0]}";"${r[1]}"`),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-reservei-${data.range}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalAppts = data?.metrics.totalAppointments || 0;
  const completedAppts = data?.metrics.completedAppointments || 0;
  const cancelledAppts = data?.metrics.cancelledAppointments || 0;
  const noShowAppts = data?.metrics.noShowAppointments || 0;

  const completedPct = totalAppts > 0 ? Math.round((completedAppts / totalAppts) * 100) : 0;
  const cancelledPct = totalAppts > 0 ? Math.round((cancelledAppts / totalAppts) * 100) : 0;
  const noShowPct = totalAppts > 0 ? Math.round((noShowAppts / totalAppts) * 100) : 0;

  const totalEmployeeRevenue = data?.byEmployee.reduce((sum, e) => sum + e.revenue, 0) || 0;
  const totalPaymentRevenue = data?.byMethod.reduce((sum, m) => sum + m.total, 0) || 0;
  const maxDayCount = Math.max(1, ...(data?.busyDays.map((d) => d.count) || [1]));

  return (
    <div className="page-content reports-page-content">
      {/* 1. Page Header with Title and CSV Export */}
      <div className="page-intro" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <p className="eyebrow">Inteligência & Negócio</p>
          <h1>Relatórios</h1>
          <p className="intro-copy">Métricas analíticas de faturamento, ocupação, horários de maior fluxo e comissões da equipe.</p>
        </div>

        <button
          type="button"
          className="button-secondary"
          onClick={handleExportCsv}
          disabled={!data || loading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text-primary)",
            cursor: !data || loading ? "not-allowed" : "pointer",
            fontWeight: 600,
            fontSize: 13,
            opacity: !data || loading ? 0.5 : 1,
            transition: "all 0.15s ease",
          }}
        >
          <Download size={15} />
          <span>Exportar Relatório (CSV)</span>
        </button>
      </div>

      {/* 2. Filter Toolbar: Period Segmented Switcher + Date Range */}
      <div
        className="reports-toolbar"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 14,
          padding: "14px 18px",
          borderRadius: 12,
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {RANGES.map((item) => {
            const active = range === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setRange(item.id)}
                className={`reports-range-btn ${active ? "active" : ""}`}
                style={{
                  padding: "8px 16px",
                  borderRadius: 7,
                  border: active ? "1px solid var(--primary)" : "1px solid transparent",
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  cursor: "pointer",
                  background: active ? "var(--primary)" : "transparent",
                  color: active ? "var(--primary-foreground, #ffffff)" : "var(--text-secondary)",
                  transition: "all 0.15s ease",
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {data && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 14px",
              borderRadius: 8,
              background: "var(--surface-secondary)",
              border: "1px solid var(--border)",
              fontSize: 12,
              color: "var(--text-secondary)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <Calendar size={14} style={{ color: "var(--primary)" }} />
            <span>
              {formatDateDisplay(data.fromDate)} — {formatDateDisplay(data.toDate)}
            </span>
          </div>
        )}
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="metric-card"
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: 124,
              }}
            >
              <div style={{ width: "40%", height: 12, background: "rgba(255, 255, 255, 0.08)", borderRadius: 4 }} />
              <div style={{ width: "65%", height: 26, background: "rgba(255, 255, 255, 0.14)", borderRadius: 4 }} />
              <div style={{ width: "50%", height: 10, background: "rgba(255, 255, 255, 0.06)", borderRadius: 4 }} />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div
          className="reports-panel"
          style={{
            padding: 32,
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
            borderRadius: 12,
            border: "1px solid rgba(248, 113, 113, 0.3)",
          }}
        >
          <AlertCircle size={28} color="#f87171" />
          <p style={{ margin: 0, color: "var(--text-primary)", fontSize: 14 }}>{error}</p>
          <button
            type="button"
            onClick={() => setRange(range)}
            className="button-secondary"
            style={{
              padding: "8px 18px",
              borderRadius: 7,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Main Dashboard Data */}
      {data && !loading && (
        <>
          {/* 3. Top 4 Metric Cards (Uniform Solid Green Style) */}
          <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {/* KPI 1: Receita Realizada */}
            <div className="metric-card">
              <div className="metric-icon metric-teal">
                <TrendingUp size={18} />
              </div>
              <div className="metric-copy">
                <p>Receita realizada</p>
                <strong style={{ color: "var(--primary)" }}>{formatCurrency(data.metrics.realizedRevenue)}</strong>
                <span className="metric-detail">Prevista: {formatCurrency(data.metrics.forecastRevenue)}</span>
              </div>
            </div>

            {/* KPI 2: Taxa de Ocupação */}
            <div className="metric-card">
              <div className="metric-icon metric-teal">
                <Percent size={18} />
              </div>
              <div className="metric-copy">
                <p>Taxa de ocupação</p>
                <strong>{data.metrics.occupancyRate}%</strong>
                <span className="metric-detail">{data.metrics.completedAppointments} atendimentos concluídos</span>
              </div>
            </div>

            {/* KPI 3: Ticket Médio */}
            <div className="metric-card">
              <div className="metric-icon metric-teal">
                <BarChart3 size={18} />
              </div>
              <div className="metric-copy">
                <p>Ticket médio</p>
                <strong>{formatCurrency(data.metrics.averageTicket)}</strong>
                <span className="metric-detail">por atendimento</span>
              </div>
            </div>

            {/* KPI 4: Clientes Atendidos */}
            <div className="metric-card">
              <div className="metric-icon metric-teal">
                <Users size={18} />
              </div>
              <div className="metric-copy">
                <p>Clientes atendidos</p>
                <strong>{data.metrics.newClients + data.metrics.recurringClients}</strong>
                <span className="metric-detail">
                  {data.metrics.newClients} novos · {data.metrics.recurringClients} recorrentes
                </span>
              </div>
            </div>
          </div>

          {/* 4. Analytics Grid: Operational Status & Peak Movement */}
          <div
            className="reports-analytics-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
              gap: 20,
            }}
          >
            {/* Panel 1: Atendimentos por Status */}
            <div
              className="reports-panel"
              style={{
                borderRadius: 12,
                padding: "24px 26px",
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <CheckCircle2 size={18} color="#4ade80" />
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                    Status dos Atendimentos
                  </h3>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 6,
                    background: "var(--surface-secondary)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {totalAppts} total
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {/* Concluídos */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 7 }}>
                    <span style={{ color: "var(--text-secondary)" }}>Concluídos</span>
                    <strong style={{ color: "#4ade80", fontVariantNumeric: "tabular-nums" }}>
                      {completedAppts} ({completedPct}%)
                    </strong>
                  </div>
                  <div style={{ height: 8, background: "var(--surface-tertiary)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${completedPct}%`, height: "100%", background: "#4ade80", borderRadius: 4 }} />
                  </div>
                </div>

                {/* Cancelados */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 7 }}>
                    <span style={{ color: "var(--text-secondary)" }}>Cancelados</span>
                    <strong style={{ color: "#f87171", fontVariantNumeric: "tabular-nums" }}>
                      {cancelledAppts} ({cancelledPct}%)
                    </strong>
                  </div>
                  <div style={{ height: 8, background: "var(--surface-tertiary)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${cancelledPct}%`, height: "100%", background: "#f87171", borderRadius: 4 }} />
                  </div>
                </div>

                {/* No-show */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 7 }}>
                    <span style={{ color: "var(--text-secondary)" }}>Não Compareceu (No-show)</span>
                    <strong style={{ color: "#fb923c", fontVariantNumeric: "tabular-nums" }}>
                      {noShowAppts} ({noShowPct}%)
                    </strong>
                  </div>
                  <div style={{ height: 8, background: "var(--surface-tertiary)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${noShowPct}%`, height: "100%", background: "#fb923c", borderRadius: 4 }} />
                  </div>
                </div>

                {/* Descontos aplicados */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    paddingTop: 16,
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <span style={{ color: "var(--text-muted)" }}>Total em Descontos</span>
                  <strong style={{ color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                    {formatCurrency(data.metrics.totalDiscounts)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Panel 2: Horários de Pico & Dias da Semana */}
            <div
              className="reports-panel"
              style={{
                borderRadius: 12,
                padding: "24px 26px",
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Clock3 size={18} style={{ color: "var(--primary)" }} />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                  Horários de Pico
                </h3>
              </div>

              {/* Peak Hours */}
              <div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Horários com maior volume
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {data.peakHours.length > 0 ? (
                    data.peakHours.map((p) => (
                      <span
                        key={p.hour}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 12px",
                          background: "var(--surface-secondary)",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--primary)",
                          border: "1px solid var(--border)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        <strong>{p.hour}</strong>
                        <span style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 400 }}>
                          ({p.count} {p.count === 1 ? "atendimento" : "atendimentos"})
                        </span>
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--text-muted)", padding: "4px 0" }}>
                      Nenhum atendimento registrado no período
                    </span>
                  )}
                </div>
              </div>

              {/* Busy Days Bar Chart (Generous Height, Solid & Clean) */}
              <div style={{ marginTop: 6 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Distribuição por dia da semana
                </span>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    gap: 10,
                    marginTop: 14,
                    alignItems: "end",
                    height: 125,
                  }}
                >
                  {data.busyDays.map((d) => {
                    const heightPct = maxDayCount > 0 ? Math.max(10, Math.round((d.count / maxDayCount) * 100)) : 10;
                    const isBusiest = d.count > 0 && d.count === maxDayCount;
                    return (
                      <div
                        key={d.day}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          height: "100%",
                          justifyContent: "flex-end",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: isBusiest ? 700 : 500,
                            color: isBusiest ? "var(--primary)" : "var(--text-muted)",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {d.count > 0 ? d.count : "·"}
                        </span>
                        <div
                          style={{
                            width: "100%",
                            maxWidth: 36,
                            height: `${heightPct}%`,
                            background: isBusiest ? "var(--primary)" : "var(--surface-tertiary)",
                            borderRadius: "4px 4px 0 0",
                            transition: "height 0.25s ease",
                          }}
                        />
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: isBusiest ? "var(--text-primary)" : "var(--text-secondary)",
                            textTransform: "uppercase",
                          }}
                        >
                          {d.day.slice(0, 3)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* 5. Team Performance & Commissions Table */}
          <section
            className="reports-panel"
            style={{
              borderRadius: 12,
              padding: "24px 26px",
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <UserCheck size={18} style={{ color: "var(--primary)" }} />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                  Desempenho da Equipe e Comissões
                </h3>
              </div>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  padding: "4px 10px",
                  borderRadius: 6,
                  background: "var(--surface-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                {data.byEmployee.length} profissionais
              </span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid var(--border)",
                      color: "var(--text-muted)",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    <th style={{ padding: "12px 16px" }}>Profissional</th>
                    <th style={{ padding: "12px 16px" }}>Atendimentos</th>
                    <th style={{ padding: "12px 16px" }}>Faturamento Gerado</th>
                    <th style={{ padding: "12px 16px" }}>Comissão Devida</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>% da Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byEmployee.map((emp) => {
                    const pctOfTotal = totalEmployeeRevenue > 0 ? Math.round((emp.revenue / totalEmployeeRevenue) * 100) : 0;
                    return (
                      <tr
                        key={emp.employeeId}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          transition: "background 0.15s ease",
                        }}
                      >
                        <td style={{ padding: "16px", fontWeight: 600, color: "var(--text-primary)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: "50%",
                                background: "var(--primary-soft)",
                                color: "var(--primary)",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              {getInitials(emp.name)}
                            </span>
                            <span>{emp.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: "16px", color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                          {emp.appointments}
                        </td>
                        <td style={{ padding: "16px", color: "var(--text-primary)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                          {formatCurrency(emp.revenue)}
                        </td>
                        <td style={{ padding: "16px", color: "var(--primary)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                          {formatCurrency(emp.commission)}
                        </td>
                        <td style={{ padding: "16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)", fontWeight: 600 }}>
                          {pctOfTotal}%
                        </td>
                      </tr>
                    );
                  })}
                  {data.byEmployee.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                        Nenhum atendimento de profissional registrado no período selecionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* 6. Payment Methods Section: Clean Cards Grid */}
          {data.byMethod && data.byMethod.length > 0 && (
            <div
              className="reports-panel"
              style={{
                borderRadius: 12,
                padding: "24px 26px",
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <CreditCard size={18} style={{ color: "var(--primary)" }} />
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                    Recebimento por Forma de Pagamento
                  </h3>
                </div>
                <span style={{ fontSize: 12, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                  Total recebido: <strong style={{ color: "var(--text-primary)" }}>{formatCurrency(totalPaymentRevenue)}</strong>
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 14,
                }}
              >
                {data.byMethod.map((m) => {
                  const pct = totalPaymentRevenue > 0 ? Math.round((m.total / totalPaymentRevenue) * 100) : 0;
                  return (
                    <div
                      key={m.method}
                      className="payment-method-card"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        padding: "16px 20px",
                        borderRadius: 10,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                          {formatMethodName(m.method)}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "var(--primary-foreground, #ffffff)",
                            background: "var(--primary)",
                            padding: "2px 7px",
                            borderRadius: 4,
                          }}
                        >
                          {pct}%
                        </span>
                      </div>
                      <strong style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                        {formatCurrency(m.total)}
                      </strong>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
