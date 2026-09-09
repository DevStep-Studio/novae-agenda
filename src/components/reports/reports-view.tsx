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
  Sparkles,
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
  byEmployee: Array<{ employeeId: string; name: string; appointments: number; revenue: number; commission: number }>;
  byMethod: Array<{ method: string; total: number }>;
};

export function ReportsView() {
  const [range, setRange] = useState<"today" | "7d" | "30d" | "month" | "prev_month">("month");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api<{ data: ReportData }>(`/api/reports?range=${range}`)
      .then((res) => {
        if (active) {
          setData(res.data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [range]);

  const handleExportCsv = () => {
    if (!data) return;
    const headers = ["Metrica", "Valor"];
    const rows = [
      ["Periodo", `${data.fromDate} a ${data.toDate}`],
      ["Receita Realizada (R$)", data.metrics.realizedRevenue.toFixed(2)],
      ["Receita Prevista (R$)", data.metrics.forecastRevenue.toFixed(2)],
      ["Ticket Medio (R$)", data.metrics.averageTicket.toFixed(2)],
      ["Taxa de Ocupacao (%)", `${data.metrics.occupancyRate}%`],
      ["Total de Atendimentos", data.metrics.totalAppointments],
      ["Atendimentos Finalizados", data.metrics.completedAppointments],
      ["Cancelamentos", data.metrics.cancelledAppointments],
      ["Nao Compareceu (No-show)", data.metrics.noShowAppointments],
      ["Novos Clientes", data.metrics.newClients],
      ["Clientes Recorrentes", data.metrics.recurringClients],
    ];

    const csvContent = [
      headers.join(";"),
      ...rows.map((r) => `"${r[0]}";"${r[1]}"`),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-desempenho-${data.range}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ padding: "0 0 40px" }}>
      {/* Top Header & Range Filters */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", gap: 8, background: "#0f1f18", padding: 4, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
          {(
            [
              { id: "today", label: "Hoje" },
              { id: "7d", label: "7 dias" },
              { id: "30d", label: "30 dias" },
              { id: "month", label: "Este mês" },
              { id: "prev_month", label: "Mês anterior" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setRange(item.id)}
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                border: "none",
                fontSize: 13,
                fontWeight: range === item.id ? 700 : 500,
                cursor: "pointer",
                background: range === item.id ? "#dcff4c" : "transparent",
                color: range === item.id ? "#12231b" : "rgba(255,255,255,0.7)",
                transition: "all 0.15s ease",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={!data}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 16px",
            background: "#162a22",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            color: "#ffffff",
            fontSize: 13,
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          <Download size={15} /> Exportar Relatório (CSV)
        </button>
      </div>

      {loading && (
        <div style={{ padding: "40px 0", textAlign: "center", color: "rgba(255,255,255,0.6)" }}>
          Carregando indicadores...
        </div>
      )}

      {data && !loading && (
        <>
          {/* Main KPI Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
            <div style={{ background: "#162a22", border: "1px solid rgba(220, 255, 76, 0.25)", borderRadius: 14, padding: "18px 20px" }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", textTransform: "uppercase" }}>Receita Realizada</span>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#dcff4c", margin: "6px 0 2px" }}>
                {formatCurrency(data.metrics.realizedRevenue)}
              </div>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                Prevista: {formatCurrency(data.metrics.forecastRevenue)}
              </span>
            </div>

            <div style={{ background: "#162a22", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "18px 20px" }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", textTransform: "uppercase" }}>Taxa de Ocupação</span>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#4ade80", margin: "6px 0 2px" }}>
                {data.metrics.occupancyRate}%
              </div>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                Tempo ocupado / disponível
              </span>
            </div>

            <div style={{ background: "#162a22", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "18px 20px" }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", textTransform: "uppercase" }}>Ticket Médio</span>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#ffffff", margin: "6px 0 2px" }}>
                {formatCurrency(data.metrics.averageTicket)}
              </div>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                {data.metrics.completedAppointments} atendimentos concluídos
              </span>
            </div>

            <div style={{ background: "#162a22", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "18px 20px" }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", textTransform: "uppercase" }}>Clientes Atendidos</span>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#60a5fa", margin: "6px 0 2px" }}>
                {data.metrics.newClients + data.metrics.recurringClients}
              </div>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                {data.metrics.newClients} novos · {data.metrics.recurringClients} recorrentes
              </span>
            </div>
          </div>

          {/* Secondary Metrics: Status Breakdown */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 28 }}>
            <div style={{ background: "#162a22", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "20px 24px" }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "#ffffff", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={16} color="#4ade80" /> Desempenho dos Atendimentos
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span style={{ color: "rgba(255,255,255,0.7)" }}>Atendimentos Concluídos</span>
                  <strong style={{ color: "#4ade80" }}>{data.metrics.completedAppointments}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span style={{ color: "rgba(255,255,255,0.7)" }}>Cancelamentos</span>
                  <strong style={{ color: "#f87171" }}>{data.metrics.cancelledAppointments}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span style={{ color: "rgba(255,255,255,0.7)" }}>Não Compareceu (No-show)</span>
                  <strong style={{ color: "#fb923c" }}>{data.metrics.noShowAppointments}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  <span style={{ color: "rgba(255,255,255,0.7)" }}>Total de Descontos</span>
                  <strong style={{ color: "#f87171" }}>{formatCurrency(data.metrics.totalDiscounts)}</strong>
                </div>
              </div>
            </div>

            {/* Peak Hours & Busiest Days */}
            <div style={{ background: "#162a22", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "20px 24px" }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "#ffffff", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <Clock3 size={16} color="#dcff4c" /> Horários e Dias de Pico
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", textTransform: "uppercase" }}>Horários com mais movimento</span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                    {data.peakHours.length > 0 ? (
                      data.peakHours.map((p) => (
                        <span
                          key={p.hour}
                          style={{
                            padding: "4px 10px",
                            background: "#0f1f18",
                            borderRadius: 6,
                            fontSize: 13,
                            color: "#dcff4c",
                            border: "1px solid rgba(220,255,76,0.2)",
                          }}
                        >
                          {p.hour} ({p.count})
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Sem dados suficientes</span>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 6 }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", textTransform: "uppercase" }}>Dias mais movimentados</span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                    {data.busyDays.filter((d) => d.count > 0).length > 0 ? (
                      data.busyDays
                        .filter((d) => d.count > 0)
                        .map((d) => (
                          <span
                            key={d.day}
                            style={{
                              padding: "4px 10px",
                              background: "#0f1f18",
                              borderRadius: 6,
                              fontSize: 13,
                              color: "#ffffff",
                              border: "1px solid rgba(255,255,255,0.08)",
                            }}
                          >
                            {d.day}: {d.count}
                          </span>
                        ))
                    ) : (
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Sem dados suficientes</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Performance by Employee */}
          <section style={{ background: "#162a22", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "20px 24px" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#ffffff", marginBottom: 16 }}>
              Desempenho da Equipe e Comissões
            </h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", fontSize: 12, textTransform: "uppercase" }}>
                    <th style={{ padding: "10px 12px" }}>Profissional</th>
                    <th style={{ padding: "10px 12px" }}>Atendimentos</th>
                    <th style={{ padding: "10px 12px" }}>Faturamento Gerado</th>
                    <th style={{ padding: "10px 12px" }}>Comissão Devida</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byEmployee.map((emp) => (
                    <tr key={emp.employeeId} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "12px", fontWeight: 600, color: "#ffffff" }}>{emp.name}</td>
                      <td style={{ padding: "12px" }}>{emp.appointments}</td>
                      <td style={{ padding: "12px", color: "#4ade80" }}>{formatCurrency(emp.revenue)}</td>
                      <td style={{ padding: "12px", color: "#dcff4c" }}>{formatCurrency(emp.commission)}</td>
                    </tr>
                  ))}
                  {data.byEmployee.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: 20, textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
                        Nenhum atendimento registrado no período selecionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
