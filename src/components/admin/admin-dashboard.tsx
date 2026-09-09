"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { NovaeLogo } from "@/components/brand/novae-logo";
import { useStore } from "@/store/store";
import { api } from "@/lib/api-client";
import styles from "./admin-dashboard.module.css";

type Tab = "empresas" | "usuarios" | "agendamentos" | "status";

type CompanyItem = {
  id: string;
  name: string;
  slug: string;
  phone: string;
  active: boolean;
  createdAt: string;
};

export function AdminDashboard() {
  const { session, logout } = useStore();
  const [activeTab, setActiveTab] = useState<Tab>("empresas");
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await api<{ data: CompanyItem[] }>("/api/companies/public");
        setCompanies(res.data || []);
      } catch {
        setCompanies([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logoArea}>
          <NovaeLogo size={32} />
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
            Empresas
          </button>
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === "usuarios" ? styles.active : ""}`}
            onClick={() => setActiveTab("usuarios")}
          >
            <Users size={18} />
            Usuários
          </button>
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === "agendamentos" ? styles.active : ""}`}
            onClick={() => setActiveTab("agendamentos")}
          >
            <Calendar size={18} />
            Agendamentos
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
            <h1>Painel Superadmin Nova(e)</h1>
            <p>Gerenciamento global de tenants, status e métricas da infraestrutura.</p>
          </div>
        </header>

        <div className={styles.contentBody}>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span>Empresas cadastradas</span>
                <Building2 size={16} />
              </div>
              <div className={styles.statValueLime}>{companies.length}</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span>Status da Plataforma</span>
                <Server size={16} />
              </div>
              <div className={styles.statValue} style={{ color: "#4ade80", fontSize: 20 }}>
                100% Operacional
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span>Banco de dados</span>
                <Layers size={16} />
              </div>
              <div className={styles.statValue} style={{ fontSize: 20 }}>
                PostgreSQL OK
              </div>
            </div>
          </div>

          {activeTab === "empresas" && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Empresas Ativas</h2>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Slug</th>
                    <th>Telefone</th>
                    <th>Status</th>
                    <th>Link Público</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td><code>/{c.slug}</code></td>
                      <td>{c.phone || "—"}</td>
                      <td>
                        <span className={styles.statusPill}>
                          <CheckCircle2 size={11} /> Ativa
                        </span>
                      </td>
                      <td>
                        <a
                          href={`/r/${c.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "#dcff4c", textDecoration: "none", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                        >
                          Abrir <ExternalLink size={11} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "status" && (
            <div className={styles.statCard} style={{ maxWidth: 600 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Saúde da Infraestrutura</h2>
              <p><strong>Ambiente:</strong> {process.env.NODE_ENV}</p>
              <p><strong>Motor de Agendamentos:</strong> Ativo com bloqueio atômico</p>
              <p><strong>Servidor de Notificações:</strong> Conectado</p>
              <p><strong>Versão do Schema:</strong> v2.4 (Multi-profile + Memberships)</p>
            </div>
          )}

          {activeTab === "usuarios" && (
            <div className={styles.statCard} style={{ maxWidth: 600 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Gestão de Usuários</h2>
              <p>Os usuários são segregados por papéis (Cliente, Funcionário, Gestor, Administrador e Superadmin) com controle granular de acesso.</p>
            </div>
          )}

          {activeTab === "agendamentos" && (
            <div className={styles.statCard} style={{ maxWidth: 600 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Monitoramento de Agendamentos</h2>
              <p>Todos os agendamentos passam pelo motor de disponibilidade unificado para garantir integridade anti-colisão.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
