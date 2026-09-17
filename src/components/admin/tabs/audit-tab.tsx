"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FileText,
  Search,
  Eye,
  X,
  Clock,
  Shield,
  Filter,
} from "lucide-react";
import styles from "../admin-dashboard.module.css";

export function AuditTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Selected Log for inspection
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      if (search) params.set("search", search);
      if (actionFilter) params.set("action", actionFilter);

      const res = await fetch(`/api/superadmin/audit-logs?${params.toString()}`);
      const json = await res.json();
      if (json.data) {
        setLogs(json.data);
        setTotalPages(json.pagination.totalPages || 1);
        setTotalCount(json.pagination.total || 0);
      }
    } catch (err) {
      console.error("Error loading audit logs:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, actionFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadLogs();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadLogs]);

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
            placeholder="Buscar por e-mail, motivo ou alvo..."
            className={styles.searchInput}
            style={{ width: 300 }}
          />

          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className={styles.filterSelect}
          >
            <option value="">Todas as Ações</option>
            <option value="OWNER_CREATE">OWNER_CREATE</option>
            <option value="OWNER_UPDATE">OWNER_UPDATE</option>
            <option value="OWNER_SOFT_DELETE">OWNER_SOFT_DELETE</option>
            <option value="OWNER_HARD_DELETE">OWNER_HARD_DELETE</option>
            <option value="SUBSCRIPTION_GRANT">SUBSCRIPTION_GRANT</option>
            <option value="SUBSCRIPTION_REVOKE">SUBSCRIPTION_REVOKE</option>
            <option value="EMPLOYEE_DELETE">EMPLOYEE_DELETE</option>
            <option value="CLIENT_UPDATE">CLIENT_UPDATE</option>
            <option value="CLIENT_SOFT_DELETE">CLIENT_SOFT_DELETE</option>
            <option value="COUPON_CREATE">COUPON_CREATE</option>
            <option value="OWNER_IMPERSONATE">OWNER_IMPERSONATE</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>Data / Hora</th>
              <th>Administrador</th>
              <th>Ação</th>
              <th>Entidade / Alvo</th>
              <th>Motivo Registrado</th>
              <th style={{ textAlign: "right" }}>Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                  {new Date(log.createdAt).toLocaleString("pt-BR")}
                </td>
                <td style={{ fontWeight: 600 }}>{log.adminEmail}</td>
                <td>
                  <span className={`${styles.statusPill} ${styles.statusTrial}`}>
                    {log.action}
                  </span>
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{log.entityName || "—"}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{log.entity}</div>
                </td>
                <td style={{ fontSize: 12, maxWidth: 300 }}>
                  {log.reason || "—"}
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    title="Inspecionar Diferenças (Antes / Depois)"
                    onClick={() => setSelectedLog(log)}
                  >
                    <Eye size={15} />
                  </button>
                </td>
              </tr>
            ))}
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 36, color: "var(--text-secondary)" }}>
                  Nenhum registro de auditoria encontrado.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 36, color: "var(--text-secondary)" }}>
                  Carregando trilha de auditoria...
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className={styles.pagination}>
          <span>
            Mostrando {logs.length} de {totalCount} registros de auditoria
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

      {/* Log Inspection Modal */}
      {selectedLog && (
        <div className={styles.modalBackdrop}>
          <div className={`${styles.modalDialog} ${styles.modalLarge}`}>
            <div className={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Shield size={18} color="#818cf8" />
                <h2>Auditoria: {selectedLog.action} em {selectedLog.entityName || selectedLog.entity}</h2>
              </div>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setSelectedLog(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13, background: "rgba(255,255,255,0.03)", padding: 14, borderRadius: 8 }}>
                <div>
                  <span style={{ color: "var(--text-secondary)" }}>Admin:</span> <strong>{selectedLog.adminEmail}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-secondary)" }}>Data:</span> <strong>{new Date(selectedLog.createdAt).toLocaleString("pt-BR")}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-secondary)" }}>Entidade ID:</span> <code>{selectedLog.entityId || "N/A"}</code>
                </div>
                <div>
                  <span style={{ color: "var(--text-secondary)" }}>Endereço IP:</span> <code>{selectedLog.ipAddress || "Interno"}</code>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Motivo Registrado:</span>
                  <div style={{ marginTop: 4, fontStyle: "italic" }}>{selectedLog.reason || "Sem motivo informado."}</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#f87171", marginBottom: 6 }}>
                    Estado Anterior (Antes)
                  </div>
                  <pre className={styles.codeBox}>
                    {JSON.stringify(selectedLog.beforeState, null, 2) || "null"}
                  </pre>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981", marginBottom: 6 }}>
                    Estado Posterior (Depois)
                  </div>
                  <pre className={styles.codeBox}>
                    {JSON.stringify(selectedLog.afterState, null, 2) || "null"}
                  </pre>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setSelectedLog(null)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
