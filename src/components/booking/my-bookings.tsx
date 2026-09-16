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
  KeyRound,
  MapPin,
  Phone,
  RotateCcw,
  Share2,
  Sparkles,
  UserRound,
  X,
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
import { PinInput } from "./pin-input";
import { ClientNoticeModal } from "./client-notice-modal";
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
    [cancelTarget, setCancelTarget] = useState<Detail | null>(null),
    [lateNotice, setLateNotice] = useState<{
      booking: Detail;
      type: "cancel" | "reschedule";
    } | null>(null),
    [catalog, setCatalog] = useState<PublicCatalog | null>(null),
    [date, setDate] = useState(""),
    [slot, setSlot] = useState<AvailableSlot | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");

  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinChangeVal, setPinChangeVal] = useState("");
  const [confirmPinChangeVal, setConfirmPinChangeVal] = useState("");
  const [pinChangeError, setPinChangeError] = useState("");
  const [pinChangeSuccess, setPinChangeSuccess] = useState("");
  const [pinChangeBusy, setPinChangeBusy] = useState(false);
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

  async function confirmCancel(target: Detail) {
    if (!target) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/my/bookings/${target.id}/cancel`, {
        method: "POST",
      });
      setCancelTarget(null);
      setAction(null);
      setMessage("Agendamento desmarcado com sucesso.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleCancel(booking: Detail) {
    if (booking.canChange) {
      setCancelTarget(booking);
    } else {
      setLateNotice({ booking, type: "cancel" });
    }
  }

  function handleReschedule(booking: Detail) {
    if (booking.canChange) {
      void reschedule(booking);
    } else {
      setLateNotice({ booking, type: "reschedule" });
    }
  }

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
          ? "Agendamento desmarcado com sucesso."
          : "Seu horário foi atualizado com sucesso.",
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
    if (requested === "reschedule") handleReschedule(current);
    if (requested === "cancel") handleCancel(current);
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

  const isCurrentActive = current && current.status !== "cancelled" && current.status !== "completed" && current.status !== "no_show" && new Date(current.endsAt) >= new Date();

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

        {/* Modal de Alteração de PIN */}
        {pinModalOpen && (
          <div className={b.modalBackdrop} onClick={() => !pinChangeBusy && setPinModalOpen(false)}>
            <div className={b.modalCard} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Alterar PIN de acesso">
              <div className={b.modalHeader}>
                <div style={{ margin: "0 auto 12px", width: 44, height: 44, borderRadius: "50%", background: "rgba(16, 185, 129, 0.12)", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <KeyRound size={22} />
                </div>
                <h2 className={b.modalTitle}>Alterar PIN de acesso</h2>
                <p className={b.modalSubtitle}>
                  Defina um novo PIN de 6 dígitos para consultar suas reservas no Reservei.
                </p>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <button
                  type="button"
                  className={b.textButton}
                  disabled={pinChangeBusy}
                  onClick={async () => {
                    setPinChangeError("");
                    try {
                      const result = await api<{ pin: string }>("/api/customer-access/pin/random");
                      setPinChangeVal(result.pin);
                      setConfirmPinChangeVal(result.pin);
                    } catch (err) {
                      setPinChangeError(err instanceof Error ? err.message : "Não foi possível gerar PIN.");
                    }
                  }}
                  style={{ fontSize: "12px" }}
                >
                  <Sparkles size={13} /> Gerar PIN disponível
                </button>
              </div>

              <div style={{ display: "grid", gap: 14 }}>
                <div>
                  <label style={{ fontSize: "12.5px", fontWeight: 500, display: "block", marginBottom: 6 }}>
                    Novo PIN (6 números)
                  </label>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <PinInput
                      id="my-bookings-new-pin"
                      value={pinChangeVal}
                      onChange={setPinChangeVal}
                      length={6}
                      autoFocus
                      theme="dark"
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "12.5px", fontWeight: 500, display: "block", marginBottom: 6 }}>
                    Confirme o novo PIN
                  </label>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <PinInput
                      id="my-bookings-confirm-pin"
                      value={confirmPinChangeVal}
                      onChange={setConfirmPinChangeVal}
                      length={6}
                      theme="dark"
                    />
                  </div>
                </div>

                {pinChangeError && (
                  <p style={{ color: "var(--booking-danger)", fontSize: "12.5px", margin: 0, textAlign: "center" }}>
                    {pinChangeError}
                  </p>
                )}

                {pinChangeSuccess && (
                  <p style={{ color: "#10b981", fontSize: "12.5px", margin: 0, textAlign: "center", fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    <Check size={13} />
                    <span>{pinChangeSuccess}</span>
                  </p>
                )}

                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    className={`${b.button} ${b.wide}`}
                    disabled={pinChangeBusy || pinChangeVal.length !== 6 || confirmPinChangeVal.length !== 6}
                    onClick={async () => {
                      if (pinChangeVal.length !== 6 || confirmPinChangeVal.length !== 6) {
                        setPinChangeError("O PIN deve conter exatamente 6 números.");
                        return;
                      }
                      if (pinChangeVal !== confirmPinChangeVal) {
                        setPinChangeError("Os PINs não coincidem.");
                        return;
                      }
                      setPinChangeBusy(true);
                      setPinChangeError("");
                      try {
                        const result = await api<{ customer: Customer }>("/api/customer-access/pin/setup", {
                          method: "POST",
                          body: JSON.stringify({
                            pin: pinChangeVal,
                            confirmPin: confirmPinChangeVal,
                            phone: user?.phone || undefined,
                          }),
                        });
                        if (result.customer) setUser(result.customer);
                        setPinChangeSuccess("PIN atualizado com sucesso!");
                        setTimeout(() => {
                          setPinModalOpen(false);
                          setPinChangeSuccess("");
                          setPinChangeVal("");
                          setConfirmPinChangeVal("");
                        }, 1500);
                      } catch (err: any) {
                        setPinChangeError(err.message || "Erro ao atualizar PIN.");
                      } finally {
                        setPinChangeBusy(false);
                      }
                    }}
                  >
                    {pinChangeBusy ? "Salvando..." : "Salvar novo PIN"}
                  </button>
                  <button
                    type="button"
                    className={`${b.button} ${b.outline}`}
                    onClick={() => setPinModalOpen(false)}
                    disabled={pinChangeBusy}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Cancelamento Online */}
        {cancelTarget && (
          <div className={b.modalBackdrop} onClick={() => !busy && setCancelTarget(null)}>
            <div className={b.modalCard} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Confirmar cancelamento">
              <div className={b.modalHeader}>
                <div className={b.modalIconDanger}>
                  <AlertCircle size={28} />
                </div>
                <h2 className={b.modalTitle}>Desmarcar agendamento?</h2>
                <p className={b.modalSubtitle}>
                  O horário será liberado imediatamente no sistema para outras pessoas.
                </p>
              </div>

              <div className={b.modalSummaryBox}>
                <div className={b.modalSummaryRow}>
                  <span>Serviço</span>
                  <strong>{cancelTarget.items.map((i) => i.name).join(" + ")}</strong>
                </div>
                <div className={b.modalSummaryRow}>
                  <span>Estabelecimento</span>
                  <strong>{cancelTarget.company.name}</strong>
                </div>
                <div className={b.modalSummaryRow}>
                  <span>Data e horário</span>
                  <strong>
                    {dateLabel(cancelTarget.items[0]?.date ?? cancelTarget.startsAt.slice(0, 10))} · {cancelTarget.items[0]?.startTime.slice(0, 5)}
                  </strong>
                </div>
                {cancelTarget.items[0]?.employeeName && (
                  <div className={b.modalSummaryRow}>
                    <span>Profissional</span>
                    <strong>{cancelTarget.items[0].employeeName}</strong>
                  </div>
                )}
                <div className={b.modalSummaryRow}>
                  <span>Valor total</span>
                  <strong style={{ color: "var(--accent)" }}>{money(cancelTarget.total)}</strong>
                </div>
              </div>

              <div className={b.modalActions}>
                <button
                  type="button"
                  className={`${b.button} ${b.cancelButtonDanger}`}
                  disabled={busy}
                  onClick={() => confirmCancel(cancelTarget)}
                >
                  {busy ? "Desmarcando…" : "Sim, confirmar desmarcação"}
                </button>
                <button
                  type="button"
                  className={`${b.button} ${b.outline}`}
                  disabled={busy}
                  onClick={() => setCancelTarget(null)}
                >
                  Não, manter meu agendamento
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Aviso de Prazo / Contato WhatsApp */}
        {lateNotice && (
          <div className={b.modalBackdrop} onClick={() => setLateNotice(null)}>
            <div className={b.modalCard} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Aviso de cancelamento">
              <div className={b.modalHeader}>
                <div className={b.modalIconWarning}>
                  <AlertCircle size={28} />
                </div>
                <h2 className={b.modalTitle}>
                  {lateNotice.type === "cancel" ? "Desmarcar agendamento" : "Remarcar agendamento"}
                </h2>
                <p className={b.modalSubtitle}>
                  Alterações fora do prazo padrão online
                </p>
              </div>

              <div className={b.modalNoticeText}>
                <p>
                  A política de alterações online de <strong>{lateNotice.booking.company.name}</strong> permite {lateNotice.type === "cancel" ? "desmarcar" : "remarcar"} até <strong>{lateNotice.booking.company.cancellationHours} horas</strong> antes do horário.
                </p>
                <p>
                  Como seu horário está próximo (<strong>{dateLabel(lateNotice.booking.items[0]?.date ?? lateNotice.booking.startsAt.slice(0, 10))} às {lateNotice.booking.items[0]?.startTime.slice(0, 5)}</strong>), solicite a alteração diretamente com a equipe.
                </p>
              </div>

              <div className={b.modalSummaryBox}>
                <div className={b.modalSummaryRow}>
                  <span>Serviço</span>
                  <strong>{lateNotice.booking.items.map((i) => i.name).join(" + ")}</strong>
                </div>
                <div className={b.modalSummaryRow}>
                  <span>Estabelecimento</span>
                  <strong>{lateNotice.booking.company.name}</strong>
                </div>
              </div>

              <div className={b.modalActions}>
                {lateNotice.booking.company.phone && (
                  <a
                    className={`${b.button} ${b.whatsappBtn}`}
                    target="_blank"
                    rel="noreferrer"
                    href={`https://wa.me/${lateNotice.booking.company.phone.replace(/\D/g, "").length <= 11 ? "55" : ""}${lateNotice.booking.company.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá! Gostaria de ${lateNotice.type === "cancel" ? "desmarcar" : "remarcar"} meu agendamento de "${lateNotice.booking.items.map((i) => i.name).join(" + ")}" agendado para ${dateLabel(lateNotice.booking.items[0]?.date ?? lateNotice.booking.startsAt.slice(0, 10))} às ${lateNotice.booking.items[0]?.startTime.slice(0, 5)}.`)}`}
                  >
                    <WhatsAppIcon size={16} /> Falar no WhatsApp
                  </a>
                )}
                {lateNotice.booking.company.phone && (
                  <a
                    className={`${b.button} ${b.outline}`}
                    href={`tel:${lateNotice.booking.company.phone.replace(/[^+\d]/g, "")}`}
                  >
                    <Phone size={15} /> Ligar para o estabelecimento
                  </a>
                )}
                <button
                  type="button"
                  className={`${b.button} ${b.outline}`}
                  onClick={() => setLateNotice(null)}
                >
                  Entendido, fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {!user ? (
          <AuthScreen initialMode="reservas" />
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
                      window.history.replaceState({}, "", "/minhas-reservas");
                    }}
                  >
                    <ArrowLeft size={16} /> Voltar para minhas reservas
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
                <h3>Desmarcar este agendamento?</h3>
                <p>O horário será liberado imediatamente para outras pessoas no estabelecimento.</p>
                <div className={b.cancelPromptActions}>
                  <button
                    className={`${b.button} ${b.cancelButtonDanger}`}
                    disabled={busy}
                    onClick={() => confirmCancel(current)}
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
                {isCurrentActive && (
                  <div className={b.detailActionRow}>
                    <button
                      className={`${b.button} ${b.outline}`}
                      disabled={busy}
                      onClick={() => handleReschedule(current)}
                    >
                      <RotateCcw size={15} /> Remarcar horário
                    </button>
                    <button
                      className={`${b.button} ${b.cancelOutlineBtn}`}
                      disabled={busy}
                      onClick={() => handleCancel(current)}
                    >
                      Desmarcar agendamento
                    </button>
                  </div>
                )}

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
                        : `Você pode cancelar ou remarcar seu atendimento gratuitamente online até ${current.company.cancellationHours} horas antes do horário reservado.`}
                    </p>
                  </div>
                </div>

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
                window.history.replaceState({}, "", "/minhas-reservas");
              }}
            >
              <ArrowLeft size={16} /> Ver todas as minhas reservas
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
                    ? "Histórico de reservas"
                    : tab === "Cancelados"
                      ? "Reservas canceladas"
                      : "Minhas reservas"}
                </h1>
                <p className={b.subtitle}>
                  {tab === "Anteriores"
                    ? "Consulte seus atendimentos realizados e serviços anteriores."
                    : tab === "Cancelados"
                      ? "Histórico de horários e reservas desmarcadas."
                      : "Acompanhe seus próximos horários confirmados e gerencie suas reservas."}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                {rows[0]?.company?.slug && (
                  <Link
                    href={`/agendar/${rows[0].company.slug}`}
                    className={`${b.button} ${b.small}`}
                    style={{ background: "#dcff4c", color: "#0a0a0a", fontWeight: 600 }}
                  >
                    <CalendarPlus size={14} /> Agendar novo horário
                  </Link>
                )}
                {!embedded && (
                  <>
                    <button
                      type="button"
                      className={`${b.button} ${b.outline} ${b.small}`}
                      onClick={() => {
                        setPinModalOpen(true);
                        setPinChangeVal("");
                        setConfirmPinChangeVal("");
                        setPinChangeError("");
                        setPinChangeSuccess("");
                      }}
                    >
                      <KeyRound size={13} /> Alterar PIN
                    </button>
                    <button
                      type="button"
                      className={`${b.button} ${b.outline} ${b.small}`}
                      onClick={async () => {
                        await api("/api/auth/logout", { method: "POST" });
                        setUser(null);
                        setRows([]);
                      }}
                    >
                      Trocar de conta
                    </button>
                  </>
                )}
              </div>
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
                  const isUpcoming = r.status !== "cancelled" && r.status !== "completed" && r.status !== "no_show" && new Date(r.endsAt) >= new Date();
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
                            <button className={`${b.button} ${b.outline} ${b.small}`} onClick={() => setSelected(r.id)}>Ver detalhes</button>
                            {isUpcoming && (
                              <button
                                className={`${b.button} ${b.outline} ${b.small}`}
                                disabled={busy}
                                onClick={() => handleReschedule(r)}
                                title="Remarcar para outra data ou horário"
                              >
                                <RotateCcw size={13} />
                                Remarcar
                              </button>
                            )}
                            {isUpcoming && (
                              <button
                                className={`${b.button} ${b.cancelOutlineBtn} ${b.small}`}
                                disabled={busy}
                                onClick={() => handleCancel(r)}
                                title="Desmarcar este agendamento"
                              >
                                Desmarcar
                              </button>
                            )}
                            {r.status === "completed" && <button className={`${b.button} ${b.small}`} onClick={() => repeat(r)}><RotateCcw size={13} /> Agendar novamente</button>}
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
  return (
    <>
      <ClientNoticeModal />
      {embedded ? content : (
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
      )}
    </>
  );
}
