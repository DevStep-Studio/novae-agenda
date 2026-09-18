"use client";

import { useEffect, useState, useCallback } from "react";
import {
  KeyRound,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  Copy,
  Check,
  Building2,
  Sparkles,
  Unlock,
  Trash2,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  Crown,
  Briefcase,
  User,
  Clock,
  Phone,
} from "lucide-react";
import styles from "../admin-dashboard.module.css";

interface UserPinItem {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  isSuperadmin: boolean;
  active: boolean;
  createdAt: string;
  companyId?: string | null;
  companyName?: string;
  hasPin: boolean;
  pinUpdatedAt?: string | null;
  pinCreatedAt?: string | null;
  failedAttempts: number;
  lockedUntil?: string | null;
  isLocked: boolean;
  lastLoginAt?: string | null;
}

interface PinStats {
  totalUsers: number;
  configuredPins: number;
  unconfiguredPins: number;
  lockedPins: number;
}

export function PinsTab() {
  const [items, setItems] = useState<UserPinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [pinStatusFilter, setPinStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<PinStats>({
    totalUsers: 0,
    configuredPins: 0,
    unconfiguredPins: 0,
    lockedPins: 0,
  });

  // Modal: Redefinir PIN
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserPinItem | null>(null);
  const [manualPinMode, setManualPinMode] = useState(false);
  const [manualPinValue, setManualPinValue] = useState("");
  const [userPhoneInput, setUserPhoneInput] = useState("");
  const [unlockCheckbox, setUnlockCheckbox] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modal: Sucesso PIN Gerado
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [createdPinResult, setCreatedPinResult] = useState<{
    pin: string;
    userName: string;
    userEmail: string;
    userPhone: string;
  } | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);

  // Modal: Confirmação de Desbloqueio / Remoção
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    action: "unlock" | "remove";
    user: UserPinItem | null;
  }>({
    open: false,
    action: "unlock",
    user: null,
  });

  const loadPins = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
      });
      if (search.trim()) params.set("q", search.trim());
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (pinStatusFilter !== "all") params.set("pinStatus", pinStatusFilter);

      const res = await fetch(`/api/superadmin/pins?${params.toString()}`);
      if (res.status === 401) {
        setFetchError("Sua sessão expirou ou você não possui permissão de Super Admin.");
        return;
      }
      if (!res.ok) {
        throw new Error(`Falha na resposta do servidor (HTTP ${res.status}).`);
      }
      const json = await res.json();
      setItems(json.items || []);
      setTotalPages(json.pagination?.totalPages || 1);
      setTotalCount(json.pagination?.total || 0);
      if (json.stats) {
        setStats(json.stats);
      }
    } catch (err: any) {
      console.error("Erro ao carregar PINs:", err);
      setFetchError(err.message || "Erro de conexão ao banco de dados.");
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, pinStatusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPins();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadPins]);

  // Handle Redefinir PIN Submit
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (manualPinMode) {
      if (!/^\d{4,6}$/.test(manualPinValue.trim())) {
        setActionError("O PIN deve conter exatamente 4 a 6 dígitos numéricos.");
        return;
      }
    }

    try {
      setSubmitting(true);
      setActionError(null);

      const payload: any = {
        userId: selectedUser.id,
        unlock: unlockCheckbox,
      };

      if (manualPinMode && manualPinValue.trim()) {
        payload.pin = manualPinValue.trim();
      }

      if (userPhoneInput.trim() && userPhoneInput.trim() !== (selectedUser.phone || "")) {
        payload.newPhone = userPhoneInput.trim();
      }

      const res = await fetch("/api/superadmin/pins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Falha ao redefinir PIN.");
      }

      setResetModalOpen(false);
      setCreatedPinResult({
        pin: data.pin,
        userName: data.userName || selectedUser.name,
        userEmail: data.userEmail || selectedUser.email,
        userPhone: data.userPhone || selectedUser.phone || "Não informado",
      });
      setSuccessModalOpen(true);
      void loadPins();
    } catch (err: any) {
      console.error("Erro ao redefinir PIN:", err);
      setActionError(err.message || "Erro interno ao processar PIN.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Unlock or Remove
  const handleConfirmAction = async () => {
    if (!confirmModal.user) return;
    try {
      setSubmitting(true);
      const res = await fetch("/api/superadmin/pins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: confirmModal.user.id,
          action: confirmModal.action,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Falha ao executar ação de PIN.");
      }

      setConfirmModal({ open: false, action: "unlock", user: null });
      void loadPins();
    } catch (err: any) {
      alert(err.message || "Erro ao executar ação.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderRoleBadge = (user: UserPinItem) => {
    if (user.isSuperadmin || user.role === "superadmin") {
      return (
        <span
          className={`${styles.statusPill} ${styles.statusActive}`}
          style={{
            background: "rgba(220, 255, 76, 0.15)",
            color: "#dcff4c",
            borderColor: "rgba(220, 255, 76, 0.4)",
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
          className={styles.statusPill}
          style={{
            background: "rgba(34, 197, 94, 0.12)",
            color: "#4ade80",
            borderColor: "rgba(34, 197, 94, 0.3)",
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
          className={styles.statusPill}
          style={{
            background: "rgba(59, 130, 246, 0.12)",
            color: "#60a5fa",
            borderColor: "rgba(59, 130, 246, 0.3)",
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
        className={styles.statusPill}
        style={{
          background: "rgba(163, 163, 163, 0.1)",
          color: "#d4d4d4",
          borderColor: "rgba(163, 163, 163, 0.25)",
        }}
      >
        <User size={12} />
        Cliente
      </span>
    );
  };

  return (
    <div className={styles.tabContent}>
      {/* Stat Cards Overview */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statTitle}>Total de Usuários</span>
            <div className={styles.statIcon} style={{ background: "rgba(255,255,255,0.06)", color: "#ffffff" }}>
              <User size={16} />
            </div>
          </div>
          <div className={styles.statValue}>{stats.totalUsers}</div>
          <div className={styles.statSubtext}>Base de usuários do sistema</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statTitle}>PINs Ativos</span>
            <div
              className={styles.statIcon}
              style={{ background: "rgba(220, 255, 76, 0.12)", color: "#dcff4c" }}
            >
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className={styles.statValue} style={{ color: "#dcff4c" }}>
            {stats.configuredPins}
          </div>
          <div className={styles.statSubtext}>Acesso por PIN habilitado</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statTitle}>Sem PIN Configurado</span>
            <div
              className={styles.statIcon}
              style={{ background: "rgba(245, 158, 11, 0.12)", color: "#fbbf24" }}
            >
              <Clock size={16} />
            </div>
          </div>
          <div className={styles.statValue} style={{ color: "#fbbf24" }}>
            {stats.unconfiguredPins}
          </div>
          <div className={styles.statSubtext}>Autenticação padrão ou pendente</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statTitle}>PINs Bloqueados</span>
            <div
              className={styles.statIcon}
              style={{ background: "rgba(239, 68, 68, 0.12)", color: "#f87171" }}
            >
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className={styles.statValue} style={{ color: "#f87171" }}>
            {stats.lockedPins}
          </div>
          <div className={styles.statSubtext}>Bloqueados por tentativas incorretas</div>
        </div>
      </div>

      {/* Toolbar & Filter Bar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search
              size={15}
              style={{
                position: "absolute",
                left: 12,
                color: "#737373",
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              className={styles.searchInput}
              style={{ paddingLeft: 36 }}
              placeholder="Buscar por usuário, e-mail, telefone ou empresa..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <select
            className={styles.filterSelect}
            value={pinStatusFilter}
            onChange={(e) => {
              setPinStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Todos os Status de PIN</option>
            <option value="configured">✅ Com PIN Ativo</option>
            <option value="not_configured">⏳ Sem PIN Configurado</option>
            <option value="locked">🚫 Bloqueados por Tentativas</option>
          </select>

          <select
            className={styles.filterSelect}
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Todos os Níveis</option>
            <option value="customer">👤 Clientes Finais</option>
            <option value="owner">👑 Proprietários</option>
            <option value="employee">💼 Colaboradores</option>
            <option value="superadmin">🛡️ Super Admin</option>
          </select>
        </div>

        <div className={styles.toolbarRight}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => void loadPins()}
            title="Atualizar lista"
          >
            <RotateCcw size={15} />
            Atualizar
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
            borderRadius: "8px",
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

      {/* Desktop Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>USUÁRIO</th>
              <th>TELEFONE / WHATSAPP</th>
              <th>NÍVEL</th>
              <th>EMPRESA</th>
              <th>STATUS DO PIN</th>
              <th>TENTATIVAS</th>
              <th>ÚLTIMA ALTERAÇÃO</th>
              <th style={{ textAlign: "right" }}>AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {!loading &&
              items.map((user) => (
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
                        <div style={{ fontSize: 11, color: "#737373" }}>{user.email}</div>
                      </div>
                    </div>
                  </td>

                  <td>
                    <div style={{ fontSize: 13, color: "#f5f5f5", display: "flex", alignItems: "center", gap: 6 }}>
                      <Phone size={13} style={{ color: "#a3a3a3" }} />
                      <span>{user.phone || "Sem telefone"}</span>
                    </div>
                  </td>

                  <td>{renderRoleBadge(user)}</td>

                  <td>
                    <span style={{ fontSize: 12, color: "#d4d4d4", display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <Building2 size={13} style={{ color: "#737373" }} />
                      {user.companyName}
                    </span>
                  </td>

                  <td>
                    {user.isLocked ? (
                      <span className={`${styles.statusPill} ${styles.statusCancelled}`}>
                        <AlertTriangle size={12} />
                        Bloqueado
                      </span>
                    ) : user.hasPin ? (
                      <span className={`${styles.statusPill} ${styles.statusActive}`}>
                        <CheckCircle2 size={12} />
                        PIN Ativo
                      </span>
                    ) : (
                      <span className={`${styles.statusPill} ${styles.statusTrial}`}>
                        <Clock size={12} />
                        Sem PIN
                      </span>
                    )}
                  </td>

                  <td>
                    {user.failedAttempts > 0 ? (
                      <span
                        style={{
                          color: user.isLocked ? "#f87171" : "#fbbf24",
                          fontWeight: 700,
                          fontSize: 12,
                        }}
                      >
                        {user.failedAttempts} falha(s)
                      </span>
                    ) : (
                      <span style={{ color: "#737373", fontSize: 12 }}>0 falhas</span>
                    )}
                  </td>

                  <td>
                    <span style={{ fontSize: 11.5, color: "#a3a3a3" }}>
                      {user.pinUpdatedAt
                        ? new Date(user.pinUpdatedAt).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </span>
                  </td>

                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 6 }}>
                      {user.isLocked && (
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          style={{ padding: "5px 9px", fontSize: 12, borderColor: "#f87171", color: "#f87171" }}
                          title="Desbloquear tentativas de acesso"
                          onClick={() => {
                            setConfirmModal({
                              open: true,
                              action: "unlock",
                              user,
                            });
                          }}
                        >
                          <Unlock size={14} />
                          Desbloquear
                        </button>
                      )}

                      <button
                        type="button"
                        className={styles.btnSecondary}
                        style={{ padding: "5px 10px", fontSize: 12 }}
                        title="Redefinir PIN deste usuário"
                        onClick={() => {
                          setSelectedUser(user);
                          setUserPhoneInput(user.phone || "");
                          setManualPinMode(false);
                          setManualPinValue("");
                          setUnlockCheckbox(true);
                          setActionError(null);
                          setResetModalOpen(true);
                        }}
                      >
                        <KeyRound size={13} style={{ color: "#dcff4c" }} />
                        <span>Redefinir PIN</span>
                      </button>

                      {user.hasPin && (
                        <button
                          type="button"
                          className={styles.btnGhost}
                          style={{ color: "#f87171" }}
                          title="Remover credencial de PIN"
                          onClick={() => {
                            setConfirmModal({
                              open: true,
                              action: "remove",
                              user,
                            });
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: 36, color: "#a3a3a3" }}>
                  Nenhum usuário encontrado para os filtros selecionados.
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: 36, color: "#a3a3a3" }}>
                  Carregando credenciais de PIN do banco de dados...
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className={styles.pagination}>
          <span>
            Mostrando {items.length} de {totalCount} usuários
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
        {!loading &&
          items.map((user) => (
            <div key={user.id} className={styles.mobileCard}>
              <div className={styles.mobileCardHeader}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
                      fontSize: 12,
                      flexShrink: 0,
                    }}
                  >
                    {user.name?.slice(0, 2).toUpperCase() || "US"}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: "#ffffff", fontSize: 14 }}>{user.name}</div>
                    <div style={{ fontSize: 11, color: "#737373" }}>{user.email}</div>
                  </div>
                </div>

                {user.isLocked ? (
                  <span className={`${styles.statusPill} ${styles.statusCancelled}`}>Bloqueado</span>
                ) : user.hasPin ? (
                  <span className={`${styles.statusPill} ${styles.statusActive}`}>PIN Ativo</span>
                ) : (
                  <span className={`${styles.statusPill} ${styles.statusTrial}`}>Sem PIN</span>
                )}
              </div>

              <div className={styles.mobileCardBody}>
                <div>
                  <span style={{ color: "#737373" }}>Nível:</span> {renderRoleBadge(user)}
                </div>
                <div>
                  <span style={{ color: "#737373" }}>Telefone:</span> {user.phone || "—"}
                </div>
                <div>
                  <span style={{ color: "#737373" }}>Empresa:</span> {user.companyName}
                </div>
                <div>
                  <span style={{ color: "#737373" }}>Falhas:</span> {user.failedAttempts}
                </div>
              </div>

              <div className={styles.mobileCardActions}>
                {user.isLocked && (
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    style={{ borderColor: "#f87171", color: "#f87171" }}
                    onClick={() => {
                      setConfirmModal({
                        open: true,
                        action: "unlock",
                        user,
                      });
                    }}
                  >
                    <Unlock size={14} /> Desbloquear
                  </button>
                )}

                <button
                  type="button"
                  className={styles.btnPrimary}
                  style={{ fontSize: 12, padding: "7px 12px" }}
                  onClick={() => {
                    setSelectedUser(user);
                    setUserPhoneInput(user.phone || "");
                    setManualPinMode(false);
                    setManualPinValue("");
                    setUnlockCheckbox(true);
                    setActionError(null);
                    setResetModalOpen(true);
                  }}
                >
                  <KeyRound size={14} /> Redefinir PIN
                </button>

                {user.hasPin && (
                  <button
                    type="button"
                    className={styles.btnGhost}
                    style={{ color: "#f87171" }}
                    onClick={() => {
                      setConfirmModal({
                        open: true,
                        action: "remove",
                        user,
                      });
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}

        {!loading && items.length === 0 && (
          <div className={styles.mobileCard} style={{ textAlign: "center", color: "#a3a3a3" }}>
            Nenhum usuário encontrado para os filtros selecionados.
          </div>
        )}

        {loading && (
          <div className={styles.mobileCard} style={{ textAlign: "center", color: "#a3a3a3" }}>
            Carregando PINs do banco de dados...
          </div>
        )}
      </div>

      {/* MODAL: REDEFINIR PIN */}
      {resetModalOpen && selectedUser && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalDialog} style={{ maxWidth: 500 }}>
            <div className={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <KeyRound size={20} style={{ color: "#dcff4c" }} />
                <h3>Redefinir PIN de Acesso</h3>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setResetModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResetSubmit}>
              <div className={styles.modalBody}>
                {actionError && (
                  <div
                    style={{
                      background: "rgba(239, 68, 68, 0.12)",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      color: "#f87171",
                      padding: "10px 14px",
                      borderRadius: 8,
                      fontSize: 12.5,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <AlertTriangle size={15} />
                    <span>{actionError}</span>
                  </div>
                )}

                <div
                  style={{
                    background: "#16171b",
                    border: "1px solid #282932",
                    borderRadius: 10,
                    padding: "12px 16px",
                  }}
                >
                  <div style={{ fontWeight: 600, color: "#ffffff", fontSize: 14 }}>
                    {selectedUser.name}
                  </div>
                  <div style={{ fontSize: 12, color: "#a3a3a3", marginTop: 2 }}>
                    {selectedUser.email}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                    {renderRoleBadge(selectedUser)}
                    {selectedUser.hasPin ? (
                      <span className={`${styles.statusPill} ${styles.statusActive}`}>PIN Configurado</span>
                    ) : (
                      <span className={`${styles.statusPill} ${styles.statusTrial}`}>Sem PIN</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className={styles.label}>Telefone / WhatsApp Vinculado</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="(11) 99999-9999"
                    value={userPhoneInput}
                    onChange={(e) => setUserPhoneInput(e.target.value)}
                  />
                  <div style={{ fontSize: 11, color: "#737373", marginTop: 4 }}>
                    Utilizado para login por telefone + PIN nos agendamentos e área do cliente.
                  </div>
                </div>

                <div style={{ marginTop: 6 }}>
                  <label className={styles.label}>Método de Definição do PIN</label>
                  <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                    <button
                      type="button"
                      className={!manualPinMode ? styles.btnPrimary : styles.btnSecondary}
                      style={{ flex: 1, fontSize: 12.5, padding: "9px 12px" }}
                      onClick={() => setManualPinMode(false)}
                    >
                      <Sparkles size={14} />
                      Gerar PIN Automático
                    </button>
                    <button
                      type="button"
                      className={manualPinMode ? styles.btnPrimary : styles.btnSecondary}
                      style={{ flex: 1, fontSize: 12.5, padding: "9px 12px" }}
                      onClick={() => setManualPinMode(true)}
                    >
                      <KeyRound size={14} />
                      Digitar Manualmente
                    </button>
                  </div>
                </div>

                {manualPinMode && (
                  <div style={{ marginTop: 10 }}>
                    <label className={styles.label}>Novo PIN Numérico (4 a 6 dígitos) *</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      className={styles.input}
                      placeholder="Ex: 482913"
                      value={manualPinValue}
                      onChange={(e) => setManualPinValue(e.target.value.replace(/\D/g, ""))}
                      style={{
                        letterSpacing: "6px",
                        fontSize: "18px",
                        fontFamily: "monospace",
                        textAlign: "center",
                      }}
                    />
                    <div style={{ fontSize: 11, color: "#737373", marginTop: 4 }}>
                      Evite sequências simples como 123456 ou 000000.
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 6 }}>
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
                      checked={unlockCheckbox}
                      onChange={(e) => setUnlockCheckbox(e.target.checked)}
                    />
                    Zerar tentativas falhas e desbloquear usuário imediatamente
                  </label>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setResetModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className={styles.btnPrimary} disabled={submitting}>
                  {submitting ? "Gravando no Banco..." : "Confirmar & Gravar PIN"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SUCESSO PIN CRIADO */}
      {successModalOpen && createdPinResult && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalDialog} style={{ maxWidth: 440 }}>
            <div className={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <CheckCircle2 size={22} style={{ color: "#4ade80" }} />
                <h3>PIN Definido com Sucesso!</h3>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setSuccessModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <p style={{ fontSize: 13, color: "#a3a3a3", margin: 0 }}>
                O novo PIN de acesso foi gravado com segurança e criptografia no MySQL. Repasse este código ao usuário:
              </p>

              <div
                style={{
                  background: "#12140c",
                  border: "1px solid rgba(220, 255, 76, 0.4)",
                  borderRadius: 12,
                  padding: "18px 20px",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 11, color: "#a3a3a3", textTransform: "uppercase", letterSpacing: 1 }}>
                  PIN DE ACESSO DO USUÁRIO
                </div>
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 800,
                    letterSpacing: "8px",
                    fontFamily: "monospace",
                    color: "#dcff4c",
                    textShadow: "0 0 12px rgba(220, 255, 76, 0.4)",
                  }}
                >
                  {createdPinResult.pin}
                </div>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  style={{ padding: "8px 18px", fontSize: 13 }}
                  onClick={() => {
                    navigator.clipboard.writeText(createdPinResult.pin);
                    setCopiedPin(true);
                    setTimeout(() => setCopiedPin(false), 2000);
                  }}
                >
                  {copiedPin ? (
                    <>
                      <Check size={14} style={{ color: "#0a0a0a" }} />
                      <span>PIN Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copiar PIN</span>
                    </>
                  )}
                </button>
              </div>

              <div
                style={{
                  background: "#161616",
                  border: "1px solid #282828",
                  borderRadius: 8,
                  padding: "12px 14px",
                  fontSize: 12.5,
                }}
              >
                <div style={{ marginBottom: 4 }}>
                  <span style={{ color: "#737373" }}>Usuário:</span>{" "}
                  <strong style={{ color: "#ffffff" }}>{createdPinResult.userName}</strong>
                </div>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ color: "#737373" }}>E-mail:</span>{" "}
                  <strong style={{ color: "#ffffff" }}>{createdPinResult.userEmail}</strong>
                </div>
                <div>
                  <span style={{ color: "#737373" }}>Telefone:</span>{" "}
                  <strong style={{ color: "#ffffff" }}>{createdPinResult.userPhone}</strong>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setSuccessModalOpen(false)}
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR DESBLOQUEIO OU REMOÇÃO */}
      {confirmModal.open && confirmModal.user && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalDialog} style={{ maxWidth: 420 }}>
            <div className={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <AlertTriangle
                  size={20}
                  style={{ color: confirmModal.action === "remove" ? "#f87171" : "#fbbf24" }}
                />
                <h3>
                  {confirmModal.action === "unlock"
                    ? "Desbloquear PIN do Usuário"
                    : "Remover Credencial de PIN"}
                </h3>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setConfirmModal({ open: false, action: "unlock", user: null })}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <p style={{ fontSize: 13, color: "#d4d4d4", margin: 0 }}>
                {confirmModal.action === "unlock" ? (
                  <>
                    Deseja zerar as tentativas falhas e liberar imediatamente o acesso por PIN para{" "}
                    <strong style={{ color: "#ffffff" }}>{confirmModal.user.name}</strong>?
                  </>
                ) : (
                  <>
                    Tem certeza que deseja remover o PIN de{" "}
                    <strong style={{ color: "#ffffff" }}>{confirmModal.user.name}</strong>? O usuário precisará criar um novo PIN para entrar.
                  </>
                )}
              </p>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setConfirmModal({ open: false, action: "unlock", user: null })}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={confirmModal.action === "remove" ? styles.btnDanger : styles.btnPrimary}
                disabled={submitting}
                onClick={() => void handleConfirmAction()}
              >
                {submitting ? "Processando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
