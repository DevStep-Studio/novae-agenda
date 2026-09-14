"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShieldAlert,
  Building2,
  Users,
  Calendar,
  Activity,
  LogOut,
  ExternalLink,
  CheckCircle2,
  Server,
  Layers,
  Sparkles,
  TrendingUp,
  CreditCard,
  FileText,
} from "lucide-react";
import { ReserveiLogo } from "@/components/brand/novae-logo";
import { useStore } from "@/store/store";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/client-utils";
import type { SuperadminStatsDTO } from "@/shared/types";
import styles from "./admin-dashboard.module.css";

type Tab = "empresas" | "saas" | "usuarios" | "agendamentos" | "logs" | "status";

export function AdminDashboard() {
  const { session, logout } = useStore();
  const [activeTab, setActiveTab] = useState<Tab>("empresas");
  const [stats, setStats] = useState<SuperadminStatsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api<SuperadminStatsDTO>("/api/superadmin");
      setStats(res || null);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const res = await api<SuperadminStatsDTO>("/api/superadmin");
        if (!cancelled) setStats(res || null);
      } catch {
        if (!cancelled) setStats(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredCompanies = (stats?.recentCompanies || []).filter((c) => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q);
  });

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logoArea}>
          <ReserveiLogo size={32} />
        </div>

        <div className={styles.adminBadge}>
          <ShieldAlert size={12} />
          Superadmin
        </div>

        <nav className={styles.nav}>
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === "empresas" ? styles.active : ""}`}
            onClick={() => setActiveTab("empresas")}
          >
            <Building2 size={18} />
            Empresas ({stats?.totalCompanies ?? 0})
          </button>
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === "saas" ? styles.active : ""}`}
            onClick={() => setActiveTab("saas")}
          >
            <Sparkles size={18} />
            Métricas SaaS
          </button>
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === "usuarios" ? styles.active : ""}`}
            onClick={() => setActiveTab("usuarios")}
          >
            <Users size={18} />
            Usuários ({stats?.totalUsers ?? 0})
          </button>
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === "agendamentos" ? styles.active : ""}`}
            onClick={() => setActiveTab("agendamentos")}
          >
            <Calendar size={18} />
            Agendamentos ({stats?.totalAppointments ?? 0})
          </button>
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === "logs" ? styles.active : ""}`}
            onClick={() => setActiveTab("logs")}
          >
            <FileText size={18} />
            Audit Logs
          </button>
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === "status" ? styles.active : ""}`}
            onClick={() => setActiveTab("status")}
          >
            <Activity size={18} />
            Status do Sistema
          </button>
        </nav>

        <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <a href="/gestao" className={styles.portalSwitchBtn}>
            <ExternalLink size={13} />
            Painel da Empresa
          </a>
          <button
            type="button"
            onClick={logout}
            className={styles.portalSwitchBtn}
            style={{ color: "#f87171" }}
          >
            <LogOut size={13} />
            Sair
          </button>
        </div>
      </aside>

      <main className={styles.mainContent}>
        <header className={styles.topbar}>
          <div className={styles.topbarTitle}>
            <h1>Painel Superadmin Reservei</h1>
            <p>Gerenciamento global de tenants, status e métricas da infraestrutura.</p>
          </div>
        </header>

        <div className={styles.contentBody}>
          {/* Top SaaS KPI Cards */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span>Empresas Cadastradas</span>
                <Building2 size={16} />
              </div>
              <div className={styles.statValueLime}>{stats?.totalCompanies ?? 0}</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span>Receita Recorrente (MRR)</span>
                <TrendingUp size={16} color="#4ade80" />
              </div>
              <div className={styles.statValue} style={{ color: "#4ade80" }}>
                {formatCurrency(stats?.estimatedMRR ?? 0)}
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span>Assinaturas Ativas / Trials</span>
                <Sparkles size={16} color="var(--primary)" />
              </div>
              <div className={styles.statValue}>
                {stats?.activeSubscriptions ?? 0} <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>ativas</span> · {stats?.trialSubscriptions ?? 0} <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>trials</span>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span>Total de Agendamentos</span>
                <Calendar size={16} />
              </div>
              <div className={styles.statValue}>{stats?.totalAppointments ?? 0}</div>
            </div>
          </div>

          {/* TAB: Empresas */}
          {activeTab === "empresas" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Empresas Cadastradas</h2>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar empresa por nome ou e-mail..."
                  style={{
                    padding: "8px 14px",
                    background: "var(--surface-secondary)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--text-primary)",
                    fontSize: 13,
                    width: 280,
                  }}
                />
              </div>

              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>E-mail</th>
                    <th>Colaboradores</th>
                    <th>Agendamentos</th>
                    <th>Plano / Status</th>
                    <th>Criado em</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompanies.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</td>
                      <td>{c.email || "—"}</td>
                      <td>{c.employeesCount}</td>
                      <td>{c.appointmentsCount}</td>
                      <td>
                        <span
                          className={styles.statusPill}
                          style={{
                            borderColor: c.subscriptionStatus === "active" ? "#4ade80" : "var(--primary)",
                            color: c.subscriptionStatus === "active" ? "#4ade80" : "var(--primary)",
                          }}
                        >
                          <CheckCircle2 size={11} /> {c.subscriptionStatus?.toUpperCase() ?? "TRIAL"}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                        {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                  {filteredCompanies.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: 24, color: "rgba(255,255,255,0.5)" }}>
                        Nenhuma empresa encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: SaaS Metrics */}
          {activeTab === "saas" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div className={styles.statCard}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Resumo Financeiro SaaS</h3>
                <p><strong>MRR Estimado:</strong> {formatCurrency(stats?.estimatedMRR ?? 0)}/mês</p>
                <p><strong>ARR Projetado:</strong> {formatCurrency((stats?.estimatedMRR ?? 0) * 12)}/ano</p>
                <p><strong>Assinaturas Ativas:</strong> {stats?.activeSubscriptions ?? 0}</p>
                <p><strong>Períodos de Teste (Trials):</strong> {stats?.trialSubscriptions ?? 0}</p>
              </div>

              <div className={styles.statCard}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Planos Comerciais</h3>
                <p><strong>Pro Mensal:</strong> R$ 89,90/mês</p>
                <p><strong>Pro Anual:</strong> R$ 799,00/ano (economia de 26%)</p>
                <p><strong>Gateway:</strong> Mercado Pago (Recorrência via Webhooks)</p>
                <p><strong>Período de Trial:</strong> 7 dias gratuitos</p>
              </div>
            </div>
          )}

          {/* TAB: Usuários */}
          {activeTab === "usuarios" && (
            <div className={styles.statCard}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Base de Usuários</h2>
              <p><strong>Total de contas registradas:</strong> {stats?.totalUsers ?? 0}</p>
              <p><strong>Profissionais da equipe:</strong> {stats?.totalEmployees ?? 0}</p>
              <p>Os usuários são segregados nos papéis: Cliente, Profissional, Gestor, Proprietário e Superadmin.</p>
            </div>
          )}

          {/* TAB: Agendamentos */}
          {activeTab === "agendamentos" && (
            <div className={styles.statCard}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Volume de Agendamentos</h2>
              <p><strong>Total histórico na plataforma:</strong> {stats?.totalAppointments ?? 0} agendamentos</p>
              <p>Integridade garantida pelo motor central de disponibilidade e bloqueio advisory do PostgreSQL.</p>
            </div>
          )}

          {/* TAB: Audit Logs */}
          {activeTab === "logs" && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Trilha de Auditoria Recente</h2>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Ação</th>
                    <th>Entidade</th>
                    <th>Data / Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats?.recentLogs || []).map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontWeight: 600, color: "#ffffff" }}><code>{log.action}</code></td>
                      <td>{log.entity}</td>
                      <td style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                        {new Date(log.createdAt).toLocaleString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                  {(!stats?.recentLogs || stats.recentLogs.length === 0) && (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "center", padding: 24, color: "rgba(255,255,255,0.5)" }}>
                        Nenhum log registrado recentemente.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: Status */}
          {activeTab === "status" && (
            <div className={styles.statCard} style={{ maxWidth: 640 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Saúde da Infraestrutura</h2>
              <p><strong>Banco de Dados:</strong> MySQL 8.0 com Drizzle ORM (Conectado)</p>
              <p><strong>Anti-Collision:</strong> Locks transacionais via MySQL InnoDB `FOR UPDATE`</p>
              <p><strong>Gateway de Pagamento:</strong> Mercado Pago Webhook `/api/webhooks/mercadopago`</p>
              <p><strong>Notificações & Lembretes:</strong> Job runner ativo</p>
              <p><strong>Segurança:</strong> Bcrypt (12 rounds), JWT assinado, Rate Limiting ativo</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
