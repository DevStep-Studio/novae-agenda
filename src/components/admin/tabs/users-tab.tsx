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
} from "lucide-react";
import styles from "../admin-dashboard.module.css";

export function UsersTab() {
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

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

  // Helper badge renderers
  const renderLevelBadge = (user: any) => {
    if (user.isSuperadmin || user.role === "superadmin") {
      return (
        <span
          className={styles.badge}
          style={{
            background: "rgba(220, 255, 76, 0.15)",
            color: "#dcff4c",
            borderColor: "rgba(220, 255, 76, 0.4)",
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            fontWeight: 700,
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
          className={styles.badge}
          style={{
            background: "rgba(34, 197, 94, 0.12)",
            color: "#4ade80",
            borderColor: "rgba(34, 197, 94, 0.3)",
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            fontWeight: 600,
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
          className={styles.badge}
          style={{
            background: "rgba(59, 130, 246, 0.12)",
            color: "#60a5fa",
            borderColor: "rgba(59, 130, 246, 0.3)",
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            fontWeight: 500,
          }}
        >
          <Briefcase size={12} />
          Colaborador
        </span>
      );
    }

    return (
      <span
        className={styles.badge}
        style={{
          background: "rgba(163, 163, 163, 0.1)",
          color: "#d4d4d4",
          borderColor: "rgba(163, 163, 163, 0.25)",
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
        }}
      >
        <User size={12} />
        Cliente
      </span>
    );
  };

  return (
    <div className={styles.tabContent}>
      {/* Top action & Filter bar */}
      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <Search size={16} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Buscar usuário por nome, e-mail, telefone ou empresa..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <select
          className={styles.selectInput}
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
          className={styles.selectInput}
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

        <button
          type="button"
          className={styles.btnPrimary}
          onClick={() => setCreateModalOpen(true)}
          style={{ whiteSpace: "nowrap" }}
        >
          <Plus size={16} />
          Criar Usuário no Banco
        </button>
      </div>

      {fetchError && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#f87171",
            padding: "12px 16px",
            borderRadius: "8px",
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

      {/* Users Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>USUÁRIO</th>
              <th>E-MAIL & TELEFONE</th>
              <th>NÍVEL / PAPEL</th>
              <th>EMPRESA VINCULADA</th>
              <th>ASSINATURA / PLANO</th>
              <th>STATUS</th>
              <th style={{ textAlign: "right" }}>AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {!loading &&
              usersList.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          background: user.isSuperadmin ? "#262b14" : "#1f1f23",
                          border: user.isSuperadmin ? "1px solid #dcff4c" : "1px solid #333338",
                          color: user.isSuperadmin ? "#dcff4c" : "#e5e5e5",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: 13,
                          flexShrink: 0,
                        }}
                      >
                        {user.name?.slice(0, 2).toUpperCase() || "US"}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: "#ffffff" }}>{user.name}</div>
                        <div style={{ fontSize: 11, color: "#737373" }}>
                          Cadastrado em {new Date(user.createdAt).toLocaleDateString("pt-BR")}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td>
                    <div style={{ fontSize: 13, color: "#e5e5e5" }}>{user.email}</div>
                    <div style={{ fontSize: 11, color: "#a3a3a3" }}>{user.phone || "Sem telefone"}</div>
                  </td>

                  <td>{renderLevelBadge(user)}</td>

                  <td>
                    {user.company ? (
                      <span
                        style={{
                          fontSize: 12,
                          color: "#d4d4d4",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <Building2 size={13} style={{ color: "#a3a3a3" }} />
                        {user.company.name}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: "#525252" }}>Nenhuma (Global)</span>
                    )}
                  </td>

                  <td>
                    {user.subscription ? (
                      <div>
                        <span
                          className={`${styles.badge} ${
                            user.subscription.status === "active" ? styles.badgeSuccess : styles.badgeWarning
                          }`}
                        >
                          {user.subscription.plan.toUpperCase()} • {user.subscription.status}
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: "#525252" }}>—</span>
                    )}
                  </td>

                  <td>
                    <span
                      className={`${styles.badge} ${user.active ? styles.badgeSuccess : styles.badgeDanger}`}
                    >
                      {user.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>

                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 6 }}>
                      <button
                        type="button"
                        className={styles.btnGhost}
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
                        className={styles.btnGhost}
                        style={{ color: "#f87171" }}
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
              ))}

            {!loading && usersList.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 36, color: "#a3a3a3" }}>
                  Nenhum usuário encontrado para os filtros selecionados.
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 36, color: "#a3a3a3" }}>
                  Carregando usuários do MySQL...
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className={styles.pagination}>
          <span>
            Mostrando {usersList.length} de {totalCount} usuários cadastrados
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
    </div>
  );
}
