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
  XCircle,
  AlertCircle,
  ArrowUpRight,
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
  const maxDayCount = Math.max(1, ...(data?.busyDays.map((d) => d.count) || [1]));

  return (
    <div className="reports-container" style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 48 }}>
      {/* Top Controls: Period Segmented Switcher + Interval Badge + Export Button */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {/* Segmented Period Tabs (Solid, No Gradient) */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 2,
              background: "#0f1f18",
              padding: 3,
              borderRadius: 8,
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            {RANGES.map((item) => {
              const active = range === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setRange(item.id)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: "none",
                    fontSize: 12,
                    fontWeight: active ? 700 : 500,
                    cursor: "pointer",
                    background: active ? "#dcff4c" : "transparent",
                    color: active ? "#12231b" : "rgba(255, 255, 255, 0.7)",
                    transition: "all 0.12s ease",
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Date range badge */}
          {data && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                borderRadius: 6,
                background: "#162a22",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                fontSize: 12,
                color: "rgba(255, 255, 255, 0.65)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <Calendar size={13} color="#dcff4c" />
              <span>
                {formatDateDisplay(data.fromDate)} — {formatDateDisplay(data.toDate)}
              </span>
            </div>
          )}
        </div>

        {/* Export CSV Button (Ghost, Solid) */}
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={!data || loading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            height: 32,
            padding: "0 14px",
            background: "#162a22",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: 6,
            color: "#ffffff",
            fontSize: 12,
            fontWeight: 500,
            cursor: !data || loading ? "not-allowed" : "pointer",
            opacity: !data || loading ? 0.5 : 1,
            transition: "all 0.15s ease",
          }}
        >
          <Download size={13} />
          <span>Exportar Relatório (CSV)</span>
        </button>
      </div>

      {/* Loading State: Clean Skeleton Cards */}
      {loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                background: "#162a22",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: 10,
                padding: "20px",
                height: 106,
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div style={{ width: "40%", height: 12, background: "rgba(255, 255, 255, 0.06)", borderRadius: 4 }} />
              <div style={{ width: "65%", height: 26, background: "rgba(255, 255, 255, 0.1)", borderRadius: 4 }} />
              <div style={{ width: "50%", height: 10, background: "rgba(255, 255, 255, 0.04)", borderRadius: 4 }} />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div
          style={{
            background: "#162a22",
            border: "1px solid rgba(248, 113, 113, 0.3)",
            borderRadius: 10,
            padding: 24,
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <AlertCircle size={24} color="#f87171" />
          <p style={{ margin: 0, color: "rgba(255, 255, 255, 0.8)", fontSize: 13 }}>{error}</p>
          <button
            type="button"
            onClick={() => setRange(range)}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              background: "#0f1f18",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#ffffff",
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
          {/* Row 1: 4 Key Metric Cards (Solid #162a22, zero gradients) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            {/* KPI 1: Receita Realizada */}
            <div
              style={{
                background: "#162a22",
                border: "1px solid rgba(220, 255, 76, 0.22)",
                borderRadius: 10,
                padding: "18px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255, 255, 255, 0.55)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Receita Realizada
                </span>
                <TrendingUp size={14} color="#dcff4c" />
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#dcff4c", fontVariantNumeric: "tabular-nums" }}>
                {formatCurrency(data.metrics.realizedRevenue)}
              </div>
              <span style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.5)", fontVariantNumeric: "tabular-nums" }}>
                Prevista: {formatCurrency(data.metrics.forecastRevenue)}
              </span>
            </div>

            {/* KPI 2: Taxa de Ocupação */}
            <div
              style={{
                background: "#162a22",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: 10,
                padding: "18px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255, 255, 255, 0.55)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Taxa de Ocupação
                </span>
                <Percent size={14} color="#4ade80" />
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#ffffff", fontVariantNumeric: "tabular-nums" }}>
                {data.metrics.occupancyRate}%
              </div>
              <span style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.5)" }}>
                {data.metrics.completedAppointments} atendimentos concluídos
              </span>
            </div>

            {/* KPI 3: Ticket Médio */}
            <div
              style={{
                background: "#162a22",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: 10,
                padding: "18px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255, 255, 255, 0.55)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Ticket Médio
                </span>
                <BarChart3 size={14} color="rgba(255, 255, 255, 0.7)" />
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#ffffff", fontVariantNumeric: "tabular-nums" }}>
                {formatCurrency(data.metrics.averageTicket)}
              </div>
              <span style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.5)" }}>
                Média por atendimento
              </span>
            </div>

            {/* KPI 4: Clientes Atendidos */}
            <div
              style={{
                background: "#162a22",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: 10,
                padding: "18px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255, 255, 255, 0.55)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Clientes Atendidos
                </span>
                <Users size={14} color="rgba(255, 255, 255, 0.7)" />
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#ffffff", fontVariantNumeric: "tabular-nums" }}>
                {data.metrics.newClients + data.metrics.recurringClients}
              </div>
              <span style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.5)", fontVariantNumeric: "tabular-nums" }}>
                {data.metrics.newClients} novos · {data.metrics.recurringClients} recorrentes
              </span>
            </div>
          </div>

          {/* Row 2: Analytics Cards (Operational Funnel & Peak Times) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 16,
            }}
          >
            {/* Panel 1: Atendimentos por Status */}
            <div
              style={{
                background: "#162a22",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: 10,
                padding: "20px 22px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircle2 size={16} color="#4ade80" />
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#ffffff" }}>
                    Status dos Atendimentos
                  </h3>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: "#0f1f18",
                    color: "rgba(255, 255, 255, 0.7)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {totalAppts} total
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Concluídos */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                    <span style={{ color: "rgba(255, 255, 255, 0.7)" }}>Concluídos</span>
                    <strong style={{ color: "#4ade80", fontVariantNumeric: "tabular-nums" }}>
                      {completedAppts} ({completedPct}%)
                    </strong>
                  </div>
                  <div style={{ height: 6, background: "rgba(255, 255, 255, 0.06)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${completedPct}%`, height: "100%", background: "#4ade80", borderRadius: 3 }} />
                  </div>
                </div>

                {/* Cancelamentos */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                    <span style={{ color: "rgba(255, 255, 255, 0.7)" }}>Cancelados</span>
                    <strong style={{ color: "#f87171", fontVariantNumeric: "tabular-nums" }}>
                      {cancelledAppts} ({cancelledPct}%)
                    </strong>
                  </div>
                  <div style={{ height: 6, background: "rgba(255, 255, 255, 0.06)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${cancelledPct}%`, height: "100%", background: "#f87171", borderRadius: 3 }} />
                  </div>
                </div>

                {/* No-show */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                    <span style={{ color: "rgba(255, 255, 255, 0.7)" }}>Não Compareceu (No-show)</span>
                    <strong style={{ color: "#fb923c", fontVariantNumeric: "tabular-nums" }}>
                      {noShowAppts} ({noShowPct}%)
                    </strong>
                  </div>
                  <div style={{ height: 6, background: "rgba(255, 255, 255, 0.06)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${noShowPct}%`, height: "100%", background: "#fb923c", borderRadius: 3 }} />
                  </div>
                </div>

                {/* Descontos aplicados */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    paddingTop: 12,
                    borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                  }}
                >
                  <span style={{ color: "rgba(255, 255, 255, 0.55)" }}>Total em Descontos</span>
                  <strong style={{ color: "rgba(255, 255, 255, 0.8)", fontVariantNumeric: "tabular-nums" }}>
                    {formatCurrency(data.metrics.totalDiscounts)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Panel 2: Horários de Pico & Dias da Semana */}
            <div
              style={{
                background: "#162a22",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: 10,
                padding: "20px 22px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Clock3 size={16} color="#dcff4c" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#ffffff" }}>
                  Horários e Dias de Movimento
                </h3>
              </div>

              {/* Peak Hours */}
              <div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255, 255, 255, 0.5)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Horários com maior demanda
                </span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  {data.peakHours.length > 0 ? (
                    data.peakHours.map((p) => (
                      <span
                        key={p.hour}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "4px 10px",
                          background: "#0f1f18",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 500,
                          color: "#dcff4c",
                          border: "1px solid rgba(220, 255, 76, 0.18)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        <strong>{p.hour}</strong>
                        <span style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: 11 }}>
                          ({p.count} {p.count === 1 ? "atend." : "atend."})
                        </span>
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.45)" }}>
                      Nenhum atendimento no período
                    </span>
                  )}
                </div>
              </div>

              {/* Busy Days Bar Chart (Minimalist, Solid) */}
              <div style={{ marginTop: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255, 255, 255, 0.5)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Distribuição por dia da semana
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginTop: 12, alignItems: "end", height: 75 }}>
                  {data.busyDays.map((d) => {
                    const heightPct = maxDayCount > 0 ? Math.max(8, Math.round((d.count / maxDayCount) * 100)) : 8;
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
                          gap: 6,
                        }}
                      >
                        <span style={{ fontSize: 10, color: isBusiest ? "#dcff4c" : "rgba(255, 255, 255, 0.45)", fontVariantNumeric: "tabular-nums" }}>
                          {d.count > 0 ? d.count : "·"}
                        </span>
                        <div
                          style={{
                            width: "100%",
                            height: `${heightPct}%`,
                            background: isBusiest ? "#dcff4c" : "rgba(255, 255, 255, 0.12)",
                            borderRadius: "3px 3px 0 0",
                            transition: "height 0.2s ease",
                          }}
                        />
                        <span style={{ fontSize: 10, color: "rgba(255, 255, 255, 0.55)", textTransform: "uppercase" }}>
                          {d.day.slice(0, 3)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Equipe & Comissões (Data Table, Minimalist & Solid) */}
          <section
            style={{
              background: "#162a22",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: 10,
              padding: "20px 22px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#ffffff" }}>
                Desempenho da Equipe e Comissões
              </h3>
              <span style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.5)" }}>
                {data.byEmployee.length} profissionais
              </span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                      color: "rgba(255, 255, 255, 0.5)",
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    <th style={{ padding: "10px 14px" }}>Profissional</th>
                    <th style={{ padding: "10px 14px" }}>Atendimentos</th>
                    <th style={{ padding: "10px 14px" }}>Faturamento Gerado</th>
                    <th style={{ padding: "10px 14px" }}>Comissão Devida</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>% da Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byEmployee.map((emp) => {
                    const pctOfTotal = totalEmployeeRevenue > 0 ? Math.round((emp.revenue / totalEmployeeRevenue) * 100) : 0;
                    return (
                      <tr
                        key={emp.employeeId}
                        style={{
                          borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                          transition: "background 0.12s ease",
                        }}
                      >
                        <td style={{ padding: "12px 14px", fontWeight: 600, color: "#ffffff" }}>
                          {emp.name}
                        </td>
                        <td style={{ padding: "12px 14px", color: "rgba(255, 255, 255, 0.7)", fontVariantNumeric: "tabular-nums" }}>
                          {emp.appointments}
                        </td>
                        <td style={{ padding: "12px 14px", color: "#ffffff", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                          {formatCurrency(emp.revenue)}
                        </td>
                        <td style={{ padding: "12px 14px", color: "#dcff4c", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                          {formatCurrency(emp.commission)}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "rgba(255, 255, 255, 0.6)" }}>
                          {pctOfTotal}%
                        </td>
                      </tr>
                    );
                  })}
                  {data.byEmployee.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: 24, textAlign: "center", color: "rgba(255, 255, 255, 0.45)", fontSize: 13 }}>
                        Nenhum atendimento de profissional registrado no período selecionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Row 4: Formas de Pagamento (se houver dados) */}
          {data.byMethod && data.byMethod.length > 0 && (
            <div
              style={{
                background: "#162a22",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: 10,
                padding: "18px 22px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CreditCard size={15} color="rgba(255, 255, 255, 0.7)" />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#ffffff" }}>
                  Recebimento por Forma de Pagamento
                </span>
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {data.byMethod.map((m) => (
                  <div key={m.method} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <span style={{ color: "rgba(255, 255, 255, 0.55)", textTransform: "capitalize" }}>
                      {m.method}:
                    </span>
                    <strong style={{ color: "#ffffff", fontVariantNumeric: "tabular-nums" }}>
                      {formatCurrency(m.total)}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
