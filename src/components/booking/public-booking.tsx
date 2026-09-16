/* eslint-disable react-hooks/set-state-in-effect -- Synchronizes server availability, URL state and persisted booking drafts. */
"use client";

import Image from "next/image";
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
  Phone,
  KeyRound,
  User,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import type { PublicCatalog } from "@/lib/booking/catalog";
import { isSectionVisible, resolveCopy } from "@/lib/booking/customization";
import type { AvailableSlot } from "@/lib/booking/engine";
import type { Selection } from "@/lib/booking/validation";
import { AvailabilityPicker } from "./availability-picker";
import { CustomerAuth, type Customer } from "./customer-auth";
import { PinInput } from "./pin-input";
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
import { MonthSchedulerModal } from "@/components/membership/month-scheduler-modal";
import {
  MembershipPlanCard,
  ActiveMembershipBanner,
  MembershipAccessModal,
} from "./membership-showcase";

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
    "PRODID:-//Reservei//Agendamento Online//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}@reservei.com.br`,
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
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "cash" | "card" | null>(null);
  const [extras, setExtras] = useState<Record<string, number>>({});
  const [coupon, setCoupon] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState("");
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinCreatedSuccess, setPinCreatedSuccess] = useState(false);

  // Estados para alteração de PIN quando já logado
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [changePin, setChangePin] = useState("");
  const [confirmChangePin, setConfirmChangePin] = useState("");
  const [changePinBusy, setChangePinBusy] = useState(false);
  const [changePinError, setChangePinError] = useState("");
  const [changePinSuccess, setChangePinSuccess] = useState("");

  // Estados para identificação sem senha ou login por PIN
  const [authMethod, setAuthMethod] = useState<"form" | "pin">("pin");
  const [loginPin, setLoginPin] = useState("");
  const [loginPinBusy, setLoginPinBusy] = useState(false);
  const [loginPinError, setLoginPinError] = useState("");
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const refreshCustomerMembership = useCallback(async () => {
    try {
      const data = await api<import("@/shared/types").CustomerMembershipDTO>(
        `/api/my/membership?companySlug=${company.slug}`,
      );
      setCustomerMembership(data);
    } catch {
      setCustomerMembership(null);
    }
  }, [company.slug]);

  const handleSwitchCustomer = async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {}
    setCustomer(null);
    setCustomerMembership(null);
    setAuthMethod("pin");
    setLoginPin("");
    setLoginPinError("");
    setLoginPinBusy(false);
    setFormName("");
    setFormPhone("");
    setFormEmail("");
    setFormError("");
    setFormBusy(false);
    setNewPin("");
    setConfirmNewPin("");
    setPinError("");
    setPinCreatedSuccess(false);
    setIsChangingPin(false);
    setChangePin("");
    setConfirmChangePin("");
    setChangePinError("");
    setChangePinSuccess("");
  };

  const handlePinSubmit = async (pinValue: string) => {
    const cleanPin = pinValue.trim();
    if (cleanPin.length !== 6 || loginPinBusy) return;
    setLoginPinBusy(true);
    setLoginPinError("");
    try {
      const res = await api<{ customer: Customer }>("/api/customer-access/pin/login", {
        method: "POST",
        body: JSON.stringify({ pin: cleanPin }),
      });
      setCustomer(res.customer);
      setLoginPin("");
      void refreshCustomerMembership();
    } catch (err: any) {
      setLoginPinError(err.message || "PIN incorreto ou não encontrado.");
    } finally {
      setLoginPinBusy(false);
    }
  };

  const handleUpdatePin = async () => {
    if (changePin.length !== 6 || confirmChangePin.length !== 6) {
      setChangePinError("O PIN deve conter exatamente 6 números.");
      return;
    }
    if (changePin !== confirmChangePin) {
      setChangePinError("Os PINs não coincidem.");
      return;
    }
    setChangePinBusy(true);
    setChangePinError("");
    try {
      const result = await api<{ customer: Customer; message?: string }>(
        "/api/customer-access/pin/setup",
        {
          method: "POST",
          body: JSON.stringify({
            pin: changePin,
            confirmPin: confirmChangePin,
            phone: customer?.phone || undefined,
          }),
        },
      );
      if (result.customer) setCustomer(result.customer);
      setChangePinSuccess("PIN atualizado com sucesso!");
      setTimeout(() => {
        setIsChangingPin(false);
        setChangePinSuccess("");
        setChangePin("");
        setConfirmChangePin("");
      }, 1500);
    } catch (err: any) {
      setChangePinError(err.message || "Erro ao atualizar PIN.");
    } finally {
      setChangePinBusy(false);
    }
  };

  const handleCreatePin = async () => {
    if (newPin.length !== 6 || confirmNewPin.length !== 6) {
      setPinError("O PIN deve conter exatamente 6 números.");
      return;
    }
    if (newPin !== confirmNewPin) {
      setPinError("Os PINs não coincidem.");
      return;
    }
    setPinBusy(true);
    setPinError("");
    try {
      const result = await api<{ customer: Customer }>("/api/customer-access/pin/setup", {
        method: "POST",
        body: JSON.stringify({
          pin: newPin,
          confirmPin: confirmNewPin,
          phone: customer?.phone || undefined,
        }),
      });
      setCustomer(result.customer);
      setPinCreatedSuccess(true);
      setNewPin("");
      setConfirmNewPin("");
      void refreshCustomerMembership();
    } catch (err: any) {
      setPinError(err instanceof Error ? err.message : "Erro ao salvar PIN.");
    } finally {
      setPinBusy(false);
    }
  };
  const handleSavePostBookingPin = handleCreatePin;

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

  const [membershipPlans, setMembershipPlans] = useState<import("@/shared/types").MembershipPlanDTO[]>([]);
  const [customerMembership, setCustomerMembership] = useState<import("@/shared/types").CustomerMembershipDTO | null>(null);
  const [inspectingPlan, setInspectingPlan] = useState<import("@/shared/types").MembershipPlanDTO | null>(null);
  const [monthSchedulerOpen, setMonthSchedulerOpen] = useState(false);
  const [membershipAccessModalOpen, setMembershipAccessModalOpen] = useState(false);
  const [selectedPlanForAccess, setSelectedPlanForAccess] = useState<import("@/shared/types").MembershipPlanDTO | null>(null);

  useEffect(() => {
    void api<import("@/shared/types").MembershipPlanDTO[]>(`/api/public/${company.slug}/membership-plans`)
      .then((data) => setMembershipPlans(data || []))
      .catch(() => setMembershipPlans([]));

    void api<import("@/shared/types").CustomerMembershipDTO>(`/api/my/membership?companySlug=${company.slug}`)
      .then((data) => setCustomerMembership(data))
      .catch(() => setCustomerMembership(null));
  }, [company.slug]);

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
          if (["pix", "cash", "card"].includes(draft.paymentMethod)) {
            setPaymentMethod(draft.paymentMethod);
          }
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
            paymentMethod,
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
    paymentMethod,
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
    if (!customer) {
      setError(
        "Por favor, informe seu nome e WhatsApp ou digite seu PIN para continuar.",
      );
      return;
    }
    if (!customer.hasPin) {
      setError("Crie seu PIN de 6 dígitos antes de confirmar o horário.");
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
            const matchedProfs = professionals.filter(
              (p) =>
                (p.serviceIds.length === 0 || p.serviceIds.includes(service.id)) &&
                (p.locationIds.length === 0 || p.locationIds.includes(locationId)),
            );
            const eligibleProfs = matchedProfs.length > 0
              ? matchedProfs
              : (professionals.filter((p) => p.locationIds.length === 0 || p.locationIds.includes(locationId)).length > 0
                  ? professionals.filter((p) => p.locationIds.length === 0 || p.locationIds.includes(locationId))
                  : professionals);

            return (
              <div key={service.id} className={b.summaryItem}>
                <div className={b.summaryItemRow}>
                  <div className={b.summaryItemLeft}>
                    {service.imageUrl && !failedImages[service.id] ? (
                      <Image
                        className={b.summaryItemThumb}
                        src={service.imageUrl}
                        alt={service.name}
                        width={40}
                        height={40}
                        unoptimized
                        onError={() => setFailedImages((prev) => ({ ...prev, [service.id]: true }))}
                      />
                    ) : (
                      <span
                        className={b.summaryItemThumb}
                        style={{
                          display: "grid",
                          placeItems: "center",
                          background: "var(--booking-surface-elevated)",
                          color: "var(--accent, #3b82f6)",
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
        <p className={b.muted} style={{ fontSize: 12, color: "var(--accent, #3b82f6)" }}>
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
                !customer?.hasPin ||
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
              ? (!customer
                  ? "Informe seus dados para agendar"
                  : !customer.hasPin
                    ? "Crie seu PIN de 6 dígitos para agendar"
                    : !paymentMethod
                      ? "Escolha a forma de pagamento"
                      : resolveCopy(company.copyOverrides, "ctaConfirm"))
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

            {/* Banner pós-reserva para criar PIN de acesso */}
            {customer?.phone && !customer.hasPin && (
              <div
                style={{
                  margin: "18px 0 14px",
                  padding: "16px",
                  borderRadius: "10px",
                  border: "1px solid #27272a",
                  backgroundColor: "#09090b",
                  color: "#fafafa",
                  textAlign: "center",
                }}
              >
                {pinCreatedSuccess ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      color: "#a3e635",
                      fontWeight: 600,
                      fontSize: "14px",
                    }}
                  >
                    <CheckCircle2 size={18} />
                    <span>Seu PIN de 6 dígitos foi ativado com sucesso!</span>
                  </div>
                ) : !showPinModal ? (
                  <>
                    <p style={{ margin: "0 0 10px", fontSize: "13.5px", color: "#d4d4d8" }}>
                      Quer consultar ou remarcar seus horários com facilidade e sem senhas?
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowPinModal(true)}
                      style={{
                        padding: "9px 18px",
                        borderRadius: "8px",
                        backgroundColor: "#dcff4c",
                        color: "#0a0a0a",
                        fontWeight: 600,
                        fontSize: "13px",
                        border: "none",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <ShieldCheck size={16} />
                      <span>CRIAR MEU PIN DE ACESSO</span>
                    </button>
                  </>
                ) : (
                  <div style={{ maxWidth: "340px", margin: "0 auto", textAlign: "left" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "10px",
                      }}
                    >
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "#fafafa" }}>
                        Crie seu PIN de 6 dígitos
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPinModal(false);
                          setPinError("");
                        }}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#a1a1aa",
                          cursor: "pointer",
                          fontSize: "12px",
                        }}
                      >
                        Cancelar
                      </button>
                    </div>

                    <p style={{ fontSize: "12px", color: "#a1a1aa", margin: "0 0 10px" }}>
                      Use este PIN para consultar, remarcar ou acompanhar suas reservas sem precisar de senhas.
                    </p>

                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await api<{ pin: string }>("/api/customer-access/pin/random");
                            setNewPin(res.pin);
                            setConfirmNewPin(res.pin);
                          } catch {
                            const rand = Math.floor(100000 + Math.random() * 900000).toString();
                            setNewPin(rand);
                            setConfirmNewPin(rand);
                          }
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#dcff4c",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                          padding: "2px 4px",
                        }}
                      >
                        ✦ Gerar PIN automático
                      </button>
                    </div>

                    <div style={{ marginBottom: "10px" }}>
                      <label style={{ display: "block", fontSize: "12px", marginBottom: "4px", color: "#d4d4d8" }}>
                        Digite 6 números
                      </label>
                      <PinInput
                        id="booking-new-pin"
                        value={newPin}
                        onChange={setNewPin}
                        length={6}
                        autoFocus
                        theme="dark"
                      />
                    </div>

                    <div style={{ marginBottom: "14px" }}>
                      <label style={{ display: "block", fontSize: "12px", marginBottom: "4px", color: "#d4d4d8" }}>
                        Confirme o PIN
                      </label>
                      <PinInput
                        id="booking-confirm-pin"
                        value={confirmNewPin}
                        onChange={setConfirmNewPin}
                        length={6}
                        theme="dark"
                      />
                    </div>

                    {pinError && (
                      <p style={{ color: "#ef4444", fontSize: "12px", margin: "0 0 10px" }}>
                        {pinError}
                      </p>
                    )}

                    <button
                      type="button"
                      disabled={pinBusy || newPin.length !== 6 || confirmNewPin.length !== 6}
                      onClick={handleSavePostBookingPin}
                      style={{
                        width: "100%",
                        padding: "9px",
                        borderRadius: "8px",
                        backgroundColor: "#dcff4c",
                        color: "#0a0a0a",
                        fontWeight: 600,
                        fontSize: "13px",
                        border: "none",
                        cursor: pinBusy ? "default" : "pointer",
                        opacity: newPin.length !== 6 || confirmNewPin.length !== 6 ? 0.6 : 1,
                      }}
                    >
                      {pinBusy ? "Salvando..." : "Confirmar e Ativar PIN"}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className={b.successActions}>
              <a
                href={`/minhas-reservas?booking=${bookingId}&confirmed=1`}
                className={`${b.button} ${b.wide}`}
              >
                <UserRound size={16} /> Ver minhas reservas
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
                      <Image className={b.avatar} src={company.logoUrl} alt="" width={54} height={54} unoptimized />
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

                  {/* Active Mensalista Banner */}
                  {customerMembership && customerMembership.status === "active" && (
                    <ActiveMembershipBanner
                      membership={customerMembership}
                      onScheduleMonth={() => setMonthSchedulerOpen(true)}
                    />
                  )}

                  {/* Planos Mensais Showcase Section */}
                  {membershipPlans.length > 0 && (!customerMembership || customerMembership.status !== "active") && (
                    <section className="public-membership-plans" style={{ marginBottom: 32 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <Sparkles size={18} color="var(--brand-primary, #6366f1)" />
                          <h2 style={{ fontSize: "1.08rem", fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>
                            Economize com um Plano Mensal
                          </h2>
                          <span style={{ fontSize: "0.82rem", color: "var(--text-secondary, #a1a1aa)" }}>
                            · Recorrência inteligente
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 16 }}>
                        {membershipPlans.map((plan) => (
                          <MembershipPlanCard
                            key={plan.id}
                            plan={plan}
                            onInspect={(p) => setInspectingPlan(p)}
                            onSouMensalista={(p) => {
                              if (customerMembership && customerMembership.status === "active") {
                                setMonthSchedulerOpen(true);
                              } else {
                                setSelectedPlanForAccess(p);
                                setMembershipAccessModalOpen(true);
                              }
                            }}
                          />
                        ))}
                      </div>
                    </section>
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
                            const isIncludedInMembership = customerMembership && customerMembership.status === "active" && customerMembership.includedServices?.some((s) => s.id === service.id);
                            const chosen = items.some(
                              (i) => i.serviceId === service.id,
                            );
                            const eligible = true;

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
                                      <Image
                                        className={b.serviceImage}
                                        src={service.imageUrl}
                                        alt={service.name}
                                        width={64}
                                        height={64}
                                        unoptimized
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
                                    </div>
                                  </div>
                                </div>

                                <div className={b.serviceActions}>
                                  <div className={b.servicePrice}>
                                    {isIncludedInMembership ? (
                                      <div>
                                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#10b981", background: "rgba(16,185,129,0.15)", padding: "2px 6px", borderRadius: 4 }}>
                                          INCLUÍDO NO PLANO
                                        </span>
                                        <strong style={{ display: "block", color: "#10b981" }}>R$ 0,00</strong>
                                      </div>
                                    ) : (
                                      <strong><Price amount={service.price} /></strong>
                                    )}
                                    {serviceHints[service.id] && <small className={b.muted}>Próximo horário: {serviceHints[service.id].date === today ? "Hoje" : dateLabelShort(serviceHints[service.id].date)} às {serviceHints[service.id].slot.startTime}</small>}
                                  </div>

                                  <div className={b.serviceButtons}>
                                    {!chosen && (
                                      <button
                                        type="button"
                                        className={`${b.button} ${b.small}`}
                                        onClick={() => {
                                          changeItems([{ serviceId: service.id, employeeId: null }]);
                                          event("service_selected");
                                          go(1);
                                        }}
                                        title="Escolher data e horário disponíveis"
                                      >
                                        Agendar
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      className={`${b.button} ${b.small} ${chosen ? "" : b.outline}`}
                                      aria-pressed={chosen}
                                      aria-label={`${chosen ? "Remover" : "Selecionar"} ${service.name}`}
                                      disabled={!chosen && items.length >= 8}
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
                              <Image
                                src={photo}
                                key={photo}
                                alt={`Foto ${i + 1} de ${company.name}`}
                                width={130}
                                height={95}
                                unoptimized
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
                  {customer ? (
                    <div className={b.note}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <strong>{customer.name}</strong>
                            {customer.hasPin ? (
                              <span
                                style={{
                                  fontSize: "11px",
                                  background: "rgba(16, 185, 129, 0.15)",
                                  color: "#10b981",
                                  border: "1px solid rgba(16, 185, 129, 0.3)",
                                  padding: "2px 7px",
                                  borderRadius: 4,
                                  fontWeight: 600,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                <Check size={11} /> PIN ativo
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: "11px",
                                  background: "rgba(245, 158, 11, 0.15)",
                                  color: "#f59e0b",
                                  border: "1px solid rgba(245, 158, 11, 0.3)",
                                  padding: "2px 7px",
                                  borderRadius: 4,
                                  fontWeight: 600,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                PIN pendente
                              </span>
                            )}
                          </div>
                          <p style={{ margin: "3px 0 0", fontSize: "13px", color: "var(--booking-text-muted)" }}>
                            {customer.phone ? customer.phone : "Contato registrado"} ·{" "}
                            {customer.hasPin
                              ? "Confira os dados e confirme seu horário."
                              : "Crie seu PIN de 6 dígitos abaixo para liberar o agendamento."}
                          </p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          {customer.hasPin && (
                            <button
                              type="button"
                              className={b.textButton}
                              onClick={() => {
                                setIsChangingPin((prev) => !prev);
                                setChangePin("");
                                setConfirmChangePin("");
                                setChangePinError("");
                                setChangePinSuccess("");
                              }}
                              style={{ fontSize: "12px", textDecoration: "underline" }}
                            >
                              {isChangingPin ? "Cancelar alteração" : "Alterar meu PIN"}
                            </button>
                          )}
                          <button
                            type="button"
                            className={b.textButton}
                            onClick={() => void handleSwitchCustomer()}
                            style={{ fontSize: "12px" }}
                          >
                            Trocar de conta
                          </button>
                        </div>
                      </div>

                      {/* Formulário inline para alterar PIN */}
                      {isChangingPin && (
                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--booking-border)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                            <span style={{ fontSize: "13px", fontWeight: 600 }}>Alterar PIN de acesso (6 dígitos)</span>
                            <button
                              type="button"
                              className={b.textButton}
                              disabled={changePinBusy}
                              onClick={async () => {
                                setChangePinError("");
                                try {
                                  const result = await api<{ pin: string }>("/api/customer-access/pin/random");
                                  setChangePin(result.pin);
                                  setConfirmChangePin(result.pin);
                                } catch (err) {
                                  setChangePinError(err instanceof Error ? err.message : "Não foi possível gerar PIN.");
                                }
                              }}
                              style={{ fontSize: "11.5px" }}
                            >
                              <Sparkles size={12} /> Gerar PIN disponível
                            </button>
                          </div>
                          <div style={{ display: "grid", gap: 10, maxWidth: 360 }}>
                            <div>
                              <label style={{ fontSize: "12px", color: "var(--booking-text-muted)", display: "block", marginBottom: 4 }}>
                                Novo PIN
                              </label>
                              <PinInput
                                id="booking-change-pin-input"
                                value={changePin}
                                onChange={setChangePin}
                                length={6}
                                autoFocus
                                theme="dark"
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: "12px", color: "var(--booking-text-muted)", display: "block", marginBottom: 4 }}>
                                Confirmar novo PIN
                              </label>
                              <PinInput
                                id="booking-confirm-change-pin-input"
                                value={confirmChangePin}
                                onChange={setConfirmChangePin}
                                length={6}
                                theme="dark"
                              />
                            </div>
                            {changePinError && (
                              <p style={{ color: "var(--booking-danger)", fontSize: "12px", margin: 0 }}>
                                {changePinError}
                              </p>
                            )}
                            {changePinSuccess && (
                              <p style={{ color: "#10b981", fontSize: "12px", margin: 0, fontWeight: 500 }}>
                                ✓ {changePinSuccess}
                              </p>
                            )}
                            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                              <button
                                type="button"
                                className={`${b.button} ${b.small}`}
                                disabled={changePinBusy || changePin.length !== 6 || confirmChangePin.length !== 6}
                                onClick={() => void handleUpdatePin()}
                              >
                                {changePinBusy ? "Salvando..." : "Salvar novo PIN"}
                              </button>
                              <button
                                type="button"
                                className={`${b.button} ${b.outline} ${b.small}`}
                                onClick={() => setIsChangingPin(false)}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={b.authPhoneCard} style={{ margin: "16px 0" }}>
                      {authMethod === "pin" ? (
                        <div>
                          <div className={b.authVerifyHeader}>
                            <div className={b.authVerifyIconBadge}>
                              <KeyRound size={20} />
                            </div>
                            <div className={b.authVerifyHeaderText}>
                              <span className={b.authVerifyTag}>Cliente cadastrado</span>
                              <h3 className={b.authVerifyTitle}>Entrar com seu PIN</h3>
                            </div>
                          </div>
                          <p className={b.muted} style={{ margin: "0 0 16px", fontSize: "13px" }}>
                            Digite o PIN de 6 dígitos criado no seu agendamento anterior para carregar seus dados.
                          </p>
                          <div style={{ margin: "0 auto 16px", display: "flex", justifyContent: "center" }}>
                            <PinInput
                              id="booking-login-pin"
                              value={loginPin}
                              onChange={(val) => {
                                setLoginPin(val);
                                if (loginPinError) setLoginPinError("");
                                if (val.length === 6) {
                                  void handlePinSubmit(val);
                                }
                              }}
                              length={6}
                              autoFocus
                              error={Boolean(loginPinError)}
                              theme="dark"
                            />
                          </div>
                          {loginPinError && (
                            <p style={{ color: "var(--booking-danger)", fontSize: "12.5px", margin: "0 0 12px", textAlign: "center" }}>
                              {loginPinError}
                            </p>
                          )}
                          <button
                            type="button"
                            className={`${b.button} ${b.wide}`}
                            disabled={loginPinBusy || loginPin.length !== 6}
                            onClick={() => void handlePinSubmit(loginPin)}
                          >
                            {loginPinBusy ? "Identificando..." : "Confirmar PIN e prosseguir"}
                          </button>
                          <div style={{ marginTop: "14px", textAlign: "center" }}>
                            <button
                              type="button"
                              className={b.textButton}
                              onClick={() => {
                                setAuthMethod("form");
                                setLoginPinError("");
                              }}
                              style={{ fontSize: "12.5px" }}
                            >
                              Primeira vez aqui? Preencher meus dados
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className={b.authVerifyHeader}>
                            <div className={b.authVerifyIconBadge}>
                              <User size={20} />
                            </div>
                            <div className={b.authVerifyHeaderText}>
                              <span className={b.authVerifyTag}>Identificação</span>
                              <h3 className={b.authVerifyTitle}>Seus dados para a reserva</h3>
                            </div>
                          </div>
                          <p className={b.muted} style={{ margin: "0 0 16px", fontSize: "13px" }}>
                            Sem senhas! Você receberá confirmações por WhatsApp e poderá criar um PIN simples de 6 dígitos.
                          </p>
                          <form
                            onSubmit={async (e) => {
                              e.preventDefault();
                              setFormBusy(true);
                              setFormError("");
                              try {
                                const res = await api<{ customer: Customer | null; hasPin: boolean }>("/api/customer-access/identify", {
                                  method: "POST",
                                  body: JSON.stringify({
                                    name: formName,
                                    phone: formPhone,
                                    email: formEmail || undefined,
                                  }),
                                });
                                if (res.hasPin) {
                                  setAuthMethod("pin");
                                  setLoginPin("");
                                  setLoginPinError("Este celular já possui PIN. Digite-o para continuar.");
                                } else if (res.customer) {
                                  setCustomer(res.customer);
                                  void refreshCustomerMembership();
                                }
                              } catch (err: any) {
                                setFormError(err.message || "Erro ao salvar dados.");
                              } finally {
                                setFormBusy(false);
                              }
                            }}
                            style={{ display: "grid", gap: "12px" }}
                          >
                            <label className={b.field}>
                              Seu nome completo *
                              <input
                                type="text"
                                required
                                minLength={2}
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                placeholder="Ex: Maria Silva"
                                autoFocus
                              />
                            </label>
                            <label className={b.field}>
                              WhatsApp / Celular com DDD *
                              <input
                                type="tel"
                                required
                                minLength={8}
                                value={formPhone}
                                onChange={(e) => {
                                  const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                                  let formatted = digits;
                                  if (digits.length <= 2) formatted = digits.length ? `(${digits}` : "";
                                  else if (digits.length <= 7) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
                                  else formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
                                  setFormPhone(formatted);
                                }}
                                placeholder="(11) 99999-9999"
                              />
                            </label>
                            <label className={b.field}>
                              E-mail (opcional)
                              <input
                                type="email"
                                value={formEmail}
                                onChange={(e) => setFormEmail(e.target.value)}
                                placeholder="Para receber comprovante"
                              />
                            </label>
                            {formError && (
                              <p style={{ color: "var(--booking-danger)", fontSize: "12.5px", margin: 0 }}>
                                {formError}
                              </p>
                            )}
                            <button
                              type="submit"
                              className={`${b.button} ${b.wide}`}
                              disabled={formBusy || formName.trim().length < 2 || formPhone.replace(/\D/g, "").length < 8}
                              style={{ marginTop: "6px" }}
                            >
                              {formBusy ? "Salvando..." : "Continuar com agendamento"}
                            </button>
                          </form>
                          <div style={{ marginTop: "14px", textAlign: "center" }}>
                            <button
                              type="button"
                              className={b.textButton}
                              onClick={() => {
                                setAuthMethod("pin");
                                setFormError("");
                              }}
                              style={{ fontSize: "12.5px" }}
                            >
                              Já tem um PIN de reservas? Entrar com seu PIN
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {customer && !customer.hasPin && (
                    <div className={b.authPhoneCard} style={{ margin: "16px 0" }}>
                      <div className={b.authVerifyHeader}>
                        <div className={b.authVerifyIconBadge}>
                          <KeyRound size={20} />
                        </div>
                        <div className={b.authVerifyHeaderText}>
                          <span className={b.authVerifyTag}>Obrigatório para agendar</span>
                          <h3 className={b.authVerifyTitle}>Crie seu PIN de 6 dígitos</h3>
                        </div>
                      </div>
                      <p className={b.muted} style={{ margin: "0 0 16px", fontSize: "13px" }}>
                        Para sua segurança e privacidade, o Reservei só permite marcar horários com um PIN criado. Use-o para consultar e remarcar sempre que precisar.
                      </p>
                      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                        <button
                          type="button"
                          className={b.textButton}
                          disabled={pinBusy}
                          onClick={async () => {
                            setPinError("");
                            try {
                              const result = await api<{ pin: string }>("/api/customer-access/pin/random");
                              setNewPin(result.pin);
                              setConfirmNewPin(result.pin);
                            } catch (err) {
                              setPinError(err instanceof Error ? err.message : "Não foi possível gerar um PIN agora.");
                            }
                          }}
                        >
                          <Sparkles size={13} /> Gerar PIN disponível
                        </button>
                      </div>
                      <div style={{ display: "grid", gap: 14 }}>
                        <label className={b.field}>
                          Digite seu PIN
                          <PinInput
                            id="booking-required-new-pin"
                            value={newPin}
                            onChange={setNewPin}
                            length={6}
                            autoFocus
                            error={Boolean(pinError)}
                            theme="dark"
                          />
                        </label>
                        <label className={b.field}>
                          Confirme seu PIN
                          <PinInput
                            id="booking-required-confirm-pin"
                            value={confirmNewPin}
                            onChange={setConfirmNewPin}
                            length={6}
                            error={Boolean(pinError)}
                            theme="dark"
                          />
                        </label>
                        {pinError && (
                          <p style={{ color: "var(--booking-danger)", fontSize: "12.5px", margin: 0 }}>
                            {pinError}
                          </p>
                        )}
                        <button
                          type="button"
                          className={`${b.button} ${b.wide}`}
                          disabled={pinBusy || newPin.length !== 6 || confirmNewPin.length !== 6}
                          onClick={() => void handleCreatePin()}
                        >
                          {pinBusy ? "Criando PIN..." : "Criar PIN e liberar agendamento"}
                        </button>
                      </div>
                    </div>
                  )}

                  {customer?.hasPin && (
                    <>
                      {pinCreatedSuccess && (
                        <div
                          className={b.note}
                          style={{
                            borderColor: "rgba(16, 185, 129, 0.3)",
                            background: "rgba(16, 185, 129, 0.08)",
                            marginTop: 12,
                            marginBottom: 12,
                          }}
                        >
                          <p style={{ color: "#10b981", fontSize: "13px", margin: 0, fontWeight: 500 }}>
                            ✓ PIN cadastrado com sucesso! Agora escolha a forma de pagamento para confirmar seu horário.
                          </p>
                        </div>
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
                      !customer?.hasPin ||
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
                    ? (!customer
                        ? "Identifique-se"
                        : !customer.hasPin
                          ? "Crie seu PIN"
                          : !paymentMethod
                            ? "Forma de pagamento"
                            : resolveCopy(company.copyOverrides, "ctaConfirm"))
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

        {/* Month Scheduler Modal for Active Mensalistas */}
        {customerMembership && (
          <MonthSchedulerModal
            customerMembershipId={customerMembership.id}
            clientName={customer?.name || "Cliente"}
            isOpen={monthSchedulerOpen}
            onClose={() => setMonthSchedulerOpen(false)}
            onSuccess={() => {
              setMonthSchedulerOpen(false);
              void api<import("@/shared/types").CustomerMembershipDTO>(`/api/my/membership?companySlug=${company.slug}`)
                .then(setCustomerMembership)
                .catch(() => {});
            }}
            notify={(msg) => alert(msg)}
          />
        )}

        {/* Sou Mensalista Quick Identification Modal */}
        <MembershipAccessModal
          isOpen={membershipAccessModalOpen}
          onClose={() => setMembershipAccessModalOpen(false)}
          onSuccess={(activeMem, authCustomer) => {
            setCustomerMembership(activeMem);
            if (authCustomer) setCustomer(authCustomer);
            setMonthSchedulerOpen(true);
          }}
          company={company}
          planName={selectedPlanForAccess?.name}
        />

        {/* Plan Details Modal */}
        {inspectingPlan && (
          <div
            className={b.bottomSheetOverlay}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setInspectingPlan(null);
            }}
          >
            <div
              style={{
                background: "var(--bg-card, #1e1e1e)",
                border: "1px solid var(--border-color, #333)",
                borderRadius: 12,
                padding: 24,
                maxWidth: 480,
                width: "90%",
                color: "var(--text-primary, #fff)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: inspectingPlan.badgeColor || "var(--brand-primary, #6366f1)",
                    }}
                  >
                    Plano Mensal
                  </span>
                  <h3 style={{ fontSize: "1.3rem", margin: "2px 0 0", fontWeight: 700 }}>{inspectingPlan.name}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectingPlan(null)}
                  style={{ background: "transparent", border: "none", color: "var(--text-secondary, #999)", cursor: "pointer" }}
                >
                  <X size={20} />
                </button>
              </div>

              {inspectingPlan.description && (
                <p style={{ fontSize: "0.9rem", color: "var(--text-secondary, #aaa)", marginBottom: 16 }}>
                  {inspectingPlan.description}
                </p>
              )}

              <div
                style={{
                  background: "var(--bg-secondary, #252525)",
                  padding: "12px 16px",
                  borderRadius: 8,
                  marginBottom: 16,
                }}
              >
                <span style={{ fontSize: "0.8rem", color: "var(--text-secondary, #aaa)" }}>Valor da Mensalidade</span>
                <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--brand-primary, #6366f1)" }}>
                  {money(inspectingPlan.price)} <small style={{ fontSize: "0.85rem", fontWeight: 500 }}>/mês</small>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <strong style={{ fontSize: "0.85rem", display: "block", marginBottom: 8 }}>O que está incluído:</strong>
                <ul style={{ paddingLeft: 20, margin: 0, fontSize: "0.85rem", color: "var(--text-secondary, #ccc)", lineHeight: 1.6 }}>
                  <li>
                    {inspectingPlan.frequencyType === "WEEKLY_CALENDAR_BASED"
                      ? `${inspectingPlan.weeklyFrequency || 1} atendimento por semana (calcula 4 ou 5 semanas do mês)`
                      : `${inspectingPlan.sessionsPerPeriod} atendimentos fixos por mês`}
                  </li>
                  <li>Serviços: {inspectingPlan.services.map((s) => s.name).join(", ")}</li>
                  <li>Escolha todos os seus horários do mês de uma vez só</li>
                  <li>{inspectingPlan.allowReschedule ? `Remarcação permitida com até ${inspectingPlan.rescheduleHoursNotice}h de antecedência` : "Sessões fixas"}</li>
                </ul>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  className={`${b.button} ${b.wide}`}
                  onClick={() => {
                    const phone = company.phone?.replace(/\D/g, "");
                    const text = encodeURIComponent(`Olá! Gostaria de contratar o plano mensal "${inspectingPlan.name}" (${money(inspectingPlan.price)}/mês) no ${company.name}.`);
                    if (phone) {
                      window.open(`https://wa.me/${phone.length <= 11 ? "55" : ""}${phone}?text=${text}`, "_blank");
                    } else {
                      alert(`Entre em contato com ${company.name} para aderir a este plano mensal!`);
                    }
                    setInspectingPlan(null);
                  }}
                  style={{ fontWeight: 700 }}
                >
                  Quero Este Plano
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </PublicFrame>
  );
}
