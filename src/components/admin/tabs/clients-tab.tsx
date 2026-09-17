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
} from "lucide-react";
import styles from "../admin-dashboard.module.css";

export function ClientsTab() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Edit Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
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
  const [confirmationName, setConfirmationName] = useState("");

  const loadClients = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
      });
      if (search) params.set("search", search);

      const res = await fetch(`/api/superadmin/clients?${params.toString()}`);
      const json = await res.json();
      if (json.data) {
        setClients(json.data);
        setTotalPages(json.pagination.totalPages || 1);
        setTotalCount(json.pagination.total || 0);
      }
    } catch (err) {
      console.error("Error loading clients:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadClients();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadClients]);

  const handleOpenEdit = (client: any) => {
    setSelectedClient(client);
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
    if (!selectedClient) return;

    try {
      const res = await fetch(`/api/superadmin/clients/${selectedClient.id}`, {
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
      void loadClients();
    } catch (err: any) {
      alert("Erro ao atualizar: " + err.message);
    }
  };

  const handleExecuteDelete = async () => {
    if (!clientToDelete) return;
    if (deleteMode === "hard" && confirmationName.trim() !== clientToDelete.name.trim()) {
      alert(`Para exclusão definitiva, digite exatamente o nome "${clientToDelete.name}".`);
      return;
    }

    try {
      const params = deleteMode === "hard" ? `?hard=true&confirmationName=${encodeURIComponent(confirmationName)}` : "";
      const res = await fetch(`/api/superadmin/clients/${clientToDelete.id}${params}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Erro ao excluir cliente.");
        return;
      }
      alert(`Cliente ${deleteMode === "hard" ? "excluído permanentemente" : "desativado (soft delete)"} com sucesso!`);
      setDeleteModalOpen(false);
      setClientToDelete(null);
      setConfirmationName("");
      void loadClients();
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
            placeholder="Buscar por nome, email, telefone, documento ou empresa..."
            className={styles.searchInput}
            style={{ width: 360 }}
          />
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Contato & E-mail</th>
              <th>Documento</th>
              <th>Empresa Proprietária</th>
              <th>Status</th>
              <th>Cadastrado em</th>
              <th style={{ textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((cli) => (
              <tr key={cli.id}>
                <td style={{ fontWeight: 600 }}>{cli.name}</td>
                <td>
                  <div>{cli.email || "—"}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {cli.phone || "—"}
                  </div>
                </td>
                <td style={{ fontFamily: "monospace", fontSize: 12 }}>
                  {cli.document || "—"}
                </td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Building2 size={13} color="#818cf8" />
                    <span>{cli.companyName || "N/A"}</span>
                  </div>
                </td>
                <td>
                  {cli.deletedAt ? (
                    <span className={`${styles.statusPill} ${styles.statusDeleted}`}>
                      Excluído (Soft)
                    </span>
                  ) : (
                    <span className={`${styles.statusPill} ${styles.statusActive}`}>
                      Ativo
                    </span>
                  )}
                </td>
                <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {new Date(cli.createdAt).toLocaleDateString("pt-BR")}
                </td>
                <td style={{ textAlign: "right" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <button
                      type="button"
                      className={styles.btnGhost}
                      title="Editar Dados Cadastrais"
                      onClick={() => handleOpenEdit(cli)}
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      type="button"
                      className={styles.btnGhost}
                      style={{ color: "#f87171" }}
                      title="Excluir Cliente"
                      onClick={() => {
                        setClientToDelete(cli);
                        setDeleteMode("soft");
                        setConfirmationName("");
                        setDeleteModalOpen(true);
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && clients.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 36, color: "var(--text-secondary)" }}>
                  Nenhum cliente encontrado.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 36, color: "var(--text-secondary)" }}>
                  Carregando lista de clientes...
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className={styles.pagination}>
          <span>
            Mostrando {clients.length} de {totalCount} clientes
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

      {/* Edit Client Modal */}
      {editModalOpen && selectedClient && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalDialog}>
            <div className={styles.modalHeader}>
              <h2>Editar Cliente: {selectedClient.name}</h2>
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
                    <label className={styles.label}>Nome Completo *</label>
                    <input
                      type="text"
                      required
                      className={styles.input}
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>CPF / Documento</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={editForm.document}
                      onChange={(e) => setEditForm({ ...editForm, document: e.target.value })}
                    />
                  </div>
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
                    <label className={styles.label}>Telefone / WhatsApp</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroupFull}>
                    <label className={styles.label}>Notas / Observações</label>
                    <textarea
                      className={styles.textarea}
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
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

      {/* Delete Client Modal */}
      {deleteModalOpen && clientToDelete && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalDialog}>
            <div className={styles.modalHeader}>
              <h2 style={{ color: "#f87171" }}>Excluir Cliente: {clientToDelete.name}</h2>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setDeleteModalOpen(false)}
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
                  <p style={{ color: "var(--text-secondary)" }}>
                    O cliente será marcado como excluído (`deleted_at`). O histórico de agendamentos passados será preservado para relatórios fiscais do proprietário.
                  </p>
                </div>
              ) : (
                <div style={{ background: "rgba(239, 68, 68, 0.08)", padding: 16, borderRadius: 8, fontSize: 13 }}>
                  <p style={{ color: "var(--text-secondary)", marginBottom: 12 }}>
                    O registro do cliente será fisicamente removido do banco. Digite o nome do cliente para confirmar:
                  </p>
                  <input
                    type="text"
                    className={styles.input}
                    style={{ borderColor: "#f87171" }}
                    placeholder={clientToDelete.name}
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
                onClick={() => setDeleteModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={deleteMode === "hard" ? styles.btnDanger : styles.btnPrimary}
                onClick={handleExecuteDelete}
                disabled={deleteMode === "hard" && confirmationName.trim() !== clientToDelete.name.trim()}
              >
                {deleteMode === "hard" ? "Excluir Definitivamente" : "Desativar Cliente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
