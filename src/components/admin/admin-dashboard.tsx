"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Building2,
  Users,
  CreditCard,
  Ticket,
  FileText,
  LogOut,
  ExternalLink,
  LayoutDashboard,
  Menu,
  X,
  KeyRound,
} from "lucide-react";
import { ReserveiLogo } from "@/components/brand/novae-logo";
import { useStore } from "@/store/store";
import { Toasts } from "@/components/ui/toast";
import { ConfirmModalHost } from "@/components/ui/confirm-modal";
import { MetricsTab } from "./tabs/metrics-tab";
import { UsersTab } from "./tabs/users-tab";
import { OwnersTab } from "./tabs/owners-tab";
import { SubscriptionsTab } from "./tabs/subscriptions-tab";
import { ClientsTab } from "./tabs/clients-tab";
import { PinsTab } from "./tabs/pins-tab";
import { CouponsTab } from "./tabs/coupons-tab";
import { AuditTab } from "./tabs/audit-tab";
import styles from "./admin-dashboard.module.css";

type Tab = "dashboard" | "usuarios" | "proprietarios" | "assinaturas" | "clientes" | "pins" | "cupons" | "logs";

export function AdminDashboard() {
  const { session, logout, toasts, dismissToast } = useStore();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSelectTab = (tab: Tab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <div className={styles.shell}>
      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          className={styles.sidebarOverlay}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${mobileMenuOpen ? styles.open : ""}`}>
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
            onClick={() => handleSelectTab("dashboard")}
          >
            <LayoutDashboard size={18} />
            Dashboard
          </button>

          <button
            type="button"
            className={`${styles.navItem} ${activeTab === "usuarios" ? styles.active : ""}`}
            onClick={() => handleSelectTab("usuarios")}
          >
            <Users size={18} />
            Usuários & Níveis
          </button>

          <button
            type="button"
            className={`${styles.navItem} ${activeTab === "proprietarios" ? styles.active : ""}`}
            onClick={() => handleSelectTab("proprietarios")}
          >
            <Building2 size={18} />
            Proprietários
          </button>

          <button
            type="button"
            className={`${styles.navItem} ${activeTab === "assinaturas" ? styles.active : ""}`}
            onClick={() => handleSelectTab("assinaturas")}
          >
            <CreditCard size={18} />
            Assinaturas
          </button>

          <button
            type="button"
            className={`${styles.navItem} ${activeTab === "clientes" ? styles.active : ""}`}
            onClick={() => handleSelectTab("clientes")}
          >
            <Users size={18} />
            Clientes
          </button>

          <button
            type="button"
            className={`${styles.navItem} ${activeTab === "pins" ? styles.active : ""}`}
            onClick={() => handleSelectTab("pins")}
          >
            <KeyRound size={18} />
            PINs de Acesso
          </button>

          <button
            type="button"
            className={`${styles.navItem} ${activeTab === "cupons" ? styles.active : ""}`}
            onClick={() => handleSelectTab("cupons")}
          >
            <Ticket size={18} />
            Cupons & Influenciadores
          </button>

          <button
            type="button"
            className={`${styles.navItem} ${activeTab === "logs" ? styles.active : ""}`}
            onClick={() => handleSelectTab("logs")}
          >
            <FileText size={18} />
            Logs de Auditoria
          </button>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.sidebarUserText}>
            Conectado como: <strong>{session?.email || "Super Admin"}</strong>
          </div>
          <Link href="/gestao" className={styles.portalSwitchBtn}>
            <ExternalLink size={13} />
            <span>Painel da Empresa</span>
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className={styles.sidebarExitBtn}
          >
            <LogOut size={13} />
            <span>Sair do Painel</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={styles.mainContent}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button
              type="button"
              className={styles.mobileMenuBtn}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Abrir menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className={styles.topbarTitle}>
              <h1>Painel de Super Admin Reservei</h1>
              <p>Acesso e gestão operacional direta ao ecossistema multi-tenant.</p>
            </div>
          </div>

          <div className={styles.topbarRight}>
            <div className={styles.topbarUserChip}>
              <span className={styles.userStatusDot} />
              <span className={styles.topbarUserEmail}>
                {session?.email || "Super Admin"}
              </span>
            </div>

            <Link
              href="/gestao"
              className={styles.topbarBtn}
              title="Ir para o Painel da Empresa"
            >
              <ExternalLink size={14} />
              <span>Painel da Empresa</span>
            </Link>

            <button
              type="button"
              onClick={() => void logout()}
              className={styles.topbarLogoutBtn}
              title="Sair do Painel de Administrador"
            >
              <LogOut size={14} />
              <span>Sair</span>
            </button>
          </div>
        </header>

        <div className={styles.contentBody}>
          {activeTab === "dashboard" && <MetricsTab />}
          {activeTab === "usuarios" && (
            <UsersTab onSwitchToPins={() => handleSelectTab("pins")} />
          )}
          {activeTab === "proprietarios" && (
            <OwnersTab onSwitchToUsers={() => handleSelectTab("usuarios")} />
          )}
          {activeTab === "assinaturas" && <SubscriptionsTab />}
          {activeTab === "clientes" && <ClientsTab />}
          {activeTab === "pins" && <PinsTab />}
          {activeTab === "cupons" && <CouponsTab />}
          {activeTab === "logs" && <AuditTab />}
        </div>
      </main>
      <Toasts toasts={toasts} onDismiss={dismissToast} />
      <ConfirmModalHost />
    </div>
  );
}
