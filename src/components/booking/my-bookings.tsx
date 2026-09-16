/* eslint-disable react-hooks/set-state-in-effect -- Synchronizes server availability, URL state and persisted booking drafts. */
"use client";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  Check,
  Clock3,
  ExternalLink,
  FileText,
  History,
  MapPin,
  Phone,
  RotateCcw,
  Share2,
  Sparkles,
  UserRound,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { api } from "@/lib/api-client";
import type { BookingDetails } from "@/lib/booking/service";
import type { PublicCatalog } from "@/lib/booking/catalog";
import type { AvailableSlot } from "@/lib/booking/engine";
import { STATUS_LABELS } from "@/lib/client-utils";
import type { AppointmentStatus } from "@/shared/types";
import { AvailabilityPicker } from "./availability-picker";
import { CustomerAuth, type Customer } from "./customer-auth";
import { AuthScreen } from "@/components/auth/auth-screen";
import {
  b,
  BookingAvatar,
  dateLabel,
  friendlyTimezone,
  ErrorMessage,
  money,
  Price,
  PublicFrame,
  Skeleton,
} from "./primitives";
type Detail = Omit<BookingDetails, "startsAt" | "endsAt"> & {
  startsAt: string;
  endsAt: string;
};
export function MyBookings({
  embedded = false,
  initialTab = "Próximos",
  initialUser = null,
}: {
  embedded?: boolean;
  initialTab?: string;
  initialUser?: Customer | null;
}) {
  const Content = embedded ? "section" : "main";
  const [user, setUser] = useState<Customer | null>(initialUser),
    [rows, setRows] = useState<Detail[]>([]),
    [loading, setLoading] = useState(false),
    [tab, setTab] = useState(initialTab),
    [error, setError] = useState(""),
    [selected, setSelected] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [action, setAction] = useState<"cancel" | "reschedule" | null>(null),
    [catalog, setCatalog] = useState<PublicCatalog | null>(null),
    [date, setDate] = useState(""),
    [slot, setSlot] = useState<AvailableSlot | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const onReady = useCallback((u: Customer) => setUser(u), []);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<Detail[]>("/api/my/bookings");
      setRows(Array.isArray(data) ? data : []);
      setError("");
    } catch (e) {
      setRows([]);
      const msg = (e as Error).message ?? "";
      if (
        !msg.toLowerCase().includes("entre") &&
        !msg.toLowerCase().includes("login") &&
        !msg.toLowerCase().includes("unauthorized")
      ) {
        setError(msg);
      } else {
        setError("");
      }
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (user) void load();
  }, [user, load]);
  useEffect(() => {
    if (initialUser) setUser(initialUser);
  }, [initialUser]);
  useEffect(() => {
    let active = true;
    api<Customer | null>("/api/my/session")
      .then((identity) => {
        if (active && identity) setUser(identity);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setSelected(q.get("booking") || "");
    setConfirmed(q.get("confirmed") === "1");
    const token = q.get("verify");
    if (token)
      void api("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ token }),
      })
        .then(() => {
          setMessage("E-mail confirmado. Você já pode concluir sua reserva.");
          window.history.replaceState({}, "", window.location.pathname);
        })
        .catch((e) => setError(e.message));
  }, []);
  useEffect(() => { setTab(initialTab); }, [initialTab]);
  const current = rows.find((r) => r.id === selected);
  async function change() {
    if (!current || !action) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/my/bookings/${current.id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ date, startTime: slot?.startTime }),
      });
      setAction(null);
      setMessage(
        action === "cancel"
          ? "Agendamento cancelado."
          : "Seu horário foi atualizado.",
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
      setSlot(null);
    } finally {
      setBusy(false);
    }
  }
  async function reschedule(booking = current) {
    if (!booking) return;
    setSelected(booking.id);
    setBusy(true);
    setError("");
    try {
      const c = await api<PublicCatalog>(`/api/public/${booking.company.slug}`);
      setCatalog(c);
      setDate("");
      setSlot(null);
      setAction("reschedule");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function repeat(booking: Detail) {
    const q = new URLSearchParams({ items: JSON.stringify(booking.items.map(i => ({ serviceId: i.serviceId, employeeId: i.employeeId }))), location: booking.locationId });
    window.location.assign(`/agendar/${booking.company.slug}?${q}`);
  }
  useEffect(() => {
    if (!current) return;
    const q = new URLSearchParams(window.location.search);
    const requested = q.get("action");
    if (!requested) return;
    q.delete("action");
    window.history.replaceState({}, "", `${window.location.pathname}?${q}`);
    if (requested === "reschedule" && current.canChange) void reschedule(current);
    if (requested === "repeat") repeat(current);
    // The URL action is consumed once and removed before these functions mutate state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);
  const visible = rows.filter((r) =>
    tab === "Cancelados"
      ? r.status === "cancelled"
      : tab === "Anteriores"
        ? r.status !== "cancelled" &&
          (new Date(r.endsAt) < new Date() ||
            r.status === "completed" ||
            r.status === "no_show")
        : r.status !== "cancelled" &&
          r.status !== "completed" &&
          r.status !== "no_show" &&
          new Date(r.endsAt) >= new Date(),
  ).sort((a,b) => tab === "Próximos" ? a.startsAt.localeCompare(b.startsAt) : b.startsAt.localeCompare(a.startsAt));
  const stamp = (v: string) =>
    new Date(v)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");

  if (!user && !embedded) {
    return (
      <AuthScreen
        initialMode="reservas"
        onAuthenticated={async (needsOnboarding) => {
          if (needsOnboarding) {
            window.location.assign("/");
            return;
          }
          try {
            const identity = await api<Customer | null>("/api/my/session");
            setUser(identity);
            if (identity) void load();
          } catch {
            window.location.reload();
          }
        }}
      />
    );
  }

  const content = (
      <Content className={`${b.main} ${current ? b.success : ""} ${user && !current ? b.bookingsPage : ""}`}>
        {error &&
          !error.toLowerCase().includes("entre") &&
          !error.toLowerCase().includes("login") &&
          !error.toLowerCase().includes("sessão") && (
            <ErrorMessage message={error} />
          )}
        {message && (
          <div className={b.note} role="status">
            {message}
          </div>
        )}
        {!user ? (
          <div className={b.authContainer}>
            <div className={b.authHero}>
              <div className={b.authHeroIcon}>
                <UserRound size={26} />
              </div>
              <span className={b.authHeroBadge}>Área do Cliente</span>
              <h1 className={b.title}>Seus agendamentos em um só lugar</h1>
              <p className={b.subtitle}>
                Entre na sua conta para acompanhar seus próximos horários, histórico e alterações.
              </p>
            </div>
            <CustomerAuth onReady={onReady} requireVerified={false} />
          </div>
        ) : loading ? (
          <div className={b.detailContainer}>
            <Skeleton label="Buscando seus agendamentos…" />
          </div>
        ) : current ? (
          <div className={b.detailContainer}>
            {confirmed ? (
              <div className={b.detailHero}>
                <div className={b.detailCheckWrap}>
                  <Check size={34} strokeWidth={2.5} />
                </div>
                <span className={b.detailBadge}>
                  <Sparkles size={13} />
                  Está tudo certo
                </span>
                <h1 className={b.detailTitle}>Agendamento confirmado!</h1>
                <p className={b.detailSubtitle}>
                  Seu horário está reservado. Esperamos você no estabelecimento!
                </p>
              </div>
            ) : (
              <>
                <div className={b.detailTopNav}>
                  <button
                    type="button"
                    className={b.backLink}
                    onClick={() => {
                      setSelected("");
                      setAction(null);
                      window.history.replaceState({}, "", "/meus-agendamentos");
                    }}
                  >
                    <ArrowLeft size={16} /> Voltar para meus agendamentos
                  </button>
                </div>
                <div className={b.detailHeroCompact}>
                  <span className={b.detailBadge}>
                    <CalendarDays size={13} />
                    Seu próximo encontro
                  </span>
                  <h1 className={b.detailTitle}>Detalhes do agendamento</h1>
                  <p className={b.detailSubtitle}>{current.company.name}</p>
                </div>
              </>
            )}

            <article className={b.detailCard}>
              <div className={b.detailCardHeader}>
                <div className={b.detailCompanyInfo}>
                  {current.company.logoUrl ? (
                    <Image
                      src={current.company.logoUrl}
                      alt={current.company.name}
                      width={44}
                      height={44}
                      className={b.detailCompanyAvatar}
                      unoptimized
                    />
                  ) : (
                    <span className={b.detailCompanyAvatar}>
                      {current.company.name.slice(0, 1)}
                    </span>
                  )}
                  <div>
                    <h2 className={b.detailCompanyName}>{current.company.name}</h2>
                    {current.company.businessType && (
                      <span className={b.detailCompanyCategory}>
                        {current.company.businessType}
                      </span>
                    )}
                  </div>
                </div>
                <span className={b.bookingStatus}>
                  {STATUS_LABELS[current.status as AppointmentStatus] ?? current.status}
                </span>
              </div>

              <div className={b.detailHighlightBox}>
                <div className={b.detailHighlightRow}>
                  <CalendarDays size={18} />
                  <div>
                    <small>Data</small>
                    <strong>
                      {dateLabel(
                        current.items[0]?.date ?? current.startsAt.slice(0, 10),
                      )}
                    </strong>
                  </div>
                </div>
                <div className={b.detailHighlightRow}>
                  <Clock3 size={18} />
                  <div>
                    <small>Horário</small>
                    <strong>
                      {current.items[0]?.startTime.slice(0, 5)} –{" "}
                      {current.items.at(-1)?.endTime.slice(0, 5)}
                      <span className={b.detailTimezone}>
                        {" "}· {friendlyTimezone(current.timezone)}
                      </span>
                    </strong>
                  </div>
                </div>
                {current.company.address && (
                  <div className={b.detailHighlightRow}>
                    <MapPin size={18} />
                    <div>
                      <small>Endereço</small>
                      <strong>{current.company.address}</strong>
                    </div>
                  </div>
                )}
              </div>

              <div className={b.detailSection}>
                <span className={b.detailSectionTitle}>Serviço(s) selecionado(s)</span>
                <div className={b.detailItemsList}>
                  {current.items.map((i) => (
                    <div className={b.detailItemRow} key={i.id}>
                      <div className={b.detailItemProfessional}>
                        <BookingAvatar
                          name={i.employeeName}
                          src={i.employeePhotoUrl}
                          size="sm"
                        />
                        <div>
                          <strong>{i.name}</strong>
                          <small>
                            {i.employeeName} · {i.employeeJobTitle || "Profissional"}
                          </small>
                        </div>
                      </div>
                      <div className={b.detailItemRight}>
                        <span className={b.detailItemTime}>
                          {i.startTime.slice(0, 5)} – {i.endTime.slice(0, 5)}
                        </span>
                        <Price amount={i.price} className={b.detailItemPrice} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {current.products.length > 0 && (
                <div className={b.detailProductsList}>
                  {current.products.map((p) => (
                    <div className={b.detailProductRow} key={p.productId}>
                      <span>
                        {p.quantity} × {p.name}
                      </span>
                      <span>{money(Number(p.unitPrice) * p.quantity)}</span>
                    </div>
                  ))}
                </div>
              )}

              {Number(current.discount) > 0 && (
                <div className={b.detailDiscountRow}>
                  <span>Desconto</span>
                  <span className={b.detailDiscountValue}>
                    −{money(current.discount)}
                  </span>
                </div>
              )}

              <div className={b.detailTotalBox}>
                <div className={b.detailTotalLabel}>
                  <span>Total da reserva</span>
                  <small>Pagamento no atendimento</small>
                </div>
                <strong className={b.detailTotalPrice}>{money(current.total)}</strong>
              </div>

              {current.notes && (
                <div className={b.detailNotesBox}>
                  <div className={b.detailNotesHeader}>
                    <FileText size={14} />
                    <span>Sua observação</span>
                  </div>
                  <p className={b.detailNotesText}>{current.notes}</p>
                </div>
              )}
            </article>

            {action === "reschedule" && catalog ? (
              <div className={b.detailCard}>
                <div className={b.rescheduleHeader}>
                  <RotateCcw size={20} />
                  <div>
                    <h3>Escolha seu novo horário</h3>
                    <p>Selecione uma data e horário disponível para remarcar seu atendimento.</p>
                  </div>
                </div>
                <AvailabilityPicker
                  slug={catalog.company.slug}
                  locationId={current.locationId}
                  items={current.items.map((i) => ({
                    serviceId: i.serviceId,
                    employeeId: i.employeeId,
                  }))}
                  today={catalog.today}
                  maxLeadDays={catalog.settings.maxLeadDays}
                  date={date}
                  onDate={setDate}
                  selected={slot}
                  onSelect={setSlot}
                  bookingId={current.id}
                />
                <div className={b.rescheduleActions}>
                  <button
                    className={`${b.button} ${b.wide}`}
                    disabled={!slot || busy}
                    onClick={change}
                  >
                    {busy ? "Remarcando…" : "Confirmar novo horário"}
                  </button>
                  <button
                    className={`${b.button} ${b.outline} ${b.wide}`}
                    onClick={() => setAction(null)}
                  >
                    Manter meu horário atual
                  </button>
                </div>
              </div>
            ) : action === "cancel" ? (
              <div className={b.cancelPromptCard}>
                <div className={b.cancelPromptIcon}>
                  <AlertCircle size={28} />
                </div>
                <h3>Cancelar este agendamento?</h3>
                <p>O horário será liberado imediatamente para outras pessoas no estabelecimento.</p>
                <div className={b.cancelPromptActions}>
                  <button
                    className={`${b.button} ${b.cancelButtonDanger}`}
                    disabled={busy}
                    onClick={change}
                  >
                    {busy ? "Cancelando…" : "Sim, confirmar cancelamento"}
                  </button>
                  <button
                    className={`${b.button} ${b.outline}`}
                    onClick={() => setAction(null)}
                  >
                    Não, manter agendamento
                  </button>
                </div>
              </div>
            ) : (
              <div className={b.detailActionsGroup}>
                <div className={b.detailActionRow}>
                  <a
                    className={`${b.button} ${b.calendarPrimaryBtn}`}
                    href={`/api/my/bookings/${current.id}/calendar`}
                    title="Baixar arquivo de calendário (.ics)"
                  >
                    <CalendarPlus size={16} /> Adicionar ao calendário
                  </a>
                  <a
                    className={`${b.button} ${b.outline}`}
                    target="_blank"
                    rel="noreferrer"
                    href={`https://calendar.google.com/calendar/render?${new URLSearchParams({ action: "TEMPLATE", text: current.items.map((i) => i.name).join(" + "), dates: `${stamp(current.startsAt)}/${stamp(current.endsAt)}`, location: current.company.address ?? current.company.name })}`}
                  >
                    <ExternalLink size={15} /> Google Calendar
                  </a>
                  <button
                    className={`${b.button} ${b.outline}`}
                    onClick={async () => {
                      const url = `${window.location.origin}/agendar/${current.company.slug}`;
                      try {
                        if (navigator.share)
                          await navigator.share({
                            title: current.company.name,
                            text: "Agende seu horário",
                            url,
                          });
                        else {
                          await navigator.clipboard.writeText(url);
                          setMessage("Link do estabelecimento copiado.");
                        }
                      } catch (e) {
                        if ((e as Error).name !== "AbortError")
                          setError("Não foi possível compartilhar.");
                      }
                    }}
                  >
                    <Share2 size={15} /> Compartilhar
                  </button>
                </div>
                <p className={b.calendarHintText}>
                  Compatível com Apple Calendar, Google Calendar e Outlook.
                </p>

                <div className={b.detailPolicyBox}>
                  <AlertCircle size={18} />
                  <div>
                    <strong>Política de alterações</strong>
                    <p>
                      {current.company.cancellationHours < 0
                        ? "Cancelamento e remarcação diretamente com o estabelecimento."
                        : `Você pode cancelar ou remarcar seu atendimento gratuitamente até ${current.company.cancellationHours} horas antes do horário reservado.`}
                    </p>
                  </div>
                </div>

                {current.canChange && (
                  <div className={b.detailActionRow}>
                    <button
                      className={`${b.button} ${b.outline}`}
                      disabled={busy}
                      onClick={() => reschedule()}
                    >
                      <RotateCcw size={15} /> Remarcar horário
                    </button>
                    <button
                      className={`${b.button} ${b.cancelOutlineBtn}`}
                      onClick={() => setAction("cancel")}
                    >
                      Cancelar agendamento
                    </button>
                  </div>
                )}

                <div className={b.detailActionRow}>
                  {current.status === "completed" && (
                    <button
                      className={`${b.button} ${b.outline}`}
                      onClick={() => repeat(current)}
                    >
                      <RotateCcw size={15} /> Agendar novamente
                    </button>
                  )}
                  {current.company.address && (
                    <a
                      className={`${b.button} ${b.outline}`}
                      target="_blank"
                      rel="noreferrer"
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(current.company.address)}`}
                    >
                      <MapPin size={15} /> Como chegar
                    </a>
                  )}
                  {current.company.phone && (
                    <a
                      className={`${b.button} ${b.outline}`}
                      href={`tel:${current.company.phone.replace(/[^+\d]/g, "")}`}
                    >
                      <Phone size={15} /> Entrar em contato
                    </a>
                  )}
                  {current.company.phone && (
                    <a
                      className={`${b.button} ${b.outline} whatsapp-button`}
                      target="_blank"
                      rel="noreferrer"
                      href={`https://wa.me/${current.company.phone.replace(/\D/g, "").length <= 11 ? "55" : ""}${current.company.phone.replace(/\D/g, "")}`}
                    >
                      <WhatsAppIcon size={15} /> WhatsApp
                    </a>
                  )}
                </div>
              </div>
            )}

            <button
              type="button"
              className={b.detailBackLink}
              onClick={() => {
                setSelected("");
                setConfirmed(false);
                setAction(null);
                window.history.replaceState({}, "", "/meus-agendamentos");
              }}
            >
              <ArrowLeft size={16} /> Ver todos os meus agendamentos
            </button>
          </div>
        ) : (

          <>
            <header className={b.bookingsHeader}>
              <div>
                <span className={b.bookingsBadge}>
                  <UserRound size={12} /> {user.name ? `Olá, ${user.name.split(" ")[0]}` : "Área do Cliente"}
                </span>
                <h1 className={b.title}>
                  {tab === "Anteriores"
                    ? "Histórico de agendamentos"
                    : tab === "Cancelados"
                      ? "Agendamentos cancelados"
                      : "Meus agendamentos"}
                </h1>
                <p className={b.subtitle}>
                  {tab === "Anteriores"
                    ? "Consulte seus atendimentos realizados e serviços anteriores."
                    : tab === "Cancelados"
                      ? "Histórico de horários e reservas desmarcadas."
                      : "Gerencie seus próximos horários confirmados e consulte seu histórico."}
                </p>
              </div>
              {!embedded && (
                <button
                  className={`${b.button} ${b.outline} ${b.small}`}
                  onClick={async () => {
                    await api("/api/auth/logout", { method: "POST" });
                    setUser(null);
                    setRows([]);
                  }}
                >
                  Sair
                </button>
              )}
            </header>
            <div className={b.bookingTabs} role="tablist" aria-label="Filtrar agendamentos">
              {(["Próximos", "Anteriores", "Cancelados"] as const).map((t) => {
                const count = rows.filter((row) =>
                  t === "Cancelados"
                    ? row.status === "cancelled"
                    : t === "Anteriores"
                      ? row.status !== "cancelled" &&
                        (new Date(row.endsAt) < new Date() ||
                          row.status === "completed" ||
                          row.status === "no_show")
                      : row.status !== "cancelled" &&
                        row.status !== "completed" &&
                        row.status !== "no_show" &&
                        new Date(row.endsAt) >= new Date(),
                ).length;
                return (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === t}
                    className={`${b.bookingTab} ${tab === t ? b.bookingTabActive : ""}`}
                    key={t}
                    onClick={() => setTab(t)}
                  >
                    <span>{t}</span>
                    <span className={b.bookingTabBadge}>{count}</span>
                  </button>
                );
              })}
            </div>
            {visible.length ? (
              <div className={b.bookingCards}>
                {visible.map((r, index) => {
                  const featured = tab === "Próximos" && index === 0;
                  const isUsed = tab === "Anteriores";
                  const isCancelled = tab === "Cancelados";
                  const firstItem = r.items[0];
                  const bookingDate = firstItem?.date ?? r.startsAt.slice(0,10);
                  const dateParts = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).formatToParts(new Date(`${bookingDate}T12:00:00Z`));
                  const day = dateParts.find((part) => part.type === "day")?.value;
                  const month = dateParts.find((part) => part.type === "month")?.value.replace(".", "");
                  return (
                    <article
                      className={`${featured ? b.featuredBookingCard : b.bookingCardCompact} ${b.ticketCard} ${isUsed ? b.ticketUsed : ""} ${isCancelled ? b.ticketCancelled : ""}`}
                      key={r.id}
                      style={{ "--card-brand": isUsed || isCancelled ? undefined : r.company.color } as React.CSSProperties}
                    >
                      <div className={b.bookingDateBlock}>
                        <span>{day}</span>
                        <strong>{month}</strong>
                      </div>
                      <div className={b.bookingCardBody}>
                        {featured && <p className={b.bookingKicker}><CalendarDays size={14} /> Próximo agendamento</p>}
                        <div className={b.bookingCardTitleRow}>
                          <div>
                            <p className={b.bookingFullDate}>{dateLabel(bookingDate)}</p>
                            <h2>{r.items.map((item) => item.name).join(" + ")}</h2>
                          </div>
                          <span className={b.bookingStatus}>{STATUS_LABELS[r.status as AppointmentStatus] ?? r.status}</span>
                        </div>
                        <div className={b.bookingCardMeta}>
                          <span><Clock3 size={15} /> {firstItem?.startTime.slice(0, 5)} – {r.items.at(-1)?.endTime.slice(0, 5)}</span>
                          <span className={b.bookingProfessional}>
                            <BookingAvatar name={firstItem?.employeeName || "Profissional"} src={firstItem?.employeePhotoUrl} size="sm" />
                            <span><strong>{firstItem?.employeeName}</strong><small>{firstItem?.employeeJobTitle || "Profissional"}</small></span>
                          </span>
                          <span className={b.bookingCompany}>
                            {r.company.logoUrl ? <Image src={r.company.logoUrl} alt="" width={28} height={28} unoptimized /> : <span>{r.company.name.slice(0, 1)}</span>}
                            <strong>{r.company.name}</strong>
                          </span>
                          {featured && r.company.address && <span><MapPin size={15} /> {r.company.address}</span>}
                        </div>
                        <div className={b.bookingCardFooter}>
                          <Price amount={r.total} className={b.bookingCardPrice} />
                          <div className={b.bookingPrimaryActions}>
                            <button className={`${b.button} ${b.outline}`} onClick={() => setSelected(r.id)}>Ver detalhes</button>
                            {r.canChange && <button className={b.textButton} disabled={busy} onClick={() => reschedule(r)}>Remarcar</button>}
                            {r.canChange && <button className={b.textButton} onClick={() => { setSelected(r.id); setAction("cancel"); }}>Cancelar</button>}
                            {r.status === "completed" && <button className={b.button} onClick={() => repeat(r)}><RotateCcw size={15} /> Agendar novamente</button>}
                          </div>
                        </div>
                        {featured && (
                          <div className={b.bookingUtilityActions}>
                            <a href={`/api/my/bookings/${r.id}/calendar`}><CalendarPlus size={15} /> Adicionar ao calendário</a>
                            {r.company.address && <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.company.address)}`}><MapPin size={15} /> Como chegar</a>}
                            {r.company.phone && <a href={`tel:${r.company.phone.replace(/[^+\d]/g, "")}`}>Entrar em contato</a>}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className={b.bookingsEmpty}>
                <div className={b.bookingsEmptyIcon}>
                  {tab === "Próximos" ? (
                    <CalendarDays size={24} />
                  ) : tab === "Cancelados" ? (
                    <RotateCcw size={24} />
                  ) : (
                    <History size={24} />
                  )}
                </div>
                <h3>
                  {tab === "Próximos"
                    ? "Nenhum agendamento futuro"
                    : tab === "Cancelados"
                      ? "Nenhum agendamento cancelado"
                      : "Nenhum agendamento por aqui"}
                </h3>
                <p>
                  {tab === "Próximos"
                    ? "Quando você reservar um horário, ele aparecerá aqui com todos os detalhes e opções de remarcação."
                    : tab === "Cancelados"
                      ? "Você não possui agendamentos cancelados no seu registro."
                      : "Seu histórico de atendimentos realizados e concluídos aparecerá aqui quando houver registros."}
                </p>
                <Link
                  href={embedded ? "/cliente?tab=agendar" : "/"}
                  className={b.emptyCtaButton}
                >
                  <CalendarPlus size={15} />
                  <span>{tab === "Próximos" ? "Agendar horário" : "Explorar estabelecimentos"}</span>
                </Link>
              </div>
            )}
          </>
        )}
      </Content>
  );
  return embedded ? content : (
    <PublicFrame
      color={current?.company.color}
      company={current ? {
        name: current.company.name,
        category: current.company.businessType,
        logoUrl: current.company.logoUrl,
        slug: current.company.slug ?? undefined,
        address: current.company.address,
      } : undefined}
    >
      {content}
    </PublicFrame>
  );
}
