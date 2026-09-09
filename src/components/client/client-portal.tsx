"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  ExternalLink,
  History,
  Home,
  MapPin,
  RotateCcw,
  Sparkles,
  User,
  UserRound,
  X,
  XCircle,
  Building2,
  ChevronRight,
  Bell,
  LogOut,
  CalendarCheck2,
  Briefcase,
  AlertCircle,
  ShieldCheck,
  Download,
  Star,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { NovaeLogo } from "@/components/brand/novae-logo";
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
};

export function ClientPortal({
  initialSession,
  onLogout,
}: {
  initialSession?: SessionInfo | null;
  onLogout?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<ClientTab>("home");
  const [session, setSession] = useState<SessionInfo | null>(initialSession ?? null);
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [companies, setCompanies] = useState<PublicCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Booking Flow State
  const [selectedCompany, setSelectedCompany] = useState<PublicCompany | null>(null);
  const [catalog, setCatalog] = useState<any>(null);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [bookingStep, setBookingStep] = useState<number>(1);
  const [bookingSuccess, setBookingSuccess] = useState<CustomerBooking | null>(null);
  const [submittingBooking, setSubmittingBooking] = useState(false);

  // Reschedule / Cancel state
  const [reschedulingBooking, setReschedulingBooking] = useState<CustomerBooking | null>(null);
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
        api<CustomerBooking[]>("/api/my/bookings").catch(() => []),
        api<PublicCompany[]>("/api/companies/public").catch(() => []),
      ]);

      if (sessData) setSession(sessData);
      setBookings(bookingsData);
      setCompanies(companiesData);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Next upcoming booking
  const now = new Date();
  const upcomingBookings = bookings.filter(
    (b) => new Date(b.startsAt) >= now && b.status !== "cancelled"
  );
  const nextBooking = upcomingBookings[0] ?? null;

  // Past bookings (history)
  const pastBookings = bookings.filter(
    (b) => new Date(b.startsAt) < now || b.status === "completed" || b.status === "cancelled"
  );

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
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "Não foi possível registrar a avaliação.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  // Handle Booking Flow - Step 1: Company selected
  const handleSelectCompany = async (company: PublicCompany) => {
    setSelectedCompany(company);
    setSelectedService(null);
    setSelectedEmployee(null);
    setSelectedDate("");
    setSelectedSlot("");
    try {
      const cat = await api(`/api/public/${company.publicSlug}`);
      setCatalog(cat);
      setBookingStep(2); // Go to service selection
    } catch (e) {
      setError("Não foi possível carregar os serviços do estabelecimento.");
    }
  };

  // Step 2: Service selected
  const handleSelectService = (service: any) => {
    setSelectedService(service);
    setBookingStep(3); // Go to professional selection
  };

  // Step 3: Professional selected
  const handleSelectEmployee = (employee: any) => {
    setSelectedEmployee(employee);
    // Generate dates starting today
    const today = new Date().toISOString().slice(0, 10);
    setSelectedDate(today);
    loadSlots(today, employee);
    setBookingStep(4); // Go to date/time selection
  };

  // Load available slots
  const loadSlots = async (date: string, pro: any) => {
    if (!selectedCompany || !selectedService) return;
    try {
      const proId = pro?.id === "any" ? null : pro?.id;
      const items = [{ serviceId: selectedService.id, employeeId: proId }];
      const query = new URLSearchParams({
        locationId: catalog?.company?.locationId || catalog?.locations?.[0]?.id || "",
        date,
        items: JSON.stringify(items),
      });
      const res = await api<{ slots: Array<{ startTime: string }> }>(
        `/api/public/${selectedCompany.publicSlug}/availability?${query.toString()}`,
      );
      setAvailableSlots(res?.slots?.map((s) => s.startTime) || []);
    } catch {
      // fallback slots
      setAvailableSlots(["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"]);
    }
  };

  // Step 4: Date/Time selected -> Step 5: Review
  const handleSelectSlot = (slotTime: string) => {
    setSelectedSlot(slotTime);
    setBookingStep(5);
  };

  // Step 5: Confirm and create booking
  const handleConfirmBooking = async () => {
    if (!selectedCompany || !selectedService || !selectedSlot || !selectedDate) return;
    setSubmittingBooking(true);
    setError(null);
    try {
      const proId = selectedEmployee?.id === "any" ? null : selectedEmployee?.id;
      const locationId = catalog?.locations?.[0]?.id || catalog?.company?.locationId;
      const res = await api<{ id: string }>("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          slug: selectedCompany.publicSlug,
          locationId,
          date: selectedDate,
          startTime: selectedSlot,
          items: [{ serviceId: selectedService.id, employeeId: proId }],
          idempotencyKey: crypto.randomUUID(),
        }),
      });

      // Reload bookings and show success
      await loadData();
      setBookingStep(6); // Success
      setSuccessMsg("Seu horário está confirmado!");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível confirmar o agendamento.");
    } finally {
      setSubmittingBooking(false);
    }
  };

  // Quick action: Agendar novamente
  const handleBookAgain = async (booking: CustomerBooking) => {
    const matchedComp = companies.find((c) => c.id === booking.companyId);
    if (!matchedComp) {
      setActiveTab("agendar");
      return;
    }
    setSelectedCompany(matchedComp);
    setActiveTab("agendar");
    try {
      const cat = await api<any>(`/api/public/${matchedComp.publicSlug}`);
      setCatalog(cat);
      const item = booking.items?.[0];
      const matchedSvc = cat.services?.find((s: any) => s.id === item?.serviceId);
      const matchedEmp = cat.employees?.find((e: any) => e.id === item?.employeeId) || { id: "any", name: "Qualquer profissional" };
      if (matchedSvc) {
        setSelectedService(matchedSvc);
        setSelectedEmployee(matchedEmp);
        const today = new Date().toISOString().slice(0, 10);
        setSelectedDate(today);
        const proId = matchedEmp?.id === "any" ? null : matchedEmp?.id;
        const items = [{ serviceId: matchedSvc.id, employeeId: proId }];
        const query = new URLSearchParams({
          locationId: cat?.company?.locationId || cat?.locations?.[0]?.id || "",
          date: today,
          items: JSON.stringify(items),
        });
        const res = await api<{ slots: Array<{ startTime: string }> }>(
          `/api/public/${matchedComp.publicSlug}/availability?${query.toString()}`
        ).catch(() => ({ slots: [] }));
        setAvailableSlots(res?.slots?.map((s: any) => s.startTime) || []);
        setBookingStep(4);
      } else {
        setBookingStep(2);
      }
    } catch {
      setBookingStep(2);
    }
  };

  const clientName = session?.name ? session.name.split(" ")[0] : "Cliente";

  return (
    <div className={styles.page}>
      {/* Top Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <NovaeLogo variant="full" size={24} />
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
                setBookingStep(1);
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
                    onClick={() => setActiveTab("horarios")}
                  >
                    Ver detalhes
                  </button>
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
                    setBookingStep(1);
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
                  setBookingStep(1);
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
            <div className={styles.flowHeader}>
              <h2 className={styles.flowHeaderTitle}>
                {bookingStep === 1 && "1. Escolha o Estabelecimento"}
                {bookingStep === 2 && `2. Serviços em ${selectedCompany?.name}`}
                {bookingStep === 3 && "3. Escolha o Profissional"}
                {bookingStep === 4 && "4. Data e Horário Disponível"}
                {bookingStep === 5 && "5. Confirmação do Atendimento"}
                {bookingStep === 6 && "Seu horário está confirmado!"}
              </h2>
              <span className={styles.flowProgress}>Etapa {bookingStep} de 5</span>
            </div>

            {/* Step 1: Company / Estabelecimento */}
            {bookingStep === 1 && (
              <div className={styles.companyGrid}>
                {companies.map((comp) => (
                  <div
                    key={comp.id}
                    className={styles.companyCard}
                    onClick={() => handleSelectCompany(comp)}
                  >
                    <div className={styles.companyLogo}>
                      {comp.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <strong style={{ display: "block", fontSize: "14px" }}>{comp.name}</strong>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {comp.businessType ?? "Atendimento"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Step 2: Services */}
            {bookingStep === 2 && (
              <div>
                <div className={styles.servicesGrid}>
                  {catalog?.services?.map((serv: any) => (
                    <div
                      key={serv.id}
                      className={styles.serviceCard}
                      onClick={() => handleSelectService(serv)}
                    >
                      <div className={styles.serviceHeader}>
                        <strong style={{ fontSize: "14px" }}>{serv.name}</strong>
                        <span className={styles.servicePrice}>
                          R$ {Number(serv.price).toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                      <span className={styles.serviceDuration}>
                        <Clock size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                        {serv.durationMinutes} minutos
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 20 }}>
                  <button type="button" className={styles.actionBtn} onClick={() => setBookingStep(1)}>
                    Voltar
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Professional */}
            {bookingStep === 3 && (
              <div>
                <div className={styles.proGrid}>
                  <div
                    className={styles.proCard}
                    onClick={() => handleSelectEmployee({ id: "any", name: "Qualquer profissional disponível" })}
                  >
                    <div className={styles.proAvatar}>
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <strong>Qualquer profissional disponível</strong>
                      <small style={{ display: "block", color: "var(--text-muted)" }}>
                        Primeiro horário livre
                      </small>
                    </div>
                  </div>

                  {catalog?.professionals?.map((pro: any) => (
                    <div
                      key={pro.id}
                      className={styles.proCard}
                      onClick={() => handleSelectEmployee(pro)}
                    >
                      <div className={styles.proAvatar}>{pro.name.slice(0, 2).toUpperCase()}</div>
                      <div>
                        <strong>{pro.name}</strong>
                        <small style={{ display: "block", color: "var(--text-muted)" }}>
                          {pro.jobTitle ?? "Especialista"}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 20 }}>
                  <button type="button" className={styles.actionBtn} onClick={() => setBookingStep(2)}>
                    Voltar
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Date & Time */}
            {bookingStep === 4 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                    Data do atendimento:
                  </label>
                  <input
                    type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      loadSlots(e.target.value, selectedEmployee);
                    }}
                    style={{
                      display: "block",
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

                <div>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                    Horários disponíveis:
                  </span>
                  <div className={styles.slotGrid} style={{ marginTop: 8 }}>
                    {availableSlots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        className={`${styles.slotBtn} ${selectedSlot === slot ? styles.slotBtnActive : ""}`}
                        onClick={() => handleSelectSlot(slot)}
                      >
                        {slot}
                      </button>
                    ))}
                    {availableSlots.length === 0 && (
                      <p style={{ gridColumn: "1 / -1", color: "var(--text-muted)", fontSize: "13px" }}>
                        Nenhum horário disponível para esta data. Selecione outro dia.
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 20 }}>
                  <button type="button" className={styles.actionBtn} onClick={() => setBookingStep(3)}>
                    Voltar
                  </button>
                </div>
              </div>
            )}

            {/* Step 5: Summary and Confirmation */}
            {bookingStep === 5 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div className={styles.summaryBox}>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Estabelecimento:</span>
                    <span className={styles.summaryValue}>{selectedCompany?.name}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Serviço:</span>
                    <span className={styles.summaryValue}>{selectedService?.name}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Profissional:</span>
                    <span className={styles.summaryValue}>{selectedEmployee?.name}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Data e Horário:</span>
                    <span className={styles.summaryValue}>
                      {selectedDate} às {selectedSlot}
                    </span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Duração estimada:</span>
                    <span className={styles.summaryValue}>{selectedService?.durationMinutes} min</span>
                  </div>
                  <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                    <span>Valor total:</span>
                    <span>R$ {Number(selectedService?.price || 0).toFixed(2).replace(".", ",")}</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button type="button" className={styles.actionBtn} onClick={() => setBookingStep(4)}>
                    Voltar
                  </button>
                  <button
                    type="button"
                    className={styles.ctaButton}
                    disabled={submittingBooking}
                    onClick={handleConfirmBooking}
                  >
                    {submittingBooking ? "Confirmando..." : "Confirmar agendamento"}
                  </button>
                </div>
              </div>
            )}

            {/* Step 6: Success screen */}
            {bookingStep === 6 && (
              <div className={styles.successCard}>
                <div className={styles.successIconWrapper}>
                  <CheckCircle2 size={32} />
                </div>
                <h3 style={{ fontSize: "20px", fontWeight: 750, margin: 0 }}>Seu horário está confirmado!</h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "14px", margin: 0 }}>
                  Enviamos os detalhes da sua reserva para o seu e-mail cadastrado.
                </p>

                <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", justifyContent: "center" }}>
                  <button
                    type="button"
                    className={styles.ctaButton}
                    onClick={() => setActiveTab("horarios")}
                  >
                    Ver meus horários
                  </button>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => {
                      setActiveTab("home");
                      setBookingStep(1);
                    }}
                  >
                    Voltar ao início
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MEUS HORÁRIOS */}
        {activeTab === "horarios" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ fontSize: "20px", fontWeight: 750, margin: 0 }}>Meus Agendamentos</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {upcomingBookings.map((b) => (
                <div key={b.id} className={styles.nextCard} style={{ padding: 18 }}>
                  <div className={styles.nextCardBody}>
                    <div className={styles.companyLogo}>
                      {b.companyName ? b.companyName.slice(0, 2).toUpperCase() : "NP"}
                    </div>
                    <div className={styles.appointmentInfo}>
                      <span className={styles.companyName}>
                        {b.companyName ?? "Estabelecimento"} · {b.locationName}
                      </span>
                      <strong className={styles.serviceName}>
                        {b.items?.[0]?.serviceName ?? "Atendimento"}
                      </strong>
                      <div className={styles.appointmentMeta}>
                        <span>{b.items?.[0]?.employeeName}</span>
                        <span>
                          {new Intl.DateTimeFormat("pt-BR", {
                            day: "numeric",
                            month: "long",
                            timeZone: "UTC",
                          }).format(new Date(b.startsAt))}
                        </span>
                        <span>{b.startsAt.slice(11, 16)}</span>
                      </div>
                    </div>
                    <span className={styles.appointmentStatusBadge}>
                      {STATUS_LABELS[b.status as keyof typeof STATUS_LABELS] ?? "Confirmado"}
                    </span>
                  </div>

                  <div className={styles.cardActions}>
                    <a
                      href={`/api/my/bookings/${b.id}/calendar`}
                      download
                      className={styles.actionBtn}
                    >
                      <Download size={13} /> Adicionar ao calendário
                    </a>
                    {b.companyAddress && (
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(b.companyAddress)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.actionBtn}
                      >
                        <MapPin size={13} /> Localização
                      </a>
                    )}
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                      onClick={() => setCancellingBooking(b)}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ))}

              {upcomingBookings.length === 0 && (
                <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                  Você não tem nenhum atendimento agendado para os próximos dias.
                </p>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: HISTÓRICO */}
        {activeTab === "historico" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ fontSize: "20px", fontWeight: 750, margin: 0 }}>Histórico de Atendimentos</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {pastBookings.map((b) => (
                <div key={b.id} className={styles.historyCard}>
                  <div className={styles.historyInfo}>
                    <span className={styles.historyDate}>
                      {new Intl.DateTimeFormat("pt-BR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        timeZone: "UTC",
                      }).format(new Date(b.startsAt))}{" "}
                      às {b.startsAt.slice(11, 16)}
                    </span>
                    <strong className={styles.historyService}>
                      {b.items?.[0]?.serviceName ?? "Atendimento"}
                    </strong>
                    <span className={styles.historySub}>
                      {b.companyName ?? "Estabelecimento"} · {b.items?.[0]?.employeeName} · R${" "}
                      {Number(b.total).toFixed(2).replace(".", ",")}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => handleBookAgain(b)}
                    >
                      <RotateCcw size={13} /> Agendar novamente
                    </button>
                    {!reviewedBookings.has(b.id) ? (
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => {
                          setReviewBooking(b);
                          setReviewRating(5);
                          setReviewComment("");
                        }}
                        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        <Star size={13} style={{ color: "#facc15" }} /> Avaliar
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--primary)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <CheckCircle2 size={13} /> Avaliado
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {pastBookings.length === 0 && (
                <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                  Nenhum atendimento anterior encontrado.
                </p>
              )}
            </div>
          </div>
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
                    window.location.href = "/";
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
            setBookingStep(1);
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
