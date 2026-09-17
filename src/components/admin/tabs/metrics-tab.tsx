"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Building2,
  TrendingUp,
  Sparkles,
  Users,
  Ticket,
  ShieldCheck,
  Activity,
  ArrowUpRight,
  Clock,
  DollarSign,
  AlertCircle,
  Calendar,
  Layers,
  UserCheck,
  CheckCircle2,
  XCircle,
  Briefcase,
} from "lucide-react";
import { formatCurrency } from "@/lib/client-utils";
import styles from "../admin-dashboard.module.css";

interface MetricsData {
  period: string;
  startDate: string | null;
  endDate: string | null;
  totalCompanies: number;
  activeCompanies: number;
  newCompaniesInPeriod: number;
  totalOwners: number;
  activeEmployees: number;
  totalClients: number;
  totalAppointments: number;
  newAppointmentsInPeriod: number;
  activeSubscribers: number;
  trialingCount: number;
  expiredTrialsCount: number;
  pendingSubsCount: number;
  cancelledSubsCount: number;
  churnedCount: number;
  churnRate: number;
  mrr: number;
  platformRevenue: number;
  establishmentsRevenue: number;
  totalPendingPayments: number;
  totalPaymentFailures: number;
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
  const [period, setPeriod] = useState<"today" | "7d" | "30d" | "all">("30d");

