/* eslint-disable react-hooks/set-state-in-effect -- Loads the authenticated portal snapshot when the shell mounts. */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  History,
  Home,
  MapPin,
  Sparkles,
  User,
  UserRound,
  X,
  LogOut,
  CalendarCheck2,
  Briefcase,
  Download,
  Star,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { api, ApiError } from "@/lib/api-client";
import { MyBookings } from "@/components/booking/my-bookings";
import type { BookingDetails } from "@/lib/booking/service";
import { ReserveiLogo } from "@/components/brand/novae-logo";
import { STATUS_LABELS } from "@/lib/client-utils";
import styles from "./client-portal.module.css";
import type { SessionInfo } from "@/shared/types";

export type ClientTab =
  | "home"
  | "agendar"
  | "horarios"
  | "historico"
  | "notificacoes"
  | "perfil";

type PublicCompany = {
  id: string;
  name: string;
  businessType: string | null;
  logoUrl: string | null;
  publicSlug: string;
  address: string | null;
  phone: string | null;
  primaryColor: string;
};

type BookingItem = {
  id: string;
  serviceId: string;
  serviceName: string;
  employeeId: string;
  employeeName: string;
  price: number;
  durationMinutes: number;
  date: string;
  startTime: string;
  endTime: string;
};

type CustomerBooking = {
  id: string;
  companyId: string;
  companyName?: string;
  companySlug?: string;
  companyAddress?: string | null;
  locationId: string;
  locationName: string;
  startsAt: string;
  endsAt: string;
  status: string;
  total: number;
  items: BookingItem[];
  canChange?: boolean;
};

