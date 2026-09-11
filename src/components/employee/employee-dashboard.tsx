"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Clock,
  UserCheck,
  Play,
  CheckCircle,
  LogOut,
  Bell,
  User,
  Users,
  CalendarDays,
  Sparkles,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { ReserveiLogo } from "@/components/brand/novae-logo";
import { useStore } from "@/store/store";
import { api } from "@/lib/api-client";
import type { AppointmentDTO, AppointmentStatus } from "@/shared/types";
import styles from "./employee-dashboard.module.css";

type Tab = "hoje" | "agenda" | "clientes" | "notificacoes" | "perfil";

export function EmployeeDashboard() {
  const { session, logout } = useStore();
  const [activeTab, setActiveTab] = useState<Tab>("hoje");
  const [appointments, setAppointments] = useState<AppointmentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api<{ data: AppointmentDTO[] }>(`/api/appointments?from=${todayStr}`);
      setAppointments(res.data || []);
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [todayStr]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const handleUpdateStatus = async (appointmentId: string, newStatus: AppointmentStatus) => {
    try {
      setActionLoading(appointmentId);
      await api(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      await loadAppointments();
    } catch (err) {
      alert("Não foi possível atualizar o status do atendimento.");
    } finally {
      setActionLoading(null);
    }
  };

  const todayApts = appointments.filter((a) => a.date === todayStr);
  const completedToday = todayApts.filter((a) => a.status === "completed").length;
  const activeToday = todayApts.filter((a) => !["cancelled", "no_show"].includes(a.status));
  const nextClient = activeToday.find((a) => ["scheduled", "confirmed", "waiting", "in_progress"].includes(a.status));

  const totalCommissions = todayApts
    .filter((a) => a.status === "completed")
    .reduce((sum, a) => sum + (a.total * 0.4), 0); // estimated 40% standard or commission rate

  const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
      case "waiting":
        return <span className={`${styles.statusBadge} ${styles.statusWaiting}`}>Cliente chegou</span>;
      case "in_progress":
        return <span className={`${styles.statusBadge} ${styles.statusInProgress}`}>Em atendimento</span>;
      case "completed":
        return <span className={`${styles.statusBadge} ${styles.statusCompleted}`}>Finalizado</span>;
      case "cancelled":
        return <span className={`${styles.statusBadge} ${styles.statusCancelled}`}>Cancelado</span>;
      default:
        return <span className={`${styles.statusBadge} ${styles.statusScheduled}`}>Agendado</span>;
    }
  };

  return (
    <div className={styles.shell}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.logoArea}>
          <ReserveiLogo size={32} />
        </div>

        <div className={styles.employeeBadge}>
          <UserCheck size={12} />
          Profissional
        </div>

        <nav className={styles.nav}>
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === "hoje" ? styles.active : ""}`}
            onClick={() => setActiveTab("hoje")}
          >
            <Clock size={18} />
            Hoje
          </button>
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === "agenda" ? styles.active : ""}`}
            onClick={() => setActiveTab("agenda")}
          >
            <CalendarDays size={18} />
            Minha agenda
          </button>
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === "clientes" ? styles.active : ""}`}
            onClick={() => setActiveTab("clientes")}
          >
            <Users size={18} />
            Meus clientes
          </button>
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === "notificacoes" ? styles.active : ""}`}
            onClick={() => setActiveTab("notificacoes")}
          >
            <Bell size={18} />
            Notificações
          </button>
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === "perfil" ? styles.active : ""}`}
            onClick={() => setActiveTab("perfil")}
          >
            <User size={18} />
            Perfil
          </button>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userCard}>
            <div className={styles.userAvatar}>
              {session?.name ? session.name[0].toUpperCase() : "P"}
            </div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{session?.name ?? "Profissional"}</span>
              <span className={styles.userRole}>Equipe Reservei</span>
            </div>
          </div>

          <a href="/cliente" className={styles.portalSwitchBtn}>
            <ExternalLink size={13} />
            Acessar Área do Cliente
          </a>

          <button
            type="button"
            onClick={logout}
            className={styles.portalSwitchBtn}
            style={{ color: "#f87171" }}
          >
            <LogOut size={13} />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={styles.mainContent}>
        <header className={styles.topbar}>
          <div className={styles.topbarTitle}>
            <h1>Olá, {session?.name?.split(" ")[0] ?? "Profissional"}</h1>
            <p>Acompanhe sua agenda e gerencie seus atendimentos de hoje.</p>
          </div>
        </header>

        <div className={styles.contentBody}>
          {activeTab === "hoje" && (
            <>
              {/* Metric Cards */}
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statHeader}>
                    <span>Atendimentos hoje</span>
                    <Clock size={16} />
                  </div>
                  <div className={styles.statValue}>{todayApts.length}</div>
                </div>

                <div className={styles.statCard}>
                  <div className={styles.statHeader}>
                    <span>Próximo cliente</span>
                    <UserCheck size={16} />
                  </div>
                  <div className={styles.statValueLime}>
                    {nextClient ? nextClient.clientName.split(" ")[0] : "Nenhum"}
                  </div>
                </div>

                <div className={styles.statCard}>
                  <div className={styles.statHeader}>
                    <span>Finalizados</span>
                    <CheckCircle size={16} />
                  </div>
                  <div className={styles.statValue}>{completedToday}</div>
                </div>

                <div className={styles.statCard}>
                  <div className={styles.statHeader}>
                    <span>Minha comissão (estimada)</span>
                    <Sparkles size={16} />
                  </div>
                  <div className={styles.statValueLime}>
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalCommissions)}
                  </div>
                </div>
              </div>

              {/* Agenda de Hoje */}
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Agenda de hoje ({todayApts.length} horários)</h2>
              </div>

              {loading ? (
                <div className={styles.emptyState}>
                  <p>Carregando seus atendimentos...</p>
                </div>
              ) : todayApts.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>
                    <Calendar size={28} />
                  </div>
                  <div className={styles.emptyTitle}>Você não possui atendimentos agora.</div>
                  <div className={styles.emptySubtitle}>
                    Novos horários marcados por clientes aparecerão diretamente aqui.
                  </div>
                </div>
              ) : (
                <div className={styles.appointmentsList}>
                  {todayApts.map((apt) => (
                    <div key={apt.id} className={styles.appointmentCard}>
                      <div className={styles.aptTimeCol}>
                        <div className={styles.aptTime}>{apt.startTime}</div>
                        <div className={styles.aptDuration}>{apt.durationMinutes} min</div>
                      </div>

                      <div className={styles.aptInfoCol}>
                        <div className={styles.aptClientName}>
                          {apt.clientName}
                          {getStatusBadge(apt.status)}
                        </div>
                        <div className={styles.aptServiceName}>
                          {apt.serviceName || "Serviço"}
                        </div>
                        <div className={styles.aptMeta}>
                          {apt.clientPhone && (
                            <span className={styles.aptMetaItem}>
                              <WhatsAppIcon size={13} />
                              {apt.clientPhone}
                            </span>
                          )}
                          <span className={styles.aptMetaItem}>
                            Valor: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(apt.total)}
                          </span>
                        </div>
                      </div>

                      <div className={styles.aptActionsCol}>
                        {apt.clientPhone && (
                          <a
                            href={`https://wa.me/55${apt.clientPhone.replace(/\D/g, "")}?text=Olá%20${encodeURIComponent(apt.clientName)},%20confirmamos%20seu%20atendimento%20hoje%20às%20${apt.startTime}.`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${styles.actionBtn} whatsapp-button`}
                          >
                            <WhatsAppIcon size={14} />
                            WhatsApp
                          </a>
                        )}

                        {apt.status === "scheduled" || apt.status === "confirmed" ? (
                          <button
                            type="button"
                            disabled={actionLoading === apt.id}
                            className={`${styles.actionBtn} ${styles.btnCheckin}`}
                            onClick={() => handleUpdateStatus(apt.id, "waiting")}
                          >
                            <UserCheck size={14} />
                            Chegou
                          </button>
                        ) : null}

                        {apt.status === "waiting" && (
                          <button
                            type="button"
                            disabled={actionLoading === apt.id}
                            className={`${styles.actionBtn} ${styles.btnStart}`}
                            onClick={() => handleUpdateStatus(apt.id, "in_progress")}
                          >
                            <Play size={14} />
                            Iniciar
                          </button>
                        )}

                        {apt.status === "in_progress" && (
                          <button
                            type="button"
                            disabled={actionLoading === apt.id}
                            className={`${styles.actionBtn} ${styles.btnFinish}`}
                            onClick={() => handleUpdateStatus(apt.id, "completed")}
                          >
                            <CheckCircle size={14} />
                            Finalizar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === "agenda" && (
            <div>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Próximos atendimentos</h2>
              </div>
              {appointments.filter((a) => a.date > todayStr).length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>
                    <CalendarDays size={28} />
                  </div>
                  <div className={styles.emptyTitle}>Nenhum atendimento futuro agendado.</div>
                </div>
              ) : (
                <div className={styles.appointmentsList}>
                  {appointments
                    .filter((a) => a.date > todayStr)
                    .map((apt) => (
                      <div key={apt.id} className={styles.appointmentCard}>
                        <div className={styles.aptTimeCol}>
                          <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>{apt.date}</div>
                          <div className={styles.aptTime}>{apt.startTime}</div>
                        </div>
                        <div className={styles.aptInfoCol}>
                          <div className={styles.aptClientName}>
                            {apt.clientName}
                            {getStatusBadge(apt.status)}
                          </div>
                          <div className={styles.aptServiceName}>{apt.serviceName}</div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "clientes" && (
            <div>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Clientes atendidos</h2>
              </div>
              <div className={styles.appointmentsList}>
                {Array.from(new Set(appointments.map((a) => a.clientName))).map((clientName) => {
                  const clientApts = appointments.filter((a) => a.clientName === clientName);
                  return (
                    <div key={clientName} className={styles.appointmentCard}>
                      <div className={styles.aptInfoCol}>
                        <div className={styles.aptClientName}>{clientName}</div>
                        <div className={styles.aptServiceName}>
                          {clientApts.length} atendimento(s) agendado(s)
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "notificacoes" && (
            <div>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Notificações da sua agenda</h2>
              </div>
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <Bell size={28} />
                </div>
                <div className={styles.emptyTitle}>Tudo em dia por aqui.</div>
                <div className={styles.emptySubtitle}>
                  Avisos de novos agendamentos e cancelamentos aparecerão aqui.
                </div>
              </div>
            </div>
          )}

          {activeTab === "perfil" && (
            <div className={styles.statCard} style={{ maxWidth: 500 }}>
              <h2 className={styles.sectionTitle} style={{ marginBottom: 16 }}>Meu Perfil Profissional</h2>
              <p><strong>Nome:</strong> {session?.name}</p>
              <p><strong>E-mail:</strong> {session?.email}</p>
              <p><strong>Função:</strong> Especialista / Profissional da Equipe</p>
              <div style={{ marginTop: 24 }}>
                <button
                  type="button"
                  onClick={logout}
                  className={`${styles.actionBtn} ${styles.btnFinish}`}
                  style={{ background: "#f87171", color: "#ffffff" }}
                >
                  <LogOut size={14} />
                  Desconectar da conta
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
