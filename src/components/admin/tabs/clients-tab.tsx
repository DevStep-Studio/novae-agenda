"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users,
  Search,
  Edit2,
  Trash2,
  X,
  Building2,
  AlertTriangle,
  Eye,
  Calendar,
  Phone,
  Mail,
  FileText,
} from "lucide-react";
import styles from "../admin-dashboard.module.css";

export function ClientsTab() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Client Details Modal
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);

  // Edit Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    document: "",
    notes: "",
  });

  // Delete Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<any | null>(null);
  const [deleteMode, setDeleteMode] = useState<"soft" | "hard">("soft");

  // Bulk selection state
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkDeleteMode, setBulkDeleteMode] = useState<"soft" | "hard">("soft");
  const [bulkDeleteReason, setBulkDeleteReason] = useState("Exclusão em massa via Super Admin");
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const loadClients = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
      });
      if (search.trim()) {
        params.set("q", search.trim());
      }

      const res = await fetch(`/api/superadmin/clients?${params.toString()}`);
      const json = await res.json();
      if (json.data || json.items) {
        setClients(json.data || json.items);
        setTotalPages(json.pagination?.totalPages || 1);
        setTotalCount(json.pagination?.total || 0);
      }
    } catch (err) {
      console.error("Erro ao carregar clientes:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadClients();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadClients]);

  const handleOpenDetails = (client: any) => {
    setSelectedClient(client);
    setDetailsModalOpen(true);
  };

  const handleOpenEdit = (client: any) => {
    setClientToEdit(client);
    setEditForm({
      name: client.name || "",
      email: client.email || "",
      phone: client.phone || "",
      document: client.document || "",
      notes: client.notes || "",
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientToEdit) return;

    try {
      const res = await fetch(`/api/superadmin/clients/${clientToEdit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Erro ao salvar cliente.");
        return;
      }
      alert("Cliente atualizado com sucesso!");
      setEditModalOpen(false);
      setClientToEdit(null);
      void loadClients();
    } catch (err: any) {
      alert("Erro ao atualizar: " + err.message);
    }
  };

  const handleExecuteDelete = async () => {
    if (!clientToDelete) return;

    try {
      const params = deleteMode === "hard" ? "?hard=true" : "";
      const res = await fetch(`/api/superadmin/clients/${clientToDelete.id}${params}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Erro ao excluir cliente.");
        return;
      }
      alert(
        `Cliente ${deleteMode === "hard" ? "excluído permanentemente" : "desativado (soft delete)"} com sucesso!`
      );
      setDeleteModalOpen(false);
      setClientToDelete(null);
      void loadClients();
    } catch (err: any) {
      alert("Erro ao excluir: " + err.message);
    }
  };

  // Bulk Select Handlers
  const handleToggleSelectAll = () => {
    if (clients.length === 0) return;
    const allIds = clients.map((c) => c.id);
    const allSelected = allIds.every((id) => selectedClientIds.includes(id));
    if (allSelected) {
      setSelectedClientIds((prev) => prev.filter((id) => !allIds.includes(id)));
    } else {
      setSelectedClientIds((prev) => Array.from(new Set([...prev, ...allIds])));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedClientIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleExecuteBulkDelete = async () => {
    if (selectedClientIds.length === 0) return;
    setBulkDeleting(true);
    try {
      const res = await fetch("/api/superadmin/clients", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedClientIds,
          mode: bulkDeleteMode,
          reason: bulkDeleteReason || "Exclusão em massa via Super Admin",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Erro ao excluir clientes selecionados.");
        return;
      }
      alert(json.message || `${selectedClientIds.length} cliente(s) processado(s) com sucesso!`);
      setSelectedClientIds([]);
      setBulkDeleteModalOpen(false);
      void loadClients();
    } catch (err: any) {
      alert("Erro ao excluir em massa: " + err.message);
    } finally {
      setBulkDeleting(false);
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
            placeholder="Buscar por nome, telefone, e-mail, empresa..."
            className={styles.searchInput}
            style={{ width: 340 }}
          />
        </div>
      </div>

      {/* Table Desktop */}
      <div className={styles.tableWrapper}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th style={{ width: 44, textAlign: "center" }}>
                <input
                  type="checkbox"
                  className={styles.tableCheckbox}
                  checked={clients.length > 0 && clients.every((c) => selectedClientIds.includes(c.id))}
                  onChange={handleToggleSelectAll}
                  aria-label="Selecionar todos os clientes da página"
                />
              </th>
              <th>Cliente</th>
              <th>Contato & E-mail</th>
              <th>Empresa Vinculada</th>
              <th>Agendamentos</th>
              <th>Último Atendimento</th>
              <th>Status</th>
              <th>Cadastro</th>
              <th style={{ textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => {
              const isSelected = selectedClientIds.includes(client.id);
              return (
                <tr key={client.id} className={isSelected ? styles.rowSelected : ""}>
                  <td style={{ width: 44, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      className={styles.tableCheckbox}
                      checked={isSelected}
                      onChange={() => handleToggleSelectOne(client.id)}
                      aria-label={`Selecionar cliente ${client.name}`}
                    />
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: "#ffffff" }}>{client.name}</div>
                    <div style={{ fontSize: 11, color: "#a3a3a3", fontFamily: "monospace" }}>
                      {client.document ? `DOC: ${client.document}` : "Sem documento"}
                    </div>
                  </td>
                  <td>
                    <div>{client.phone || "Sem telefone"}</div>
                    <div style={{ fontSize: 12, color: "#a3a3a3" }}>{client.email || "—"}</div>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#f5f5f5" }}>
                      <Building2 size={13} color="#dcff4c" />
                      <span>{client.companyName || "Empresa vinculada"}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {client.totalBookings ?? 0} agendamentos
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: 12, color: "#a3a3a3" }}>
                      {client.lastBookingAt
                        ? new Date(client.lastBookingAt).toLocaleDateString("pt-BR")
                        : "Nenhum histórico"}
                    </div>
                  </td>
                  <td>
                    {client.deletedAt ? (
                      <span className={`${styles.statusPill} ${styles.statusDeleted}`}>
                        Inativo
                      </span>
                    ) : client.active !== false ? (
                      <span className={`${styles.statusPill} ${styles.statusActive}`}>
                        Ativo
                      </span>
                    ) : (
                      <span className={`${styles.statusPill} ${styles.statusCancelled}`}>
                        Suspenso
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: "#a3a3a3" }}>
                    {new Date(client.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <button
                        type="button"
                        className={styles.btnGhost}
                        title="Ver Detalhes do Cliente"
                        onClick={() => handleOpenDetails(client)}
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        type="button"
                        className={styles.btnGhost}
                        title="Editar Cliente"
                        onClick={() => handleOpenEdit(client)}
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        type="button"
                        className={styles.btnGhost}
                        style={{ color: "#f87171" }}
                        title="Excluir Cliente"
                        onClick={() => {
                          setClientToDelete(client);
                          setDeleteMode("soft");
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
            {!loading && clients.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: 36, color: "#a3a3a3" }}>
                  Nenhum cliente encontrado para os filtros selecionados.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: 36, color: "#a3a3a3" }}>
                  Carregando lista de clientes do MySQL...
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className={styles.pagination}>
          <span>
            Mostrando {clients.length} de {totalCount} clientes cadastrados
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

      {/* Mobile Cards List */}
      <div className={styles.mobileCardsList}>
        {clients.map((client) => {
          const isSelected = selectedClientIds.includes(client.id);
          return (
            <div
              key={client.id}
              className={`${styles.mobileCard} ${isSelected ? styles.rowSelected : ""}`}
            >
              <div className={styles.mobileCardHeader}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    className={styles.tableCheckbox}
                    checked={isSelected}
                    onChange={() => handleToggleSelectOne(client.id)}
                    aria-label={`Selecionar cliente ${client.name}`}
                  />
                  <div>
                    <div style={{ fontWeight: 700, color: "#ffffff", fontSize: 14 }}>
                      {client.name}
                    </div>
                    <div style={{ fontSize: 12, color: "#a3a3a3" }}>
                      {client.companyName}
                    </div>
                  </div>
                </div>
                <span className={`${styles.statusPill} ${client.active ? styles.statusActive : styles.statusDeleted}`}>
                  {client.active ? "Ativo" : "Inativo"}
                </span>
              </div>

              <div className={styles.mobileCardBody}>
                <div>
                  <span style={{ color: "#737373" }}>Telefone:</span> {client.phone || "—"}
                </div>
                <div>
                  <span style={{ color: "#737373" }}>E-mail:</span> {client.email || "—"}
                </div>
                <div>
                  <span style={{ color: "#737373" }}>Agendamentos:</span>{" "}
                  <strong style={{ color: "#ffffff" }}>{client.totalBookings ?? 0}</strong>
                </div>
                <div>
                  <span style={{ color: "#737373" }}>Cadastro:</span>{" "}
                  {new Date(client.createdAt).toLocaleDateString("pt-BR")}
                </div>
              </div>

              <div className={styles.mobileCardActions}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => handleOpenDetails(client)}
                >
                  <Eye size={14} /> Detalhes
                </button>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => handleOpenEdit(client)}
                >
                  <Edit2 size={14} /> Editar
                </button>
                <button
                  type="button"
                  className={styles.btnGhost}
                  style={{ color: "#f87171" }}
                  onClick={() => {
                    setClientToDelete(client);
                    setDeleteMode("soft");
                    setDeleteModalOpen(true);
                  }}
                >
                  <Trash2 size={14} /> Excluir
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedClientIds.length > 0 && (
        <div className={styles.bulkActionBar}>
          <div className={styles.bulkActionInfo}>
            <span className={styles.bulkActionCount}>{selectedClientIds.length}</span>
            <span>
              {selectedClientIds.length === 1
                ? "cliente selecionado"
                : "clientes selecionados"}
            </span>
          </div>
          <div className={styles.bulkActionBtns}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => setSelectedClientIds([])}
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
              Excluir Selecionados ({selectedClientIds.length})
            </button>
          </div>
        </div>
      )}

      {/* Modal: Detalhes do Cliente */}
      {detailsModalOpen && selectedClient && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalDialog}>
            <div className={styles.modalHeader}>
              <h2>Detalhes do Cliente: {selectedClient.name}</h2>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setDetailsModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.detailSection}>
                <div className={styles.detailSectionTitle}>
                  <span>Dados Cadastrais & Contato</span>
                </div>
                <div className={styles.formGrid}>
                  <div>
                    <span style={{ color: "#737373", fontSize: 12 }}>Nome Completo:</span>
                    <div style={{ fontWeight: 600 }}>{selectedClient.name}</div>
                  </div>
                  <div>
                    <span style={{ color: "#737373", fontSize: 12 }}>Empresa Vinculada:</span>
                    <div style={{ fontWeight: 600, color: "#dcff4c" }}>
                      {selectedClient.companyName || "—"}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: "#737373", fontSize: 12 }}>Telefone:</span>
                    <div>{selectedClient.phone || "Não informado"}</div>
                  </div>
                  <div>
                    <span style={{ color: "#737373", fontSize: 12 }}>E-mail:</span>
                    <div>{selectedClient.email || "Não informado"}</div>
                  </div>
                  <div>
                    <span style={{ color: "#737373", fontSize: 12 }}>Total de Agendamentos:</span>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {selectedClient.totalBookings ?? 0}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: "#737373", fontSize: 12 }}>Último Atendimento:</span>
                    <div>
                      {selectedClient.lastBookingAt
                        ? new Date(selectedClient.lastBookingAt).toLocaleDateString("pt-BR")
                        : "Nenhum atendimento registrado"}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ background: "#111111", padding: 12, borderRadius: 8, border: "1px solid #222222" }}>
                <span style={{ fontSize: 11, color: "#737373" }}>
                  Nota de Segurança: Tokens e credenciais de PIN do cliente são protegidos e nunca
                  são exibidos em tela.
                </span>
              </div>
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

      {/* Modal: Editar Cliente */}
      {editModalOpen && clientToEdit && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalDialog}>
            <div className={styles.modalHeader}>
              <h2>Editar Cliente</h2>
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
                <div className={styles.formGroup}>
                  <label className={styles.label}>Nome Completo *</label>
                  <input
                    type="text"
                    required
                    className={styles.input}
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>E-mail</label>
                    <input
                      type="email"
                      className={styles.input}
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Telefone</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Documento (CPF)</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={editForm.document}
                    onChange={(e) => setEditForm({ ...editForm, document: e.target.value })}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Notas / Observações</label>
                  <textarea
                    rows={2}
                    className={styles.textarea}
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
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
                <button type="submit" className={styles.btnPrimary}>
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Excluir Cliente */}
      {deleteModalOpen && clientToDelete && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalDialog}>
            <div className={styles.modalHeader}>
              <h2 style={{ color: "#f87171", display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={18} />
                Excluir Cliente: {clientToDelete.name}
              </h2>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setDeleteModalOpen(false)}
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
                  <option value="soft">Soft Delete (Desativação lógica)</option>
                  <option value="hard">Hard Delete (Exclusão definitiva)</option>
                </select>
              </div>

              {deleteMode === "hard" && (
                <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "12px 14px", borderRadius: 8 }}>
                  <p style={{ margin: 0, fontSize: 12.5, color: "#fca5a5", lineHeight: 1.4 }}>
                    ⚠️ <strong>Atenção:</strong> A exclusão definitiva removerá permanentemente o cliente <strong>{clientToDelete.name}</strong> e todos os seus registros associados. Esta ação não poderá ser desfeita.
                  </p>
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setDeleteModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.btnDanger}
                onClick={handleExecuteDelete}
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Exclusão em Massa de Clientes */}
      {bulkDeleteModalOpen && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalDialog}>
            <div className={styles.modalHeader}>
              <h2 style={{ color: "#f87171", display: "flex", alignItems: "center", gap: 8 }}>
                <Trash2 size={18} />
                Excluir {selectedClientIds.length} {selectedClientIds.length === 1 ? "Cliente" : "Clientes"}
              </h2>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setBulkDeleteModalOpen(false)}
                disabled={bulkDeleting}
              >
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Tipo de Exclusão</label>
                <select
                  value={bulkDeleteMode}
                  onChange={(e) => setBulkDeleteMode(e.target.value as any)}
                  className={styles.select}
                  disabled={bulkDeleting}
                >
                  <option value="soft">Soft Delete (Desativação lógica)</option>
                  <option value="hard">Hard Delete (Exclusão definitiva no banco)</option>
                </select>
              </div>

              {bulkDeleteMode === "hard" && (
                <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "12px 14px", borderRadius: 8 }}>
                  <p style={{ margin: 0, fontSize: 12.5, color: "#fca5a5", lineHeight: 1.4 }}>
                    ⚠️ <strong>Atenção:</strong> A exclusão definitiva removerá permanentemente os <strong>{selectedClientIds.length}</strong> clientes selecionados. Esta ação não poderá ser desfeita.
                  </p>
                </div>
              )}

              {bulkDeleteMode === "soft" && (
                <div style={{ background: "rgba(234, 179, 8, 0.1)", border: "1px solid rgba(234, 179, 8, 0.3)", padding: "12px 14px", borderRadius: 8 }}>
                  <p style={{ margin: 0, fontSize: 12.5, color: "#fde047", lineHeight: 1.4 }}>
                    Os <strong>{selectedClientIds.length}</strong> clientes serão desativados (soft delete). Seus dados e históricos permanecem preservados.
                  </p>
                </div>
              )}

              <div className={styles.formGroup}>
                <label className={styles.label}>Motivo para Auditoria</label>
                <input
                  type="text"
                  value={bulkDeleteReason}
                  onChange={(e) => setBulkDeleteReason(e.target.value)}
                  className={styles.input}
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
                  ? `Excluir Definitivamente (${selectedClientIds.length})`
                  : `Desativar em Massa (${selectedClientIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