export function ClientPortal({
  initialSession,
  onLogout,
}: {
  initialSession?: SessionInfo | null;
  onLogout?: () => void;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ClientTab>("home");
  const [session, setSession] = useState<SessionInfo | null>(initialSession ?? null);
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [companies, setCompanies] = useState<PublicCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [cancellingBooking, setCancellingBooking] = useState<CustomerBooking | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  // Review state
  const [reviewBooking, setReviewBooking] = useState<CustomerBooking | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>("");
  const [reviewSubmitting, setReviewSubmitting] = useState<boolean>(false);
  const [reviewedBookings, setReviewedBookings] = useState<Set<string>>(new Set());

  // Load session & customer data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sessData, bookingsData, companiesData] = await Promise.all([
        api<SessionInfo>("/api/auth/session").catch(() => null),
        api<BookingDetails[]>("/api/my/bookings").then(rows => rows.map(row => ({ ...row, startsAt: String(row.startsAt), endsAt: String(row.endsAt), total: Number(row.total), companyName: row.company.name, companySlug: row.company.slug ?? undefined, companyAddress: row.company.address, locationName: "", items: row.items.map(i => ({ ...i, serviceName: i.name, price: Number(i.price) })) }))),
        api<PublicCompany[]>("/api/companies/public").catch(() => []),
      ]);

      if (sessData) setSession(sessData);
      setBookings(bookingsData);
      setCompanies(companiesData);
    } catch {
      setError("Não foi possível carregar seus agendamentos. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const now = new Date();
  const upcomingBookings = bookings.filter(b => !["cancelled", "completed", "no_show"].includes(b.status) && new Date(b.endsAt) >= now).sort((a,b) => a.startsAt.localeCompare(b.startsAt));
  const nextBooking = upcomingBookings[0] ?? null;
  const startReschedule = (booking: CustomerBooking) => {
    router.push(`/meus-agendamentos?booking=${booking.id}&action=reschedule`);
  };
  const getWhatsAppLink = (booking: CustomerBooking) => {
    const phone = companies.find(c => c.id === booking.companyId)?.phone?.replace(/\D/g, "");
    return phone ? `https://wa.me/${phone.length <= 11 ? "55" : ""}${phone}` : null;
  };
  // Cancel handler
  const handleCancelBooking = async () => {
    if (!cancellingBooking) return;
    try {
      await api(`/api/my/bookings/${cancellingBooking.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: cancelReason || undefined }),
      });
      setSuccessMsg("Atendimento cancelado com sucesso.");
      setCancellingBooking(null);
      setCancelReason("");
      await loadData();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível cancelar o atendimento.");
    }
  };

  const handleReviewBooking = async () => {
    if (!reviewBooking) return;
    setReviewSubmitting(true);
    try {
      await api("/api/reviews", {
        method: "POST",
        body: JSON.stringify({
          appointmentId: reviewBooking.id,
          rating: reviewRating,
          comment: reviewComment.trim() || undefined,
        }),
      });
      setReviewedBookings((prev) => new Set([...prev, reviewBooking.id]));
      setSuccessMsg("Obrigado pela sua avaliação!");
      setReviewBooking(null);
      setReviewComment("");
      setReviewRating(5);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível registrar a avaliação.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleSelectCompany = (company: PublicCompany) => {
    router.push(`/agendar/${company.publicSlug}`);
  };
  const clientName = session?.name ? session.name.split(" ")[0] : "Cliente";

  return (
    <div className={styles.page}>
      {/* Top Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <ReserveiLogo variant="full" size={24} />
            <span>Cliente</span>
          </div>

          <nav className={styles.desktopNav}>
            <button
              type="button"
              className={`${styles.navItem} ${activeTab === "home" ? styles.navItemActive : ""}`}
              onClick={() => setActiveTab("home")}
            >
              <Home size={15} /> Início
            </button>
            <button
              type="button"
              className={`${styles.navItem} ${activeTab === "agendar" ? styles.navItemActive : ""}`}
              onClick={() => {
                setActiveTab("agendar");
              }}
            >
              <CalendarPlus size={15} /> Agendar
            </button>
            <button
              type="button"
              className={`${styles.navItem} ${activeTab === "horarios" ? styles.navItemActive : ""}`}
              onClick={() => setActiveTab("horarios")}
            >
              <CalendarDays size={15} /> Meus horários
            </button>
            <button
              type="button"
              className={`${styles.navItem} ${activeTab === "historico" ? styles.navItemActive : ""}`}
              onClick={() => setActiveTab("historico")}
            >
              <History size={15} /> Histórico
            </button>
            <button
              type="button"
              className={`${styles.navItem} ${activeTab === "perfil" ? styles.navItemActive : ""}`}
              onClick={() => setActiveTab("perfil")}
            >
              <User size={15} /> Perfil
            </button>
          </nav>

          <div className={styles.headerActions}>
            {/* Switch portal if user is also owner/employee */}
            {(session?.role === "owner" || session?.role === "admin" || session?.isSuperadmin) && (
              <a href="/gestao" className={styles.contextSwitchBtn} title="Ir para Painel da Empresa">
                <Briefcase size={14} />
                <span>Gestão da Empresa</span>
              </a>
            )}
            {session?.role === "employee" && (
              <a href="/profissional" className={styles.contextSwitchBtn} title="Ir para Painel do Profissional">
                <CalendarCheck2 size={14} />
                <span>Minha Agenda</span>
              </a>
            )}

            <button
              type="button"
              className={styles.avatarBtn}
              onClick={() => setActiveTab("perfil")}
              title={session?.name ?? "Meu Perfil"}
            >
              {session?.name ? session.name[0].toUpperCase() : "C"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className={styles.main}>
        {/* Banner feedback */}
        {error && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "10px",
              background: "rgba(239, 68, 68, 0.12)",
              color: "#fca5a5",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer" }}
            >
              <X size={15} />
            </button>
          </div>
        )}

        {successMsg && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "10px",
              background: "rgba(220, 255, 76, 0.12)",
              color: "#dcff4c",
              border: "1px solid rgba(220, 255, 76, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            <span>{successMsg}</span>
            <button
              type="button"
              onClick={() => setSuccessMsg(null)}
              style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer" }}
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* TAB 1: HOME */}
        {activeTab === "home" && (
          <>
            <section className={styles.welcomeSection}>
              <h1 className={styles.welcomeTitle}>Olá, {clientName}</h1>
              <p className={styles.welcomeSubtitle}>
                Gerencie seus horários e acompanhe seus próximos atendimentos.
              </p>
            </section>

            {/* Next Appointment Card or Empty State */}
            {nextBooking ? (
              <section className={styles.nextCard}>
                <div className={styles.nextCardTag}>
                  <Sparkles size={13} />
                  <span>Próximo atendimento</span>
                </div>

                <div className={styles.nextCardBody}>
                  <div className={styles.companyLogo}>
                    {nextBooking.companyName ? nextBooking.companyName.slice(0, 2).toUpperCase() : "NP"}
                  </div>

                  <div className={styles.appointmentInfo}>
                    <span className={styles.companyName}>
                      {nextBooking.companyName ?? "Estabelecimento Parceiro"} · {nextBooking.locationName}
                    </span>
                    <strong className={styles.serviceName}>
                      {nextBooking.items?.[0]?.serviceName ?? "Atendimento"}
                    </strong>
                    <div className={styles.appointmentMeta}>
                      <span className={styles.appointmentMetaItem}>
                        <UserRound size={13} />
                        {nextBooking.items?.[0]?.employeeName ?? "Profissional"}
                      </span>
                      <span className={styles.appointmentMetaItem}>
                        <CalendarDays size={13} />
                        {new Intl.DateTimeFormat("pt-BR", {
                          day: "numeric",
                          month: "long",
                          timeZone: "UTC",
                        }).format(new Date(nextBooking.startsAt))}
                      </span>
                      <span className={styles.appointmentMetaItem}>
                        <Clock size={13} />
                        {nextBooking.startsAt.slice(11, 16)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className={styles.appointmentStatusBadge}>
                      <CheckCircle2 size={12} />
                      {STATUS_LABELS[nextBooking.status as keyof typeof STATUS_LABELS] ?? "Confirmado"}
                    </span>
                  </div>
                </div>

                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => router.push(`/meus-agendamentos?booking=${nextBooking.id}`)}
                  >
                    Ver detalhes
                  </button>
                  {nextBooking.canChange && (
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => startReschedule(nextBooking)}
                    >
                      Remarcar
                    </button>
                  )}
                  <a
                    href={`/api/my/bookings/${nextBooking.id}/calendar`}
                    download
                    className={styles.actionBtn}
                  >
                    <Download size={13} /> Adicionar ao calendário
                  </a>
                  {nextBooking.companyAddress && (
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(nextBooking.companyAddress)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.actionBtn}
                    >
                      <MapPin size={13} /> Abrir localização
                    </a>
                  )}
                  {getWhatsAppLink(nextBooking) && (
                    <a
                      href={getWhatsAppLink(nextBooking)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${styles.actionBtn} whatsapp-button`}
                    >
                      <WhatsAppIcon size={14} aria-hidden="true" /> Entrar em contato
                    </a>
                  )}
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                    onClick={() => setCancellingBooking(nextBooking)}
                  >
                    Cancelar
                  </button>
                </div>
              </section>
            ) : (
              <section className={styles.emptyCard}>
                <div className={styles.emptyIconWrapper}>
                  <CalendarDays size={24} />
                </div>
                <h3 className={styles.emptyTitle}>Você não possui nenhum atendimento agendado.</h3>
                <p className={styles.emptySubtitle}>
                  Encontre os melhores estabelecimentos e reserve seus serviços de beleza, saúde e estética em segundos.
                </p>
                <button
                  type="button"
                  className={styles.ctaButton}
                  onClick={() => {
                    setActiveTab("agendar");
                  }}
                >
                  <CalendarPlus size={16} />
                  <span>Agendar horário</span>
                </button>
              </section>
            )}

            {/* Quick Actions Grid */}
            <div className={styles.quickActionsGrid}>
              <div
                className={styles.quickActionCard}
                onClick={() => {
                  setActiveTab("agendar");
                }}
              >
                <div className={styles.quickActionIcon}>
                  <CalendarPlus size={20} />
                </div>
                <div className={styles.quickActionText}>
                  <strong>Novo agendamento</strong>
                  <span>Escolha estabelecimento, serviço e horário</span>
                </div>
              </div>

              <div
                className={styles.quickActionCard}
                onClick={() => setActiveTab("horarios")}
              >
                <div className={styles.quickActionIcon}>
                  <CalendarDays size={20} />
                </div>
                <div className={styles.quickActionText}>
                  <strong>Meus horários</strong>
                  <span>{upcomingBookings.length} atendimento(s) futuros</span>
                </div>
              </div>

              <div
                className={styles.quickActionCard}
                onClick={() => setActiveTab("historico")}
              >
                <div className={styles.quickActionIcon}>
                  <History size={20} />
                </div>
                <div className={styles.quickActionText}>
                  <strong>Histórico</strong>
                  <span>Consulte visitas e agende novamente</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* TAB 2: AGENDAR (FLOW EM ETAPAS) */}
        {activeTab === "agendar" && (
          <div className={styles.flowContainer}>
            <h2>Escolha o estabelecimento</h2>
            <div className={styles.companyGrid}>
                {companies.map((comp) => (
                  <button
                    type="button"
                    key={comp.id}
                    className={styles.companyCard}
                    onClick={() => handleSelectCompany(comp)}
                  >
                    <div className={styles.companyLogo}>
                      {comp.logoUrl ? (
                        <img
                          src={comp.logoUrl}
                          alt={comp.name}
                          style={{ width: "100%", height: "100%", borderRadius: 12, objectFit: "cover" }}
                        />
                      ) : (
                        comp.name.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <strong style={{ display: "block", fontSize: "14px", color: "#ffffff", letterSpacing: "-0.2px" }}>
                        {comp.name}
                      </strong>
                      <span style={{ fontSize: "12px", color: "#8db3a2" }}>
                        {comp.businessType ?? "Atendimento"}
                      </span>
                      {comp.address && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "11px", color: "#6e9382", marginTop: 3 }}>
                          <MapPin size={11} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {comp.address}
                          </span>
                        </span>
                      )}
                    </div>
                  </button>
                ))}
            </div>

          </div>
        )}
        {(activeTab === "horarios" || activeTab === "historico") && (
          <MyBookings
            embedded
            initialTab={activeTab === "historico" ? "Anteriores" : "Próximos"}
            initialUser={session ? {
              id: session.userId,
              name: session.name,
              email: session.email,
              phone: session.phone ?? null,
              emailVerified: session.emailVerified,
            } : null}
          />
        )}

        {/* TAB 5: PERFIL */}
        {activeTab === "perfil" && (
          <div className={styles.flowContainer}>
            <div className={styles.flowHeader}>
              <h2 className={styles.flowHeaderTitle}>Meu Perfil e Segurança</h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                  Nome completo
                </label>
                <input
                  type="text"
                  defaultValue={session?.name}
                  disabled
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 6,
                    height: 40,
                    padding: "0 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--surface-secondary)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                  E-mail cadastrado
                </label>
                <input
                  type="email"
                  defaultValue={session?.email}
                  disabled
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 6,
                    height: 40,
                    padding: "0 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--surface-secondary)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                  Telefone / WhatsApp
                </label>
                <input
                  type="tel"
                  defaultValue={session?.phone ?? ""}
                  placeholder="(11) 99999-9999"
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 6,
                    height: 40,
                    padding: "0 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 10 }}>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                  onClick={async () => {
                    await api("/api/auth/logout", { method: "POST" });
                    router.push("/");
                  }}
                >
                  <LogOut size={14} /> Sair da conta
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Cancelamento */}
        {cancellingBooking && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              display: "grid",
              placeItems: "center",
              zIndex: 100,
              padding: 20,
            }}
          >
            <div
              style={{
                background: "var(--surface)",
                borderRadius: 16,
                padding: 24,
                maxWidth: 440,
                width: "100%",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 750 }}>
                Cancelar atendimento?
              </h3>
              <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "14px" }}>
                Tem certeza que deseja cancelar seu horário com{" "}
                <strong>{cancellingBooking.companyName ?? "o estabelecimento"}</strong>?
              </p>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                  Motivo do cancelamento (opcional):
                </label>
                <input
                  type="text"
                  placeholder="Ex: Imprevisto de última hora"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 6,
                    height: 40,
                    padding: "0 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => setCancellingBooking(null)}
                >
                  Voltar
                </button>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                  onClick={handleCancelBooking}
                >
                  Confirmar cancelamento
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Avaliação */}
        {reviewBooking && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              display: "grid",
              placeItems: "center",
              zIndex: 100,
              padding: 20,
            }}
            onClick={() => setReviewBooking(null)}
          >
            <div
              style={{
                background: "var(--surface)",
                borderRadius: 16,
                padding: 24,
                maxWidth: 440,
                width: "100%",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 750 }}>
                  Como foi seu atendimento?
                </h3>
                <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "14px" }}>
                  {reviewBooking.items?.[0]?.serviceName ?? "Atendimento"} com{" "}
                  <strong>{reviewBooking.items?.[0]?.employeeName}</strong>
                </p>
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: 10, padding: "8px 0" }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 4,
                      color: star <= reviewRating ? "#facc15" : "var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title={`${star} estrelas`}
                  >
                    <Star
                      size={28}
                      fill={star <= reviewRating ? "#facc15" : "none"}
                    />
                  </button>
                ))}
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                  Comentário ou elogio (opcional):
                </label>
                <textarea
                  rows={3}
                  placeholder="Conte como foi sua experiência..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 6,
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--text-primary)",
                    fontSize: 13,
                    fontFamily: "inherit",
                    resize: "none",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => setReviewBooking(null)}
                  disabled={reviewSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                  onClick={handleReviewBooking}
                  disabled={reviewSubmitting}
                >
                  {reviewSubmitting ? "Enviando..." : "Confirmar avaliação"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className={styles.bottomNav}>
        <button
          type="button"
          className={`${styles.bottomNavItem} ${activeTab === "home" ? styles.bottomNavItemActive : ""}`}
          onClick={() => setActiveTab("home")}
        >
          <Home size={18} />
          <span>Início</span>
        </button>

        <button
          type="button"
          className={`${styles.bottomNavItem} ${activeTab === "agendar" ? styles.bottomNavItemActive : ""}`}
          onClick={() => {
            setActiveTab("agendar");
          }}
        >
          <CalendarPlus size={18} />
          <span>Agendar</span>
        </button>

        <button
          type="button"
          className={`${styles.bottomNavItem} ${activeTab === "horarios" ? styles.bottomNavItemActive : ""}`}
          onClick={() => setActiveTab("horarios")}
        >
          <CalendarDays size={18} />
          <span>Horários</span>
        </button>

        <button
          type="button"
          className={`${styles.bottomNavItem} ${activeTab === "historico" ? styles.bottomNavItemActive : ""}`}
          onClick={() => setActiveTab("historico")}
        >
          <History size={18} />
          <span>Histórico</span>
        </button>

        <button
          type="button"
          className={`${styles.bottomNavItem} ${activeTab === "perfil" ? styles.bottomNavItemActive : ""}`}
          onClick={() => setActiveTab("perfil")}
        >
          <User size={18} />
          <span>Perfil</span>
        </button>
      </nav>
    </div>
  );
}
