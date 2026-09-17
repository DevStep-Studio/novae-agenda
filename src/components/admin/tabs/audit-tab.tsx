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
      if (search.trim()) params.set("search", search.trim());
      if (actionFilter) params.set("action", actionFilter);

      const res = await fetch(`/api/superadmin/audit-logs?${params.toString()}`);
      const json = await res.json();
      if (json.data) {
        setLogs(json.data);
        setTotalPages(json.pagination?.totalPages || 1);
        setTotalCount(json.pagination?.total || 0);
      }
    } catch (err) {
      console.error("Erro ao carregar logs de auditoria:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, actionFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadLogs();
    }, 250);
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
            style={{ width: 320 }}
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
            <option value="CREATE_OWNER_MANUAL">CREATE_OWNER_MANUAL</option>
            <option value="UPDATE_OWNER">UPDATE_OWNER</option>
            <option value="SUSPEND_COMPANY">SUSPEND_COMPANY</option>
            <option value="REACTIVATE_COMPANY">REACTIVATE_COMPANY</option>
            <option value="SOFT_DELETE_OWNER">SOFT_DELETE_OWNER</option>
            <option value="HARD_DELETE_OWNER">HARD_DELETE_OWNER</option>
            <option value="GRANT_SUBSCRIPTION_MANUAL">GRANT_SUBSCRIPTION_MANUAL</option>
            <option value="REVOKE_SUBSCRIPTION_IMMEDIATELY">REVOKE_SUBSCRIPTION_IMMEDIATELY</option>
            <option value="IMPERSONATE_OWNER">IMPERSONATE_OWNER</option>
            <option value="DELETE_EMPLOYEE">DELETE_EMPLOYEE</option>
            <option value="SOFT_DELETE_CLIENT">SOFT_DELETE_CLIENT</option>
          </select>
        </div>
      </div>

      {/* Table Desktop */}
      <div className={styles.tableWrapper}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>Data e Hora</th>
              <th>Administrador</th>
              <th>Ação</th>
              <th>Entidade Afetada</th>
              <th>Motivo / Justificativa</th>
              <th style={{ textAlign: "right" }}>Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>
                  <div style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <Clock size={13} color="#dcff4c" />
                    <span>{new Date(log.createdAt).toLocaleString("pt-BR")}</span>
                  </div>
                </td>
                <td>
                  <div style={{ fontWeight: 600, color: "#ffffff" }}>{log.adminEmail}</div>
                </td>
                <td>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: "#1c1e24",
                      color: "#dcff4c",
                      fontFamily: "monospace",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {log.action}
                  </span>
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{log.entityName || "—"}</div>
                  <div style={{ fontSize: 11, color: "#a3a3a3", textTransform: "capitalize" }}>
                    Tipo: {log.entity}
                  </div>
                </td>
                <td>
                  <div style={{ fontSize: 12, color: "#f5f5f5", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {log.reason || "—"}
                  </div>
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    title="Inspecionar Carga do Evento"
                    onClick={() => setSelectedLog(log)}
                  >
                    <Eye size={15} />
                  </button>
                </td>
              </tr>
            ))}
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 36, color: "#a3a3a3" }}>
                  Nenhum registro de auditoria encontrado.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 36, color: "#a3a3a3" }}>
                  Carregando registros de auditoria do MySQL...
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className={styles.pagination}>
          <span>
            Mostrando {logs.length} de {totalCount} eventos auditados
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
        {logs.map((log) => (
          <div key={log.id} className={styles.mobileCard}>
            <div className={styles.mobileCardHeader}>
              <div>
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: "#1c1e24",
                    color: "#dcff4c",
                    fontFamily: "monospace",
                    fontSize: 11,
                    fontWeight: 700,
                    marginBottom: 4,
                  }}
                >
                  {log.action}
                </span>
                <div style={{ fontWeight: 600, color: "#ffffff", fontSize: 13 }}>
                  {log.entityName || log.entity}
                </div>
              </div>
              <span style={{ fontSize: 11, color: "#737373" }}>
                {new Date(log.createdAt).toLocaleDateString("pt-BR")}
              </span>
            </div>

            <div className={styles.mobileCardBody}>
              <div>
                <span style={{ color: "#737373" }}>Autor:</span> {log.adminEmail}
              </div>
              <div>
                <span style={{ color: "#737373" }}>Motivo:</span> {log.reason || "—"}
              </div>
            </div>

            <div className={styles.mobileCardActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                style={{ width: "100%", justifyContent: "center" }}
                onClick={() => setSelectedLog(log)}
              >
                <Eye size={14} /> Inspecionar Evento
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Inspeção de Evento */}
      {selectedLog && (
        <div className={styles.modalBackdrop}>
          <div className={`${styles.modalDialog} ${styles.modalLarge}`}>
            <div className={styles.modalHeader}>
              <h2>Detalhes do Evento de Auditoria</h2>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setSelectedLog(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGrid}>
                <div>
                  <span style={{ color: "#737373", fontSize: 12 }}>Ação:</span>
                  <div style={{ fontWeight: 700, color: "#dcff4c", fontFamily: "monospace" }}>
                    {selectedLog.action}
                  </div>
                </div>
                <div>
                  <span style={{ color: "#737373", fontSize: 12 }}>Data e Hora:</span>
                  <div>{new Date(selectedLog.createdAt).toLocaleString("pt-BR")}</div>
                </div>
                <div>
                  <span style={{ color: "#737373", fontSize: 12 }}>Administrador:</span>
                  <div>{selectedLog.adminEmail}</div>
                </div>
                <div>
                  <span style={{ color: "#737373", fontSize: 12 }}>Entidade Afetada:</span>
                  <div>{selectedLog.entityName} ({selectedLog.entity})</div>
                </div>
              </div>

              {selectedLog.reason && (
                <div style={{ background: "#171717", padding: 12, borderRadius: 8, border: "1px solid #262626" }}>
                  <span style={{ color: "#a3a3a3", fontSize: 12, fontWeight: 700 }}>Motivo Registrado:</span>
                  <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#f5f5f5" }}>
                    {selectedLog.reason}
                  </p>
                </div>
              )}

              {selectedLog.afterState && (
                <div>
                  <span style={{ color: "#a3a3a3", fontSize: 12, fontWeight: 700 }}>
                    Estado Posterior (Payload Auditado):
                  </span>
                  <div className={styles.codeBox} style={{ marginTop: 6 }}>
                    <pre style={{ margin: 0 }}>
                      {JSON.stringify(selectedLog.afterState, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {selectedLog.beforeState && (
                <div>
                  <span style={{ color: "#a3a3a3", fontSize: 12, fontWeight: 700 }}>
                    Estado Anterior:
                  </span>
                  <div className={styles.codeBox} style={{ marginTop: 6 }}>
                    <pre style={{ margin: 0 }}>
                      {JSON.stringify(selectedLog.beforeState, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
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
