"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Building2,
  Users,
  Sparkles,
  Ticket,
  FileText,
  LogOut,
  ExternalLink,
  LayoutDashboard,
} from "lucide-react";
import { ReserveiLogo } from "@/components/brand/novae-logo";
import { useStore } from "@/store/store";
import { Toasts } from "@/components/ui/toast";
import { ConfirmModalHost } from "@/components/ui/confirm-modal";
import { MetricsTab } from "./tabs/metrics-tab";
import { OwnersTab } from "./tabs/owners-tab";
import { ClientsTab } from "./tabs/clients-tab";
import { CouponsTab } from "./tabs/coupons-tab";
import { AuditTab } from "./tabs/audit-tab";
import styles from "./admin-dashboard.module.css";

type Tab = "dashboard" | "proprietarios" | "clientes" | "cupons" | "logs";

export function AdminDashboard() {
  const { session, logout, toasts, dismissToast } = useStore();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  return (
    <div className={styles.shell}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.logoArea}>
          <ReserveiLogo size={32} />
        </div>

        <div className={styles.adminBadge}>
          <ShieldAlert size={12} />
          Super Admin
        </div>

        <nav className={styles.nav}>
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === "dashboard" ? styles.active : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            <LayoutDashboard size={18} />
            Dashboard
          </button>

          <button
            type="button"
            className={`${styles.navItem} ${activeTab === "proprietarios" ? styles.active : ""}`}
            onClick={() => setActiveTab("proprietarios")}
          >
            <Building2 size={18} />
            Proprietários
          </button>

          <button
            type="button"
            className={`${styles.navItem} ${activeTab === "clientes" ? styles.active : ""}`}
            onClick={() => setActiveTab("clientes")}
          >
            <Users size={18} />
            Clientes
          </button>

          <button
            type="button"
            className={`${styles.navItem} ${activeTab === "cupons" ? styles.active : ""}`}
            onClick={() => setActiveTab("cupons")}
          >
            <Ticket size={18} />
            Cupons & Influenciadores
          </button>

          <button
            type="button"
            className={`${styles.navItem} ${activeTab === "logs" ? styles.active : ""}`}
            onClick={() => setActiveTab("logs")}
          >
            <FileText size={18} />
            Logs de Auditoria
          </button>
        </nav>

        <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 8, paddingLeft: 4 }}>
            Conectado como: <strong>{session?.email || "Admin"}</strong>
          </div>
          <Link href="/gestao" className={styles.portalSwitchBtn}>
            <ExternalLink size={13} />
            Painel da Empresa
          </Link>
          <button
            type="button"
            onClick={logout}
            className={styles.portalSwitchBtn}
            style={{ color: "#f87171" }}
          >
            <LogOut size={13} />
            Sair do Painel
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={styles.mainContent}>
        <header className={styles.topbar}>
          <div className={styles.topbarTitle}>
            <h1>Painel de Super Admin Reservei</h1>
            <p>Acesso e gestão operacional direta ao ecossistema multi-tenant.</p>
          </div>
        </header>

        <div className={styles.contentBody}>
          {activeTab === "dashboard" && <MetricsTab />}
          {activeTab === "proprietarios" && <OwnersTab />}
          {activeTab === "clientes" && <ClientsTab />}
          {activeTab === "cupons" && <CouponsTab />}
          {activeTab === "logs" && <AuditTab />}
        </div>
      </main>
      <Toasts toasts={toasts} onDismiss={dismissToast} />
      <ConfirmModalHost />
    </div>
  );
}
