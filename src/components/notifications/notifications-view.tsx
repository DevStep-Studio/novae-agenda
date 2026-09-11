"use client";

import React, { useState, useMemo } from "react";
import {
  Bell,
  CheckCheck,
  Check,
  Calendar,
  DollarSign,
  Info,
  Clock,
  ExternalLink,
  Sparkles,
  Loader2,
} from "lucide-react";
import { useStore } from "@/store/store";
import type { NotificationDTO } from "@/shared/types";

type CategoryFilter = "all" | "unread" | "agendamentos" | "financeiro" | "sistema";

interface NotificationsViewProps {
  onNavigateToAppointment?: (appointmentId: string) => void;
  onNavigateToAgenda?: () => void;
}

export function NotificationsView({ onNavigateToAppointment, onNavigateToAgenda }: NotificationsViewProps) {
  const { notifications, reloadNotifications, markNotificationRead, markAllNotificationsRead, notify } = useStore();
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>("all");
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);

  // Filter notifications on state or filter change
  const filteredList = useMemo(() => {
    let result = [...notifications];

    if (activeFilter === "unread") {
      result = result.filter((n) => !n.readAt);
    } else if (activeFilter === "agendamentos") {
      result = result.filter(
        (n) =>
          n.type.startsWith("booking.") ||
          n.type.startsWith("waitlist.") ||
          n.type.startsWith("customer.") ||
          n.type.startsWith("appointment_") ||
          n.type.startsWith("reminder") ||
          n.entityType === "appointment" ||
          n.entityType === "waitlist"
      );
    } else if (activeFilter === "financeiro") {
      result = result.filter(
        (n) =>
          n.type.startsWith("payment.") ||
          n.type.startsWith("financial.") ||
          n.type.startsWith("subscription.") ||
          n.type === "appointment_completed" ||
          n.entityType === "financial" ||
          n.entityType === "subscription"
      );
    } else if (activeFilter === "sistema") {
      result = result.filter(
        (n) =>
          n.type.startsWith("system.") ||
          n.type.startsWith("plan.") ||
          n.entityType === "system"
      );
    }

    return result;
  }, [notifications, activeFilter]);

  const unreadTotal = useMemo(() => notifications.filter((n) => !n.readAt).length, [notifications]);

  const handleMarkAllRead = async () => {
    if (unreadTotal === 0) return;
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

  const getCategoryIcon = (type: string, entityType: string | null) => {
    if (
      type.startsWith("payment.") ||
      type.startsWith("financial.") ||
      type.startsWith("subscription.") ||
      type === "appointment_completed" ||
      entityType === "financial" ||
      entityType === "subscription"
    ) {
      return <DollarSign size={18} />;
    }
    if (
      type.startsWith("booking.") ||
      type.startsWith("waitlist.") ||
      type.startsWith("customer.") ||
      type.startsWith("appointment_") ||
      type.startsWith("reminder") ||
      entityType === "appointment" ||
      entityType === "waitlist"
    ) {
      return <Calendar size={18} />;
    }
    return <Info size={18} />;
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

  const getCategoryBadgeLabel = (type: string, entityType: string | null) => {
    if (type.startsWith("booking.") || type.startsWith("appointment_") || type.startsWith("reminder") || entityType === "appointment") {
      return "Agendamento";
    }
    if (type.startsWith("payment.") || entityType === "financial") {
      return "Financeiro";
    }
    if (type.startsWith("subscription.") || entityType === "subscription") {
      return "Assinatura";
    }
    if (type.startsWith("waitlist.") || entityType === "waitlist") {
      return "Fila de Espera";
    }
    return "Sistema";
  };

  return (
    <div className="page-content notifications-page-content" style={{ maxWidth: 980, margin: "0 auto", padding: "28px 24px 80px" }}>
      {/* Top Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 28,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(220, 255, 76, 0.15)",
                color: "var(--primary, #dcff4c)",
              }}
            >
              <Bell size={18} />
            </span>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
              Central de Notificações
            </h1>
            {unreadTotal > 0 && (
              <span
                style={{
                  background: "var(--primary, #dcff4c)",
                  color: "#080808",
                  fontSize: 11,
                  fontWeight: 800,
                  padding: "2px 8px",
                  borderRadius: 12,
                }}
              >
                {unreadTotal} nova{unreadTotal > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
            Histórico completo de eventos, novos agendamentos, clientes e alertas da sua empresa.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", position: "relative" }}>
          {/* Simulate Action Button */}
          <button
            type="button"
            onClick={() => handleSimulate("reminder_2h")}
            disabled={simulating}
            title="Disparar lembrete automático de 2h antes do atendimento"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 14px",
              background: "rgba(220, 255, 76, 0.12)",
              border: "1px solid rgba(220, 255, 76, 0.3)",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              color: "var(--primary, #dcff4c)",
              cursor: simulating ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              if (!simulating) {
                e.currentTarget.style.background = "rgba(220, 255, 76, 0.22)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }
            }}
            onMouseLeave={(e) => {
              if (!simulating) {
                e.currentTarget.style.background = "rgba(220, 255, 76, 0.12)";
                e.currentTarget.style.transform = "none";
              }
            }}
          >
            {simulating ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
            <span>{simulating ? "Simulando..." : "Simular Lembrete 2h (QA)"}</span>
          </button>

          {/* Mark All Read Button */}
          {unreadTotal > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={loading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 16px",
                background: "var(--surface, #121212)",
                border: "1px solid var(--border, #262626)",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-primary, #ffffff)",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.borderColor = "var(--primary, #dcff4c)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.borderColor = "var(--border, #262626)";
                  e.currentTarget.style.transform = "none";
                }
              }}
            >
              {loading ? (
                <Loader2 size={15} className="spin" />
              ) : (
                <CheckCheck size={16} style={{ color: "var(--primary, #dcff4c)" }} />
              )}
              <span>Marcar todas como lidas</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 4,
          marginBottom: 24,
          borderBottom: "1px solid var(--border, #262626)",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveFilter("all")}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: activeFilter === "all" ? 700 : 500,
            border: activeFilter === "all" ? "1px solid rgba(220, 255, 76, 0.4)" : "1px solid transparent",
            background: activeFilter === "all" ? "rgba(220, 255, 76, 0.1)" : "transparent",
            color: activeFilter === "all" ? "var(--primary, #dcff4c)" : "var(--text-secondary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            whiteSpace: "nowrap",
            transition: "all 0.15s ease",
          }}
        >
          Todas
          <span style={{ fontSize: 11, opacity: 0.8 }}>({notifications.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter("unread")}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: activeFilter === "unread" ? 700 : 500,
            border: activeFilter === "unread" ? "1px solid rgba(220, 255, 76, 0.4)" : "1px solid transparent",
            background: activeFilter === "unread" ? "rgba(220, 255, 76, 0.1)" : "transparent",
            color: activeFilter === "unread" ? "var(--primary, #dcff4c)" : "var(--text-secondary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            whiteSpace: "nowrap",
            transition: "all 0.15s ease",
          }}
        >
          Não lidas
          {unreadTotal > 0 && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                background: "var(--primary, #dcff4c)",
                color: "#080808",
                borderRadius: 10,
                padding: "1px 6px",
              }}
            >
              {unreadTotal}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter("agendamentos")}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: activeFilter === "agendamentos" ? 700 : 500,
            border: activeFilter === "agendamentos" ? "1px solid rgba(220, 255, 76, 0.4)" : "1px solid transparent",
            background: activeFilter === "agendamentos" ? "rgba(220, 255, 76, 0.1)" : "transparent",
            color: activeFilter === "agendamentos" ? "var(--primary, #dcff4c)" : "var(--text-secondary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            whiteSpace: "nowrap",
            transition: "all 0.15s ease",
          }}
        >
          <Calendar size={14} />
          Agendamentos
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter("financeiro")}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: activeFilter === "financeiro" ? 700 : 500,
            border: activeFilter === "financeiro" ? "1px solid rgba(220, 255, 76, 0.4)" : "1px solid transparent",
            background: activeFilter === "financeiro" ? "rgba(220, 255, 76, 0.1)" : "transparent",
            color: activeFilter === "financeiro" ? "var(--primary, #dcff4c)" : "var(--text-secondary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            whiteSpace: "nowrap",
            transition: "all 0.15s ease",
          }}
        >
          <DollarSign size={14} />
          Financeiro
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter("sistema")}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: activeFilter === "sistema" ? 700 : 500,
            border: activeFilter === "sistema" ? "1px solid rgba(220, 255, 76, 0.4)" : "1px solid transparent",
            background: activeFilter === "sistema" ? "rgba(220, 255, 76, 0.1)" : "transparent",
            color: activeFilter === "sistema" ? "var(--primary, #dcff4c)" : "var(--text-secondary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            whiteSpace: "nowrap",
            transition: "all 0.15s ease",
          }}
        >
          <Info size={14} />
          Sistema
        </button>
      </div>

      {/* Notifications List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filteredList.length > 0 ? (
          filteredList.map((item) => {
            const isUnread = !item.readAt;
            return (
              <div
                key={item.id}
                onClick={() => handleNotificationClick(item)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 16,
                  padding: "16px 20px",
                  borderRadius: 12,
                  background: isUnread ? "var(--surface, #121212)" : "var(--surface-secondary, #181818)",
                  border: isUnread ? "1px solid rgba(220, 255, 76, 0.35)" : "1px solid var(--border, #262626)",
                  boxShadow: isUnread ? "0 4px 16px rgba(0,0,0,0.3)" : "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.borderColor = "var(--primary, #dcff4c)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.borderColor = isUnread ? "rgba(220, 255, 76, 0.35)" : "var(--border, #262626)";
                }}
              >
                {/* Unread indicator dot */}
                {isUnread && (
                  <span
                    style={{
                      position: "absolute",
                      left: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--primary, #dcff4c)",
                      boxShadow: "0 0 8px var(--primary, #dcff4c)",
                    }}
                  />
                )}

                {/* Category Icon */}
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: isUnread ? "rgba(220, 255, 76, 0.14)" : "var(--surface-tertiary, #222222)",
                    color: isUnread ? "var(--primary, #dcff4c)" : "var(--text-secondary)",
                    display: "grid",
                    placeItems: "center",
                    flex: "0 0 auto",
                  }}
                >
                  {getCategoryIcon(item.type, item.entityType)}
                </div>

                {/* Main Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: isUnread ? 700 : 600,
                        color: "var(--text-primary, #ffffff)",
                      }}
                    >
                      {item.title}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "var(--surface-tertiary, #222222)",
                        color: "var(--text-muted, #737373)",
                        border: "1px solid var(--border, #262626)",
                      }}
                    >
                      {getCategoryBadgeLabel(item.type, item.entityType)}
                    </span>
                  </div>

                  {item.body && (
                    <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary, #a3a3a3)", lineHeight: 1.5 }}>
                      {item.body}
                    </p>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted, #737373)" }}>
                      <Clock size={12} />
                      {formatTimestamp(item.createdAt)}
                    </span>

                    {item.entityType === "appointment" && item.entityId && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--primary, #dcff4c)",
                        }}
                      >
                        <ExternalLink size={11} />
                        Ver na agenda
                      </span>
                    )}
                  </div>
                </div>

                {/* Mark as read quick action */}
                {isUnread && (
                  <button
                    type="button"
                    onClick={(e) => handleSingleMarkRead(e, item)}
                    title="Marcar como lida"
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--text-muted, #737373)",
                      padding: 6,
                      borderRadius: 6,
                      cursor: "pointer",
                      display: "grid",
                      placeItems: "center",
                      flex: "0 0 auto",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "var(--primary, #dcff4c)";
                      e.currentTarget.style.background = "rgba(220, 255, 76, 0.12)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "var(--text-muted, #737373)";
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <Check size={16} />
                  </button>
                )}
              </div>
            );
          })
        ) : (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              background: "var(--surface, #121212)",
              borderRadius: 16,
              border: "1px solid var(--border, #262626)",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "var(--surface-secondary, #181818)",
                color: "var(--text-muted, #737373)",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 16px",
              }}
            >
              <Bell size={22} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px", color: "var(--text-primary, #ffffff)" }}>
              {activeFilter === "unread"
                ? "Tudo em dia!"
                : "Nenhuma notificação encontrada"}
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--text-secondary, #a3a3a3)", maxWidth: 360, marginLeft: "auto", marginRight: "auto" }}>
              {activeFilter === "unread"
                ? "Você já leu todas as notificações recentes."
                : "Quando ocorrerem agendamentos, pagamentos ou novidades no sistema, eles aparecerão aqui."}
            </p>
            <button
              type="button"
              onClick={() => handleSimulate("reminder_2h")}
              disabled={simulating}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                background: "rgba(220, 255, 76, 0.12)",
                border: "1px solid rgba(220, 255, 76, 0.3)",
                color: "var(--primary, #dcff4c)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Sparkles size={14} />
              Simular Notificação de Teste
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
