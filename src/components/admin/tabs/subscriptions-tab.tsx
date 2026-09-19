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
  Edit2,
  Sparkles,
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

  // Edit Subscription Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [subToEdit, setSubToEdit] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    plan: "profissional",
    status: "active",
    billingInterval: "monthly" as "monthly" | "yearly",
    amount: "0.00",
    origin: "manual_courtesy" as "manual_courtesy" | "manual_paid" | "checkout",
    paymentMethod: "pix",
    endDate: "",
    reason: "Ajuste administrativo de assinatura via Super Admin",
  });
  const [savingEdit, setSavingEdit] = useState(false);

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

  const handleOpenEdit = (sub: any) => {
    setSubToEdit(sub);
    const rawDate = sub.nextPaymentAt || sub.currentPeriodEnd || sub.trialEndsAt;
    let formattedDate = "";
    if (rawDate) {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        formattedDate = d.toISOString().split("T")[0];
      }
    }
    setEditForm({
      plan: sub.plan || "trial",
      status: sub.status || "active",
      billingInterval: (sub.billingInterval === "yearly" ? "yearly" : "monthly") as "monthly" | "yearly",
      amount: sub.amount !== null && sub.amount !== undefined ? String(Number(sub.amount).toFixed(2)) : "0.00",
      origin: (sub.origin || "manual_courtesy") as any,
      paymentMethod: sub.paymentMethod || "pix",
      endDate: formattedDate,
      reason: "Ajuste administrativo de assinatura via Super Admin",
    });
    setEditModalOpen(true);
  };

  const handleExtendDays = (days: number) => {
    const base = editForm.endDate ? new Date(editForm.endDate + "T12:00:00") : new Date();
    const newDate = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    setEditForm((prev) => ({
      ...prev,
      endDate: newDate.toISOString().split("T")[0],
    }));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subToEdit) return;
    if (!editForm.reason.trim()) {
      alert("Informe a justificativa para auditoria.");
      return;
    }

    setSavingEdit(true);
    try {
      const res = await fetch("/api/superadmin/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: subToEdit.id,
          plan: editForm.plan,
          status: editForm.status,
          billingInterval: editForm.billingInterval,
          amount: editForm.amount,
          origin: editForm.origin,
          paymentMethod: editForm.paymentMethod,
          nextPaymentAt: editForm.endDate ? new Date(editForm.endDate + "T23:59:59") : null,
          currentPeriodEnd: editForm.endDate ? new Date(editForm.endDate + "T23:59:59") : null,
          trialEndsAt: editForm.endDate ? new Date(editForm.endDate + "T23:59:59") : undefined,
          reason: editForm.reason,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Erro ao atualizar assinatura.");
        return;
      }

      alert("Assinatura atualizada com sucesso!");
      setEditModalOpen(false);
      setSubToEdit(null);
      void loadSubscriptions();
    } catch (err: any) {
      alert("Erro ao atualizar assinatura: " + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const renderStatusBadge = (sub: any) => {
    const isLifetime = sub.billingInterval === "lifetime" || sub.plan === "vitalicia";
    const isYearly = sub.billingInterval === "yearly" || sub.plan === "anual" || sub.plan === "pro_yearly";
    const isTrial = sub.status === "trialing";
    const isExpiredTrial =
      isTrial && sub.trialEndsAt && new Date(sub.trialEndsAt) < new Date();

    if (isLifetime) {
      return (
        <span
          className={styles.statusPill}
          style={{
            background: "rgba(220, 255, 76, 0.15)",
            color: "#dcff4c",
            border: "1px solid rgba(220, 255, 76, 0.4)",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontWeight: 700,
          }}
        >
          <Sparkles size={11} /> Vitalícia
        </span>
      );
    }

    if (isExpiredTrial || sub.status === "expired" || sub.status === "past_due") {
      return (
        <span className={`${styles.statusPill} ${styles.statusCancelled}`}>
          Vencida
        </span>
      );
    }
    if (isTrial) {
      return (
        <span className={`${styles.statusPill} ${styles.statusTrial}`}>
          Teste (15 dias)
        </span>
      );
    }
    if (sub.status === "active") {
      return (
        <span className={`${styles.statusPill} ${styles.statusActive}`}>
          <CheckCircle2 size={11} /> {isYearly ? "Ativa (Anual)" : "Ativa"}
        </span>
      );
    }
    if (sub.status === "pending") {
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
            <option value="all">Todas as Assinaturas</option>
            <option value="active">Ativas</option>
            <option value="pending">Pendentes</option>
            <option value="vencida">Vencidas / Expiradas</option>
            <option value="vitalicia">Vitalícias</option>
            <option value="anual">Anuais</option>
            <option value="trialing">Em Teste (15 dias)</option>
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
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      style={{ padding: "6px 10px", fontSize: 11 }}
                      title="Editar Assinatura"
                      onClick={() => handleOpenEdit(sub)}
                    >
                      <Edit2 size={13} style={{ color: "#dcff4c" }} />
                      Editar
                    </button>

                    {sub.status !== "cancelled" && sub.status !== "suspended" && (
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        style={{ padding: "6px 10px", fontSize: 11 }}
                        title="Revogar Assinatura"
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

            <div className={styles.mobileCardActions} style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className={styles.btnSecondary}
                style={{ flex: 1, justifyContent: "center", fontSize: 12 }}
                onClick={() => handleOpenEdit(sub)}
              >
                <Edit2 size={14} style={{ color: "#dcff4c" }} />
                Editar Assinatura
              </button>
              {sub.status !== "cancelled" && sub.status !== "suspended" && (
                <button
                  type="button"
                  className={styles.btnGhost}
                  style={{ color: "#f87171", fontSize: 12 }}
                  onClick={() => {
                    setSelectedSub(sub);
                    setRevokeModalOpen(true);
                  }}
                >
                  <Ban size={14} /> Revogar
                </button>
              )}
            </div>
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

      {/* Edit Subscription Modal */}
      {editModalOpen && subToEdit && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalDialog} style={{ maxWidth: 580 }}>
            <div className={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Edit2 size={20} color="#dcff4c" />
                <div>
                  <h2 style={{ fontSize: 17, margin: 0 }}>Editar Assinatura</h2>
                  <div style={{ fontSize: 12, color: "#a3a3a3", marginTop: 2 }}>
                    {subToEdit.companyName} • {subToEdit.ownerName || subToEdit.ownerEmail || "Sem proprietário"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setEditModalOpen(false)}
                disabled={savingEdit}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className={styles.modalBody}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Plano Contratado *</label>
                    <select
                      className={styles.select}
                      value={editForm.plan}
                      onChange={(e) => {
                        const newPlan = e.target.value;
                        const isVit = newPlan === "vitalicia";
                        const isAnu = newPlan === "anual";
                        setEditForm({
                          ...editForm,
                          plan: newPlan,
                          billingInterval: isVit ? ("lifetime" as any) : isAnu ? "yearly" : editForm.billingInterval,
                          status: isVit ? "active" : editForm.status,
                        });
                        if (isVit) {
                          handleExtendDays(36500); // 100 years
                        } else if (isAnu) {
                          handleExtendDays(365);
                        }
                      }}
                      disabled={savingEdit}
                    >
                      <option value="vitalicia">Vitalícia (Acesso Vitalício)</option>
                      <option value="anual">Anual (Plano Anual)</option>
                      <option value="profissional">Profissional (Mais popular)</option>
                      <option value="essencial">Essencial</option>
                      <option value="equipe">Equipe</option>
                      <option value="negocio">Negócio</option>
                      <option value="empresa">Empresa / Enterprise</option>
                      <option value="trial">Trial (15 dias de Teste)</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Status da Assinatura *</label>
                    <select
                      className={styles.select}
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      disabled={savingEdit}
                    >
                      <option value="active">Ativa</option>
                      <option value="pending">Pendente (Aguardando Pagamento)</option>
                      <option value="past_due">Vencida / Atrasada (Past Due)</option>
                      <option value="expired">Vencida / Expirada</option>
                      <option value="trialing">Teste (15 dias de Teste)</option>
                      <option value="suspended">Suspensa Administrativamente</option>
                      <option value="cancelled">Cancelada</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Periodicidade *</label>
                    <select
                      className={styles.select}
                      value={editForm.billingInterval}
                      onChange={(e) => setEditForm({ ...editForm, billingInterval: e.target.value as any })}
                      disabled={savingEdit}
                    >
                      <option value="monthly">Mensal</option>
                      <option value="yearly">Anual</option>
                      <option value="lifetime">Vitalícia (Sem Renovação)</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Origem da Assinatura *</label>
                    <select
                      className={styles.select}
                      value={editForm.origin}
                      onChange={(e) => setEditForm({ ...editForm, origin: e.target.value as any })}
                      disabled={savingEdit}
                    >
                      <option value="manual_courtesy">Cortesia Admin (Gratuito)</option>
                      <option value="manual_paid">Cobrança Manual (PIX/Boleto)</option>
                      <option value="checkout">Checkout Online (Mercado Pago)</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Valor Contratado (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className={styles.input}
                      value={editForm.amount}
                      onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                      disabled={savingEdit}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Método de Pagamento</label>
                    <select
                      className={styles.select}
                      value={editForm.paymentMethod}
                      onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value })}
                      disabled={savingEdit}
                    >
                      <option value="pix">PIX</option>
                      <option value="card">Cartão de Crédito</option>
                      <option value="manual">Manual</option>
                    </select>
                  </div>
                </div>

                {/* Vencimento / Próxima Cobrança */}
                <div className={styles.formGroup} style={{ marginTop: 6 }}>
                  <label className={styles.label} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Data de Vencimento / Próxima Cobrança</span>
                    <span style={{ color: "#a3a3a3", fontSize: 11 }}>Estender vigência rapidamente:</span>
                  </label>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                    <input
                      type="date"
                      className={styles.input}
                      style={{ flex: 1 }}
                      value={editForm.endDate}
                      onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                      disabled={savingEdit}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      style={{ fontSize: 11, padding: "4px 8px" }}
                      onClick={() => handleExtendDays(7)}
                      disabled={savingEdit}
                    >
                      +7 dias
                    </button>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      style={{ fontSize: 11, padding: "4px 8px" }}
                      onClick={() => handleExtendDays(15)}
                      disabled={savingEdit}
                    >
                      +15 dias
                    </button>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      style={{ fontSize: 11, padding: "4px 8px" }}
                      onClick={() => handleExtendDays(30)}
                      disabled={savingEdit}
                    >
                      +30 dias
                    </button>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      style={{ fontSize: 11, padding: "4px 8px" }}
                      onClick={() => handleExtendDays(90)}
                      disabled={savingEdit}
                    >
                      +90 dias
                    </button>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      style={{ fontSize: 11, padding: "4px 8px" }}
                      onClick={() => handleExtendDays(365)}
                      disabled={savingEdit}
                    >
                      +1 ano
                    </button>
                  </div>
                </div>

                <div className={styles.formGroup} style={{ marginTop: 12 }}>
                  <label className={styles.label}>Motivo / Justificativa para Auditoria *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Upgrade negociado, prorrogação de prazo, etc."
                    className={styles.input}
                    value={editForm.reason}
                    onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                    disabled={savingEdit}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setEditModalOpen(false)}
                  disabled={savingEdit}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={savingEdit}
                >
                  {savingEdit ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
