/* eslint-disable react-hooks/set-state-in-effect -- Synchronizes server availability, URL state and persisted booking drafts. */
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  CalendarPlus,
  Share2,
  UserRound,
  CheckCircle2,
  X,
  Sparkles,
  ChevronUp,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import type { PublicCatalog } from "@/lib/booking/catalog";
import type { AvailableSlot } from "@/lib/booking/engine";
import type { Selection } from "@/lib/booking/validation";
import { AvailabilityPicker } from "./availability-picker";
import { CustomerAuth, type Customer } from "./customer-auth";
import {
  b,
  dateLabel,
  dateLabelShort,
  duration,
  ErrorMessage,
  friendlyTimezone,
  money,
  PublicFrame,
} from "./primitives";

function downloadBookingIcs(booking: {
  companyName: string;
  serviceNames: string;
  address?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  professionalName?: string;
}) {
  const startIso = `${booking.date.replace(/-/g, "")}T${booking.startTime.replace(":", "")}00`;
  const endIso = `${booking.date.replace(/-/g, "")}T${booking.endTime.replace(":", "")}00`;
  const nowIso = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Novae Agenda//Agendamento Online//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}@novae.app`,
    `DTSTAMP:${nowIso}`,
    `DTSTART:${startIso}`,
    `DTEND:${endIso}`,
    `SUMMARY:${booking.serviceNames} - ${booking.companyName}`,
    `DESCRIPTION:Agendamento confirmado com ${booking.companyName}.${booking.professionalName ? ` Profissional: ${booking.professionalName}.` : ""}`,
    booking.address ? `LOCATION:${booking.address.replace(/,/g, "\\,")}` : "",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `agendamento-${booking.date}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function PublicBooking({ catalog }: { catalog: PublicCatalog }) {
  const {
    company,
    services,
    professionals,
    locations,
    products,
    today,
    settings,
  } = catalog;

  const [items, setItems] = useState<Selection>([]);
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [step, setStep] = useState(0);
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState<AvailableSlot | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [useManualLogin, setUseManualLogin] = useState(false);
  const [waitlistStatus, setWaitlistStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [notes, setNotes] = useState("");
  const [extras, setExtras] = useState<Record<string, number>>({});
  const [coupon, setCoupon] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const [quote, setQuote] = useState<{
    subtotal: number;
    discount: number;
    total: number;
  } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");

  const quoteKey = JSON.stringify({
    serviceIds: items.map((i) => i.serviceId),
    products: Object.entries(extras)
      .filter(([, q]) => q > 0)
      .map(([productId, quantity]) => ({ productId, quantity })),
    couponCode: coupon,
  });

  useEffect(() => {
    if (step !== 2 || !items.length) return;
    const controller = new AbortController();
    setQuoteLoading(true);
    setQuote(null);
    setQuoteError("");
    const timer = setTimeout(() => {
      void api<{ subtotal: number; discount: number; total: number }>(
        `/api/public/${company.slug}/quote`,
        { method: "POST", body: quoteKey, signal: controller.signal },
      )
        .then((q) => {
          setQuote(q);
          setQuoteLoading(false);
        })
        .catch((e) => {
          if (!controller.signal.aborted) {
            setQuoteError(e.message);
            setQuoteLoading(false);
          }
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [quoteKey, step, company.slug, items.length]);

  const [requestId, setRequestId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const storageKey = `novae-booking:${company.slug}`;

  function event(name: string) {
    if (sessionId) {
      void api(`/api/public/${company.slug}/events`, {
        method: "POST",
        body: JSON.stringify({ event: name, sessionId: sessionId }),
      }).catch(() => {});
    }
  }

  useEffect(() => {
    setRequestId(crypto.randomUUID());
    const initialSessionId = crypto.randomUUID();
    setSessionId(initialSessionId);
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const draft = JSON.parse(raw);
        if (Date.now() - draft.savedAt < 86400000) {
          setItems(
            draft.items.filter((i: Selection[number]) =>
              services.some((s) => s.id === i.serviceId),
            ),
          );
          setDate(draft.date || "");
          setSlot(draft.slot || null);
          setLocationId(draft.locationId || locations[0]?.id || "");
          setStep(draft.step || 0);
          setNotes(draft.notes || "");
          if (draft.requestId) setRequestId(draft.requestId);
        }
      }
    } catch {}
    setReady(true);
    void api(`/api/public/${company.slug}/events`, {
      method: "POST",
      body: JSON.stringify({
        event: "booking_page_view",
        sessionId: initialSessionId,
      }),
    }).catch(() => {});

    const params = new URLSearchParams(window.location.search);
    const token = params.get("verify");
    if (token) {
      void api("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ token }),
      })
        .then(() => {
          setStep(2);
          window.history.replaceState({}, "", window.location.pathname);
        })
        .catch((e) => setError(e.message));
    }

    const again = params.get("services");
    if (again) {
      const ids = again.split(",");
      setItems(
        ids
          .filter((id) => services.some((s) => s.id === id))
          .slice(0, 8)
          .map((serviceId) => ({
            serviceId,
            employeeId: params.get("professional") || null,
          })),
      );
      setStep(1);
    }
  }, [company.slug, locations, services, storageKey]);

  useEffect(() => {
    if (ready && !bookingId && step < 3) {
      try {
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({
            items,
            date,
            slot,
            locationId,
            step,
            notes,
            requestId,
            savedAt: Date.now(),
          }),
        );
      } catch {}
    }
  }, [
    items,
    date,
    slot,
    locationId,
    step,
    notes,
    ready,
    bookingId,
    storageKey,
    requestId,
  ]);

  const onCustomer = useCallback((user: Customer) => setCustomer(user), []);

  const selected = items
    .map((i) => services.find((s) => s.id === i.serviceId)!)
    .filter(Boolean);

  const price =
    selected.reduce((sum, s) => sum + s.price, 0) +
    products.reduce((sum, p) => sum + p.price * (extras[p.id] || 0), 0);

  const minutes = selected.reduce((sum, s) => sum + s.durationMinutes, 0);

  // Categories extraction
  const allCategories = [
    "Todos",
    ...Array.from(new Set(services.map((s) => s.category || "Outros"))),
  ];

  const visible = services.filter((s) => {
    const matchesSearch = `${s.name} ${s.category ?? ""} ${s.description ?? ""}`
      .toLocaleLowerCase("pt-BR")
      .includes(search.toLocaleLowerCase("pt-BR"));
    const matchesCategory =
      selectedCategory === "Todos" ||
      (s.category || "Outros") === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const activeCategories = [
    ...new Set(visible.map((s) => s.category || "Serviços")),
  ];

  function changeItems(next: Selection) {
    setItems(next);
    setSlot(null);
    setRequestId(crypto.randomUUID());
  }

  function go(next: number) {
    setError("");
    setStep(next);
    setBottomSheetOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
    setTimeout(() => heading.current?.focus(), 0);

    if (next === 1) event("date_selected");
    if (next === 2) event("booking_confirmation_viewed");
  }

  async function confirm(e?: FormEvent) {
    e?.preventDefault();
    if (busy || !slot || quoteLoading || !quote) return;
    if (!customer && (!guestName.trim() || !guestPhone.trim())) {
      setError(
        "Por favor, informe seu nome e WhatsApp para confirmar o agendamento.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api<{ id: string }>("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          slug: company.slug,
          locationId,
          items,
          date,
          startTime: slot.startTime,
          notes,
          idempotencyKey: requestId,
          products: Object.entries(extras)
            .filter(([, quantity]) => quantity > 0)
            .map(([productId, quantity]) => ({ productId, quantity })),
          couponCode: coupon,
          customer: customer
            ? undefined
            : {
                name: guestName.trim(),
                phone: guestPhone.trim(),
                email: guestEmail.trim() || null,
              },
        }),
      });

      setBookingId(result.id);
      event("booking_completed");
      sessionStorage.removeItem(storageKey);
      setStep(3); // Show rich in-page confirmation screen
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && e.status === 409) {
        setError(
          "Este horário acabou de ser reservado por outro cliente. Por favor, escolha outro horário para continuar.",
        );
        setSlot(null);
        setStep(1);
        setRequestId(crypto.randomUUID());
      }
    } finally {
      setBusy(false);
    }
  }

  // Summary Card Content Renderer
  const renderSummaryContent = (isMobileSheet = false) => (
    <>
      <p className={b.eyebrow}>
        {step === 2 ? "Revise sua reserva" : "Seu agendamento"}
      </p>
      <h2>Seu agendamento</h2>

      {!selected.length ? (
        <div className={b.summaryEmpty}>
          <Clock3 size={24} />
          <p>Escolha um ou mais serviços para continuar.</p>
        </div>
      ) : (
        <>
          {selected.map((service) => {
            const item = items.find((i) => i.serviceId === service.id)!;
            const planned = slot?.items.find((i) => i.serviceId === service.id);
            const eligibleProfs = professionals.filter(
              (p) =>
                p.serviceIds.includes(service.id) &&
                (p.locationIds.length === 0 || p.locationIds.includes(locationId)),
            );

            return (
              <div key={service.id} className={b.summaryItem}>
                <div className={b.summaryItemRow}>
                  <div className={b.summaryItemLeft}>
                    {service.imageUrl && (
                      <img
                        className={b.summaryItemThumb}
                        src={service.imageUrl}
                        alt=""
                        loading="lazy"
                      />
                    )}
                    <div className={b.summaryItemInfo}>
                      <h3>{service.name}</h3>
                      <div className={b.summaryItemMeta}>
                        <span>{duration(service.durationMinutes)}</span>
                        <strong className={b.summaryItemPrice}>
                          {money(service.price)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {step === 0 && (
                    <button
                      className={b.remove}
                      aria-label={`Remover ${service.name}`}
                      onClick={() =>
                        changeItems(
                          items.filter((i) => i.serviceId !== service.id),
                        )
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {/* Professional Selector */}
                {step < 2 ? (
                  eligibleProfs.length === 1 ? (
                    <p className={b.muted} style={{ marginTop: 6, fontSize: 12 }}>
                      Com <strong>{eligibleProfs[0]?.name}</strong>
                    </p>
                  ) : (
                    <label className={b.field} style={{ margin: "6px 0 0" }}>
                      <span className={b.muted} style={{ fontSize: 11 }}>
                        Profissional
                      </span>
                      <select
                        aria-label={`Profissional para ${service.name}`}
                        value={item.employeeId ?? ""}
                        onChange={(e) => {
                          const val = e.target.value || null;
                          changeItems(
                            items.map((i) =>
                              i.serviceId === service.id
                                ? { ...i, employeeId: val }
                                : i,
                            ),
                          );
                          if (val) event("professional_selected");
                        }}
                      >
                        <option value="">Qualquer profissional disponível</option>
                        {eligibleProfs.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )
                ) : (
                  <p className={b.muted} style={{ marginTop: 6, fontSize: 12 }}>
                    {planned?.employeeName || "Qualquer profissional disponível"}
                  </p>
                )}
              </div>
            );
          })}

          {step > 0 && (
            <button
              className={b.textButton}
              style={{ marginTop: 8 }}
              onClick={() => go(0)}
            >
              <Plus size={14} /> Adicionar outro serviço
            </button>
          )}

          {slot && date && (
            <div className={b.summaryScheduleBox}>
              <div className={b.summaryScheduleDate}>{dateLabel(date)}</div>
              <div className={b.summaryScheduleTime}>
                {slot.startTime} – {slot.endTime}
              </div>
              <div className={b.summarySchedulePlace}>{company.name}</div>
            </div>
          )}
        </>
      )}

      {Object.entries(extras)
        .filter(([, q]) => q > 0)
        .map(([id, q]) => (
          <div className={b.row} key={id} style={{ margin: "8px 0" }}>
            <span className={b.muted}>
              {q} × {products.find((p) => p.id === id)?.name}
            </span>
            <span>
              {money((products.find((p) => p.id === id)?.price ?? 0) * q)}
            </span>
          </div>
        ))}

      <div className={b.total}>
        <div>
          Total
          <span
            className={b.muted}
            style={{ display: "block", fontWeight: 400, fontSize: 12 }}
          >
            {duration(minutes) || "Nenhum serviço"}
          </span>
        </div>
        <strong>{money(step === 2 && quote ? quote.total : price)}</strong>
      </div>

      {step === 2 && quoteLoading && (
        <p className={b.muted} style={{ fontSize: 12, marginTop: 4 }}>
          Conferindo valores…
        </p>
      )}

      {step === 2 && quote && quote.discount > 0 && (
        <p className={b.muted} style={{ fontSize: 12, color: "#dcff4c" }}>
          Desconto aplicado: −{money(quote.discount)}
        </p>
      )}

      <ErrorMessage message={quoteError} />

      <div className={b.summaryFooter}>
        <button
          className={`${b.button} ${b.wide}`}
          disabled={
            !selected.length ||
            !locationId ||
            (step === 1 && !slot) ||
            (step === 2 &&
              (busy ||
                !slot ||
                quoteLoading ||
                !quote ||
                (!customer && (!guestName.trim() || !guestPhone.trim()))))
          }
          onClick={() => {
            if (isMobileSheet) setBottomSheetOpen(false);
            if (step === 2) {
              void confirm();
            } else {
              go(step + 1);
            }
          }}
        >
          {busy
            ? "Processando…"
            : step === 2
              ? "Confirmar agendamento"
              : "Continuar"}
          {!busy && <ArrowRight size={16} />}
        </button>

        <p className={b.trust}>
          <ShieldCheck size={13} /> Seus dados estão protegidos
        </p>
      </div>
    </>
  );

  return (
    <PublicFrame
      color={company.color}
      coverUrl={company.coverUrl}
      themeMode={company.bookingThemeMode}
      company={{
        name: company.name,
        category: company.category,
        logoUrl: company.logoUrl,
        avatarUrl: company.avatarUrl,
        slug: company.slug,
        address: company.address,
      }}
    >
      <main className={b.main}>
        {/* Step Progress Bar (Only steps 0, 1, 2) */}
        {step < 3 && (
          <ol className={b.progress} aria-label="Progresso do agendamento">
            {["Serviços", "Data e horário", "Confirmação"].map((label, i) => (
              <li
                key={label}
                className={i === step ? b.current : ""}
                aria-current={i === step ? "step" : undefined}
              >
                <b>{i < step ? <Check size={13} /> : i + 1}</b>
                {label}
              </li>
            ))}
          </ol>
        )}

        <ErrorMessage message={error} />

        {/* STEP 3: SUCCESS CONFIRMATION VIEW */}
        {step === 3 && (
          <div className={b.successCard}>
            <div className={b.successIconWrap}>
              <CheckCircle2 size={32} />
            </div>

            <h1 className={b.successTitle}>Agendamento confirmado!</h1>
            <p className={b.successSubtitle}>
              {guestEmail || customer?.email
                ? `Tudo certo. Enviamos os detalhes para ${guestEmail || customer?.email}.`
                : "Seu horário foi agendado com sucesso no estabelecimento."}
            </p>

            <div className={b.successDetailsBox}>
              <div className={b.successDetailRow}>
                <span className={b.successDetailLabel}>Data</span>
                <span className={`${b.successDetailValue} ${b.successDetailHighlight}`}>
                  {dateLabel(date)}
                </span>
              </div>

              {slot && (
                <div className={b.successDetailRow}>
                  <span className={b.successDetailLabel}>Horário</span>
                  <span className={`${b.successDetailValue} ${b.successDetailHighlight}`}>
                    {slot.startTime} – {slot.endTime}
                  </span>
                </div>
              )}

              <div className={b.successDetailRow}>
                <span className={b.successDetailLabel}>Serviços</span>
                <span className={b.successDetailValue}>
                  {selected.map((s) => s.name).join(", ")}
                </span>
              </div>

              {slot?.items[0]?.employeeName && (
                <div className={b.successDetailRow}>
                  <span className={b.successDetailLabel}>Profissional</span>
                  <span className={b.successDetailValue}>
                    {slot.items[0].employeeName}
                  </span>
                </div>
              )}

              <div className={b.successDetailRow}>
                <span className={b.successDetailLabel}>Estabelecimento</span>
                <span className={b.successDetailValue}>{company.name}</span>
              </div>

              {company.address && (
                <div className={b.successDetailRow}>
                  <span className={b.successDetailLabel}>Endereço</span>
                  <span className={b.successDetailValue}>{company.address}</span>
                </div>
              )}

              <div className={b.successDetailRow}>
                <span className={b.successDetailLabel}>Total</span>
                <span className={`${b.successDetailValue} ${b.successDetailHighlight}`}>
                  {money(quote?.total ?? price)}
                </span>
              </div>
            </div>

            <div className={b.successActions}>
              <a
                href={`/meus-agendamentos?booking=${bookingId}&confirmed=1`}
                className={`${b.button} ${b.wide}`}
              >
                <UserRound size={16} /> Ver meus agendamentos
              </a>

              <div className={b.actionBtnRow}>
                <button
                  type="button"
                  className={`${b.button} ${b.outline}`}
                  onClick={() => {
                    if (slot) {
                      downloadBookingIcs({
                        companyName: company.name,
                        serviceNames: selected.map((s) => s.name).join(", "),
                        address: company.address,
                        date,
                        startTime: slot.startTime,
                        endTime: slot.endTime,
                        professionalName: slot.items[0]?.employeeName,
                      });
                    }
                  }}
                >
                  <CalendarPlus size={15} /> Adicionar ao calendário
                </button>

                <button
                  type="button"
                  className={`${b.button} ${b.outline}`}
                  onClick={async () => {
                    const shareData = {
                      title: `Agendamento - ${company.name}`,
                      text: `Agendei ${selected.map((s) => s.name).join(", ")} na ${company.name} para ${dateLabelShort(date)} às ${slot?.startTime}!`,
                      url: window.location.href,
                    };

                    if (navigator.share) {
                      try {
                        await navigator.share(shareData);
                      } catch {}
                    } else {
                      try {
                        await navigator.clipboard.writeText(window.location.href);
                        setCopiedShare(true);
                        setTimeout(() => setCopiedShare(false), 3000);
                      } catch {}
                    }
                  }}
                >
                  <Share2 size={15} />{" "}
                  {copiedShare ? "Link copiado!" : "Compartilhar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEPS 0, 1, 2: FLOW LAYOUT */}
        {step < 3 && (
          <div className={b.layout}>
            <div className={b.content}>
              {step > 0 && (
                <button
                  className={`${b.textButton} ${b.back}`}
                  onClick={() => go(step - 1)}
                >
                  <ArrowLeft size={16} /> Voltar
                </button>
              )}

              <p className={b.eyebrow}>
                {step === 0
                  ? "Escolha seu serviço"
                  : step === 1
                    ? "ESCOLHA QUANDO VOCÊ QUER IR"
                    : "Finalize seu agendamento"}
              </p>

              <h1 ref={heading} tabIndex={-1} className={b.title}>
                {
                  [
                    "Escolha seu serviço",
                    "Escolha a data e o horário",
                    "Revise seu agendamento",
                  ][step]
                }
              </h1>

              <p className={b.subtitle}>
                {
                  [
                    "Selecione o que deseja agendar.",
                    friendlyTimezone(company.timezone),
                    "Confira os detalhes e informe seus dados para garantir a reserva.",
                  ][step]
                }
              </p>

              {/* STEP 0: SERVICES SELECTION */}
              {step === 0 && (
                <>
                  {/* Establishment Hero Info */}
                  <div className={b.profile}>
                    {company.logoUrl ? (
                      <img className={b.avatar} src={company.logoUrl} alt="" />
                    ) : (
                      <span className={b.avatar}>
                        {company.name.slice(0, 1)}
                      </span>
                    )}
                    <div>
                      <h2>{company.name}</h2>
                      <div className={b.muted}>{company.category}</div>
                      {company.address && (
                        <div
                          className={`${b.muted} ${b.inline}`}
                          style={{ marginTop: 2, fontSize: 12 }}
                        >
                          <MapPin size={12} />
                          {company.address}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Multi-location selector if applicable */}
                  {locations.length > 1 && (
                    <label className={b.field}>
                      Unidade
                      <select
                        value={locationId}
                        onChange={(e) => {
                          setLocationId(e.target.value);
                          changeItems(
                            items.map((i) => ({ ...i, employeeId: null })),
                          );
                        }}
                      >
                        {locations.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {/* Search Bar */}
                  <div className={b.search}>
                    <Search size={18} />
                    <input
                      aria-label="Buscar serviço"
                      placeholder="Buscar serviço..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>

                  {/* Category Pills Filter */}
                  {allCategories.length > 2 && (
                    <div
                      className={b.categoryFilter}
                      role="tablist"
                      aria-label="Filtrar por categoria"
                    >
                      {allCategories.map((cat) => {
                        const count =
                          cat === "Todos"
                            ? services.length
                            : services.filter(
                                (s) => (s.category || "Outros") === cat,
                              ).length;

                        return (
                          <button
                            key={cat}
                            type="button"
                            role="tab"
                            aria-selected={selectedCategory === cat}
                            className={`${b.categoryPill} ${selectedCategory === cat ? b.categoryPillActive : ""}`}
                            onClick={() => setSelectedCategory(cat)}
                          >
                            <span>{cat}</span>
                            <span className={b.categoryCount}>({count})</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Services List */}
                  {!services.length ? (
                    <div className={b.empty}>
                      <h3>Os serviços estarão aqui em breve.</h3>
                      <p>
                        Este estabelecimento ainda não disponibilizou serviços
                        para reserva online.
                      </p>
                    </div>
                  ) : !visible.length ? (
                    <div className={b.empty}>
                      Nenhum serviço encontrado para sua busca.
                    </div>
                  ) : (
                    activeCategories.map((category) => (
                      <section key={category} className={b.serviceGroup}>
                        <h2 className={b.groupTitle}>
                          {category}
                          <span>
                            {
                              visible.filter(
                                (s) => (s.category || "Serviços") === category,
                              ).length
                            }
                          </span>
                        </h2>

                        {visible
                          .filter((s) => (s.category || "Serviços") === category)
                          .map((service) => {
                            const chosen = items.some(
                              (i) => i.serviceId === service.id,
                            );
                            const eligible = professionals.some(
                              (p) =>
                                p.serviceIds.includes(service.id) &&
                                (p.locationIds.length === 0 ||
                                  p.locationIds.includes(locationId)),
                            );

                            const isMostBooked =
                              service.bookings > 0 &&
                              service.bookings ===
                                Math.max(...services.map((s) => s.bookings));

                            return (
                              <article className={b.service} key={service.id}>
                                <div className={b.serviceMain}>
                                  {isMostBooked && (
                                    <span className={b.badge}>
                                      Mais agendado
                                    </span>
                                  )}

                                  <div className={b.serviceBody}>
                                    {service.imageUrl ? (
                                      <img
                                        className={b.serviceImage}
                                        src={service.imageUrl}
                                        alt=""
                                        loading="lazy"
                                      />
                                    ) : (
                                      <span className={b.serviceImagePlaceholder}>
                                        {service.name.slice(0, 1)}
                                      </span>
                                    )}

                                    <div className={b.serviceDetails}>
                                      <h3>{service.name}</h3>
                                      {service.description && (
                                        <p className={b.serviceDescription}>
                                          {service.description}
                                        </p>
                                      )}
                                      <div className={b.serviceMeta}>
                                        <Clock3 size={13} />
                                        <span>
                                          {duration(service.durationMinutes)}
                                        </span>
                                        {service.deliveryMode === "ONLINE" && (
                                          <span>· Online</span>
                                        )}
                                      </div>
                                      {!eligible && (
                                        <p
                                          className={b.muted}
                                          style={{
                                            color: "#f87171",
                                            fontSize: 11.5,
                                            marginTop: 4,
                                          }}
                                        >
                                          Indisponível nesta unidade
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className={b.serviceActions}>
                                  <div className={b.servicePrice}>
                                    <strong>{money(service.price)}</strong>
                                  </div>

                                  <button
                                    className={`${b.button} ${b.small} ${chosen ? "" : b.outline}`}
                                    aria-pressed={chosen}
                                    aria-label={`${chosen ? "Remover" : "Selecionar"} ${service.name}`}
                                    disabled={
                                      !eligible ||
                                      (!chosen && items.length >= 8)
                                    }
                                    onClick={() => {
                                      changeItems(
                                        chosen
                                          ? items.filter(
                                              (i) =>
                                                i.serviceId !== service.id,
                                            )
                                          : [
                                              ...items,
                                              {
                                                serviceId: service.id,
                                                employeeId: null,
                                              },
                                            ],
                                      );
                                      if (!chosen) event("service_selected");
                                    }}
                                  >
                                    {chosen ? (
                                      <>
                                        <Check size={14} /> Selecionado
                                      </>
                                    ) : (
                                      "Selecionar"
                                    )}
                                  </button>
                                </div>
                              </article>
                            );
                          })}
                      </section>
                    ))
                  )}

                  {/* Company Photos & Working Hours Info */}
                  {company.photos.length > 0 && (
                    <div className={b.photos}>
                      {company.photos.map((photo, i) => (
                        <img
                          src={photo}
                          key={photo}
                          alt={`Foto ${i + 1} de ${company.name}`}
                          loading="lazy"
                        />
                      ))}
                    </div>
                  )}

                  <div className={b.muted} style={{ marginTop: 16 }}>
                    <p>
                      Funcionamento:{" "}
                      {settings.workingDays
                        .map(
                          (d) =>
                            ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][
                              d
                            ],
                        )
                        .join(", ")}{" "}
                      · {settings.openTime}–{settings.closeTime}
                    </p>
                    {company.phone && (
                      <p style={{ marginTop: 4 }}>
                        <a href={`tel:${company.phone.replace(/[^+\d]/g, "")}`}>
                          {company.phone}
                        </a>
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* STEP 1: DATE & TIME PICKER */}
              {step === 1 && items.length > 0 && (
                <AvailabilityPicker
                  slug={company.slug}
                  locationId={locationId}
                  items={items}
                  today={today}
                  maxLeadDays={settings.maxLeadDays}
                  date={date}
                  onDate={(d) => {
                    setDate(d);
                    event("date_selected");
                  }}
                  selected={slot}
                  onSelect={(s) => {
                    setSlot(s);
                    if (s) event("time_selected");
                  }}
                  waitlistStatus={waitlistStatus}
                  onWaitlist={async () => {
                    setWaitlistStatus("loading");
                    try {
                      await api(`/api/public/${company.slug}/waitlist`, {
                        method: "POST",
                        body: JSON.stringify({
                          date,
                          items,
                          customer: customer
                            ? { name: customer.name, phone: customer.phone }
                            : guestName && guestPhone
                              ? { name: guestName, phone: guestPhone }
                              : {
                                  name: "Cliente Interessado",
                                  phone: "11999999999",
                                },
                        }),
                      });
                      setWaitlistStatus("success");
                    } catch {
                      setWaitlistStatus("error");
                    }
                  }}
                />
              )}

              {/* STEP 2: IDENTIFICATION & CONFIRMATION */}
              {step === 2 && (
                <>
                  {customer ? (
                    <div className={b.note}>
                      <div className={b.inline}>
                        <Check size={16} style={{ color: "#dcff4c" }} />
                        <strong>{customer.name}</strong>
                      </div>
                      <p>
                        {customer.email} · {customer.phone}
                      </p>
                    </div>
                  ) : useManualLogin ? (
                    <div>
                      <CustomerAuth
                        returnTo={`/agendar/${company.slug}`}
                        onReady={onCustomer}
                      />
                      <button
                        type="button"
                        onClick={() => setUseManualLogin(false)}
                        className={b.textButton}
                        style={{ marginTop: 12, fontSize: 13 }}
                      >
                        ← Voltar para agendamento rápido
                      </button>
                    </div>
                  ) : (
                    <div className={b.card}>
                      <h3>Seus dados para confirmação</h3>
                      <p>
                        Informe seus dados para contato. Você não precisa criar
                        uma senha agora.
                      </p>

                      <label className={b.field}>
                        Nome completo *
                        <input
                          type="text"
                          required
                          minLength={2}
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          placeholder="Ex: João da Silva"
                        />
                      </label>

                      <label className={b.field}>
                        WhatsApp / Telefone *
                        <input
                          type="tel"
                          required
                          minLength={8}
                          value={guestPhone}
                          onChange={(e) => setGuestPhone(e.target.value)}
                          placeholder="Ex: (11) 99999-9999"
                        />
                      </label>

                      <label className={b.field}>
                        E-mail (opcional)
                        <input
                          type="email"
                          value={guestEmail}
                          onChange={(e) => setGuestEmail(e.target.value)}
                          placeholder="Para receber a confirmação e lembretes"
                        />
                      </label>

                      <div style={{ marginTop: 12, textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setUseManualLogin(true);
                            event("booking_login_started");
                          }}
                          className={b.textButton}
                          style={{ fontSize: 12 }}
                        >
                          Já possui conta? Entrar com senha
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Customer phone requirement if missing */}
                  {customer && !customer.phone && (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const phone = new FormData(e.currentTarget).get(
                          "phone",
                        );
                        try {
                          setCustomer(
                            await api<Customer>("/api/my/session", {
                              method: "PATCH",
                              body: JSON.stringify({ phone }),
                            }),
                          );
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      <label className={b.field}>
                        Telefone para contato
                        <input
                          name="phone"
                          type="tel"
                          required
                          minLength={8}
                          maxLength={25}
                        />
                      </label>
                      <button className={b.button}>Salvar telefone</button>
                    </form>
                  )}

                  {/* Observation note */}
                  <label className={b.field} style={{ marginTop: 20 }}>
                    Alguma observação para o estabelecimento?
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      maxLength={2000}
                      placeholder="Conte algo que gostaria que o profissional soubesse (opcional)."
                    />
                  </label>

                  {/* Products add-on */}
                  {products.length > 0 && (
                    <section style={{ marginTop: 20 }}>
                      <h2 style={{ fontSize: 16, color: "#ffffff" }}>
                        Produtos adicionais
                      </h2>
                      <p className={b.muted}>
                        Produtos opcionais para levar com você no atendimento.
                      </p>
                      {products.map((p) => (
                        <label className={b.product} key={p.id}>
                          <span>
                            {p.name}
                            <small
                              className={b.muted}
                              style={{ display: "block" }}
                            >
                              {money(p.price)}
                            </small>
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={10}
                            value={extras[p.id] || 0}
                            aria-label={`Quantidade de ${p.name}`}
                            onChange={(e) =>
                              setExtras({
                                ...extras,
                                [p.id]: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                      ))}
                    </section>
                  )}

                  {/* Coupon Code */}
                  <label className={b.field} style={{ marginTop: 20 }}>
                    Código promocional (opcional)
                    <input
                      value={coupon}
                      onChange={(e) =>
                        setCoupon(e.target.value.toUpperCase())
                      }
                      maxLength={40}
                      placeholder="Seu cupom de desconto"
                    />
                  </label>

                  {/* Cancellation policy */}
                  <div className={b.note}>
                    <strong>Política de cancelamento</strong>
                    <p>
                      {company.cancellationHours < 0
                        ? "Alterações devem ser solicitadas diretamente ao estabelecimento."
                        : `Cancelamento gratuito até ${company.cancellationHours} horas antes do atendimento.`}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* DESKTOP STICKY SUMMARY CARD */}
            <aside className={b.summary} aria-label="Resumo do agendamento">
              {renderSummaryContent(false)}
            </aside>
          </div>
        )}

        {/* MOBILE STICKY BOTTOM BAR (Viewports < 768px) */}
        {step < 3 && selected.length > 0 && (
          <div className={b.mobileBottomBar}>
            <div className={b.mobileBottomBarInner}>
              <div
                className={b.mobileSummaryInfo}
                onClick={() => setBottomSheetOpen(true)}
              >
                <div className={b.mobileSummaryTitle}>
                  <span>
                    {selected[0]?.name}
                    {selected.length > 1
                      ? ` +${selected.length - 1}`
                      : ` • ${duration(minutes)}`}
                  </span>
                  <ChevronUp size={14} style={{ color: "#dcff4c" }} />
                </div>
                <div className={b.mobileSummaryPrice}>
                  {money(step === 2 && quote ? quote.total : price)}
                </div>
              </div>

              <button
                className={`${b.button} ${b.mobileCtaBtn}`}
                disabled={
                  !selected.length ||
                  !locationId ||
                  (step === 1 && !slot) ||
                  (step === 2 &&
                    (busy ||
                      !slot ||
                      quoteLoading ||
                      !quote ||
                      (!customer && (!guestName.trim() || !guestPhone.trim()))))
                }
                onClick={() => {
                  if (step === 2) {
                    void confirm();
                  } else {
                    go(step + 1);
                  }
                }}
              >
                {busy
                  ? "Aguarde…"
                  : step === 2
                    ? "Confirmar"
                    : "Continuar"}
                {!busy && <ArrowRight size={15} />}
              </button>
            </div>
          </div>
        )}

        {/* MOBILE BOTTOM SHEET MODAL */}
        {bottomSheetOpen && (
          <>
            <div
              className={b.bottomSheetOverlay}
              onClick={() => setBottomSheetOpen(false)}
            />
            <div className={b.bottomSheet} role="dialog" aria-modal="true">
              <div className={b.bottomSheetHandle} />
              <div className={b.bottomSheetHeader}>
                <h3 className={b.bottomSheetTitle}>Resumo do agendamento</h3>
                <button
                  type="button"
                  className={b.bottomSheetClose}
                  aria-label="Fechar resumo"
                  onClick={() => setBottomSheetOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <div className={b.bottomSheetBody}>
                {renderSummaryContent(true)}
              </div>
            </div>
          </>
        )}
      </main>
    </PublicFrame>
  );
}
