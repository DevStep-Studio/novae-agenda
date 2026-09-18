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
  Ban,
  RotateCcw,
  Sparkles,
  Briefcase,
  Copy,
  Check,
} from "lucide-react";
import { formatCurrency } from "@/lib/client-utils";
import styles from "../admin-dashboard.module.css";

export interface OwnersTabProps {
  onSwitchToUsers?: () => void;
}

export function OwnersTab({ onSwitchToUsers }: OwnersTabProps = {}) {
  const [owners, setOwners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<any | null>(null);
  const [copiedPass, setCopiedPass] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [ownerToEdit, setOwnerToEdit] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    businessType: "Geral",
    email: "",
    phone: "",
    cnpjOrCpf: "",
    ownerName: "",
    ownerPhone: "",
  });

  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [ownerToSuspend, setOwnerToSuspend] = useState<any | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const [ownerDetails, setOwnerDetails] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [deleteOwnerModalOpen, setDeleteOwnerModalOpen] = useState(false);
  const [ownerToDelete, setOwnerToDelete] = useState<any | null>(null);
  const [deleteMode, setDeleteMode] = useState<"soft" | "hard">("soft");
  const [deleteReason, setDeleteReason] = useState("Exclusão administrativa");
  const [confirmationName, setConfirmationName] = useState("");

  // New Owner Form
  const [newOwnerForm, setNewOwnerForm] = useState({
    name: "",
    businessType: "Geral",
    cnpjOrCpf: "",
    phone: "",
    ownerName: "",
    email: "",
    password: "",
    planSlug: "profissional",
    accessType: "trial" as "trial" | "courtesy" | "pending",
    reason: "",
  });

  // Load Owners list from real MySQL backend
  const loadOwners = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
      });
      if (search.trim()) {
        params.set("q", search.trim());
      }
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }

      const res = await fetch(`/api/superadmin/owners?${params.toString()}`);
      if (res.status === 401) {
        setFetchError("Sua sessão de Super Admin expirou ou não possui permissão. Por favor, recarregue a página.");
        return;
      }
      if (!res.ok) {
        throw new Error(`Falha na resposta do servidor (HTTP ${res.status}).`);
      }
      const json = await res.json();
      const list = json.data || json.items || [];
      setOwners(list);
      setTotalPages(json.pagination?.totalPages || 1);
      setTotalCount(json.pagination?.total || 0);
    } catch (err: any) {
      console.error("Erro ao carregar proprietários:", err);
      setFetchError(err.message || "Erro de conexão ao banco de dados.");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadOwners();
    }, 250);
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
      console.error("Erro ao carregar detalhes do proprietário:", err);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (owner: any) => {
    setOwnerToEdit(owner);
    setEditForm({
      name: owner.name || "",
      businessType: owner.businessType || "Geral",
      email: owner.email || owner.ownerEmail || "",
      phone: owner.phone || owner.ownerPhone || "",
      cnpjOrCpf: owner.cnpjOrCpf || "",
      ownerName: owner.ownerName || "",
      ownerPhone: owner.ownerPhone || "",
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerToEdit) return;

    try {
      const res = await fetch(`/api/superadmin/owners/${ownerToEdit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Erro ao salvar alterações.");
        return;
      }
      alert("Proprietário e empresa atualizados com sucesso!");
      setEditModalOpen(false);
      setOwnerToEdit(null);
      void loadOwners();
      if (detailsModalOpen && selectedOwnerId === ownerToEdit.id) {
        void handleOpenDetails(ownerToEdit.id);
      }
    } catch (err: any) {
      alert("Erro ao atualizar: " + err.message);
    }
  };

  // Suspend
  const handleConfirmSuspend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerToSuspend) return;
    if (!suspendReason.trim()) {
      alert("Informe o motivo da suspensão para auditoria.");
      return;
    }

    try {
      const res = await fetch(`/api/superadmin/owners/${ownerToSuspend.id}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: suspendReason }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Erro ao suspender empresa.");
        return;
      }
      alert(json.message || "Empresa suspensa com sucesso!");
      setSuspendModalOpen(false);
      setOwnerToSuspend(null);
      setSuspendReason("");
      void loadOwners();
      if (detailsModalOpen && selectedOwnerId === ownerToSuspend.id) {
        void handleOpenDetails(ownerToSuspend.id);
      }
    } catch (err: any) {
      alert("Erro ao suspender: " + err.message);
    }
  };

  // Reactivate
  const handleReactivate = async (owner: any) => {
    if (!confirm(`Deseja reativar o acesso da empresa "${owner.name}"?`)) return;

    try {
      const res = await fetch(`/api/superadmin/owners/${owner.id}/reactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Reativação solicitada via Super Admin" }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Erro ao reativar empresa.");
        return;
      }
      alert(json.message || "Empresa reativada com sucesso!");
      void loadOwners();
      if (detailsModalOpen && selectedOwnerId === owner.id) {
        void handleOpenDetails(owner.id);
      }
    } catch (err: any) {
      alert("Erro ao reativar: " + err.message);
    }
  };

  // Impersonate
  const handleImpersonate = async (id: string, name: string) => {
    if (
      !confirm(
        `Deseja assumir a sessão da empresa "${name}" em modo suporte? Esta ação é auditada e preserva sua identidade administrativa.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/superadmin/owners/${id}/impersonate`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        alert(`Sessão iniciada como proprietário de ${name}. Redirecionando para o painel...`);
        window.location.href = json.redirectUrl || "/gestao";
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
      setCreatedCredentials(json);
      setCreateModalOpen(false);
      setNewOwnerForm({
        name: "",
        businessType: "Geral",
        cnpjOrCpf: "",
        phone: "",
        ownerName: "",
        email: "",
        password: "",
        planSlug: "profissional",
        accessType: "trial",
        reason: "",
      });
      void loadOwners();
    } catch (err: any) {
      alert("Erro ao criar proprietário: " + err.message);
    }
  };

  // Delete Owner
  const handleExecuteDeleteOwner = async () => {
    if (!ownerToDelete) return;
    if (deleteMode === "hard" && confirmationName.trim() !== ownerToDelete.name.trim()) {
      alert(`Para exclusão definitiva, digite exatamente o nome "${ownerToDelete.name}".`);
      return;
    }

    try {
      const params = new URLSearchParams();
      if (deleteMode === "hard") {
        params.set("hard", "true");
        params.set("confirmedName", confirmationName);
      }
      params.set("reason", deleteReason);

      const res = await fetch(`/api/superadmin/owners/${ownerToDelete.id}?${params.toString()}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Erro ao excluir proprietário.");
        return;
      }
      alert(
        `Proprietário ${deleteMode === "hard" ? "excluído permanentemente" : "desativado (soft delete)"} com sucesso!`
      );
      setDeleteOwnerModalOpen(false);
      setOwnerToDelete(null);
      setConfirmationName("");
      if (detailsModalOpen) setDetailsModalOpen(false);
      void loadOwners();
    } catch (err: any) {
      alert("Erro ao excluir: " + err.message);
    }
  };

  const renderStatusBadge = (owner: any) => {
    const isDeleted = Boolean(owner.deletedAt);
    const subStatus = owner.subscriptionStatus || owner.subscription?.status;
    const isSuspended = subStatus === "suspended" || owner.publicEnabled === false;
    const isTrial = subStatus === "trialing";
    const isExpired =
      subStatus === "expired" ||
      (isTrial && owner.trialEndsAt && new Date(owner.trialEndsAt) < new Date());

    if (isDeleted) {
      return (
        <span className={`${styles.statusPill} ${styles.statusDeleted}`}>
          Excluído
        </span>
      );
    }
    if (isSuspended) {
      return (
        <span className={`${styles.statusPill} ${styles.statusCancelled}`}>
          Suspenso
        </span>
      );
    }
    if (isExpired) {
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
    if (subStatus === "active") {
      return (
        <span className={`${styles.statusPill} ${styles.statusActive}`}>
          <CheckCircle2 size={11} /> Ativa
        </span>
      );
    }
    if (subStatus === "pending" || subStatus === "past_due") {
      return (
        <span className={`${styles.statusPill} ${styles.statusTrial}`}>
          Pagamento Pendente
        </span>
      );
    }
    if (subStatus === "cancelled") {
      return (
        <span className={`${styles.statusPill} ${styles.statusCancelled}`}>
          Cancelada
        </span>
      );
    }
    return (
      <span className={`${styles.statusPill} ${styles.statusDeleted}`}>
        {subStatus || "Inativo"}
      </span>
    );
  };

  return (
    <div>
      {/* Quick link banner to Users & Levels */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          padding: "12px 18px",
          marginBottom: 16,
          background: "rgba(220, 255, 76, 0.05)",
          border: "1px solid rgba(220, 255, 76, 0.2)",
          borderRadius: 8,
          color: "#e5e5e5",
          fontSize: 13,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Users size={18} color="#dcff4c" />
          <span>
            Para visualizar e gerenciar <strong>todos os usuários do sistema</strong> (Super Admin, Colaboradores, Clientes e Proprietários) com seus níveis e senhas, acesse a aba <strong>Usuários & Níveis</strong>.
          </span>
        </div>
        {onSwitchToUsers && (
          <button
            type="button"
            className={styles.btnSecondary}
            style={{ borderColor: "#dcff4c", color: "#dcff4c", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6 }}
            onClick={onSwitchToUsers}
          >
            <Users size={14} />
            Ir para Usuários & Níveis
          </button>
        )}
      </div>

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
            placeholder="Buscar por empresa, proprietário, e-mail, telefone, documento..."
            className={styles.searchInput}
            style={{ width: 340 }}
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
            <option value="trial">Em Teste Gratuito</option>
            <option value="trial_expired">Trial Expirado</option>
            <option value="pending_payment">Pagamento Pendente</option>
            <option value="suspended">Acesso Suspenso</option>
            <option value="cancelled">Cancelados</option>
            <option value="deleted">Excluídos (Soft Delete)</option>
          </select>
        </div>

        <div className={styles.toolbarRight}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus size={15} />
            + Criar Proprietário Manualmente
          </button>
        </div>
      </div>

      {/* Error state */}
      {fetchError && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: 8,
            padding: "16px 20px",
            marginBottom: 16,
            color: "#fca5a5",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={18} color="#f87171" />
            <span>Falha ao comunicar com o MySQL: {fetchError}</span>
          </div>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => void loadOwners()}
          >
            <RotateCcw size={14} />
            Tentar novamente
          </button>
        </div>
      )}

      {/* Table Desktop */}
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
                  <div style={{ fontWeight: 700, color: "#ffffff" }}>{owner.name}</div>
                  <div style={{ fontSize: 12, color: "#a3a3a3" }}>
                    {owner.ownerName || owner.primaryOwner?.name || "Sem proprietário vinculado"}
                  </div>
                </td>
                <td>
                  <div>{owner.ownerEmail || owner.primaryOwner?.email || owner.email || "—"}</div>
                  <div style={{ fontSize: 12, color: "#a3a3a3" }}>
                    {owner.ownerPhone || owner.phone || "—"}
                  </div>
                </td>
                <td>
                  <span style={{ fontFamily: "monospace", fontSize: 12 }}>
                    {owner.cnpjOrCpf || "—"}
                  </span>
                </td>
                <td>
                  <div style={{ fontWeight: 600, textTransform: "capitalize" }}>
                    {owner.subscriptionPlan || owner.subscription?.plan || "Trial"}
                  </div>
                  <div style={{ fontSize: 11, color: "#a3a3a3" }}>
                    {owner.subscriptionOrigin === "manual_courtesy"
                      ? "Cortesia Admin"
                      : owner.subscriptionOrigin === "manual_paid"
                      ? "Cobrança Manual"
                      : "Checkout Padrão"}
                  </div>
                </td>
                <td>{renderStatusBadge(owner)}</td>
                <td style={{ fontSize: 12, color: "#a3a3a3" }}>
                  {new Date(owner.createdAt).toLocaleDateString("pt-BR")}
                </td>
                <td style={{ textAlign: "right" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
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
                      title="Editar Dados"
                      onClick={() => handleOpenEdit(owner)}
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      type="button"
                      className={styles.btnGhost}
                      style={{ color: "#dcff4c" }}
                      title="Acessar Painel da Empresa"
                      onClick={() => handleImpersonate(owner.id, owner.name)}
                    >
                      <LogIn size={15} />
                    </button>

                    {owner.publicEnabled === false || owner.subscriptionStatus === "suspended" ? (
                      <button
                        type="button"
                        className={styles.btnGhost}
                        style={{ color: "#10b981" }}
                        title="Reativar Empresa"
                        onClick={() => handleReactivate(owner)}
                      >
                        <RotateCcw size={15} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.btnGhost}
                        style={{ color: "#fbbf24" }}
                        title="Suspender Empresa"
                        onClick={() => {
                          setOwnerToSuspend(owner);
                          setSuspendReason("");
                          setSuspendModalOpen(true);
                        }}
                      >
                        <Ban size={15} />
                      </button>
                    )}

                    <button
                      type="button"
                      className={styles.btnGhost}
                      style={{ color: "#f87171" }}
                      title="Excluir / Desativar"
                      onClick={() => {
                        setOwnerToDelete(owner);
                        setDeleteMode("soft");
                        setConfirmationName("");
                        setDeleteReason("Exclusão solicitada via Super Admin");
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
                <td colSpan={7} style={{ textAlign: "center", padding: 36, color: "#a3a3a3" }}>
                  Nenhum proprietário encontrado para os filtros selecionados.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 36, color: "#a3a3a3" }}>
                  Carregando lista de proprietários do MySQL...
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
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Próxima
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Cards List */}
      <div className={styles.mobileCardsList}>
        {owners.map((owner) => (
          <div key={owner.id} className={styles.mobileCard}>
            <div className={styles.mobileCardHeader}>
              <div>
                <div style={{ fontWeight: 700, color: "#ffffff", fontSize: 14 }}>
                  {owner.name}
                </div>
                <div style={{ fontSize: 12, color: "#a3a3a3" }}>
                  {owner.ownerName || owner.primaryOwner?.name || "Sem proprietário"}
                </div>
              </div>
              {renderStatusBadge(owner)}
            </div>

            <div className={styles.mobileCardBody}>
              <div>
                <span style={{ color: "#737373" }}>E-mail:</span>{" "}
                {owner.ownerEmail || owner.email || "—"}
              </div>
              <div>
                <span style={{ color: "#737373" }}>Telefone:</span>{" "}
                {owner.ownerPhone || owner.phone || "—"}
              </div>
              <div>
                <span style={{ color: "#737373" }}>Plano:</span>{" "}
                <strong style={{ color: "#ffffff", textTransform: "capitalize" }}>
                  {owner.subscriptionPlan || "Trial"}
                </strong>
              </div>
              <div>
                <span style={{ color: "#737373" }}>Cadastro:</span>{" "}
                {new Date(owner.createdAt).toLocaleDateString("pt-BR")}
              </div>
            </div>

            <div className={styles.mobileCardActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => handleOpenDetails(owner.id)}
              >
                <Eye size={14} /> Detalhes
              </button>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => handleOpenEdit(owner)}
              >
                <Edit2 size={14} /> Editar
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => handleImpersonate(owner.id, owner.name)}
              >
                <LogIn size={14} /> Acessar
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Criar Proprietário Manualmente */}
      {createModalOpen && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalDialog}>
            <div className={styles.modalHeader}>
              <h2>+ Criar Proprietário Manualmente</h2>
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
                    <label className={styles.label}>Nome da Empresa *</label>
                    <input
                      type="text"
                      required
                      className={styles.input}
                      value={newOwnerForm.name}
                      onChange={(e) => setNewOwnerForm({ ...newOwnerForm, name: e.target.value })}
                      placeholder="Ex: Barbearia Prime"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Nicho / Categoria</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={newOwnerForm.businessType}
                      onChange={(e) => setNewOwnerForm({ ...newOwnerForm, businessType: e.target.value })}
                      placeholder="Ex: Barbearia, Salão, Estética"
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
                      placeholder="Ex: João Silva"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>E-mail de Acesso *</label>
                    <input
                      type="email"
                      required
                      className={styles.input}
                      value={newOwnerForm.email}
                      onChange={(e) => setNewOwnerForm({ ...newOwnerForm, email: e.target.value })}
                      placeholder="proprietario@email.com"
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
                    <label className={styles.label}>CPF ou CNPJ</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={newOwnerForm.cnpjOrCpf}
                      onChange={(e) => setNewOwnerForm({ ...newOwnerForm, cnpjOrCpf: e.target.value })}
                      placeholder="00.000.000/0001-00"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Senha Inicial (Opcional)</label>
                    <input
                      type="password"
                      minLength={6}
                      className={styles.input}
                      value={newOwnerForm.password}
                      onChange={(e) => setNewOwnerForm({ ...newOwnerForm, password: e.target.value })}
                      placeholder="Deixe em branco para gerar aleatória"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Plano Inicial</label>
                    <select
                      className={styles.select}
                      value={newOwnerForm.planSlug}
                      onChange={(e) => setNewOwnerForm({ ...newOwnerForm, planSlug: e.target.value })}
                    >
                      <option value="essencial">Essencial (até 2 prof.)</option>
                      <option value="profissional">Profissional (até 5 prof.)</option>
                      <option value="equipe">Equipe (até 10 prof.)</option>
                      <option value="negocio">Negócio (até 20 prof.)</option>
                      <option value="empresa">Empresa (até 50 prof.)</option>
                      <option value="enterprise">Enterprise (até 100 prof.)</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Condição de Acesso Inicial *</label>
                  <select
                    className={styles.select}
                    value={newOwnerForm.accessType}
                    onChange={(e) =>
                      setNewOwnerForm({ ...newOwnerForm, accessType: e.target.value as any })
                    }
                  >
                    <option value="trial">Iniciar Teste Gratuito (7 dias de degustação)</option>
                    <option value="courtesy">Concessão Administrativa (Cortesia Sem Cobrança)</option>
                    <option value="pending">Aguardando Contratação (Status Pendente)</option>
                  </select>
                </div>

                {newOwnerForm.accessType === "courtesy" && (
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Justificativa Obrigatória para Cortesia *</label>
                    <textarea
                      required
                      rows={2}
                      className={styles.textarea}
                      placeholder="Ex: Parceria de marketing acordada formalmente ou migração assistida."
                      value={newOwnerForm.reason}
                      onChange={(e) => setNewOwnerForm({ ...newOwnerForm, reason: e.target.value })}
                    />
                  </div>
                )}
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
                  Criar no MySQL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Credenciais Criadas */}
      {createdCredentials && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalDialog}>
            <div className={styles.modalHeader}>
              <h2 style={{ color: "#dcff4c", display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={18} /> Conta Criada com Sucesso!
              </h2>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setCreatedCredentials(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ margin: 0, fontSize: 13, color: "#a3a3a3" }}>
                Os dados foram gravados de forma transacional no banco de dados. Compartilhe as
                credenciais com o proprietário:
              </p>

              <div className={styles.codeBox}>
                <div><strong>E-mail:</strong> {createdCredentials.email}</div>
                <div><strong>Senha Temporária:</strong> {createdCredentials.temporaryPassword}</div>
                <div><strong>URL Pública:</strong> /r/{createdCredentials.slug}</div>
              </div>

              <button
                type="button"
                className={styles.btnSecondary}
                style={{ width: "100%", justifyContent: "center" }}
                onClick={() => {
                  navigator.clipboard.writeText(
                    `E-mail: ${createdCredentials.email}\nSenha: ${createdCredentials.temporaryPassword}\nAcesse em: https://reservei.com.br/login`
                  );
                  setCopiedPass(true);
                  setTimeout(() => setCopiedPass(false), 2000);
                }}
              >
                {copiedPass ? <Check size={14} color="#dcff4c" /> : <Copy size={14} />}
                {copiedPass ? "Copiado para a área de transferência!" : "Copiar Credenciais"}
              </button>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => setCreatedCredentials(null)}
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar Proprietário */}
      {editModalOpen && ownerToEdit && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalDialog}>
            <div className={styles.modalHeader}>
              <h2>Editar Proprietário & Empresa</h2>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setEditModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className={styles.modalBody}>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Nome da Empresa *</label>
                    <input
                      type="text"
                      required
                      className={styles.input}
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Nicho</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={editForm.businessType}
                      onChange={(e) => setEditForm({ ...editForm, businessType: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Nome do Proprietário</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={editForm.ownerName}
                      onChange={(e) => setEditForm({ ...editForm, ownerName: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>E-mail Comercial</label>
                    <input
                      type="email"
                      className={styles.input}
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Telefone / WhatsApp</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>CPF ou CNPJ</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={editForm.cnpjOrCpf}
                      onChange={(e) => setEditForm({ ...editForm, cnpjOrCpf: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setEditModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className={styles.btnPrimary}>
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Suspender Empresa */}
      {suspendModalOpen && ownerToSuspend && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalDialog}>
            <div className={styles.modalHeader}>
              <h2 style={{ color: "#fbbf24", display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={18} /> Suspender Empresa: {ownerToSuspend.name}
              </h2>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setSuspendModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleConfirmSuspend}>
              <div className={styles.modalBody}>
                <p style={{ margin: 0, fontSize: 13, color: "#a3a3a3", lineHeight: 1.5 }}>
                  A suspensão desativa a página pública e restringe o acesso operacional do proprietário,
                  sem apagar agendamentos ou clientes existentes. Esta ação é auditada.
                </p>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Motivo da Suspensão *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Descreva o motivo administrativo desta suspensão..."
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    className={styles.textarea}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setSuspendModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  style={{ background: "#fbbf24", color: "#0a0a0a" }}
                >
                  Confirmar Suspensão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Detalhes 360° */}
      {detailsModalOpen && (
        <div className={styles.modalBackdrop}>
          <div className={`${styles.modalDialog} ${styles.modalLarge}`}>
            <div className={styles.modalHeader}>
              <h2>Visão 360°: {ownerDetails?.company?.name || "Carregando..."}</h2>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setDetailsModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              {detailsLoading && (
                <div style={{ padding: 40, textAlign: "center", color: "#a3a3a3" }}>
                  Carregando informações completas...
                </div>
              )}

              {!detailsLoading && ownerDetails && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {/* Company Summary */}
                  <div className={styles.detailSection}>
                    <div className={styles.detailSectionTitle}>
                      <span>Dados Gerais & Proprietário</span>
                      <button
                        type="button"
                        className={styles.btnPrimary}
                        style={{ padding: "6px 12px", fontSize: 12 }}
                        onClick={() => handleImpersonate(ownerDetails.company.id, ownerDetails.company.name)}
                      >
                        <LogIn size={13} /> Acessar Painel
                      </button>
                    </div>
                    <div className={styles.formGrid}>
                      <div>
                        <span style={{ color: "#737373", fontSize: 12 }}>Proprietário:</span>
                        <div style={{ fontWeight: 600 }}>
                          {ownerDetails.primaryOwner?.name || "Sem proprietário"}
                        </div>
                        <div style={{ fontSize: 12, color: "#a3a3a3" }}>
                          {ownerDetails.primaryOwner?.email}
                        </div>
                      </div>

                      <div>
                        <span style={{ color: "#737373", fontSize: 12 }}>Slug / URL Pública:</span>
                        <div style={{ fontFamily: "monospace", color: "#dcff4c" }}>
                          /r/{ownerDetails.company?.publicSlug}
                        </div>
                        <div style={{ fontSize: 12, color: "#a3a3a3" }}>
                          Status: {ownerDetails.company?.publicEnabled ? "Pública Ativa" : "Desativada"}
                        </div>
                      </div>

                      <div>
                        <span style={{ color: "#737373", fontSize: 12 }}>Total de Atendimentos:</span>
                        <div style={{ fontWeight: 600, fontSize: 16 }}>
                          {ownerDetails.totalAppointments ?? 0}
                        </div>
                      </div>

                      <div>
                        <span style={{ color: "#737373", fontSize: 12 }}>Serviços Cadastrados:</span>
                        <div style={{ fontWeight: 600, fontSize: 16 }}>
                          {ownerDetails.totalServices ?? 0}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Subscription Details */}
                  <div className={styles.detailSection}>
                    <div className={styles.detailSectionTitle}>
                      <span>Assinatura & Plano SaaS</span>
                      <span style={{ fontSize: 12, color: "#a3a3a3" }}>
                        Origem: {ownerDetails.subscription?.origin || "Checkout"}
                      </span>
                    </div>

                    <div className={styles.formGrid}>
                      <div>
                        <span style={{ color: "#737373", fontSize: 12 }}>Plano Atual:</span>
                        <div style={{ fontWeight: 700, textTransform: "capitalize", color: "#ffffff" }}>
                          {ownerDetails.subscription?.plan || "Trial"}
                        </div>
                      </div>

                      <div>
                        <span style={{ color: "#737373", fontSize: 12 }}>Status:</span>
                        <div style={{ marginTop: 4 }}>
                          {renderStatusBadge(ownerDetails.subscription || {})}
                        </div>
                      </div>

                      <div>
                        <span style={{ color: "#737373", fontSize: 12 }}>Limite de Funcionários:</span>
                        <div style={{ fontWeight: 600 }}>
                          {ownerDetails.plan?.employeeLimit || 2} funcionários
                        </div>
                      </div>

                      <div>
                        <span style={{ color: "#737373", fontSize: 12 }}>Fim do Teste / Próxima Cobrança:</span>
                        <div style={{ fontSize: 13 }}>
                          {ownerDetails.subscription?.trialEndsAt
                            ? new Date(ownerDetails.subscription.trialEndsAt).toLocaleDateString("pt-BR")
                            : "—"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Employees & Clients List */}
                  <div className={styles.formGrid}>
                    <div className={styles.detailSection}>
                      <div className={styles.detailSectionTitle}>
                        <span>Funcionários ({ownerDetails.employees?.length ?? 0})</span>
                      </div>
                      <div style={{ maxHeight: 150, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                        {ownerDetails.employees?.map((e: any) => (
                          <div key={e.id} style={{ fontSize: 12, display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #1f1f1f" }}>
                            <span>{e.name}</span>
                            <span style={{ color: "#737373" }}>{e.jobTitle || "Profissional"}</span>
                          </div>
                        ))}
                        {(!ownerDetails.employees || ownerDetails.employees.length === 0) && (
                          <div style={{ color: "#737373", fontSize: 12 }}>Nenhum profissional cadastrado.</div>
                        )}
                      </div>
                    </div>

                    <div className={styles.detailSection}>
                      <div className={styles.detailSectionTitle}>
                        <span>Clientes Vinculados ({ownerDetails.clients?.length ?? 0})</span>
                      </div>
                      <div style={{ maxHeight: 150, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                        {ownerDetails.clients?.slice(0, 10).map((c: any) => (
                          <div key={c.id} style={{ fontSize: 12, display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #1f1f1f" }}>
                            <span>{c.name}</span>
                            <span style={{ color: "#737373" }}>{c.phone || c.email || "—"}</span>
                          </div>
                        ))}
                        {(!ownerDetails.clients || ownerDetails.clients.length === 0) && (
                          <div style={{ color: "#737373", fontSize: 12 }}>Nenhum cliente cadastrado.</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Audit Logs */}
                  <div className={styles.detailSection}>
                    <div className={styles.detailSectionTitle}>
                      <span>Histórico de Auditoria Administrativa</span>
                    </div>
                    <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                      {ownerDetails.auditLogs?.map((log: any) => (
                        <div key={log.id} style={{ fontSize: 11.5, padding: "6px 8px", background: "#0f0f0f", borderRadius: 6, border: "1px solid #222222" }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <strong style={{ color: "#dcff4c" }}>{log.action}</strong>
                            <span style={{ color: "#737373" }}>{new Date(log.createdAt).toLocaleString("pt-BR")}</span>
                          </div>
                          <div style={{ color: "#a3a3a3", marginTop: 2 }}>{log.reason || "Sem motivo registrado"}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
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

      {/* Modal: Excluir Proprietário / Empresa */}
      {deleteOwnerModalOpen && ownerToDelete && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalDialog}>
            <div className={styles.modalHeader}>
              <h2 style={{ color: "#f87171", display: "flex", alignItems: "center", gap: 8 }}>
                <Trash2 size={18} />
                Excluir: {ownerToDelete.name}
              </h2>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setDeleteOwnerModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Tipo de Exclusão</label>
                <select
                  value={deleteMode}
                  onChange={(e) => setDeleteMode(e.target.value as any)}
                  className={styles.select}
                >
                  <option value="soft">Soft Delete (Recomendado — Desativação segura com retenção de histórico)</option>
                  <option value="hard">Hard Delete (Exclusão Definitiva no MySQL com cascata)</option>
                </select>
              </div>

              {deleteMode === "hard" && (
                <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: 14, borderRadius: 8 }}>
                  <div style={{ color: "#fca5a5", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                    ⚠️ ATENÇÃO: Esta ação é irreversível!
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "#fca5a5", lineHeight: 1.4 }}>
                    Para prosseguir com a exclusão física definitiva no banco de dados, digite exatamente o nome da empresa abaixo:
                  </p>
                  <div style={{ marginTop: 10 }}>
                    <input
                      type="text"
                      placeholder={ownerToDelete.name}
                      value={confirmationName}
                      onChange={(e) => setConfirmationName(e.target.value)}
                      className={styles.input}
                      style={{ borderColor: "#ef4444" }}
                    />
                  </div>
                </div>
              )}

              <div className={styles.formGroup}>
                <label className={styles.label}>Motivo para Auditoria *</label>
                <textarea
                  rows={2}
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className={styles.textarea}
                />
              </div>
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
                className={styles.btnDanger}
                onClick={handleExecuteDeleteOwner}
              >
                {deleteMode === "hard" ? "Excluir Definitivamente" : "Desativar (Soft Delete)"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
