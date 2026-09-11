/* eslint-disable react-hooks/set-state-in-effect -- Synchronizes server availability, URL state and persisted booking drafts. */
"use client";

import {
  useCallback,
  useEffect,
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
import { isSectionVisible, resolveCopy } from "@/lib/booking/customization";
import type { AvailableSlot } from "@/lib/booking/engine";
import type { Selection } from "@/lib/booking/validation";
import { AvailabilityPicker } from "./availability-picker";
import { CustomerAuth, type Customer } from "./customer-auth";
import { ProfessionalIdentity, ProfessionalSelector } from "./professional-selector";
import {
  b,
  dateLabel,
  dateLabelShort,
  duration,
  ErrorMessage,
  friendlyTimezone,
  money,
  Price,
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

  const [serviceHints, setServiceHints] = useState<Record<string, { date: string; slot: AvailableSlot }>>({});
  const [items, setItems] = useState<Selection>([]);
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [step, setStep] = useState(0);
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState<AvailableSlot | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistDate, setWaitlistDate] = useState(today);
  const [waitlistPeriod, setWaitlistPeriod] = useState("any");
  const [waitlistEmployee, setWaitlistEmployee] = useState("");
  const [waitlistStatus, setWaitlistStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "cash" | "card" | "">("");
  const [extras, setExtras] = useState<Record<string, number>>({});
  const [coupon, setCoupon] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

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
          setExtras(draft.extras || {});
          setCoupon(draft.coupon || "");
          if (draft.requestId) setRequestId(draft.requestId);
        }
      }
    } catch {}
    setReady(true);
    void api<Customer>("/api/my/session").then(setCustomer).catch(() => {});
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

    const repeatItems = params.get("items");
    if (repeatItems) {
      try {
        const parsed = JSON.parse(repeatItems) as Selection;
        const valid = parsed.filter(i => services.some(s => s.id === i.serviceId)).slice(0, 8);
        if (valid.length) { setItems(valid); setDate(""); setSlot(null); setStep(1); }
        const unit = params.get("location");
        if (locations.some(l => l.id === unit)) setLocationId(unit!);
      } catch { setError("Não foi possível recuperar a seleção anterior."); }
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
            extras,
            coupon,
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
    extras,
    coupon,
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

  const hintIds = visible.slice(0, 6).map(s => s.id).join(",");
  useEffect(() => {
    if (step !== 0 || !locationId) return;
    const controller = new AbortController();
    setServiceHints({});
    const timer = setTimeout(async () => {
      const hints = await Promise.all(
        hintIds.split(",").filter(Boolean).map(async (serviceId) => {
          try {
            const q = new URLSearchParams({ locationId, date: today, items: JSON.stringify([{ serviceId }]), groups: "1" });
            const hint = await api<{ date: string; slot: AvailableSlot } | null>(`/api/public/${company.slug}/next-availability?${q}`, { signal: controller.signal });
            return hint ? [serviceId, hint] as const : null;
          } catch {
            return null;
          }
        }),
      );
      if (!controller.signal.aborted) {
        setServiceHints(Object.fromEntries(hints.filter((hint): hint is NonNullable<typeof hint> => Boolean(hint))));
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [hintIds, locationId, today, company.slug, step]);

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

    if (next === 1) event("date_selected");
    if (next === 2) event("booking_confirmation_viewed");
  }

  async function confirm(e?: FormEvent) {
    e?.preventDefault();
    if (busy || !slot || quoteLoading || !quote) return;
    if (!customer?.emailVerified || !customer.phone) {
      setError(
        "Entre na sua conta e confirme seu e-mail para agendar.",
      );
      return;
    }
    if (!paymentMethod) {
      setError("Escolha como pretende pagar no estabelecimento.");
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
          intendedPaymentMethod: paymentMethod,
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
                    {service.imageUrl && !failedImages[service.id] ? (
                      <img
                        className={b.summaryItemThumb}
                        src={service.imageUrl}
                        alt={service.name}
                        loading="lazy"
                        onError={() => setFailedImages((prev) => ({ ...prev, [service.id]: true }))}
                      />
                    ) : (
                      <span
                        className={b.summaryItemThumb}
                        style={{
                          display: "grid",
                          placeItems: "center",
                          background: "var(--booking-surface-elevated)",
                          color: "var(--accent, #dcff4c)",
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        {service.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div className={b.summaryItemInfo}>
                      <h3>{service.name}</h3>
                      <div className={b.summaryItemMeta}>
                        <span>{duration(service.durationMinutes)}</span>
                        <Price amount={service.price} className={b.summaryItemPrice} />
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

                {/* Visual professional selector */}
                {step < 2 ? (
                  <ProfessionalSelector
                    slug={company.slug}
                    locationId={locationId}
                    serviceId={service.id}
                    today={today}
                    professionals={eligibleProfs}
                    value={item.employeeId ?? null}
                    onChange={(employeeId) => {
                      changeItems(items.map((selection) => selection.serviceId === service.id ? { ...selection, employeeId } : selection));
                      if (employeeId) event("professional_selected");
                    }}
                  />
                ) : (
                  <ProfessionalIdentity
                    professional={eligibleProfs.find(professional => professional.id === planned?.employeeId)}
                    fallbackName={planned?.employeeName || "Qualquer profissional disponível"}
                  />
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
        <strong><Price amount={step === 2 && quote ? quote.total : price} /></strong>
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
                !customer?.emailVerified ||
                !customer.phone ||
                !paymentMethod))
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
              ? resolveCopy(company.copyOverrides, "ctaConfirm")
              : resolveCopy(company.copyOverrides, "ctaContinue")}
          {!busy && <ArrowRight size={16} />}
        </button>

        <p className={b.trust}>
          <ShieldCheck size={13} /> {resolveCopy(company.copyOverrides, "trustLine")}
        </p>
      </div>
    </>
  );

  return (
    <PublicFrame
      color={company.color}
      coverUrl={company.coverUrl}
      coverPosition={company.coverPosition}
      themeMode={company.bookingThemeMode}
      fontFamily={company.bookingFontFamily}
      copyOverrides={company.copyOverrides}
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
              {customer?.email
                ? `Tudo certo. Enviamos os detalhes para ${customer.email}.`
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
                  <ProfessionalIdentity
                    professional={professionals.find((professional) => professional.id === slot.items[0]?.employeeId)}
                    fallbackName={slot.items[0].employeeName}
                  />
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

              {paymentMethod && (
                <div className={b.successDetailRow}>
                  <span className={b.successDetailLabel}>Pagamento no local</span>
                  <span className={b.successDetailValue}>
                    {{ pix: "PIX", cash: "Dinheiro", card: "Cartão" }[paymentMethod]}
                  </span>
                </div>
              )}

              <div className={b.successDetailRow}>
                <span className={b.successDetailLabel}>Total</span>
                <span className={`${b.successDetailValue} ${b.successDetailHighlight}`}>
                  <Price amount={quote?.total ?? price} />
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

              <h1 className={b.title}>
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
                    resolveCopy(company.copyOverrides, "heroSubtitle"),
                    friendlyTimezone(company.timezone),
                    "Confira os detalhes para garantir a reserva.",
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

                  {/* Search Bar + Category Filter (hideable via Branding Studio) */}
                  {isSectionVisible(company.sectionsConfig, "search") && (
                    <>
                      <div className={b.search}>
                        <Search size={18} />
                        <input
                          aria-label="Buscar serviço"
                          placeholder={resolveCopy(company.copyOverrides, "searchPlaceholder")}
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>

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
                    </>
                  )}

                  {/* Services List */}
                  {!services.length ? (
                    <div className={b.empty}>
                      <h3>{resolveCopy(company.copyOverrides, "emptyServicesTitle")}</h3>
                      <p>{resolveCopy(company.copyOverrides, "emptyServicesBody")}</p>
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

                            const svcBookings = Number((service as any).bookings || 0);
                            const isMostBooked =
                              svcBookings > 0 &&
                              svcBookings ===
                                Math.max(...services.map((s) => Number((s as any).bookings || 0)));

                            return (
                              <article className={b.service} key={service.id}>
                                <div className={b.serviceMain}>
                                  {isMostBooked && (
                                    <span className={b.badge}>
                                      Mais agendado
                                    </span>
                                  )}

                                  <div className={b.serviceBody}>
                                    {service.imageUrl && !failedImages[service.id] ? (
                                      <img
                                        className={b.serviceImage}
                                        src={service.imageUrl}
                                        alt={service.name}
                                        loading="lazy"
                                        onError={() => setFailedImages((prev) => ({ ...prev, [service.id]: true }))}
                                      />
                                    ) : (
                                      <span className={b.serviceImagePlaceholder}>
                                        {service.name.slice(0, 1).toUpperCase()}
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
                                    <strong><Price amount={service.price} /></strong>
                                    {serviceHints[service.id] && <small className={b.muted}>Próximo horário: {serviceHints[service.id].date === today ? "Hoje" : dateLabelShort(serviceHints[service.id].date)} às {serviceHints[service.id].slot.startTime}</small>}
                                  </div>

                                  <div className={b.serviceButtons}>
                                    {!chosen && (
                                      <button
                                        type="button"
                                        className={`${b.button} ${b.small}`}
                                        disabled={!eligible}
                                        onClick={() => {
                                          changeItems([{ serviceId: service.id, employeeId: null }]);
                                          event("service_selected");
                                          const hint = serviceHints[service.id];
                                          if (hint) { setDate(hint.date); setSlot(hint.slot); go(2); }
                                          else go(1);
                                        }}
                                        title="Ver próximos horários disponíveis"
                                      >
                                        Agendar
                                      </button>
                                    )}

                                    <button
                                      type="button"
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
                                </div>
                              </article>
                            );
                          })}
                      </section>
                    ))
                  )}

                  {/* Company Photos & Working Hours Info — order/visibility set in Branding Studio */}
                  {company.sectionsConfig
                    .filter((s) => s.id !== "search")
                    .map((s) => {
                      if (!s.visible) return null;
                      if (s.id === "photos") {
                        return company.photos.length > 0 ? (
                          <div className={b.photos} key="photos">
                            {company.photos.map((photo, i) => (
                              <img
                                src={photo}
                                key={photo}
                                alt={`Foto ${i + 1} de ${company.name}`}
                                loading="lazy"
                              />
                            ))}
                          </div>
                        ) : null;
                      }
                      return (
                        <div className={b.muted} style={{ marginTop: 16 }} key="hours">
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
                      );
                    })}
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
                    if (s) { event("time_selected"); go(2); }
                  }}
                  waitlistStatus={waitlistStatus}
                  onWaitlist={() => { setWaitlistDate(date || today); setWaitlistOpen(true); }}
                />
              )}

              {step === 1 && waitlistOpen && <section className={b.detail} aria-label="Lista de espera">
                <h2>Avise-me se surgir uma vaga</h2>
                <label className={b.field}>Dia<input type="date" min={today} value={waitlistDate} onChange={e => setWaitlistDate(e.target.value)} /></label>
                <label className={b.field}>Parte do dia<select value={waitlistPeriod} onChange={e => setWaitlistPeriod(e.target.value)}><option value="any">Qualquer horário</option><option value="morning">Manhã</option><option value="afternoon">Tarde</option><option value="evening">Noite</option></select></label>
                <label className={b.field}>Profissional (opcional)<select value={waitlistEmployee} onChange={e => setWaitlistEmployee(e.target.value)}><option value="">Qualquer profissional disponível</option>{professionals.filter(p => items.every(i => p.serviceIds.includes(i.serviceId))).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                {!customer ? <CustomerAuth onReady={onCustomer} returnTo={`/agendar/${company.slug}`} requireVerified={false} /> : <button className={b.button} disabled={waitlistStatus === "loading" || waitlistStatus === "success"} onClick={async () => {
                  setWaitlistStatus("loading"); setError("");
                  try {
                    await api(`/api/public/${company.slug}/waitlist`, { method: "POST", body: JSON.stringify({ date: waitlistDate, period: waitlistPeriod, employeeId: waitlistEmployee || null, locationId, items }) });
                    setWaitlistStatus("success");
                  } catch (e) { setWaitlistStatus("error"); setError((e as Error).message); }
                }}>{waitlistStatus === "success" ? "Interesse registrado" : waitlistStatus === "loading" ? "Salvando…" : "Registrar interesse"}</button>}
                <p className={b.muted}>O estabelecimento poderá entrar em contato se surgir uma vaga. Nenhum horário será reservado automaticamente.</p>
              </section>}

              {/* STEP 2: IDENTIFICATION & CONFIRMATION */}
              {step === 2 && (
                <>
                  {customer?.emailVerified && customer.phone ? (
                    <div className={b.note}><strong>{customer.name}</strong><p>Confira os dados e confirme seu horário.</p></div>
                  ) : <CustomerAuth returnTo={`/agendar/${company.slug}`} onReady={onCustomer} /> }

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

                  {/* Payment method — chosen here only to tell the establishment how
                      the customer intends to pay; nothing is charged online. */}
                  <label className={b.field} style={{ marginTop: 20 }}>
                    Forma de pagamento
                    <div className={b.inline} role="radiogroup" aria-label="Forma de pagamento">
                      {(
                        [
                          ["pix", "PIX"],
                          ["cash", "Dinheiro"],
                          ["card", "Cartão"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={paymentMethod === value}
                          className={`${b.button} ${b.small} ${paymentMethod === value ? "" : b.outline}`}
                          onClick={() => setPaymentMethod(value)}
                        >
                          {paymentMethod === value && <Check size={12} />} {label}
                        </button>
                      ))}
                    </div>
                  </label>
                  <p className={b.muted} style={{ marginTop: -12, marginBottom: 4 }}>
                    Pagamento realizado no estabelecimento após o atendimento. Nenhuma cobrança é feita online.
                  </p>

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
                              <Price amount={p.price} />
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

                  {/* Cancellation policy — owner-set text overrides the auto-generated sentence */}
                  <div className={b.note}>
                    <strong>Política de cancelamento</strong>
                    <p>
                      {company.copyOverrides.cancellationPolicyText?.trim() ||
                        (company.cancellationHours < 0
                          ? "Alterações devem ser solicitadas diretamente ao estabelecimento."
                          : `Cancelamento gratuito até ${company.cancellationHours} horas antes do atendimento.`)}
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
              <button
                type="button"
                className={b.mobileSummaryInfo}
                aria-label="Abrir resumo do agendamento"
                onClick={() => setBottomSheetOpen(true)}
              >
                <div className={b.mobileSummaryTitle}>
                  <span>
                    {selected[0]?.name}
                    {selected.length > 1
                      ? ` +${selected.length - 1}`
                      : ` • ${duration(minutes)}`}
                  </span>
                  <ChevronUp size={14} />
                </div>
                <div className={b.mobileSummaryPrice}>
                  <Price amount={step === 2 && quote ? quote.total : price} />
                </div>
              </button>

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
                      !customer?.emailVerified ||
                      !customer.phone ||
                      !paymentMethod))
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
                    ? resolveCopy(company.copyOverrides, "ctaConfirm")
                    : resolveCopy(company.copyOverrides, "ctaContinue")}
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
