/* eslint-disable react-hooks/set-state-in-effect -- Loads the authenticated portal snapshot when the shell mounts. */
"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
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
  LogIn,
  CalendarCheck2,
  Briefcase,
  Download,
  Star,
  ChevronRight,
  Search,
  Camera,
  Check,
  Phone,
  Upload,
  Trash2,
  Lock,
  ImageIcon,
  Save,
} from "lucide-react";
import { AVATAR_PRESETS, BANNER_PRESETS } from "@/lib/theme-utils";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { api, ApiError } from "@/lib/api-client";
import { useOptionalStore } from "@/store/store";
import { MyBookings } from "@/components/booking/my-bookings";
import type { BookingDetails } from "@/lib/booking/service";
import { ReserveiLogo } from "@/components/brand/novae-logo";
import { STATUS_LABELS } from "@/lib/client-utils";
import styles from "./client-portal.module.css";
import type { SessionInfo, CustomerMembershipDTO } from "@/shared/types";
import { MonthSchedulerModal } from "@/components/membership/month-scheduler-modal";

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
  primaryColor?: string | null;
};

type BookingItem = {
  id: string;
  name: string;
  serviceName: string;
  price: number;
  durationMinutes: number;
  date: string;
  startTime: string;
  endTime: string;
  employeeName: string;
};

