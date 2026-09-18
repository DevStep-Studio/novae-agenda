"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users,
  Search,
  Plus,
  ShieldCheck,
  ShieldAlert,
  Crown,
  Briefcase,
  User,
  Key,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  X,
  Copy,
  Check,
  Building2,
  Sparkles,
  Ban,
  RotateCcw,
  KeyRound,
} from "lucide-react";
import styles from "../admin-dashboard.module.css";

export interface UsersTabProps {
  onSwitchToPins?: () => void;
}

export function UsersTab({ onSwitchToPins }: UsersTabProps = {}) {
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalOwners: 0,
    totalEmployees: 0,
    totalCustomers: 0,
    totalSuperadmins: 0,
    totalActive: 0,
  });

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<any | null>(null);
  const [copiedPass, setCopiedPass] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    role: "owner",
    isSuperadmin: false,
    active: true,
    password: "",
  });

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any | null>(null);
  const [deleteMode, setDeleteMode] = useState<"soft" | "hard">("soft");
  const [deleteReason, setDeleteReason] = useState("Exclusão administrativa");

  // Bulk selection state
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkDeleteMode, setBulkDeleteMode] = useState<"soft" | "hard">("soft");
  const [bulkDeleteReason, setBulkDeleteReason] = useState("Exclusão em massa via Super Admin");
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Create User Form
  const [newUserForm, setNewUserForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "owner" as "superadmin" | "owner" | "employee" | "customer",
    companyName: "",
    businessType: "Geral",
    planSlug: "profissional",
    accessType: "trial" as "trial" | "courtesy" | "pending",
    grantCourtesy: false,
    reason: "",
  });

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
      });
      if (search.trim()) params.set("q", search.trim());
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/superadmin/users?${params.toString()}`);
      if (res.status === 401) {
        setFetchError("Sua sessão de Super Admin expirou ou não possui permissão. Por favor, recarregue a página.");
        return;
      }
      if (!res.ok) {
        throw new Error(`Falha na resposta do servidor (HTTP ${res.status}).`);
      }
      const json = await res.json();
      setUsersList(json.data || json.items || []);
      setTotalPages(json.pagination?.totalPages || 1);
      setTotalCount(json.pagination?.total || 0);
      if (json.stats) {
        setStats(json.stats);
      }
    } catch (err: any) {
      console.error("Erro ao carregar usuários:", err);
      setFetchError(err.message || "Erro de conexão ao banco de dados.");
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadUsers();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadUsers]);

  // Handle Create User
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.name || !newUserForm.email) {
      alert("Por favor preencha nome e e-mail.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/superadmin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUserForm),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao criar usuário no banco de dados.");
      }

      setCreatedCredentials({
        name: data.name || newUserForm.name,
        email: data.email || newUserForm.email,
        temporaryPassword: data.temporaryPassword,
        role: data.role,
        isSuperadmin: data.isSuperadmin,
      });

      setCreateModalOpen(false);
      setNewUserForm({
        name: "",
        email: "",
        phone: "",
        password: "",
        role: "owner",
        companyName: "",
        businessType: "Geral",
        planSlug: "profissional",
        accessType: "trial",
        grantCourtesy: false,
        reason: "",
      });

      await loadUsers();
    } catch (err: any) {
      alert(`Erro ao criar usuário: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle Edit User
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToEdit) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/superadmin/users/${userToEdit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao atualizar usuário.");

      setEditModalOpen(false);
      setUserToEdit(null);
      await loadUsers();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle Delete User
  const handleDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToDelete) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/superadmin/users/${userToDelete.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: deleteMode, reason: deleteReason }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao excluir usuário.");

      setDeleteModalOpen(false);
      setUserToDelete(null);
      await loadUsers();
    } catch (err: any) {
      alert(`Erro ao excluir: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Bulk Select Handlers
  const handleToggleSelectAll = () => {
    if (usersList.length === 0) return;
    const allIds = usersList.map((u) => u.id);
    const allSelected = allIds.every((id) => selectedUserIds.includes(id));
    if (allSelected) {
      setSelectedUserIds((prev) => prev.filter((id) => !allIds.includes(id)));
    } else {
      setSelectedUserIds((prev) => Array.from(new Set([...prev, ...allIds])));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleExecuteBulkDelete = async () => {
    if (selectedUserIds.length === 0) return;
    setBulkDeleting(true);
    try {
      const res = await fetch("/api/superadmin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedUserIds,
          mode: bulkDeleteMode,
          reason: bulkDeleteReason || "Exclusão em massa via Super Admin",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Erro ao excluir usuários selecionados.");
        return;
      }
      alert(json.message || `${selectedUserIds.length} usuário(s) processado(s) com sucesso!`);
      setSelectedUserIds([]);
      setBulkDeleteModalOpen(false);
      await loadUsers();
    } catch (err: any) {
      alert("Erro ao excluir em massa: " + err.message);
    } finally {
      setBulkDeleting(false);
    }
  };

  // Helper badge & avatar renderers
  const getAvatarClass = (user: any) => {
    if (user.isSuperadmin || user.role === "superadmin") return styles.userAvatarSuperadmin;
    if (user.role === "owner") return styles.userAvatarOwner;
    if (user.role === "employee" || user.role === "manager" || user.role === "admin") return styles.userAvatarEmployee;
    return styles.userAvatarCustomer;
  };

  const renderLevelBadge = (user: any) => {
    if (user.isSuperadmin || user.role === "superadmin") {
      return (
        <span
          className={styles.statusPill}
          style={{
            background: "rgba(220, 255, 76, 0.12)",
            color: "#dcff4c",
            border: "1px solid rgba(220, 255, 76, 0.35)",
          }}
        >
          <ShieldAlert size={12} />
          Super Admin
        </span>
      );
    }

    if (user.role === "owner") {
      return (
        <span
          className={styles.statusPill}
          style={{
            background: "rgba(34, 197, 94, 0.12)",
            color: "#4ade80",
            border: "1px solid rgba(34, 197, 94, 0.3)",
          }}
        >
          <Crown size={12} />
          Proprietário
        </span>
      );
    }

    if (user.role === "employee" || user.role === "manager" || user.role === "admin") {
      return (
        <span
          className={styles.statusPill}
          style={{
            background: "rgba(59, 130, 246, 0.12)",
            color: "#60a5fa",
            border: "1px solid rgba(59, 130, 246, 0.3)",
          }}
        >
          <Briefcase size={12} />
          Colaborador
        </span>
      );
    }

    return (
      <span
        className={styles.statusPill}
        style={{
          background: "rgba(161, 161, 170, 0.1)",
          color: "#d4d4d8",
          border: "1px solid rgba(161, 161, 170, 0.25)",
        }}
      >
        <User size={12} />
        Cliente
      </span>
    );
  };

  return (
    <div className={styles.tabContent}>
      {/* 4 KPI Summary Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statTitle}>Total de Usuários</span>
            <div className={styles.statIcon} style={{ background: "rgba(220, 255, 76, 0.12)", color: "#dcff4c" }}>
              <Users size={18} />
            </div>
          </div>
          <div className={styles.statValue}>{stats.totalUsers || totalCount}</div>
          <div className={styles.statSubtext}>{stats.totalActive || 0} usuários ativos na plataforma</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statTitle}>Proprietários</span>
            <div className={styles.statIcon} style={{ background: "rgba(34, 197, 94, 0.12)", color: "#4ade80" }}>
              <Crown size={18} />
            </div>
          </div>
          <div className={styles.statValue}>{stats.totalOwners || 0}</div>
          <div className={styles.statSubtext}>Gestores de estabelecimentos</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statTitle}>Colaboradores</span>
            <div className={styles.statIcon} style={{ background: "rgba(59, 130, 246, 0.12)", color: "#60a5fa" }}>
              <Briefcase size={18} />
            </div>
          </div>
          <div className={styles.statValue}>{stats.totalEmployees || 0}</div>
          <div className={styles.statSubtext}>Profissionais de atendimento</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statTitle}>Clientes Finais</span>
            <div className={styles.statIcon} style={{ background: "rgba(168, 85, 247, 0.12)", color: "#c084fc" }}>
              <User size={18} />
            </div>
          </div>
          <div className={styles.statValue}>{stats.totalCustomers || 0}</div>
          <div className={styles.statSubtext}>Consumidores cadastrados</div>
        </div>
      </div>

      {/* Modern Filter & Action Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.searchWrapper}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Buscar por nome, e-mail, telefone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            {search && (
              <button
                type="button"
                className={styles.searchClearBtn}
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                title="Limpar busca"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <select
            className={styles.filterSelect}
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Todos os Níveis</option>
            <option value="superadmin">🛡️ Super Admin</option>
            <option value="owner">👑 Proprietário</option>
            <option value="employee">💼 Colaborador / Profissional</option>
            <option value="customer">👤 Cliente</option>
          </select>

          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Todos os Status</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>

          <div className={styles.resultsCountPill}>
            <span>Usuários:</span>
            <strong className={styles.resultsCountNumber}>{totalCount}</strong>
          </div>
        </div>

        <div className={styles.toolbarRight}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus size={16} />
            <span>Criar Usuário no Banco</span>
          </button>
        </div>
      </div>

      {fetchError && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#f87171",
            padding: "12px 16px",
            borderRadius: "10px",
            marginBottom: "16px",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <AlertTriangle size={16} />
          <span>Erro: {fetchError}</span>
        </div>
      )}

      {/* Users Table Desktop */}
      <div className={styles.tableWrapper}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th style={{ width: 44, textAlign: "center" }}>
                <input
                  type="checkbox"
                  className={styles.tableCheckbox}
                  checked={usersList.length > 0 && usersList.every((u) => selectedUserIds.includes(u.id))}
                  onChange={handleToggleSelectAll}
                  aria-label="Selecionar todos os usuários da página"
                />
              </th>
              <th style={{ minWidth: 220 }}>USUÁRIO</th>
              <th style={{ minWidth: 200 }}>CONTATO</th>
              <th style={{ minWidth: 140 }}>NÍVEL / PAPEL</th>
              <th style={{ minWidth: 160 }}>EMPRESA VINCULADA</th>
              <th style={{ minWidth: 150 }}>ASSINATURA / PLANO</th>
              <th style={{ minWidth: 100 }}>STATUS</th>
              <th style={{ minWidth: 120, textAlign: "right" }}>AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {!loading &&
              usersList.map((user) => {
                const isSelected = selectedUserIds.includes(user.id);
                return (
                  <tr key={user.id} className={isSelected ? styles.rowSelected : ""}>
                    <td style={{ width: 44, textAlign: "center" }}>
                      <input
                        type="checkbox"
                        className={styles.tableCheckbox}
                        checked={isSelected}
                        onChange={() => handleToggleSelectOne(user.id)}
                        aria-label={`Selecionar usuário ${user.name}`}
                      />
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div className={`${styles.userAvatar} ${getAvatarClass(user)}`}>
                          {user.name?.slice(0, 2).toUpperCase() || "US"}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "#ffffff", fontSize: "13.5px" }}>{user.name}</div>
                          <div style={{ fontSize: 11, color: "#71717a", marginTop: 2 }}>
                            Cadastrado em {new Date(user.createdAt).toLocaleDateString("pt-BR")}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ fontSize: 13, color: "#f4f4f5", fontWeight: 500 }}>{user.email}</div>
                      <div style={{ fontSize: 11.5, color: "#a1a1aa", marginTop: 2 }}>
                        {user.phone || "Sem telefone"}
                      </div>
                    </td>

                    <td>{renderLevelBadge(user)}</td>

                    <td>
                      {user.company ? (
                        <span
                          style={{
                            fontSize: 12.5,
                            fontWeight: 500,
                            color: "#e4e4e7",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Building2 size={14} style={{ color: "#a1a1aa" }} />
                          {user.company.name}
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 11.5,
                            color: "#71717a",
                            background: "#18181c",
                            padding: "3px 8px",
                            borderRadius: 6,
                            border: "1px solid #282830",
                          }}
                        >
                          Global (Sem empresa)
                        </span>
                      )}
                    </td>

                    <td>
                      {user.subscription ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#ffffff", letterSpacing: "0.03em" }}>
                            {user.subscription.plan.toUpperCase()}
                          </span>
                          <span
                            className={`${styles.statusPill} ${
                              user.subscription.status === "active" ? styles.statusActive : styles.statusTrial
                            }`}
                            style={{ fontSize: 10, padding: "2px 8px" }}
                          >
                            <span className={styles.statusDot} />
                            {user.subscription.status === "active"
                              ? "Ativa"
                              : user.subscription.status === "trialing"
                              ? "Trial"
                              : user.subscription.status}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: "#52525b" }}>—</span>
                      )}
                    </td>

                    <td>
                      <span
                        className={`${styles.statusPill} ${user.active ? styles.statusActive : styles.statusCancelled}`}
                      >
                        <span className={styles.statusDot} />
                        {user.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <div className={styles.actionBtnGroup}>
                        {onSwitchToPins && (
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.actionBtnPin}`}
                            title="Gerenciar / Redefinir PIN"
                            onClick={onSwitchToPins}
                          >
                            <KeyRound size={15} />
                          </button>
                        )}

                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.actionBtnEdit}`}
                          title="Editar Nível / Papel"
                          onClick={() => {
                            setUserToEdit(user);
                            setEditForm({
                              name: user.name || "",
                              phone: user.phone || "",
                              role: user.role || "customer",
                              isSuperadmin: Boolean(user.isSuperadmin),
                              active: Boolean(user.active),
                              password: "",
                            });
                            setEditModalOpen(true);
                          }}
                        >
                          <Edit2 size={15} />
                        </button>

                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                          title="Excluir Usuário"
                          onClick={() => {
                            setUserToDelete(user);
                            setDeleteMode("soft");
                            setDeleteReason("Exclusão solicitada no Super Admin");
                            setDeleteModalOpen(true);
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

            {!loading && usersList.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "48px 24px", color: "#a1a1aa" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                    <Users size={32} style={{ color: "#52525b" }} />
                    <span style={{ fontSize: 14, fontWeight: 500 }}>Nenhum usuário encontrado para os filtros selecionados.</span>
                    {search && (
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={() => {
                          setSearch("");
                          setRoleFilter("all");
                          setStatusFilter("all");
                        }}
                        style={{ marginTop: 6 }}
                      >
                        Limpar Filtros
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "48px 24px", color: "#a1a1aa" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        border: "2px solid #dcff4c",
                        borderTopColor: "transparent",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                    <span style={{ fontSize: 13.5 }}>Carregando usuários do sistema...</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className={styles.pagination}>
          <span>
            Mostrando <strong>{usersList.length}</strong> de <strong>{totalCount}</strong> usuários cadastrados
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
            <span style={{ padding: "0 10px", fontSize: "12.5px", fontWeight: 600, color: "#d4d4d8" }}>
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
        {!loading &&
          usersList.map((user) => {
            const isSelected = selectedUserIds.includes(user.id);
            return (
              <div
                key={user.id}
                className={`${styles.mobileCard} ${isSelected ? styles.rowSelected : ""}`}
              >
                <div className={styles.mobileCardHeader}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input
                      type="checkbox"
                      className={styles.tableCheckbox}
                      checked={isSelected}
                      onChange={() => handleToggleSelectOne(user.id)}
                      aria-label={`Selecionar usuário ${user.name}`}
                    />
                    <div className={`${styles.userAvatar} ${getAvatarClass(user)}`} style={{ width: 34, height: 34, fontSize: 12 }}>
                      {user.name?.slice(0, 2).toUpperCase() || "US"}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: "#ffffff", fontSize: 14 }}>{user.name}</div>
                      <div style={{ fontSize: 11.5, color: "#a1a1aa" }}>{user.email}</div>
                    </div>
                  </div>
                  <span
                    className={`${styles.statusPill} ${user.active ? styles.statusActive : styles.statusCancelled}`}
                  >
                    <span className={styles.statusDot} />
                    {user.active ? "Ativo" : "Inativo"}
                  </span>
                </div>

                <div className={styles.mobileCardBody}>
                  <div>
                    <span style={{ color: "#71717a" }}>Nível:</span> {renderLevelBadge(user)}
                  </div>
                  <div>
                    <span style={{ color: "#71717a" }}>Telefone:</span> {user.phone || "—"}
                  </div>
                  <div>
                    <span style={{ color: "#71717a" }}>Empresa:</span> {user.company?.name || "Global"}
                  </div>
                  <div>
                    <span style={{ color: "#71717a" }}>Plano:</span>{" "}
                    {user.subscription ? (
                      <strong style={{ color: "#ffffff" }}>{user.subscription.plan.toUpperCase()}</strong>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>

                <div className={styles.mobileCardActions}>
                  {onSwitchToPins && (
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={onSwitchToPins}
                    >
                      <KeyRound size={14} style={{ color: "#dcff4c" }} /> PINs
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => {
                      setUserToEdit(user);
                      setEditForm({
                        name: user.name || "",
                        phone: user.phone || "",
                        role: user.role || "customer",
                        isSuperadmin: Boolean(user.isSuperadmin),
                        active: Boolean(user.active),
                        password: "",
                      });
                      setEditModalOpen(true);
                    }}
                  >
                    <Edit2 size={14} /> Editar
                  </button>
                  <button
                    type="button"
                    className={styles.btnDanger}
                    onClick={() => {
                      setUserToDelete(user);
                      setDeleteMode("soft");
                      setDeleteReason("Exclusão solicitada no Super Admin");
                      setDeleteModalOpen(true);
                    }}
                  >
                    <Trash2 size={14} /> Excluir
                  </button>
                </div>
              </div>
            );
          })}

        {!loading && usersList.length === 0 && (
          <div className={styles.mobileCard} style={{ textAlign: "center", color: "#a3a3a3" }}>
            Nenhum usuário encontrado para os filtros selecionados.
          </div>
        )}

        {loading && (
          <div className={styles.mobileCard} style={{ textAlign: "center", color: "#a3a3a3" }}>
            Carregando usuários do MySQL...
          </div>
        )}
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedUserIds.length > 0 && (
        <div className={styles.bulkActionBar}>
          <div className={styles.bulkActionInfo}>
            <span className={styles.bulkActionCount}>{selectedUserIds.length}</span>
            <span>
              {selectedUserIds.length === 1
                ? "usuário selecionado"
                : "usuários selecionados"}
            </span>
          </div>
          <div className={styles.bulkActionBtns}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => setSelectedUserIds([])}
            >
              Cancelar Seleção
            </button>
            <button
              type="button"
              className={styles.btnDanger}
              onClick={() => {
                setBulkDeleteMode("soft");
                setBulkDeleteReason("Exclusão em massa via Super Admin");
                setBulkDeleteModalOpen(true);
              }}
            >
              <Trash2 size={14} />
              Excluir Selecionados ({selectedUserIds.length})
            </button>
          </div>
        </div>
      )}

      {/* MODAL: CRIAR NOVO USUÁRIO */}
      {createModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard} style={{ maxWidth: 540 }}>
            <div className={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Sparkles size={20} style={{ color: "#dcff4c" }} />
                <h3>Criar Usuário Diretamente no Banco</h3>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setCreateModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className={styles.modalBody}>
                <div style={{ marginBottom: 14 }}>
                  <label className={styles.label}>Nome Completo *</label>
                  <input
                    type="text"
                    required
                    className={styles.input}
                    placeholder="Ex: João da Silva"
                    value={newUserForm.name}
                    onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                  <div>
                    <label className={styles.label}>E-mail *</label>
                    <input
                      type="email"
                      required
                      className={styles.input}
                      placeholder="usuario@dominio.com"
                      value={newUserForm.email}
                      onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={styles.label}>Telefone / WhatsApp</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="(11) 99999-9999"
                      value={newUserForm.phone}
                      onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                  <div>
                    <label className={styles.label}>Nível / Papel de Acesso *</label>
                    <select
                      className={styles.input}
                      value={newUserForm.role}
                      onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as any })}
                    >
                      <option value="owner">👑 Proprietário (Empresa)</option>
                      <option value="superadmin">🛡️ Super Admin da Plataforma</option>
                      <option value="employee">💼 Colaborador / Profissional</option>
                      <option value="customer">👤 Cliente Final</option>
                    </select>
                  </div>
                  <div>
                    <label className={styles.label}>Senha (vazio = gerar aleatória)</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="Senha provisória"
                      value={newUserForm.password}
                      onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                    />
                  </div>
                </div>

                {/* Campos adicionais se for Proprietário */}
                {newUserForm.role === "owner" && (
                  <div
                    style={{
                      background: "#161616",
                      border: "1px solid #2a2a2a",
                      borderRadius: 8,
                      padding: 14,
                      marginTop: 10,
                      marginBottom: 14,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#dcff4c", marginBottom: 10 }}>
                      🏢 Dados da Empresa & Assinatura (Criar no MySQL)
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <div>
                        <label className={styles.label}>Nome do Estabelecimento</label>
                        <input
                          type="text"
                          className={styles.input}
                          placeholder="Ex: Barbearia do João"
                          value={newUserForm.companyName}
                          onChange={(e) => setNewUserForm({ ...newUserForm, companyName: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className={styles.label}>Segmento / Categoria</label>
                        <input
                          type="text"
                          className={styles.input}
                          placeholder="Barbearia, Salão, Estética..."
                          value={newUserForm.businessType}
                          onChange={(e) => setNewUserForm({ ...newUserForm, businessType: e.target.value })}
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <div>
                        <label className={styles.label}>Plano de Assinatura</label>
                        <select
                          className={styles.input}
                          value={newUserForm.planSlug}
                          onChange={(e) => setNewUserForm({ ...newUserForm, planSlug: e.target.value })}
                        >
                          <option value="profissional">Profissional</option>
                          <option value="equipe">Equipe</option>
                          <option value="enterprise">Enterprise</option>
                        </select>
                      </div>

                      <div>
                        <label className={styles.label}>Condição de Acesso</label>
                        <select
                          className={styles.input}
                          value={newUserForm.accessType}
                          onChange={(e) =>
                            setNewUserForm({
                              ...newUserForm,
                              accessType: e.target.value as any,
                              grantCourtesy: e.target.value === "courtesy",
                            })
                          }
                        >
                          <option value="trial">Trial (7 dias grátis)</option>
                          <option value="courtesy">Cortesia Vitalícia / Manual</option>
                          <option value="pending">Aguardando Pagamento</option>
                        </select>
                      </div>
                    </div>

                    {newUserForm.accessType === "courtesy" && (
                      <div style={{ marginTop: 8 }}>
                        <label className={styles.label}>Justificativa da Cortesia *</label>
                        <input
                          type="text"
                          required
                          className={styles.input}
                          placeholder="Ex: Parceria comercial / Beta tester VIP"
                          value={newUserForm.reason}
                          onChange={(e) => setNewUserForm({ ...newUserForm, reason: e.target.value })}
                        />
                      </div>
                    )}
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
                <button type="submit" className={styles.btnPrimary} disabled={loading}>
                  {loading ? "Gravando no MySQL..." : "Salvar Diretamente no Banco"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREDENCIAIS CRIADAS */}
      {createdCredentials && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard} style={{ maxWidth: 440 }}>
            <div className={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <CheckCircle2 size={22} style={{ color: "#4ade80" }} />
                <h3>Usuário Criado com Sucesso!</h3>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setCreatedCredentials(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <p style={{ fontSize: 13, color: "#a3a3a3", marginBottom: 16 }}>
                O registro foi gravado com sucesso no MySQL. Guarde as credenciais provisórias de acesso:
              </p>

              <div
                style={{
                  background: "#161616",
                  border: "1px solid #2a2a2a",
                  borderRadius: 8,
                  padding: 14,
                  fontSize: 13,
                }}
              >
                <div style={{ marginBottom: 8 }}>
                  <span style={{ color: "#737373" }}>Nome:</span>{" "}
                  <strong style={{ color: "#ffffff" }}>{createdCredentials.name}</strong>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ color: "#737373" }}>E-mail:</span>{" "}
                  <strong style={{ color: "#ffffff" }}>{createdCredentials.email}</strong>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ color: "#737373" }}>Nível:</span>{" "}
                  <strong style={{ color: "#dcff4c" }}>{createdCredentials.role}</strong>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <span style={{ color: "#737373" }}>Senha Temporária:</span>{" "}
                    <code style={{ color: "#dcff4c", background: "#0d0d0d", padding: "2px 6px", borderRadius: 4 }}>
                      {createdCredentials.temporaryPassword}
                    </code>
                  </div>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={() => {
                      navigator.clipboard.writeText(createdCredentials.temporaryPassword);
                      setCopiedPass(true);
                      setTimeout(() => setCopiedPass(false), 2000);
                    }}
                  >
                    {copiedPass ? <Check size={14} style={{ color: "#4ade80" }} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
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

      {/* MODAL: EDITAR NÍVEL / PAPEL */}
      {editModalOpen && userToEdit && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard} style={{ maxWidth: 480 }}>
            <div className={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Edit2 size={18} style={{ color: "#dcff4c" }} />
                <h3>Editar Nível & Acesso do Usuário</h3>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setEditModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className={styles.modalBody}>
                <div style={{ marginBottom: 12 }}>
                  <label className={styles.label}>Nome</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label className={styles.label}>Telefone</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label className={styles.label}>Papel / Role</label>
                  <select
                    className={styles.input}
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  >
                    <option value="owner">👑 Proprietário</option>
                    <option value="employee">💼 Colaborador / Profissional</option>
                    <option value="customer">👤 Cliente Final</option>
                    <option value="superadmin">🛡️ Super Administrador</option>
                  </select>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      fontSize: 13,
                      color: "#dcff4c",
                      fontWeight: 600,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={editForm.isSuperadmin}
                      onChange={(e) => setEditForm({ ...editForm, isSuperadmin: e.target.checked })}
                    />
                    Conceder privilégios de Super Admin da plataforma
                  </label>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      fontSize: 13,
                      color: "#ffffff",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={editForm.active}
                      onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                    />
                    Usuário Ativo (acesso permitido ao sistema)
                  </label>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label className={styles.label}>Redefinir Senha (opcional)</label>
                  <input
                    type="password"
                    className={styles.input}
                    placeholder="Deixe em branco para manter a senha atual"
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  />
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
                <button type="submit" className={styles.btnPrimary} disabled={loading}>
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EXCLUIR USUÁRIO */}
      {deleteModalOpen && userToDelete && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard} style={{ maxWidth: 440 }}>
            <div className={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <AlertTriangle size={20} style={{ color: "#f87171" }} />
                <h3>Excluir Usuário</h3>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setDeleteModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDeleteSubmit}>
              <div className={styles.modalBody}>
                <p style={{ fontSize: 13, color: "#d4d4d4", marginBottom: 14 }}>
                  Tem certeza que deseja desativar ou remover o usuário{" "}
                  <strong style={{ color: "#ffffff" }}>{userToDelete.name}</strong> (
                  {userToDelete.email})?
                </p>

                <div style={{ marginBottom: 12 }}>
                  <label className={styles.label}>Modo de Exclusão</label>
                  <select
                    className={styles.input}
                    value={deleteMode}
                    onChange={(e) => setDeleteMode(e.target.value as any)}
                  >
                    <option value="soft">Desativar / Soft Delete (Recomendado)</option>
                    <option value="hard">Excluir Definitivamente do MySQL</option>
                  </select>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label className={styles.label}>Justificativa</label>
                  <input
                    type="text"
                    required
                    className={styles.input}
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setDeleteModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className={styles.btnDanger} disabled={loading}>
                  Confirmar Exclusão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EXCLUSÃO EM MASSA DE USUÁRIOS */}
      {bulkDeleteModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard} style={{ maxWidth: 460 }}>
            <div className={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Trash2 size={20} style={{ color: "#f87171" }} />
                <h3>Excluir {selectedUserIds.length} {selectedUserIds.length === 1 ? "Usuário" : "Usuários"}</h3>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setBulkDeleteModalOpen(false)}
                disabled={bulkDeleting}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div style={{ marginBottom: 12 }}>
                <label className={styles.label}>Tipo de Exclusão</label>
                <select
                  className={styles.input}
                  value={bulkDeleteMode}
                  onChange={(e) => setBulkDeleteMode(e.target.value as any)}
                  disabled={bulkDeleting}
                >
                  <option value="soft">Soft Delete (Desativação lógica - Recomendado)</option>
                  <option value="hard">Hard Delete (Exclusão definitiva no MySQL)</option>
                </select>
              </div>

              {bulkDeleteMode === "hard" && (
                <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "12px 14px", borderRadius: 8, marginBottom: 12 }}>
                  <p style={{ margin: 0, fontSize: 12.5, color: "#fca5a5", lineHeight: 1.4 }}>
                    ⚠️ <strong>Atenção:</strong> A exclusão definitiva removerá permanentemente os <strong>{selectedUserIds.length}</strong> usuários selecionados do MySQL. Esta ação não pode ser desfeita.
                  </p>
                </div>
              )}

              {bulkDeleteMode === "soft" && (
                <div style={{ background: "rgba(234, 179, 8, 0.1)", border: "1px solid rgba(234, 179, 8, 0.3)", padding: "12px 14px", borderRadius: 8, marginBottom: 12 }}>
                  <p style={{ margin: 0, fontSize: 12.5, color: "#fde047", lineHeight: 1.4 }}>
                    Os <strong>{selectedUserIds.length}</strong> usuários serão marcados como desativados (soft delete). Seus dados e vínculos permanecem no banco.
                  </p>
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <label className={styles.label}>Motivo para Auditoria</label>
                <input
                  type="text"
                  required
                  className={styles.input}
                  value={bulkDeleteReason}
                  onChange={(e) => setBulkDeleteReason(e.target.value)}
                  disabled={bulkDeleting}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setBulkDeleteModalOpen(false)}
                disabled={bulkDeleting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.btnDanger}
                onClick={handleExecuteBulkDelete}
                disabled={bulkDeleting}
              >
                {bulkDeleting
                  ? "Excluindo..."
                  : bulkDeleteMode === "hard"
                  ? `Excluir Definitivamente (${selectedUserIds.length})`
                  : `Desativar em Massa (${selectedUserIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
