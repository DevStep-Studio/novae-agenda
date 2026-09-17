"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Building2,
  Search,
  Plus,
  Eye,
  LogIn,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  X,
  CreditCard,
  Users,
  Calendar,
  Clock,
  Ticket,
  ShieldAlert,
} from "lucide-react";
import { formatCurrency } from "@/lib/client-utils";
import styles from "../admin-dashboard.module.css";

export function OwnersTab() {
  const [owners, setOwners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const [ownerDetails, setOwnerDetails] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Sub-modals for 360 view
  const [grantSubModalOpen, setGrantSubModalOpen] = useState(false);
  const [revokeSubModalOpen, setRevokeSubModalOpen] = useState(false);
  const [deleteOwnerModalOpen, setDeleteOwnerModalOpen] = useState(false);
  const [ownerToDelete, setOwnerToDelete] = useState<any | null>(null);
  const [deleteMode, setDeleteMode] = useState<"soft" | "hard">("soft");
  const [confirmationName, setConfirmationName] = useState("");

  // New Owner Form
  const [newOwnerForm, setNewOwnerForm] = useState({
    name: "",
    legalName: "",
    cnpjOrCpf: "",
    phone: "",
    ownerName: "",
    email: "",
    password: "",
    planSlug: "essencial",
    grantCourtesy: false,
    reason: "Conta criada manualmente pelo Superadmin",
  });

  // Grant Subscription Form
  const [grantForm, setGrantForm] = useState({
    plan: "profissional",
    isCourtesy: true,
    billingInterval: "monthly",
    durationDays: 30,
    reason: "",
  });

  // Revoke Subscription Form
  const [revokeForm, setRevokeForm] = useState({
    immediate: true,
    reason: "",
  });

  // Load Owners list
  const loadOwners = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
      });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/superadmin/owners?${params.toString()}`);
      const json = await res.json();
      if (json.data) {
        setOwners(json.data);
        setTotalPages(json.pagination.totalPages || 1);
        setTotalCount(json.pagination.total || 0);
      }
    } catch (err) {
      console.error("Error loading owners:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadOwners();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadOwners]);

  // Open 360 Details
  const handleOpenDetails = async (id: string) => {
    setSelectedOwnerId(id);
    setDetailsModalOpen(true);
    setDetailsLoading(true);
    try {
      const res = await fetch(`/api/superadmin/owners/${id}`);
      const json = await res.json();
      if (json.data) {
        setOwnerDetails(json.data);
      }
    } catch (err) {
      console.error("Error loading owner details:", err);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Impersonate
  const handleImpersonate = async (id: string, name: string) => {
    if (!confirm(`Deseja fazer login e acessar o painel como "${name}"? Todas as ações serão auditadas.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/superadmin/owners/${id}/impersonate`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.data) {
        alert(`Sessão assumida com sucesso! Você será redirecionado para o painel de ${name}.`);
        window.location.href = json.data.redirectUrl || "/gestao";
      } else {
        alert(json.error || "Erro ao assumir sessão.");
      }
    } catch (err: any) {
      alert("Erro ao assumir sessão: " + err.message);
    }
  };

  // Create Owner
  const handleCreateOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/superadmin/owners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newOwnerForm),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Erro ao criar proprietário.");
        return;
      }
      alert("Proprietário criado com sucesso!");
      setCreateModalOpen(false);
      setNewOwnerForm({
        name: "",
        legalName: "",
        cnpjOrCpf: "",
        phone: "",
        ownerName: "",
        email: "",
        password: "",
        planSlug: "essencial",
        grantCourtesy: false,
        reason: "Conta criada manualmente pelo Superadmin",
      });
      void loadOwners();
    } catch (err: any) {
      alert("Erro ao criar proprietário: " + err.message);
    }
  };

  // Grant Subscription
  const handleGrantSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOwnerId) return;
    try {
      const res = await fetch("/api/superadmin/subscriptions/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: selectedOwnerId,
          planSlug: grantForm.plan,
          originType: grantForm.isCourtesy ? "manual_courtesy" : "manual_paid",
          periodDays: grantForm.durationDays,
          reason: grantForm.reason,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Erro ao conceder assinatura.");
        return;
      }
      alert("Assinatura concedida com sucesso!");
      setGrantSubModalOpen(false);
      void handleOpenDetails(selectedOwnerId);
      void loadOwners();
    } catch (err: any) {
      alert("Erro: " + err.message);
    }
  };

  // Revoke Subscription
  const handleRevokeSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOwnerId) return;
    try {
      const res = await fetch("/api/superadmin/subscriptions/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: selectedOwnerId,
          immediately: revokeForm.immediate,
          reason: revokeForm.reason,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Erro ao revogar assinatura.");
        return;
      }
      alert("Assinatura revogada com sucesso!");
      setRevokeSubModalOpen(false);
      void handleOpenDetails(selectedOwnerId);
      void loadOwners();
    } catch (err: any) {
      alert("Erro: " + err.message);
    }
  };

  // Delete Employee
  const handleDeleteEmployee = async (employeeId: string, employeeName: string) => {
    const cancelFuture = confirm(`Deseja cancelar os agendamentos futuros vinculados a ${employeeName}? Clique em OK para CANCELAR ou Cancelar para MANTER.`);
    try {
      const res = await fetch(`/api/superadmin/employees/${employeeId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cancelFutureAppointments: cancelFuture,
          reason: `Excluído pelo superadmin. Agendamentos futuros cancelados: ${cancelFuture}`,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Erro ao excluir funcionário.");
        return;
      }
      alert("Funcionário excluído com sucesso.");
      if (selectedOwnerId) void handleOpenDetails(selectedOwnerId);
    } catch (err: any) {
      alert("Erro ao excluir: " + err.message);
    }
  };

  // Confirm Delete Owner
  const handleExecuteDeleteOwner = async () => {
    if (!ownerToDelete) return;
    if (deleteMode === "hard" && confirmationName.trim() !== ownerToDelete.name.trim()) {
      alert(`Para exclusão definitiva, digite exatamente o nome "${ownerToDelete.name}".`);
      return;
    }

    try {
      const params = deleteMode === "hard" ? `?hard=true&confirmationName=${encodeURIComponent(confirmationName)}` : "";
      const res = await fetch(`/api/superadmin/owners/${ownerToDelete.id}${params}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Erro ao excluir proprietário.");
        return;
      }
      alert(`Proprietário ${deleteMode === "hard" ? "excluído permanentemente" : "desativado (soft delete)"} com sucesso!`);
      setDeleteOwnerModalOpen(false);
      setOwnerToDelete(null);
      setConfirmationName("");
      if (detailsModalOpen) setDetailsModalOpen(false);
      void loadOwners();
    } catch (err: any) {
      alert("Erro ao excluir: " + err.message);
    }
  };

  return (
    <div>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nome, e-mail, telefone, CPF/CNPJ..."
            className={styles.searchInput}
            style={{ width: 320 }}
          />

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className={styles.filterSelect}
          >
            <option value="all">Todos os Status</option>
            <option value="active">Assinatura Ativa</option>
            <option value="trialing">Em Período de Teste</option>
            <option value="cancelled">Cancelada / Inativa</option>
            <option value="deleted">Soft Deleted (Excluídos)</option>
          </select>
        </div>

        <div className={styles.toolbarRight}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus size={15} />
            Criar Proprietário Manualmente
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>Empresa / Proprietário</th>
              <th>Contato & E-mail</th>
              <th>Documento</th>
              <th>Assinatura / Origem</th>
              <th>Status</th>
              <th>Cadastrado em</th>
              <th style={{ textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {owners.map((owner) => (
              <tr key={owner.id}>
                <td>
                  <div style={{ fontWeight: 600, color: "#f3f4f6" }}>{owner.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {owner.primaryOwner?.name || "Sem proprietário vinculado"}
                  </div>
                </td>
                <td>
                  <div>{owner.email || owner.primaryOwner?.email || "—"}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {owner.phone || "—"}
                  </div>
                </td>
                <td>
                  <span style={{ fontFamily: "monospace", fontSize: 12 }}>
                    {owner.cnpjOrCpf || "—"}
                  </span>
                </td>
                <td>
                  <div style={{ fontWeight: 600, textTransform: "capitalize" }}>
                    {owner.subscription?.plan || "Trial"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    {owner.subscription?.origin === "manual_courtesy"
                      ? "Cortesia Manual"
                      : owner.subscription?.origin === "manual_paid"
                      ? "Cobrança Manual"
                      : "Checkout Padrão"}
                  </div>
                </td>
                <td>
                  {owner.deletedAt ? (
                    <span className={`${styles.statusPill} ${styles.statusDeleted}`}>
                      Excluído (Soft)
                    </span>
                  ) : owner.subscription?.status === "active" ? (
                    <span className={`${styles.statusPill} ${styles.statusActive}`}>
                      <CheckCircle2 size={11} /> Ativa
                    </span>
                  ) : owner.subscription?.status === "trialing" ? (
                    <span className={`${styles.statusPill} ${styles.statusTrial}`}>
                      Trial
                    </span>
                  ) : (
                    <span className={`${styles.statusPill} ${styles.statusCancelled}`}>
                      {owner.subscription?.status?.toUpperCase() || "INATIVO"}
                    </span>
                  )}
                </td>
                <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {new Date(owner.createdAt).toLocaleDateString("pt-BR")}
                </td>
                <td style={{ textAlign: "right" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <button
                      type="button"
                      className={styles.btnGhost}
                      title="Ver Detalhes 360°"
                      onClick={() => handleOpenDetails(owner.id)}
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      type="button"
                      className={styles.btnGhost}
                      style={{ color: "#818cf8" }}
                      title="Login como Proprietário"
                      onClick={() => handleImpersonate(owner.id, owner.name)}
                    >
                      <LogIn size={15} />
                    </button>
                    <button
                      type="button"
                      className={styles.btnGhost}
                      style={{ color: "#f87171" }}
                      title="Excluir Proprietário"
                      onClick={() => {
                        setOwnerToDelete(owner);
                        setDeleteMode("soft");
                        setConfirmationName("");
                        setDeleteOwnerModalOpen(true);
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && owners.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 36, color: "var(--text-secondary)" }}>
                  Nenhum proprietário encontrado para os filtros selecionados.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 36, color: "var(--text-secondary)" }}>
                  Carregando lista de proprietários...
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className={styles.pagination}>
          <span>
            Mostrando {owners.length} de {totalCount} proprietários
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
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Criar Proprietário Manualmente */}
      {createModalOpen && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalDialog}>
            <div className={styles.modalHeader}>
              <h2>Criar Proprietário Manualmente</h2>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setCreateModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateOwner}>
              <div className={styles.modalBody}>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Nome do Negócio *</label>
                    <input
                      type="text"
                      required
                      className={styles.input}
                      value={newOwnerForm.name}
                      onChange={(e) => setNewOwnerForm({ ...newOwnerForm, name: e.target.value })}
                      placeholder="Ex: Studio Alpha Barber"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>CPF ou CNPJ</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={newOwnerForm.cnpjOrCpf}
                      onChange={(e) => setNewOwnerForm({ ...newOwnerForm, cnpjOrCpf: e.target.value })}
                      placeholder="000.000.000-00"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Nome do Proprietário *</label>
                    <input
                      type="text"
                      required
                      className={styles.input}
                      value={newOwnerForm.ownerName}
                      onChange={(e) => setNewOwnerForm({ ...newOwnerForm, ownerName: e.target.value })}
                      placeholder="Ex: Roberto Silva"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>E-mail de Login *</label>
                    <input
                      type="email"
                      required
                      className={styles.input}
                      value={newOwnerForm.email}
                      onChange={(e) => setNewOwnerForm({ ...newOwnerForm, email: e.target.value })}
                      placeholder="roberto@email.com"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Telefone / WhatsApp</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={newOwnerForm.phone}
                      onChange={(e) => setNewOwnerForm({ ...newOwnerForm, phone: e.target.value })}
                      placeholder="(11) 99999-9999"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Senha Inicial *</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      className={styles.input}
                      value={newOwnerForm.password}
                      onChange={(e) => setNewOwnerForm({ ...newOwnerForm, password: e.target.value })}
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Plano Inicial</label>
                    <select
                      className={styles.select}
                      value={newOwnerForm.planSlug}
                      onChange={(e) => setNewOwnerForm({ ...newOwnerForm, planSlug: e.target.value })}
                    >
                      <option value="essencial">Essencial</option>
                      <option value="profissional">Profissional</option>
                      <option value="equipe">Equipe</option>
                      <option value="negocio">Negócio</option>
                    </select>
                  </div>

                  <div className={styles.formGroup} style={{ justifyContent: "center" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, marginTop: 18 }}>
                      <input
                        type="checkbox"
                        checked={newOwnerForm.grantCourtesy}
                        onChange={(e) => setNewOwnerForm({ ...newOwnerForm, grantCourtesy: e.target.checked })}
                      />
                      <span>Conceder como Cortesia (Sem cobrança)</span>
                    </label>
                  </div>

                  <div className={styles.formGroupFull}>
                    <label className={styles.label}>Motivo da Criação Manual (Auditoria) *</label>
                    <input
                      type="text"
                      required
                      className={styles.input}
                      value={newOwnerForm.reason}
                      onChange={(e) => setNewOwnerForm({ ...newOwnerForm, reason: e.target.value })}
                      placeholder="Ex: Parceria de marketing com influenciador"
                    />
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setCreateModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className={styles.btnPrimary}>
                  Salvar e Criar Conta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Detalhes 360° do Proprietário */}
      {detailsModalOpen && (
        <div className={styles.modalBackdrop}>
          <div className={`${styles.modalDialog} ${styles.modalLarge}`}>
            <div className={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Building2 size={20} color="#818cf8" />
                <h2>Visão 360°: {ownerDetails?.company?.name || "Carregando..."}</h2>
              </div>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setDetailsModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              {detailsLoading ? (
                <p style={{ textAlign: "center", color: "var(--text-secondary)", padding: 40 }}>
                  Carregando informações completas do proprietário...
                </p>
              ) : ownerDetails ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {/* Section 1: Assinatura */}
                  <div className={styles.detailSection}>
                    <div className={styles.detailSectionTitle}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <CreditCard size={16} color="#10b981" />
                        Assinatura & Faturamento
                      </span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          className={styles.btnPrimary}
                          style={{ padding: "6px 12px", fontSize: 12 }}
                          onClick={() => setGrantSubModalOpen(true)}
                        >
                          Conceder Assinatura
                        </button>
                        <button
                          type="button"
                          className={styles.btnDanger}
                          style={{ padding: "6px 12px", fontSize: 12 }}
                          onClick={() => setRevokeSubModalOpen(true)}
                        >
                          Revogar Assinatura
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, fontSize: 13 }}>
                      <div>
                        <span style={{ color: "var(--text-secondary)" }}>Plano Atual:</span>
                        <div style={{ fontWeight: 600, textTransform: "capitalize" }}>
                          {ownerDetails.subscription?.plan || "Sem plano"}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-secondary)" }}>Status:</span>
                        <div>
                          <span className={`${styles.statusPill} ${ownerDetails.subscription?.status === "active" ? styles.statusActive : styles.statusTrial}`}>
                            {ownerDetails.subscription?.status?.toUpperCase() || "TRIAL"}
                          </span>
                        </div>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-secondary)" }}>Origem:</span>
                        <div style={{ fontWeight: 600 }}>
                          {ownerDetails.subscription?.origin === "manual_courtesy"
                            ? "Cortesia Manual"
                            : ownerDetails.subscription?.origin === "manual_paid"
                            ? "Manual Pago"
                            : "Checkout Normal"}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-secondary)" }}>Próxima Cobrança:</span>
                        <div>
                          {ownerDetails.subscription?.nextPaymentAt
                            ? new Date(ownerDetails.subscription.nextPaymentAt).toLocaleDateString("pt-BR")
                            : ownerDetails.subscription?.currentPeriodEnd
                            ? new Date(ownerDetails.subscription.currentPeriodEnd).toLocaleDateString("pt-BR")
                            : "N/A"}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-secondary)" }}>Valor:</span>
                        <div style={{ fontWeight: 600 }}>
                          {formatCurrency(Number(ownerDetails.subscription?.finalPriceSnapshot || ownerDetails.subscription?.amount || 0))}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-secondary)" }}>Cupom de Origem:</span>
                        <div style={{ fontWeight: 600, color: "#818cf8" }}>
                          {ownerDetails.originCoupon?.code || "Nenhum"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Funcionários */}
                  <div className={styles.detailSection}>
                    <div className={styles.detailSectionTitle}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Users size={16} color="#6366f1" />
                        Equipe de Colaboradores ({ownerDetails.employees?.length ?? 0})
                      </span>
                    </div>

                    <table className={styles.dataTable}>
                      <thead>
                        <tr>
                          <th>Nome</th>
                          <th>E-mail</th>
                          <th>Cargo</th>
                          <th>Status</th>
                          <th style={{ textAlign: "right" }}>Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(ownerDetails.employees || []).map((emp: any) => (
                          <tr key={emp.id}>
                            <td style={{ fontWeight: 600 }}>{emp.name}</td>
                            <td>{emp.email || "—"}</td>
                            <td>{emp.role || "Profissional"}</td>
                            <td>
                              <span className={`${styles.statusPill} ${emp.active ? styles.statusActive : styles.statusCancelled}`}>
                                {emp.active ? "Ativo" : "Inativo"}
                              </span>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <button
                                type="button"
                                className={styles.btnGhost}
                                style={{ color: "#f87171" }}
                                title="Excluir Colaborador"
                                onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {(!ownerDetails.employees || ownerDetails.employees.length === 0) && (
                          <tr>
                            <td colSpan={5} style={{ textAlign: "center", color: "var(--text-secondary)", padding: 14 }}>
                              Nenhum funcionário cadastrado.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Section 3: Clientes */}
                  <div className={styles.detailSection}>
                    <div className={styles.detailSectionTitle}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Users size={16} color="#fbbf24" />
                        Clientes Cadastrados ({ownerDetails.clients?.length ?? 0})
                      </span>
                    </div>

                    <table className={styles.dataTable}>
                      <thead>
                        <tr>
                          <th>Nome</th>
                          <th>E-mail</th>
                          <th>Telefone</th>
                          <th>Cadastrado em</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(ownerDetails.clients || []).slice(0, 5).map((cli: any) => (
                          <tr key={cli.id}>
                            <td style={{ fontWeight: 600 }}>{cli.name}</td>
                            <td>{cli.email || "—"}</td>
                            <td>{cli.phone || "—"}</td>
                            <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                              {new Date(cli.createdAt).toLocaleDateString("pt-BR")}
                            </td>
                          </tr>
                        ))}
                        {(!ownerDetails.clients || ownerDetails.clients.length === 0) && (
                          <tr>
                            <td colSpan={4} style={{ textAlign: "center", color: "var(--text-secondary)", padding: 14 }}>
                              Nenhum cliente cadastrado.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Section 4: Auditoria Recente */}
                  <div className={styles.detailSection}>
                    <div className={styles.detailSectionTitle}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Clock size={16} color="#f87171" />
                        Histórico Administrativo Desta Conta
                      </span>
                    </div>

                    <table className={styles.dataTable}>
                      <thead>
                        <tr>
                          <th>Data / Hora</th>
                          <th>Admin</th>
                          <th>Ação</th>
                          <th>Motivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(ownerDetails.auditLogs || []).map((log: any) => (
                          <tr key={log.id}>
                            <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                              {new Date(log.createdAt).toLocaleString("pt-BR")}
                            </td>
                            <td>{log.adminEmail}</td>
                            <td>
                              <span className={`${styles.statusPill} ${styles.statusTrial}`}>
                                {log.action}
                              </span>
                            </td>
                            <td style={{ fontSize: 12 }}>{log.reason || "—"}</td>
                          </tr>
                        ))}
                        {(!ownerDetails.auditLogs || ownerDetails.auditLogs.length === 0) && (
                          <tr>
                            <td colSpan={4} style={{ textAlign: "center", color: "var(--text-secondary)", padding: 14 }}>
                              Nenhum registro de auditoria para esta empresa.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setDetailsModalOpen(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Conceder Assinatura Manual */}
      {grantSubModalOpen && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalDialog}>
            <div className={styles.modalHeader}>
              <h2>Conceder Assinatura Manualmente</h2>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setGrantSubModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleGrantSubscription}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Plano *</label>
                  <select
                    className={styles.select}
                    value={grantForm.plan}
                    onChange={(e) => setGrantForm({ ...grantForm, plan: e.target.value })}
                  >
                    <option value="essencial">Essencial</option>
                    <option value="profissional">Profissional</option>
                    <option value="equipe">Equipe</option>
                    <option value="negocio">Negócio</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Tipo de Concessão</label>
                  <select
                    className={styles.select}
                    value={grantForm.isCourtesy ? "courtesy" : "paid"}
                    onChange={(e) => setGrantForm({ ...grantForm, isCourtesy: e.target.value === "courtesy" })}
                  >
                    <option value="courtesy">Cortesia (100% Gratuito)</option>
                    <option value="paid">Cobrança Futura via Fatura</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Periodicidade</label>
                  <select
                    className={styles.select}
                    value={grantForm.billingInterval}
                    onChange={(e) => setGrantForm({ ...grantForm, billingInterval: e.target.value })}
                  >
                    <option value="monthly">Mensal</option>
                    <option value="yearly">Anual</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Validade (Dias a partir de hoje)</label>
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    className={styles.input}
                    value={grantForm.durationDays}
                    onChange={(e) => setGrantForm({ ...grantForm, durationDays: parseInt(e.target.value, 10) || 30 })}
                  />
                </div>

                <div className={styles.formGroupFull}>
                  <label className={styles.label}>Motivo Obrigatório da Concessão (Auditoria) *</label>
                  <textarea
                    required
                    className={styles.textarea}
                    value={grantForm.reason}
                    onChange={(e) => setGrantForm({ ...grantForm, reason: e.target.value })}
                    placeholder="Descreva detalhadamente o motivo da concessão (ex: cortesia acordada com parceiro comercial, resolução de chamado #1234)"
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setGrantSubModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className={styles.btnPrimary}>
                  Confirmar Concessão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Revogar Assinatura */}
      {revokeSubModalOpen && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalDialog}>
            <div className={styles.modalHeader}>
              <h2 style={{ color: "#f87171" }}>Revogar Assinatura</h2>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setRevokeSubModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRevokeSubscription}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Momento do Cancelamento</label>
                  <select
                    className={styles.select}
                    value={revokeForm.immediate ? "immediate" : "period_end"}
                    onChange={(e) => setRevokeForm({ ...revokeForm, immediate: e.target.value === "immediate" })}
                  >
                    <option value="immediate">Cancelar Imediatamente (Bloqueio agora)</option>
                    <option value="period_end">Agendar para o Fim do Ciclo Atual</option>
                  </select>
                </div>

                <div className={styles.formGroupFull}>
                  <label className={styles.label}>Motivo Obrigatório da Revogação (Auditoria) *</label>
                  <textarea
                    required
                    className={styles.textarea}
                    value={revokeForm.reason}
                    onChange={(e) => setRevokeForm({ ...revokeForm, reason: e.target.value })}
                    placeholder="Descreva detalhadamente o motivo da revogação..."
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setRevokeSubModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className={styles.btnDanger}>
                  Confirmar Revogação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Exclusão de Proprietário (Soft Delete vs Hard Delete LGPD) */}
      {deleteOwnerModalOpen && ownerToDelete && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalDialog}>
            <div className={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ShieldAlert size={20} color="#f87171" />
                <h2 style={{ color: "#f87171" }}>Excluir Proprietário: {ownerToDelete.name}</h2>
              </div>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setDeleteOwnerModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <button
                  type="button"
                  className={deleteMode === "soft" ? styles.btnPrimary : styles.btnSecondary}
                  style={{ flex: 1 }}
                  onClick={() => setDeleteMode("soft")}
                >
                  Soft Delete (Recomendado)
                </button>
                <button
                  type="button"
                  className={deleteMode === "hard" ? styles.btnDanger : styles.btnSecondary}
                  style={{ flex: 1 }}
                  onClick={() => setDeleteMode("hard")}
                >
                  Exclusão Definitiva (LGPD)
                </button>
              </div>

              {deleteMode === "soft" ? (
                <div style={{ background: "rgba(99, 102, 241, 0.08)", padding: 16, borderRadius: 8, fontSize: 13 }}>
                  <p style={{ fontWeight: 600, color: "#818cf8", marginBottom: 6 }}>
                    O que acontece no Soft Delete:
                  </p>
                  <ul style={{ paddingLeft: 18, margin: 0, color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 4 }}>
                    <li>Bloqueia o login imediatamente para o proprietário e equipe.</li>
                    <li>Interrompe cobranças recorrentes no gateway.</li>
                    <li>Preserva o histórico fiscal, relatórios e auditoria no banco.</li>
                  </ul>
                </div>
              ) : (
                <div style={{ background: "rgba(239, 68, 68, 0.08)", padding: 16, borderRadius: 8, fontSize: 13 }}>
                  <p style={{ fontWeight: 700, color: "#f87171", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <AlertTriangle size={16} /> Ação Irreversível de Exclusão Física (LGPD)
                  </p>
                  <p style={{ color: "var(--text-secondary)", marginBottom: 12 }}>
                    Todos os dados da empresa, colaboradores, serviços e agendamentos serão excluídos definitivamente do MySQL.
                  </p>
                  <label className={styles.label} style={{ color: "#f87171" }}>
                    Para confirmar, digite exatamente o nome da empresa abaixo:
                  </label>
                  <input
                    type="text"
                    className={styles.input}
                    style={{ borderColor: "#f87171", marginTop: 6 }}
                    placeholder={ownerToDelete.name}
                    value={confirmationName}
                    onChange={(e) => setConfirmationName(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setDeleteOwnerModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={deleteMode === "hard" ? styles.btnDanger : styles.btnPrimary}
                onClick={handleExecuteDeleteOwner}
                disabled={deleteMode === "hard" && confirmationName.trim() !== ownerToDelete.name.trim()}
              >
                {deleteMode === "hard" ? "Excluir Definitivamente" : "Desativar Proprietário"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
