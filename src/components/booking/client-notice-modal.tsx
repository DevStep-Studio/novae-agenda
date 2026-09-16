"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  CalendarX2,
  CalendarClock,
  Clock,
  Calendar,
  User,
  Scissors,
  Building2,
  CheckCircle2,
  ArrowRight,
  MessageSquare,
  X,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { formatPhoneForWhatsApp } from "@/lib/api-client";
import type { ClientNoticeDTO } from "@/shared/types";

function shortDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return dateStr;
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
  } catch {
    return dateStr;
  }
}

export function ClientNoticeModal() {
  const [notices, setNotices] = useState<ClientNoticeDTO[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissing, setDismissing] = useState(false);

  const fetchNotices = useCallback(async () => {
    try {
      const res = await fetch("/api/my/notices", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      if (json?.data && Array.isArray(json.data) && json.data.length > 0) {
        setNotices(json.data);
        setCurrentIndex(0);
      }
    } catch {
      // resilient background fetch
    }
  }, []);

  useEffect(() => {
    void fetchNotices();
    const interval = setInterval(() => {
      void fetchNotices();
    }, 45000);
    return () => clearInterval(interval);
  }, [fetchNotices]);

  if (notices.length === 0) return null;

  const currentNotice = notices[currentIndex];
  if (!currentNotice) return null;

  const isCancelled = currentNotice.actionType === "cancelled";

  const handleDismiss = async (all = false) => {
    setDismissing(true);
    try {
      if (all || notices.length <= 1) {
        await fetch("/api/my/notices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: currentNotice.id, all }),
        });
        setNotices([]);
      } else {
        await fetch("/api/my/notices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: currentNotice.id }),
        });
        const remaining = notices.filter((_, idx) => idx !== currentIndex);
        setNotices(remaining);
        setCurrentIndex(0);
      }
    } catch {
      setNotices([]);
    } finally {
      setDismissing(false);
    }
  };

  const whatsappMessage = isCancelled
    ? `Olá! Vi o aviso de cancelamento do meu agendamento de ${currentNotice.serviceName} no ${currentNotice.companyName}. Gostaria de mais informações.`
    : `Olá! Recebi a alteração do horário do meu agendamento de ${currentNotice.serviceName} no ${currentNotice.companyName} para ${shortDate(currentNotice.newDate)} às ${currentNotice.newStartTime}. Gostaria de confirmar.`;

  const whatsappUrl = currentNotice.companyPhone
    ? `https://wa.me/${formatPhoneForWhatsApp(currentNotice.companyPhone)}?text=${encodeURIComponent(whatsappMessage)}`
    : null;

  return (
    <div
      className="client-notice-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-notice-title"
    >
      <div className="client-notice-backdrop" onClick={() => handleDismiss(false)} />
      <div className={`client-notice-card ${isCancelled ? "is-cancelled" : "is-rescheduled"}`}>
        <button
          type="button"
          className="client-notice-close-btn"
          onClick={() => handleDismiss(false)}
          title="Fechar aviso"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>

        {/* Top Header Badge */}
        <div className="client-notice-header">
          <div className={`client-notice-icon-badge ${isCancelled ? "badge-cancelled" : "badge-rescheduled"}`}>
            {isCancelled ? <CalendarX2 size={28} /> : <CalendarClock size={28} />}
          </div>
          <div className="client-notice-header-text">
            <span className="client-notice-eyebrow">
              {currentNotice.companyName}
              {notices.length > 1 && ` · Aviso ${currentIndex + 1} de ${notices.length}`}
            </span>
            <h2 id="client-notice-title" className="client-notice-title">
              {isCancelled
                ? "Atendimento cancelado pelo estabelecimento"
                : "Seu horário foi alterado pelo estabelecimento"}
            </h2>
          </div>
        </div>

        {/* Notice Body Details */}
        <div className="client-notice-content">
          <div className="client-notice-meta-grid">
            <div className="notice-meta-item">
              <span className="notice-meta-label">
                <Scissors size={13} /> Serviço
              </span>
              <strong className="notice-meta-value">{currentNotice.serviceName}</strong>
            </div>

            {currentNotice.employeeName && (
              <div className="notice-meta-item">
                <span className="notice-meta-label">
                  <User size={13} /> Profissional
                </span>
                <strong className="notice-meta-value">{currentNotice.employeeName}</strong>
              </div>
            )}
          </div>

          {/* Schedule Comparison Box */}
          <div className="client-notice-schedule-box">
            {isCancelled ? (
              <div className="schedule-cancelled-item">
                <div className="schedule-box-header">
                  <Calendar size={14} />
                  <span>Data e horário cancelados:</span>
                </div>
                <div className="schedule-cancelled-datetime">
                  <strong>{shortDate(currentNotice.date || currentNotice.oldDate)}</strong>
                  <span>às {currentNotice.startTime || currentNotice.oldStartTime}</span>
                </div>
              </div>
            ) : (
              <div className="schedule-rescheduled-comparison">
                <div className="schedule-slot-col old-slot">
                  <span className="slot-col-tag">Horário anterior</span>
                  <strong className="slot-date">{shortDate(currentNotice.oldDate)}</strong>
                  <span className="slot-time">{currentNotice.oldStartTime}</span>
                </div>

                <div className="schedule-comparison-arrow">
                  <ArrowRight size={20} />
                </div>

                <div className="schedule-slot-col new-slot">
                  <span className="slot-col-tag slot-col-tag-highlight">Novo horário</span>
                  <strong className="slot-date">{shortDate(currentNotice.newDate)}</strong>
                  <span className="slot-time">{currentNotice.newStartTime}</span>
                </div>
              </div>
            )}
          </div>

          {/* Optional Owner Reason */}
          {currentNotice.reason && (
            <div className="client-notice-reason-card">
              <div className="reason-header">
                <MessageSquare size={14} />
                <span>Mensagem do estabelecimento:</span>
              </div>
              <p className="reason-text">&ldquo;{currentNotice.reason}&rdquo;</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="client-notice-actions">
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="client-notice-wa-btn"
            >
              <WhatsAppIcon size={16} />
              <span>Falar no WhatsApp</span>
            </a>
          )}
          <button
            type="button"
            className="client-notice-confirm-btn"
            onClick={() => handleDismiss(false)}
            disabled={dismissing}
          >
            <CheckCircle2 size={16} />
            <span>{dismissing ? "Atualizando..." : "Entendi / Fechar"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