type CustomerBooking = {
  id: string;
  companyId: string;
  companyName: string;
  companySlug?: string;
  companyAddress?: string | null;
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
  const store = useOptionalStore();
  const [activeTab, setActiveTab] = useState<ClientTab>("home");
  const [session, setSession] = useState<SessionInfo | null>(initialSession ?? null);
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [companies, setCompanies] = useState<PublicCompany[]>([]);
  const [companySearch, setCompanySearch] = useState("");
  const [customerMembership, setCustomerMembership] = useState<CustomerMembershipDTO | null>(null);
  const [monthSchedulerOpen, setMonthSchedulerOpen] = useState(false);
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

  // Profile editing state
  const [profileName, setProfileName] = useState(session?.name ?? "");
  const [profilePhone, setProfilePhone] = useState(session?.phone ?? "");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(session?.avatarUrl ?? null);
  const [profileBannerUrl, setProfileBannerUrl] = useState<string | null>(session?.bannerUrl ?? null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  useEffect(() => {
    if (session) {
      setProfileName(session.name ?? "");
      setProfilePhone(session.phone ?? "");
      setProfileAvatarUrl(session.avatarUrl ?? null);
      setProfileBannerUrl(session.bannerUrl ?? null);
    }
  }, [session]);

  // Load session & customer data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const sessData = await api<SessionInfo>("/api/auth/session").catch(() => null);
      if (sessData) setSession(sessData);

      const companiesData = await api<PublicCompany[]>("/api/companies/public").catch(() => []);
      if (Array.isArray(companiesData)) setCompanies(companiesData);

      const memData = await api<CustomerMembershipDTO>("/api/my/membership").catch(() => null);
      if (memData) setCustomerMembership(memData);

      const rawBookings = await api<BookingDetails[]>("/api/my/bookings").catch(() => []);
      if (Array.isArray(rawBookings)) {
        const parsedBookings: CustomerBooking[] = rawBookings
          .filter(Boolean)
          .map((row) => ({
            ...row,
            startsAt: String(row.startsAt ?? ""),
            endsAt: String(row.endsAt ?? ""),
            total: Number(row.total ?? 0),
            companyName: row.company?.name ?? "Empresa",
            companySlug: row.company?.slug ?? undefined,
            companyAddress: row.company?.address ?? null,
            locationName: "",
            items: (row.items || []).map((i) => ({
              ...i,
              serviceName: i.name ?? "Serviço",
              price: Number(i.price ?? 0),
            })),
          }));
        setBookings(parsedBookings);
      }
    } catch (err) {
      console.warn("ClientPortal: carregamento resiliente", err);
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

  const filteredCompanies = companies.filter((c) => {
    if (!companySearch.trim()) return true;
    const q = companySearch.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.businessType?.toLowerCase().includes(q) ||
      c.address?.toLowerCase().includes(q)
    );
  });
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

  const formatPhoneInput = (val: string): string => {
    const digits = val.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits.length ? `(${digits}` : "";
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("A foto de perfil deve ter no máximo 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setProfileAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleBannerFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError("A capa deve ter no máximo 8MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setProfileBannerUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingProfile(true);
    setError(null);
    setProfileSuccess(false);
    try {
      const res = await api<{
        ok: boolean;
        name: string;
        avatarUrl?: string | null;
        bannerUrl?: string | null;
      }>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: profileName.trim(),
          phone: profilePhone.trim() || null,
          avatarUrl: profileAvatarUrl,
          bannerUrl: profileBannerUrl,
        }),
      });

      const finalAvatar = res?.avatarUrl !== undefined ? res.avatarUrl : profileAvatarUrl;
      const finalBanner = res?.bannerUrl !== undefined ? res.bannerUrl : profileBannerUrl;
      if (finalAvatar !== undefined) setProfileAvatarUrl(finalAvatar);
      if (finalBanner !== undefined) setProfileBannerUrl(finalBanner);

      if (session) {
        setSession({
          ...session,
          name: profileName.trim(),
          phone: profilePhone.trim() || null,
          avatarUrl: finalAvatar,
          bannerUrl: finalBanner,
        });
      }
      if (store?.reloadSession) {
        void store.reloadSession();
      }
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 4000);
    } catch (err) {
      setError((err as Error).message || "Erro ao salvar alterações no perfil.");
    } finally {
      setSavingProfile(false);
    }
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
              style={{ overflow: "hidden", padding: 0 }}
            >
              {(profileAvatarUrl || session?.avatarUrl) ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={profileAvatarUrl || session?.avatarUrl || ""}
                  alt={session?.name ?? "Avatar"}
                  loading="lazy"
                  decoding="async"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              ) : session?.name ? (
                session.name[0].toUpperCase()
              ) : (
                "C"
              )}
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
              background: "var(--primary-soft)",
              color: "var(--primary)",
              border: "1px solid var(--border)",
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

            {/* Active Membership Banner */}
            {customerMembership && customerMembership.status === "active" && (
              <section
                style={{
                  background: "var(--portal-card, #16161b)",
                  border: "1px solid var(--portal-border, #27272f)",
                  borderRadius: "14px",
                  padding: "18px 20px",
                  marginBottom: "20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "14px",
                }}
              >
                <div>
                  <span
                    style={{
                      background: "rgba(99,102,241,0.2)",
                      color: "var(--primary, #6366f1)",
                      border: "1px solid rgba(99,102,241,0.3)",
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "12px",
                      textTransform: "uppercase",
                    }}
                  >
                    ★ Seu Plano Mensal Ativo
                  </span>
                  <h3 style={{ margin: "6px 0 2px", fontSize: "17px", fontWeight: 700 }}>
                    {customerMembership.membershipPlanName}
                  </h3>
                  <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)" }}>
                    Franquia do mês: <strong>{customerMembership.currentPeriod?.sessionsBooked || 0} de {customerMembership.currentPeriod?.sessionAllowance || 4} reservas</strong> (restam {customerMembership.currentPeriod?.sessionsRemaining || 0})
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setMonthSchedulerOpen(true)}
                  style={{
                    background: "var(--primary, #6366f1)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "10px 16px",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <CalendarPlus size={15} />
                  <span>Agendar Horários do Mês</span>
                </button>
              </section>
            )}

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
            <div className={styles.flowHeader}>
              <div className={styles.flowHeaderInfo}>
                <h2 className={styles.flowHeaderTitle}>Escolha o estabelecimento</h2>
                <p className={styles.flowHeaderSubtitle}>
                  Selecione onde deseja ser atendido para consultar serviços e horários disponíveis
                </p>
              </div>
              <span className={styles.flowProgress}>
                <Sparkles size={13} /> {filteredCompanies.length} disponíveis
              </span>
            </div>

            <div className={styles.searchBarWrapper}>
              <Search size={15} />
              <input
                type="text"
                placeholder="Buscar por nome, especialidade ou endereço..."
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                className={styles.searchBarInput}
              />
              {companySearch && (
                <button
                  type="button"
                  onClick={() => setCompanySearch("")}
                  style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "grid", placeItems: "center" }}
                  aria-label="Limpar busca"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className={styles.companyGrid}>
              {filteredCompanies.length === 0 ? (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "44px 20px", color: "var(--text-muted)", fontSize: "14px" }}>
                  Nenhum estabelecimento encontrado com &quot;{companySearch}&quot;.
                </div>
              ) : (
                filteredCompanies.map((comp) => (
                  <button
                    type="button"
                    key={comp.id}
                    className={styles.companyCard}
                    onClick={() => handleSelectCompany(comp)}
                  >
                    <div className={styles.companyLogo}>
                      {comp.logoUrl ? (
                        <Image
                          src={comp.logoUrl}
                          alt={comp.name}
                          width={48}
                          height={48}
                          unoptimized
                          style={{ width: "100%", height: "100%", borderRadius: 12, objectFit: "cover" }}
                        />
                      ) : (
                        comp.name.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className={styles.companyCardContent}>
                      <strong className={styles.companyCardName}>
                        {comp.name}
                      </strong>
                      <span className={styles.companyCardTag}>
                        {comp.businessType ?? "Atendimento"}
                      </span>
                      {comp.address && (
                        <span className={styles.companyCardAddress}>
                          <MapPin size={11} style={{ flexShrink: 0 }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {comp.address}
                          </span>
                        </span>
                      )}
                    </div>
                    <div className={styles.companyCardArrow}>
                      <ChevronRight size={16} />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
        {(activeTab === "horarios" || activeTab === "historico") && (
          session ? (
            <MyBookings
              embedded
              initialTab={activeTab === "historico" ? "Anteriores" : "Próximos"}
              initialUser={{
                id: session.userId,
                name: session.name,
                email: session.email,
                phone: session.phone ?? null,
                emailVerified: session.emailVerified,
              }}
            />
          ) : (
            <div className={styles.emptyCard}>
              <div className={styles.emptyIconWrapper}>
                <CalendarDays size={24} />
              </div>
              <h3 className={styles.emptyTitle}>Entre na sua conta para ver seus agendamentos</h3>
              <p className={styles.emptySubtitle}>
                Acesse sua conta para consultar histórico, acompanhar seus próximos atendimentos ou fazer remarcações.
              </p>
              <button
                type="button"
                className={styles.ctaButton}
                onClick={() => router.push("/login?callback=/cliente")}
              >
                <LogIn size={16} />
                <span>Entrar na minha conta</span>
              </button>
            </div>
          )
        )}

        {/* TAB 5: PERFIL */}
        {activeTab === "perfil" && (
          session ? (
            <div className={styles.flowContainer}>
              <div className={styles.profileCard}>
                {/* Banner Header */}
                <div className={styles.profileBannerWrap}>
                  {profileBannerUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={profileBannerUrl} alt="Capa de perfil" loading="lazy" decoding="async" className={styles.profileBannerImg} />
                  ) : (
                    <div className={styles.profileBannerFallback}>
                      <ImageIcon size={28} />
                    </div>
                  )}
                  <div className={styles.profileBannerActions}>
                    <label className={styles.bannerActionBtn} title="Fazer upload de imagem de capa">
                      <Upload size={13} />
                      <span>Alterar capa</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleBannerFileUpload}
                        style={{ display: "none" }}
                      />
                    </label>
                    {profileBannerUrl && (
                      <button
                        type="button"
                        className={`${styles.bannerActionBtn} ${styles.bannerActionBtnDanger}`}
                        onClick={() => setProfileBannerUrl(null)}
                        title="Remover capa"
                      >
                        <Trash2 size={13} />
                        <span>Remover</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Avatar & Header Meta */}
                <div className={styles.profileHeaderMeta}>
                  <div className={styles.profileAvatarContainer}>
                    {profileAvatarUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={profileAvatarUrl} alt="Foto de perfil" loading="lazy" decoding="async" className={styles.profileAvatarImg} />
                    ) : (
                      <div className={styles.profileAvatarFallback}>
                        {profileName ? profileName[0].toUpperCase() : "C"}
                      </div>
                    )}
                    <label className={styles.avatarUploadOverlay} title="Alterar foto de perfil">
                      <Camera size={18} />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarFileUpload}
                        style={{ display: "none" }}
                      />
                    </label>
                  </div>

                  <div className={styles.profileAvatarBtns}>
                    <label className={styles.bannerActionBtn} style={{ background: "var(--portal-card)" }}>
                      <Camera size={13} />
                      <span>Foto</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarFileUpload}
                        style={{ display: "none" }}
                      />
                    </label>
                    {profileAvatarUrl && (
                      <button
                        type="button"
                        className={`${styles.bannerActionBtn} ${styles.bannerActionBtnDanger}`}
                        onClick={() => setProfileAvatarUrl(null)}
                        title="Remover foto"
                        style={{ background: "var(--portal-card)" }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Profile Body & Form */}
                <form className={styles.profileBody} onSubmit={handleSaveProfile}>
                  <div className={styles.profileSectionHeader}>
                    <h2 className={styles.profileTitle}>Meu Perfil</h2>
                    <p className={styles.profileSubtitle}>
                      Atualize seu nome, número de telefone celular cadastrado e personalize seu avatar e capa.
                    </p>
                  </div>

                  <div className={styles.profileGrid}>
                    <div className={styles.profileField}>
                      <label className={styles.profileLabel}>
                        <span>Nome completo</span>
                      </label>
                      <div className={styles.profileInputWrapper}>
                        <UserRound size={15} className={styles.profileInputIcon} />
                        <input
                          type="text"
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          placeholder="Seu nome completo"
                          className={`${styles.profileInput} ${styles.profileInputWithIcon}`}
                          required
                        />
                      </div>
                    </div>

                    <div className={styles.profileField}>
                      <label className={styles.profileLabel}>
                        <span>Telefone / WhatsApp</span>
                        <span className={styles.profileLabelHint}>Confirmado</span>
                      </label>
                      <div className={styles.profileInputWrapper}>
                        <Phone size={15} className={styles.profileInputIcon} />
                        <input
                          type="tel"
                          value={profilePhone}
                          onChange={(e) => setProfilePhone(formatPhoneInput(e.target.value))}
                          placeholder="(11) 99999-9999"
                          className={`${styles.profileInput} ${styles.profileInputWithIcon}`}
                        />
                      </div>
                      <p className={styles.profileInputHelp}>
                        Usado para envio de lembretes e confirmações dos seus horários.
                      </p>
                    </div>

                    <div className={`${styles.profileField} ${styles.profileFieldFull}`}>
                      <label className={styles.profileLabel}>
                        <span>E-mail da conta</span>
                        <span className={styles.profileLabelHint}>Identificador seguro</span>
                      </label>
                      <div className={styles.profileInputWrapper}>
                        <Lock size={15} className={styles.profileInputIcon} />
                        <input
                          type="email"
                          value={session?.email ?? ""}
                          disabled
                          className={`${styles.profileInput} ${styles.profileInputWithIcon} ${styles.profileInputDisabled}`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Presets de Foto de Perfil */}
                  <div className={styles.presetGroup}>
                    <span className={styles.presetTitle}>Ou escolha um avatar rápido:</span>
                    <div className={styles.avatarPresetsList}>
                      {AVATAR_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          className={`${styles.avatarPresetItem} ${profileAvatarUrl === preset.url ? styles.avatarPresetItemActive : ""}`}
                          onClick={() => setProfileAvatarUrl(preset.url)}
                          title={preset.name}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={preset.url} alt={preset.name} loading="lazy" decoding="async" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Presets de Capa / Banner */}
                  <div className={styles.presetGroup}>
                    <span className={styles.presetTitle}>Opções de capa sólida / minimalista:</span>
                    <div className={styles.bannerPresetsList}>
                      {BANNER_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          className={`${styles.bannerPresetItem} ${profileBannerUrl === preset.url ? styles.bannerPresetItemActive : ""}`}
                          onClick={() => setProfileBannerUrl(preset.url)}
                          title={preset.name}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={preset.url} alt={preset.name} loading="lazy" decoding="async" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Feedback / Save Actions */}
                  <div className={styles.profileFooterActions}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <button
                        type="submit"
                        disabled={savingProfile}
                        className={styles.saveProfileBtn}
                      >
                        {savingProfile ? (
                          <>Salvando...</>
                        ) : (
                          <>
                            <Check size={15} />
                            <span>Salvar alterações</span>
                          </>
                        )}
                      </button>

                      {profileSuccess && (
                        <span className={styles.profileSuccessBadge}>
                          <CheckCircle2 size={14} /> Perfil atualizado!
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      className={styles.logoutBtn}
                      onClick={async () => {
                        await api("/api/auth/logout", { method: "POST" }).catch(() => {});
                        if (onLogout) {
                          onLogout();
                        } else {
                          window.location.href = "/login";
                        }
                      }}
                    >
                      <LogOut size={14} /> Sair da conta
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <div className={styles.emptyCard}>
              <div className={styles.emptyIconWrapper}>
                <User size={24} />
              </div>
              <h3 className={styles.emptyTitle}>Entre para gerenciar seu perfil</h3>
              <p className={styles.emptySubtitle}>
                Acesse sua conta para atualizar telefone, fotos e preferências.
              </p>
              <button
                type="button"
                className={styles.ctaButton}
                onClick={() => router.push("/login?callback=/cliente")}
              >
                <LogIn size={16} />
                <span>Entrar na minha conta</span>
              </button>
            </div>
          )
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

      {customerMembership && (
        <MonthSchedulerModal
          customerMembershipId={customerMembership.id}
          clientName={clientName}
          isOpen={monthSchedulerOpen}
          onClose={() => setMonthSchedulerOpen(false)}
          onSuccess={() => {
            setMonthSchedulerOpen(false);
            setSuccessMsg("Horários do mês agendados com sucesso!");
            void loadData();
          }}
          notify={(msg, type) => {
            if (type === "error") setError(msg);
            else setSuccessMsg(msg);
          }}
        />
      )}
    </div>
  );
}
