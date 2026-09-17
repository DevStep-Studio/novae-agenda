"use client";

import type { ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useStore } from "@/store/store";

export function ConfirmModal({
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}: {
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <div>
            <h2>
              {danger && <AlertTriangle size={20} className="modal-title-icon" />}
              <span>{title}</span>
            </h2>
          </div>
          <button className="icon-button" aria-label="Fechar" title="Fechar" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        <div className="modal-body" style={{ padding: "0 24px 20px" }}>
          <div style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>{description}</div>
        </div>
        <div className="modal-footer">
          <button type="button" className="button button-secondary" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          <button type="button" className={`button button-${danger ? "danger" : "primary"}`} onClick={onConfirm} disabled={busy}>
            {busy ? "Aguarde..." : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

/** Reads the pending confirm() request from the store and renders it, if any. Mount once per shell. */
export function ConfirmModalHost() {
  const { confirmRequest } = useStore();
  if (!confirmRequest) return null;
  return (
    <ConfirmModal
      title={confirmRequest.title}
      description={confirmRequest.description}
      confirmLabel={confirmRequest.confirmLabel}
      cancelLabel={confirmRequest.cancelLabel}
      danger={confirmRequest.danger}
      onConfirm={() => confirmRequest.resolve(true)}
      onClose={() => confirmRequest.resolve(false)}
    />
  );
}
