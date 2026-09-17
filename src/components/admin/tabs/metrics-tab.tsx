"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  TrendingUp,
  Sparkles,
  Users,
  Ticket,
  ShieldCheck,
  Server,
  Activity,
  ArrowUpRight,
  Clock,
} from "lucide-react";
import { formatCurrency } from "@/lib/client-utils";
import styles from "../admin-dashboard.module.css";

interface MetricsData {
  totalOwners: number;
  activeOwners: number;
  newOwnersThisMonth: number;
  mrr: number;
  activeSubscribers: number;
  trialingCount: number;
  churnedCount: number;
  churnRate: number;
  topCoupons: Array<{
    couponId: string;
    code: string;
    name: string;
    influencerName: string | null;
    totalUses: number;
    convertedUses: number;
    conversionRate: number;
  }>;
  recentAudit: Array<{
    id: string;
    action: string;
    entity: string;
    entityName: string | null;
    adminEmail: string;
    createdAt: string;
  }>;
}

export function MetricsTab() {
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMetrics() {
      try {
        setLoading(true);
        const res = await fetch("/api/superadmin/metrics");
        const json = await res.json();
        if (json.data) {
          setData(json.data);
        }
      } catch (err) {
        console.error("Failed to load metrics:", err);
      } finally {
        setLoading(false);
      }
    }
    void loadMetrics();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>
        <p>Carregando métricas da operação Reservei...</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Top Stat Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span>Proprietários Ativos</span>
            <Building2 size={16} color="#6366f1" />
          </div>
          <div className={styles.statValueLime}>
            {data?.activeOwners ?? 0}
            <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 400, marginLeft: 8 }}>
              / {data?.totalOwners ?? 0} total
            </span>
          </div>
          <span style={{ fontSize: 12, color: "#10b981", display: "flex", alignItems: "center", gap: 4 }}>
            <ArrowUpRight size={13} /> +{data?.newOwnersThisMonth ?? 0} novos neste mês
          </span>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span>Receita Mensal Recorrente (MRR)</span>
            <TrendingUp size={16} color="#10b981" />
          </div>
          <div className={styles.statValue} style={{ color: "#10b981" }}>
            {formatCurrency(data?.mrr ?? 0)}
          </div>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            ARR Projetado: {formatCurrency((data?.mrr ?? 0) * 12)}
          </span>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span>Assinantes Pagantes</span>
            <Sparkles size={16} color="#fbbf24" />
          </div>
          <div className={styles.statValue}>
            {data?.activeSubscribers ?? 0}
            <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 400, marginLeft: 8 }}>
              ativos
            </span>
          </div>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {data?.trialingCount ?? 0} contas em trial gratuito
          </span>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span>Churn Rate</span>
            <Activity size={16} color="#f87171" />
          </div>
          <div className={styles.statValue} style={{ color: data?.churnRate && data.churnRate > 10 ? "#f87171" : "#f3f4f6" }}>
            {data?.churnRate ?? 0}%
          </div>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {data?.churnedCount ?? 0} assinaturas canceladas/expiradas
          </span>
        </div>
      </div>

      {/* Grid: Influencer Coupons & Infrastructure Health */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20 }}>
        {/* Top Influencer Coupons */}
        <div className={styles.statCard}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <Ticket size={16} color="#6366f1" />
              Cupons de Influenciadores com Mais Resgates
            </h3>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Influenciador</th>
                  <th>Resgates</th>
                  <th>Conversão</th>
                </tr>
              </thead>
              <tbody>
                {(data?.topCoupons || []).map((c) => (
                  <tr key={c.couponId}>
                    <td style={{ fontWeight: 700, color: "#818cf8" }}>{c.code}</td>
                    <td>{c.influencerName || "Geral"}</td>
                    <td>{c.totalUses}</td>
                    <td>
                      <span className={`${styles.statusPill} ${styles.statusActive}`}>
                        {c.conversionRate}% ({c.convertedUses} pagos)
                      </span>
                    </td>
                  </tr>
                ))}
                {(!data?.topCoupons || data.topCoupons.length === 0) && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", color: "var(--text-secondary)", padding: 20 }}>
                      Nenhum cupom resgatado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Infrastructure & Gateway Status */}
        <div className={styles.statCard}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <Server size={16} color="#10b981" />
            Infraestrutura & Segurança
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ color: "var(--text-secondary)" }}>Banco de Dados Principal</span>
              <span style={{ color: "#10b981", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                <ShieldCheck size={14} /> MySQL 8.0 (Drizzle)
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ color: "var(--text-secondary)" }}>Gateway de Cobrança</span>
              <span style={{ color: "#818cf8", fontWeight: 600 }}>Mercado Pago API v1</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ color: "var(--text-secondary)" }}>Exclusão Segura</span>
              <span style={{ color: "#fbbf24", fontWeight: 600 }}>Soft Delete + Confirmação LGPD</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ color: "var(--text-secondary)" }}>Auditoria Administrativa</span>
              <span style={{ color: "#10b981", fontWeight: 600 }}>Ativa em 100% das escritas</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Administrative Actions */}
      <div className={styles.statCard}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={16} color="#fbbf24" />
            Últimas Ações de Backoffice (Auditoria)
          </h3>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Data / Hora</th>
                <th>Admin</th>
                <th>Ação</th>
                <th>Entidade / Alvo</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentAudit || []).map((a) => (
                <tr key={a.id}>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {new Date(a.createdAt).toLocaleString("pt-BR")}
                  </td>
                  <td>{a.adminEmail}</td>
                  <td>
                    <span className={`${styles.statusPill} ${styles.statusTrial}`}>
                      {a.action}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{a.entityName || a.entity}</td>
                </tr>
              ))}
              {(!data?.recentAudit || data.recentAudit.length === 0) && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "var(--text-secondary)", padding: 20 }}>
                    Nenhuma ação administrativa registrada recentemente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
