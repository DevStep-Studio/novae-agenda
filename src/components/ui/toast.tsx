"use client";

import { CheckCircle, X, XCircle } from "lucide-react";
import type { Toast } from "@/store/store";

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.tone === "error" ? "toast-error" : ""}`}>
          {toast.tone === "error" ? <XCircle size={17} /> : <CheckCircle size={17} />}
          <span>{toast.message}</span>
          <button onClick={() => onDismiss(toast.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
