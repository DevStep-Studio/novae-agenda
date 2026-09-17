"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CreditCard,
  Search,
  Plus,
  X,
  AlertTriangle,
  Clock,
  Calendar,
  Building2,
  CheckCircle2,
  Ban,
  ExternalLink,
} from "lucide-react";
import { formatCurrency } from "@/lib/client-utils";
import styles from "../admin-dashboard.module.css";

export function SubscriptionsTab() {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Grant Subscription Modal
  const [grantModalOpen, setGrantModalOpen] = useState(false);
  const [grantForm, setGrantForm] = useState({
    companyId: "",
    planSlug: "profissional",
    originType: "manual_courtesy" as "manual_courtesy" | "manual_paid",
    periodDays: 30,
    reason: "",
  });

  // Revoke Subscription Modal
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [selectedSub, setSelectedSub] = useState<any | null>(null);
  const [revokeForm, setRevokeForm] = useState({
    immediately: true,
    reason: "",
  });

  const loadSubscriptions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
      });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/superadmin/subscriptions?${params.toString()}`);
      const json = await res.json();
      if (json.data || json.items) {
        setSubscriptions(json.data || json.items);
        setTotalPages(json.pagination?.totalPages || 1);
        setTotalCount(json.pagination?.total || 0);
      }
    } catch (err) {
      console.error("Erro ao carregar assinaturas:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadSubscriptions();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadSubscriptions]);

  const handleGrantSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantForm.companyId.trim()) {
      alert("Informe o ID da empresa.");
      return;
    }
    if (!grantForm.reason.trim()) {
      alert("Informe uma justificativa para auditoria.");
      return;
    }

    try {
      const res = await fetch("/api/superadmin/subscriptions/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(grantForm),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Erro ao conceder assinatura.");
        return;
      }
      alert(json.message || "Assinatura concedida com sucesso!");
      setGrantModalOpen(false);
      setGrantForm({
        companyId: "",
        planSlug: "profissional",
        originType: "manual_courtesy",
        periodDays: 30,
        reason: "",
      });
      void loadSubscriptions();
    } catch (err: any) {
      alert("Erro ao conceder assinatura: " + err.message);
    }
  };

  const handleRevokeSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub) return;
    if (!revokeForm.reason.trim()) {
      alert("Informe a justificativa do cancelamento para auditoria.");
      return;
    }

    try {
      const res = await fetch("/api/superadmin/subscriptions/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: selectedSub.companyId,
          immediately: revokeForm.immediately,
          reason: revokeForm.reason,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Erro ao revogar assinatura.");
        return;
      }
      alert(json.message || "Assinatura revogada com sucesso!");
      setRevokeModalOpen(false);
      setSelectedSub(null);
      setRevokeForm({ immediately: true, reason: "" });
      void loadSubscriptions();
    } catch (err: any) {
      alert("Erro ao revogar assinatura: " + err.message);
    }
  };

  const renderStatusBadge = (sub: any) => {
    const isTrial = sub.status === "trialing";
    const isExpiredTrial =
      isTrial && sub.trialEndsAt && new Date(sub.trialEndsAt) < new Date();

    if (isExpiredTrial || sub.status === "expired") {
      return (
        <span className={`${styles.statusPill} ${styles.statusCancelled}`}>
          Trial Expirado
        </span>
      );
    }
    if (isTrial) {
      return (
        <span className={`${styles.statusPill} ${styles.statusTrial}`}>
          Teste Gratuito
        </span>
      );
    }
    if (sub.status === "active") {
      return (
        <span className={`${styles.statusPill} ${styles.statusActive}`}>
          Ativa
        </span>
      );
    }
    if (sub.status === "pending" || sub.status === "past_due") {
      return (
        <span className={`${styles.statusPill} ${styles.statusTrial}`}>
          Pendente
        </span>
      );
    }
    if (sub.status === "suspended") {
      return (
        <span className={`${styles.statusPill} ${styles.statusCancelled}`}>
          Suspensa
        </span>
      );
    }
    return (
      <span className={`${styles.statusPill} ${styles.statusDeleted}`}>
        {sub.status || "Inativa"}
      </span>
    );
  };

  return (
    <div>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div style={{ position: "relative" }}>
            <input
              type="search"
              placeholder="Buscar por empresa, e-mail, plano..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className={styles.searchInput}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className={styles.filterSelect}
          >
            <option value="all">Todos os Status</option>
            <option value="active">Ativas</option>
            <option value="trialing">Em Teste Gratuito</option>
            <option value="pending">Pagamento Pendente</option>
            <option value="suspended">Suspensas</option>
            <option value="cancelled">Canceladas</option>
          </select>
        </div>

        <div className={styles.toolbarRight}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => setGrantModalOpen(true)}
          >
            <Plus size={15} />
            Conceder Assinatura Manual
          </button>
        </div>
      </div>

      {/* Table (Desktop) */}
      <div className={styles.tableWrapper}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>Empresa / Proprietário</th>
              <th>Plano</th>
              <th>Status</th>
              <th>Periodicidade</th>
              <th>Valor Contratado</th>
              <th>Origem</th>
              <th>Próxima Cobrança / Fim</th>
              <th style={{ textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map((sub) => (
              <tr key={sub.id}>
                <td>
                  <div style={{ fontWeight: 700, color: "#ffffff" }}>
                    {sub.companyName}
                  </div>
                  <div style={{ fontSize: 12, color: "#a3a3a3" }}>
                    {sub.ownerName} ({sub.ownerEmail})
                  </div>
                </td>
                <td>
                  <span style={{ fontWeight: 600, textTransform: "capitalize" }}>
                    {sub.plan}
                  </span>
                </td>
                <td>{renderStatusBadge(sub)}</td>
                <td>
                  <span style={{ fontSize: 12, color: "#a3a3a3" }}>
                    {sub.billingInterval === "yearly" ? "Anual" : "Mensal"}
                  </span>
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>
                    {sub.amount ? formatCurrency(Number(sub.amount)) : "R$ 0,00"}
                  </div>
                  <div style={{ fontSize: 11, color: "#a3a3a3" }}>
                    Método: {sub.paymentMethod?.toUpperCase() || "PIX"}
                  </div>
                </td>
                <td>
                  <span style={{ fontSize: 12, color: "#a3a3a3" }}>
                    {sub.origin === "manual_courtesy"
                      ? "Cortesia Admin"
                      : sub.origin === "manual_paid"
                      ? "Manual Pago"
                      : "Checkout Online"}
                  </span>
                </td>
                <td>
                  <div style={{ fontSize: 12 }}>
                    {sub.nextPaymentAt
                      ? new Date(sub.nextPaymentAt).toLocaleDateString("pt-BR")
                      : sub.trialEndsAt
                      ? `Trial até ${new Date(sub.trialEndsAt).toLocaleDateString("pt-BR")}`
                      : "—"}
                  </div>
                </td>
                <td style={{ textAlign: "right" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                    {sub.status !== "cancelled" && sub.status !== "suspended" && (
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        style={{ padding: "6px 10px", fontSize: 11 }}
                        onClick={() => {
                          setSelectedSub(sub);
                          setRevokeModalOpen(true);
                        }}
                      >
                        <Ban size={13} style={{ color: "#f87171" }} />
                        Revogar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && subscriptions.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: 36, color: "#a3a3a3" }}>
                  Nenhuma assinatura encontrada para os filtros selecionados.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: 36, color: "#a3a3a3" }}>
                  Carregando assinaturas do sistema...
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className={styles.pagination}>
          <span>
            Mostrando {subscriptions.length} de {totalCount} assinaturas
          </span>
          <div className={styles.paginationBtns}>
            <button
              type="button"
              className={styles.btnSecondary}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </button>
            <span style={{ padding: "0 8px" }}>
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              className={styles.btnSecondary}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Próxima
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Cards List */}
      <div className={styles.mobileCardsList}>
        {subscriptions.map((sub) => (
          <div key={sub.id} className={styles.mobileCard}>
            <div className={styles.mobileCardHeader}>
              <div>
                <div style={{ fontWeight: 700, color: "#ffffff", fontSize: 14 }}>
                  {sub.companyName}
                </div>
                <div style={{ fontSize: 12, color: "#a3a3a3" }}>
                  {sub.ownerName}
                </div>
              </div>
              {renderStatusBadge(sub)}
            </div>

            <div className={styles.mobileCardBody}>
              <div>
                <span style={{ color: "#737373" }}>Plano:</span>{" "}
                <strong style={{ color: "#ffffff", textTransform: "capitalize" }}>
                  {sub.plan}
                </strong>
              </div>
              <div>
                <span style={{ color: "#737373" }}>Valor:</span>{" "}
                <strong style={{ color: "#dcff4c" }}>
                  {sub.amount ? formatCurrency(Number(sub.amount)) : "R$ 0,00"}
                </strong>
              </div>
              <div>
                <span style={{ color: "#737373" }}>Periodicidade:</span>{" "}
                {sub.billingInterval === "yearly" ? "Anual" : "Mensal"}
              </div>
              <div>
                <span style={{ color: "#737373" }}>Origem:</span>{" "}
                {sub.origin === "manual_courtesy" ? "Cortesia" : "Checkout"}
              </div>
            </div>

            {sub.status !== "cancelled" && sub.status !== "suspended" && (
              <div className={styles.mobileCardActions}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => {
                    setSelectedSub(sub);
                    setRevokeModalOpen(true);
                  }}
                >
                  <Ban size={14} style={{ color: "#f87171" }} />
                  Revogar / Cancelar Assinatura
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Grant Subscription Modal */}
      {grantModalOpen && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalDialog}>
            <div className={styles.modalHeader}>
              <h2>Conceder Assinatura Manual</h2>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setGrantModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleGrantSubscription}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>ID da Empresa *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 28284d93-50b0-4332-8f38-38290cc5134a"
                    value={grantForm.companyId}
                    onChange={(e) =>
                      setGrantForm({ ...grantForm, companyId: e.target.value })
                    }
                    className={styles.input}
                  />
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Plano *</label>
                    <select
                      value={grantForm.planSlug}
                      onChange={(e) =>
                        setGrantForm({ ...grantForm, planSlug: e.target.value })
                      }
                      className={styles.select}
                    >
                      <option value="essencial">Essencial (até 2 prof.)</option>
                      <option value="profissional">Profissional (até 5 prof.)</option>
                      <option value="equipe">Equipe (até 10 prof.)</option>
                      <option value="negocio">Negócio (até 20 prof.)</option>
                      <option value="empresa">Empresa (até 50 prof.)</option>
                      <option value="enterprise">Enterprise (até 100 prof.)</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Tipo de Concessão *</label>
                    <select
                      value={grantForm.originType}
                      onChange={(e) =>
                        setGrantForm({
                          ...grantForm,
                          originType: e.target.value as any,
                        })
                      }
                      className={styles.select}
                    >
                      <option value="manual_courtesy">Cortesia Administrativa</option>
                      <option value="manual_paid">Faturamento Direto</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Duração do Período (dias) *</label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={grantForm.periodDays}
                    onChange={(e) =>
                      setGrantForm({
                        ...grantForm,
                        periodDays: Number(e.target.value),
                      })
                    }
                    className={styles.input}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Justificativa para Auditoria *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Ex: Parceria comercial aprovada pela diretoria ou suporte emergencial."
                    value={grantForm.reason}
                    onChange={(e) =>
                      setGrantForm({ ...grantForm, reason: e.target.value })
                    }
                    className={styles.textarea}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setGrantModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className={styles.btnPrimary}>
                  Confirmar e Conceder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revoke Subscription Modal */}
      {revokeModalOpen && selectedSub && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalDialog}>
            <div className={styles.modalHeader}>
              <h2 style={{ color: "#f87171", display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={18} />
                Revogar Assinatura: {selectedSub.companyName}
              </h2>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setRevokeModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRevokeSubscription}>
              <div className={styles.modalBody}>
                <p style={{ margin: 0, fontSize: 13, color: "#a3a3a3", lineHeight: 1.5 }}>
                  Ao revogar a assinatura, o status será atualizado no MySQL e um registro de
                  auditoria será gerado. A empresa perderá acesso aos recursos do plano.
                </p>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Modo de Encerramento</label>
                  <select
                    value={revokeForm.immediately ? "immediate" : "cycle_end"}
                    onChange={(e) =>
                      setRevokeForm({
                        ...revokeForm,
                        immediately: e.target.value === "immediate",
                      })
                    }
                    className={styles.select}
                  >
                    <option value="immediate">Imediato (Cancelar Agora)</option>
                    <option value="cycle_end">Ao final do ciclo atual</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Motivo do Cancelamento *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Descreva o motivo desta ação administrativa..."
                    value={revokeForm.reason}
                    onChange={(e) =>
                      setRevokeForm({ ...revokeForm, reason: e.target.value })
                    }
                    className={styles.textarea}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setRevokeModalOpen(false)}
                >
                  Voltar
                </button>
                <button type="submit" className={styles.btnDanger}>
                  Confirmar Revogação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