  const loadMetrics = useCallback(async (selectedPeriod: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/superadmin/metrics?period=${selectedPeriod}`);
      const json = await res.json();
      if (json.data) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Erro ao carregar métricas:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => {
      if (mounted) void loadMetrics(period);
    }, 0);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [period, loadMetrics]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header & Period Filters */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#ffffff" }}>
            Visão Geral do Ecossistema Reservei
          </h2>
        </div>

        <div className={styles.toolbarRight}>
          <div style={{ display: "flex", gap: 6, background: "#141414", padding: 4, borderRadius: 8, border: "1px solid #262626" }}>
            <button
              type="button"
              className={styles.btnGhost}
              style={{
                background: period === "today" ? "#dcff4c" : "transparent",
                color: period === "today" ? "#0a0a0a" : "#a3a3a3",
                fontWeight: period === "today" ? 700 : 500,
                fontSize: 12,
                padding: "6px 12px",
                borderRadius: 6,
              }}
              onClick={() => setPeriod("today")}
            >
              Hoje
            </button>
            <button
              type="button"
              className={styles.btnGhost}
              style={{
                background: period === "7d" ? "#dcff4c" : "transparent",
                color: period === "7d" ? "#0a0a0a" : "#a3a3a3",
                fontWeight: period === "7d" ? 700 : 500,
                fontSize: 12,
                padding: "6px 12px",
                borderRadius: 6,
              }}
              onClick={() => setPeriod("7d")}
            >
              7 Dias
            </button>
            <button
              type="button"
              className={styles.btnGhost}
              style={{
                background: period === "30d" ? "#dcff4c" : "transparent",
                color: period === "30d" ? "#0a0a0a" : "#a3a3a3",
                fontWeight: period === "30d" ? 700 : 500,
                fontSize: 12,
                padding: "6px 12px",
                borderRadius: 6,
              }}
              onClick={() => setPeriod("30d")}
            >
              30 Dias
            </button>
            <button
              type="button"
              className={styles.btnGhost}
              style={{
                background: period === "all" ? "#dcff4c" : "transparent",
                color: period === "all" ? "#0a0a0a" : "#a3a3a3",
                fontWeight: period === "all" ? 700 : 500,
                fontSize: 12,
                padding: "6px 12px",
                borderRadius: 6,
              }}
              onClick={() => setPeriod("all")}
            >
              Geral
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ padding: 40, textAlign: "center", color: "#a3a3a3" }}>
          <p>Carregando métricas reais do MySQL...</p>
        </div>
      )}

      {!loading && (
        <>
          {/* Revenue Segregation Cards */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard} style={{ borderLeft: "4px solid #dcff4c" }}>
              <div className={styles.statHeader}>
                <span>RECEITA DA PLATAFORMA (SAAS)</span>
                <DollarSign size={16} color="#dcff4c" />
              </div>
              <div className={styles.statValueLime}>
                {formatCurrency(data?.platformRevenue ?? 0)}
              </div>
              <span style={{ fontSize: 12, color: "#a3a3a3" }}>
                Faturas SaaS confirmadas ({period === "all" ? "histórico completo" : "no período"})
              </span>
            </div>

            <div className={styles.statCard} style={{ borderLeft: "4px solid #10b981" }}>
              <div className={styles.statHeader}>
                <span>RECEITA DOS ESTABELECIMENTOS</span>
                <TrendingUp size={16} color="#10b981" />
              </div>
              <div className={styles.statValue} style={{ color: "#10b981" }}>
                {formatCurrency(data?.establishmentsRevenue ?? 0)}
              </div>
              <span style={{ fontSize: 12, color: "#a3a3a3" }}>
                Atendimentos e reservas dos estabelecimentos
              </span>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span>RECEITA RECORRENTE (MRR)</span>
                <Sparkles size={16} color="#dcff4c" />
              </div>
              <div className={styles.statValue}>
                {formatCurrency(data?.mrr ?? 0)}
              </div>
              <span style={{ fontSize: 12, color: "#a3a3a3" }}>
                ARR Estimado: {formatCurrency((data?.mrr ?? 0) * 12)}
              </span>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span>CHURN RATE</span>
                <Activity size={16} color="#f87171" />
              </div>
              <div className={styles.statValue} style={{ color: (data?.churnRate ?? 0) > 10 ? "#f87171" : "#ffffff" }}>
                {data?.churnRate ?? 0}%
              </div>
              <span style={{ fontSize: 12, color: "#a3a3a3" }}>
                {data?.churnedCount ?? 0} assinaturas canceladas / expiradas
              </span>
            </div>
          </div>

          {/* Core Ecosystem Operational Metrics */}
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: "8px 0 0 0", color: "#a3a3a3", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Indicadores Operacionais
          </h3>

          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span>Empresas & Negócios</span>
                <Building2 size={16} color="#dcff4c" />
              </div>
              <div className={styles.statValue}>
                {data?.totalCompanies ?? 0}
                <span style={{ fontSize: 12, color: "#a3a3a3", fontWeight: 400, marginLeft: 8 }}>
                  ({data?.activeCompanies ?? 0} ativas)
                </span>
              </div>
              <span style={{ fontSize: 12, color: "#dcff4c", display: "flex", alignItems: "center", gap: 4 }}>
                <ArrowUpRight size={13} /> +{data?.newCompaniesInPeriod ?? 0} no período
              </span>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span>Assinaturas Ativas</span>
                <CheckCircle2 size={16} color="#10b981" />
              </div>
              <div className={styles.statValue}>
                {data?.activeSubscribers ?? 0}
              </div>
              <span style={{ fontSize: 12, color: "#a3a3a3" }}>
                {data?.trialingCount ?? 0} em teste gratuito
              </span>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span>Trials Expirados</span>
                <Clock size={16} color="#fbbf24" />
              </div>
              <div className={styles.statValue} style={{ color: (data?.expiredTrialsCount ?? 0) > 0 ? "#fbbf24" : "#ffffff" }}>
                {data?.expiredTrialsCount ?? 0}
              </div>
              <span style={{ fontSize: 12, color: "#a3a3a3" }}>
                Contas que concluíram o período de teste
              </span>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span>Assinaturas Pendentes</span>
                <AlertCircle size={16} color="#fbbf24" />
              </div>
              <div className={styles.statValue}>
                {data?.pendingSubsCount ?? 0}
              </div>
              <span style={{ fontSize: 12, color: "#a3a3a3" }}>
                Aguardando confirmação de pagamento
              </span>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span>Proprietários Cadastrados</span>
                <UserCheck size={16} color="#dcff4c" />
              </div>
              <div className={styles.statValue}>
                {data?.totalOwners ?? 0}
              </div>
              <span style={{ fontSize: 12, color: "#a3a3a3" }}>
                Usuários com role OWNER no MySQL
              </span>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span>Funcionários Ativos</span>
                <Briefcase size={16} color="#ffffff" />
              </div>
              <div className={styles.statValue}>
                {data?.activeEmployees ?? 0}
              </div>
              <span style={{ fontSize: 12, color: "#a3a3a3" }}>
                Profissionais alocados nos negócios
              </span>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span>Clientes Cadastrados</span>
                <Users size={16} color="#ffffff" />
              </div>
              <div className={styles.statValue}>
                {data?.totalClients ?? 0}
              </div>
              <span style={{ fontSize: 12, color: "#a3a3a3" }}>
                Clientes finais cadastrados
              </span>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span>Agendamentos Realizados</span>
                <Calendar size={16} color="#dcff4c" />
              </div>
              <div className={styles.statValue}>
                {data?.totalAppointments ?? 0}
              </div>
              <span style={{ fontSize: 12, color: "#dcff4c", display: "flex", alignItems: "center", gap: 4 }}>
                <ArrowUpRight size={13} /> +{data?.newAppointmentsInPeriod ?? 0} no período
              </span>
            </div>
          </div>

          {/* Section: Influencers & Recent Audit */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20 }}>
            {/* Top Influencer Coupons */}
            <div className={styles.detailSection}>
              <div className={styles.detailSectionTitle}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Ticket size={16} color="#dcff4c" />
                  Top Cupons de Influenciadores
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data?.topCoupons && data.topCoupons.length > 0 ? (
                  data.topCoupons.map((coupon) => (
                    <div
                      key={coupon.couponId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 12px",
                        background: "#141414",
                        border: "1px solid #262626",
                        borderRadius: 8,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: "#dcff4c", fontSize: 13 }}>
                          {coupon.code}
                        </div>
                        <div style={{ fontSize: 11, color: "#a3a3a3" }}>
                          {coupon.influencerName || coupon.name}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#ffffff" }}>
                          {coupon.convertedUses} pagantes
                        </div>
                        <div style={{ fontSize: 11, color: "#a3a3a3" }}>
                          {coupon.totalUses} resgates ({coupon.conversionRate}%)
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ color: "#a3a3a3", fontSize: 13, margin: "12px 0" }}>
                    Nenhum resgate de cupom registrado no período.
                  </p>
                )}
              </div>
            </div>

            {/* Recent Audit Activities */}
            <div className={styles.detailSection}>
              <div className={styles.detailSectionTitle}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ShieldCheck size={16} color="#dcff4c" />
                  Últimas Ações de Auditoria
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data?.recentAudit && data.recentAudit.length > 0 ? (
                  data.recentAudit.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        padding: "10px 12px",
                        background: "#141414",
                        border: "1px solid #262626",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, color: "#dcff4c" }}>
                          {log.action}
                        </span>
                        <span style={{ fontSize: 11, color: "#737373" }}>
                          {new Date(log.createdAt).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <div style={{ color: "#ffffff" }}>
                        {log.entityName || log.entity}
                      </div>
                      <div style={{ fontSize: 11, color: "#a3a3a3" }}>
                        Executado por: {log.adminEmail}
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ color: "#a3a3a3", fontSize: 13, margin: "12px 0" }}>
                    Nenhum evento registrado recentemente.
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
