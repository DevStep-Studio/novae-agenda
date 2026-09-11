"use client";

import React, { useState, useMemo } from "react";
import {
  Bell,
  BellRing,
  CheckCheck,
  Check,
  Calendar,
  CalendarPlus,
  CalendarClock,
  CalendarX,
  CircleDollarSign,
  Clock,
  ExternalLink,
  Info,
  Loader2,
  ShieldCheck,
  Sparkles,
  Star,
  UserCheck,
  Users,
} from "lucide-react";
import { useStore } from "@/store/store";
import type { NotificationDTO } from "@/shared/types";

type CategoryFilter = "all" | "unread" | "agendamentos" | "financeiro" | "sistema";

interface NotificationsViewProps {
  onNavigateToAppointment?: (appointmentId: string) => void;
  onNavigateToAgenda?: () => void;
}

type NotificationMeta = {
  icon: React.ReactNode;
  badgeLabel: string;
  badgeClass: string;
  iconBgClass: string;
};

export function NotificationsView({ onNavigateToAppointment, onNavigateToAgenda }: NotificationsViewProps) {
  const { notifications, reloadNotifications, markNotificationRead, markAllNotificationsRead, notify } = useStore();
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>("all");
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);

  // Counts by category for filter pills
  const counts = useMemo(() => {
    let unread = 0;
    let agendamentos = 0;
    let financeiro = 0;
    let sistema = 0;

    for (const n of notifications) {
      if (!n.readAt) unread++;

      const isBooking =
        n.type.startsWith("booking.") ||
        n.type.startsWith("waitlist.") ||
        n.type.startsWith("customer.") ||
        n.type.startsWith("appointment_") ||
        n.type.startsWith("reminder") ||
        n.entityType === "appointment" ||
        n.entityType === "waitlist";

      const isFin =
        n.type.startsWith("payment.") ||
        n.type.startsWith("financial.") ||
        n.type.startsWith("subscription.") ||
        n.type === "appointment_completed" ||
        n.entityType === "financial" ||
        n.entityType === "subscription";

      if (isBooking) {
        agendamentos++;
      } else if (isFin) {
        financeiro++;
      } else {
        sistema++;
      }
    }

    return { total: notifications.length, unread, agendamentos, financeiro, sistema };
  }, [notifications]);

  // Filter list based on selected tab
  const filteredList = useMemo(() => {
    if (activeFilter === "unread") {
      return notifications.filter((n) => !n.readAt);
    }
    if (activeFilter === "agendamentos") {
      return notifications.filter(
        (n) =>
          n.type.startsWith("booking.") ||
          n.type.startsWith("waitlist.") ||
          n.type.startsWith("customer.") ||
          n.type.startsWith("appointment_") ||
          n.type.startsWith("reminder") ||
          n.entityType === "appointment" ||
          n.entityType === "waitlist"
      );
    }
    if (activeFilter === "financeiro") {
      return notifications.filter(
        (n) =>
          n.type.startsWith("payment.") ||
          n.type.startsWith("financial.") ||
          n.type.startsWith("subscription.") ||
          n.type === "appointment_completed" ||
          n.entityType === "financial" ||
          n.entityType === "subscription"
      );
    }
    if (activeFilter === "sistema") {
      return notifications.filter(
        (n) =>
          n.type.startsWith("system.") ||
          n.type.startsWith("plan.") ||
          n.type.startsWith("review.") ||
          n.entityType === "system" ||
          (!n.type.startsWith("booking.") &&
            !n.type.startsWith("payment.") &&
            !n.type.startsWith("financial.") &&
            !n.type.startsWith("subscription.") &&
            n.entityType !== "appointment" &&
            n.entityType !== "financial")
      );
    }
    return notifications;
  }, [notifications, activeFilter]);

  const handleMarkAllRead = async () => {
    if (counts.unread === 0) return;
    setLoading(true);
    try {
      await markAllNotificationsRead();
      notify("Todas as notificações foram marcadas como lidas!", "success");
    } catch {
      notify("Erro ao marcar notificações como lidas.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSimulate = async (type: string = "reminder_2h") => {
    setSimulating(true);
    try {
      const res = await fetch("/api/notifications/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Falha na simulação de notificação.");
      }

      const label =
        type === "reminder_2h"
          ? "Lembrete de 2h simulado com sucesso!"
          : type === "new_booking"
          ? "Novo agendamento simulado com sucesso!"
          : type === "payment"
          ? "Pagamento simulado com sucesso!"
          : "Notificação simulada com sucesso!";

      notify(label, "success");
      await reloadNotifications();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Erro ao simular notificação", "error");
    } finally {
      setSimulating(false);
    }
  };

  const handleNotificationClick = async (item: NotificationDTO) => {
    if (!item.readAt) {
      await markNotificationRead(item.id);
    }

    if (item.entityType === "appointment" && item.entityId) {
      if (onNavigateToAppointment) {
        onNavigateToAppointment(item.entityId);
      } else if (onNavigateToAgenda) {
        onNavigateToAgenda();
      }
    }
  };

  const handleSingleMarkRead = async (e: React.MouseEvent, item: NotificationDTO) => {
    e.stopPropagation();
    try {
      await markNotificationRead(item.id);
      notify("Notificação marcada como lida.", "success");
    } catch {
      notify("Não foi possível atualizar a notificação.", "error");
    }
  };

  const getNotificationMeta = (item: NotificationDTO): NotificationMeta => {
    const t = item.type.toLowerCase();
    const title = item.title.toLowerCase();
    const entity = item.entityType?.toLowerCase() || "";

    // 1. Reviews / Feedback
    if (t.startsWith("review.") || title.includes("avaliação") || title.includes("estrelas") || title.includes("nota")) {
      return {
        icon: <Star size={17} />,
        badgeLabel: "Avaliação",
        badgeClass: "badge-notif-rating",
        iconBgClass: "icon-notif-rating",
      };
    }

    // 2. Payments & Financial
    if (
      t.startsWith("payment.") ||
      t.startsWith("financial.") ||
      entity === "financial" ||
      title.includes("pagamento") ||
      title.includes("recebimento") ||
      title.includes("pix")
    ) {
      return {
        icon: <CircleDollarSign size={17} />,
        badgeLabel: "Financeiro",
        badgeClass: "badge-notif-payment",
        iconBgClass: "icon-notif-payment",
      };
    }

    // 3. Rescheduled
    if (t === "booking.rescheduled" || title.includes("remarcad") || title.includes("horário")) {
      return {
        icon: <CalendarClock size={17} />,
        badgeLabel: "Remarcação",
        badgeClass: "badge-notif-reschedule",
        iconBgClass: "icon-notif-reschedule",
      };
    }

    // 4. Cancelled
    if (t === "booking.cancelled" || title.includes("cancelad")) {
      return {
        icon: <CalendarX size={17} />,
        badgeLabel: "Cancelamento",
        badgeClass: "badge-notif-cancel",
        iconBgClass: "icon-notif-cancel",
      };
    }

    // 5. Booking Reminder
    if (t.startsWith("reminder") || t === "booking.reminder" || title.includes("lembrete")) {
      return {
        icon: <BellRing size={17} />,
        badgeLabel: "Lembrete",
        badgeClass: "badge-notif-reminder",
        iconBgClass: "icon-notif-reminder",
      };
    }

    // 6. New Booking
    if (t === "booking.created" || t.startsWith("booking.") || entity === "appointment" || title.includes("agendamento")) {
      return {
        icon: <CalendarPlus size={17} />,
        badgeLabel: "Agendamento",
        badgeClass: "badge-notif-booking",
        iconBgClass: "icon-notif-booking",
      };
    }

    // 7. Subscriptions / Pro Plans
    if (t.startsWith("subscription.") || t.startsWith("plan.") || entity === "subscription" || title.includes("assinatura") || title.includes("plano")) {
      return {
        icon: <ShieldCheck size={17} />,
        badgeLabel: "Assinatura",
        badgeClass: "badge-notif-subscription",
        iconBgClass: "icon-notif-subscription",
      };
    }

    // 8. Waitlist
    if (t.startsWith("waitlist.") || entity === "waitlist" || title.includes("espera")) {
      return {
        icon: <Users size={17} />,
        badgeLabel: "Fila de Espera",
        badgeClass: "badge-notif-waitlist",
        iconBgClass: "icon-notif-waitlist",
      };
    }

    // 9. Customer Arrived
    if (t === "customer.arrived" || title.includes("recepção") || title.includes("chegou")) {
      return {
        icon: <UserCheck size={17} />,
        badgeLabel: "Recepção",
        badgeClass: "badge-notif-reception",
        iconBgClass: "icon-notif-reception",
      };
    }

    // 10. Default / System
    return {
      icon: <Info size={17} />,
      badgeLabel: "Sistema",
      badgeClass: "badge-notif-system",
      iconBgClass: "icon-notif-system",
    };
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return "Agora mesmo";
      if (diffMins < 60) return `Há ${diffMins} min`;
      if (diffHours < 24) return `Hoje às ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
      if (diffDays === 1) return `Ontem às ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
      return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="page-content notif-page-container">
      {/* Top Header */}
      <div className="notif-page-header">
        <div className="notif-header-info">
          <div className="notif-title-row">
            <span className="notif-header-icon-wrap">
              <Bell size={18} />
            </span>
            <h1 className="notif-page-title">Central de Notificações</h1>
            {counts.unread > 0 && (
              <span className="notif-header-unread-badge">
                {counts.unread} {counts.unread === 1 ? "nova" : "novas"}
              </span>
            )}
          </div>
          <p className="notif-page-subtitle">
            Histórico completo de eventos, novos agendamentos, clientes e alertas da sua empresa.
          </p>
        </div>

        <div className="notif-header-actions">
          {/* Simulate Action Button */}
          <button
            type="button"
            className="notif-action-btn simulate"
            onClick={() => handleSimulate("reminder_2h")}
            disabled={simulating}
            title="Disparar lembrete automático de teste"
          >
            {simulating ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
            <span>{simulating ? "Simulando..." : "Simular Lembrete 2h (QA)"}</span>
          </button>

          {/* Mark All Read Button */}
          {counts.unread > 0 && (
            <button
              type="button"
              className="notif-action-btn mark-all"
              onClick={handleMarkAllRead}
              disabled={loading}
              title="Marcar todas as notificações como lidas"
            >
              {loading ? <Loader2 size={14} className="spin" /> : <CheckCheck size={15} />}
              <span>Marcar todas como lidas</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="notif-filter-bar">
        <button
          type="button"
          className={`notif-tab-pill ${activeFilter === "all" ? "active" : ""}`}
          onClick={() => setActiveFilter("all")}
        >
          <span>Todas</span>
          <span className="pill-count">{counts.total}</span>
        </button>

        <button
          type="button"
          className={`notif-tab-pill ${activeFilter === "unread" ? "active" : ""}`}
          onClick={() => setActiveFilter("unread")}
        >
          <span>Não lidas</span>
          {counts.unread > 0 && <span className="pill-count highlight">{counts.unread}</span>}
        </button>

        <button
          type="button"
          className={`notif-tab-pill ${activeFilter === "agendamentos" ? "active" : ""}`}
          onClick={() => setActiveFilter("agendamentos")}
        >
          <Calendar size={13} />
          <span>Agendamentos</span>
          {counts.agendamentos > 0 && <span className="pill-count">{counts.agendamentos}</span>}
        </button>

        <button
          type="button"
          className={`notif-tab-pill ${activeFilter === "financeiro" ? "active" : ""}`}
          onClick={() => setActiveFilter("financeiro")}
        >
          <CircleDollarSign size={13} />
          <span>Financeiro</span>
          {counts.financeiro > 0 && <span className="pill-count">{counts.financeiro}</span>}
        </button>

        <button
          type="button"
          className={`notif-tab-pill ${activeFilter === "sistema" ? "active" : ""}`}
          onClick={() => setActiveFilter("sistema")}
        >
          <Info size={13} />
          <span>Sistema</span>
          {counts.sistema > 0 && <span className="pill-count">{counts.sistema}</span>}
        </button>
      </div>

      {/* Notifications List */}
      <div className="notif-cards-list">
        {filteredList.length > 0 ? (
          filteredList.map((item) => {
            const isUnread = !item.readAt;
            const meta = getNotificationMeta(item);

            return (
              <div
                key={item.id}
                className={`notif-card ${isUnread ? "unread" : "read"}`}
                onClick={() => handleNotificationClick(item)}
                role="button"
                tabIndex={0}
              >
                {/* Visual Unread Indicator Dot */}
                {isUnread && <span className="notif-unread-dot" />}

                {/* Category Icon */}
                <div className={`notif-icon-box ${meta.iconBgClass}`}>
                  {meta.icon}
                </div>

                {/* Card Main Body */}
                <div className="notif-content-wrap">
                  <div className="notif-headline-row">
                    <strong className="notif-card-title">{item.title}</strong>
                    <span className={`notif-category-badge ${meta.badgeClass}`}>
                      {meta.badgeLabel}
                    </span>
                  </div>

                  {item.body && (
                    <p className="notif-card-body-text">{item.body}</p>
                  )}

                  <div className="notif-footer-row">
                    <span className="notif-time-text">
                      <Clock size={11} />
                      {formatTimestamp(item.createdAt)}
                    </span>

                    {item.entityType === "appointment" && item.entityId && (
                      <span className="notif-action-link">
                        <ExternalLink size={11} />
                        Ver na agenda
                      </span>
                    )}
                  </div>
                </div>

                {/* Mark as read button */}
                {isUnread && (
                  <button
                    type="button"
                    className="notif-mark-single-btn"
                    onClick={(e) => handleSingleMarkRead(e, item)}
                    title="Marcar como lida"
                    aria-label="Marcar notificação como lida"
                  >
                    <Check size={15} />
                  </button>
                )}
              </div>
            );
          })
        ) : (
          <div className="notif-empty-state">
            <div className="notif-empty-icon-wrap">
              <Bell size={22} />
            </div>
            <h3 className="notif-empty-title">
              {activeFilter === "unread" ? "Tudo em dia!" : "Nenhuma notificação encontrada"}
            </h3>
            <p className="notif-empty-desc">
              {activeFilter === "unread"
                ? "Você já visualizou todas as notificações recentes."
                : "Quando ocorrerem agendamentos, pagamentos ou novidades no sistema, eles aparecerão aqui."}
            </p>
            <button
              type="button"
              className="notif-action-btn simulate"
              onClick={() => handleSimulate("reminder_2h")}
              disabled={simulating}
            >
              <Sparkles size={14} />
              <span>Simular Notificação de Teste</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
