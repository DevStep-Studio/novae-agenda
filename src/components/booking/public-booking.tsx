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
  duration,
  ErrorMessage,
  money,
  PublicFrame,
} from "./primitives";
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
  const [items, setItems] = useState<Selection>([]),
    [locationId, setLocationId] = useState(locations[0]?.id ?? ""),
    [step, setStep] = useState(0),
    [date, setDate] = useState(""),
    [slot, setSlot] = useState<AvailableSlot | null>(null),
    [search, setSearch] = useState(""),
    [customer, setCustomer] = useState<Customer | null>(null),
    [notes, setNotes] = useState(""),
    [extras, setExtras] = useState<Record<string, number>>({}),
    [coupon, setCoupon] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [bookingId, setBookingId] = useState("");
  const [quote, setQuote] = useState<{
    subtotal: number;
    discount: number;
    total: number;
  } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false),
    [quoteError, setQuoteError] = useState("");
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
    if (sessionId)
      void api(`/api/public/${company.slug}/events`, {
        method: "POST",
        body: JSON.stringify({ event: name, sessionId: sessionId }),
      }).catch(() => {});
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
        event: "public_profile_view",
        sessionId: initialSessionId,
      }),
    }).catch(() => {});
    const params = new URLSearchParams(window.location.search),
      token = params.get("verify");
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
    // Catalog is fixed for this page load. Restoration must happen once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (ready && !bookingId)
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
            requestId: requestId,
            savedAt: Date.now(),
          }),
        );
      } catch {}
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
      .filter(Boolean),
    price =
      selected.reduce((sum, s) => sum + s.price, 0) +
      products.reduce((sum, p) => sum + p.price * (extras[p.id] || 0), 0),
    minutes = selected.reduce((sum, s) => sum + s.durationMinutes, 0);
  const visible = services.filter((s) =>
    `${s.name} ${s.category ?? ""}`
      .toLocaleLowerCase("pt-BR")
      .includes(search.toLocaleLowerCase("pt-BR")),
  );
  const categories = [...new Set(visible.map((s) => s.category || "Serviços"))];
  function changeItems(next: Selection) {
    setItems(next);
    setSlot(null);
    setRequestId(crypto.randomUUID());
  }
  function go(next: number) {
    setError("");
    setStep(next);
    window.scrollTo({ top: 0, behavior: "instant" });
    setTimeout(() => heading.current?.focus(), 0);
    if (next === 2) event("checkout_started");
  }
  async function confirm(e?: FormEvent) {
    e?.preventDefault();
    if (busy || !slot || !customer || quoteLoading || !quote) return;
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
        }),
      });
      setBookingId(result.id);
      sessionStorage.removeItem(storageKey);
      window.location.assign(
        `/meus-agendamentos?booking=${result.id}&confirmed=1`,
      );
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && e.status === 409) {
        setSlot(null);
        setStep(1);
        setRequestId(crypto.randomUUID());
      }
    } finally {
      setBusy(false);
    }
  }
  const summary = (
    <aside className={b.summary} aria-label="Resumo do agendamento">
      <p className={b.eyebrow}>
        {step === 2 ? "Revise sua reserva" : "Tudo em um só lugar"}
      </p>
      <h2>Seu agendamento</h2>
      {!selected.length ? (
        <div className={b.summaryEmpty}>
          <Clock3 size={25} />
          <p>Seu próximo momento de cuidado começa aqui.</p>
          <span className={b.muted}>
            Escolha um ou mais serviços para continuar.
          </span>
        </div>
      ) : (
        <>
          {selected.map((service) => {
            const item = items.find((i) => i.serviceId === service.id)!;
            const planned = slot?.items.find((i) => i.serviceId === service.id);
            return (
              <div key={service.id} className={b.summaryItem}>
                <div className={b.row}>
                  {service.imageUrl && (
                    <img
                      className={b.serviceImage}
                      src={service.imageUrl}
                      alt=""
                      loading="lazy"
                    />
                  )}
                  <h3>{service.name}</h3>
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
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                <div className={b.row}>
                  <span className={b.muted}>
                    {duration(service.durationMinutes)}
                  </span>
                  <strong>{money(service.price)}</strong>
                </div>
                {step < 2 ? (
                  <label className={b.field} style={{ marginBottom: 0 }}>
                    <span className={b.muted}>Profissional</span>
                    <select
                      aria-label={`Profissional para ${service.name}`}
                      value={item.employeeId ?? ""}
                      onChange={(e) =>
                        changeItems(
                          items.map((i) =>
                            i.serviceId === service.id
                              ? { ...i, employeeId: e.target.value || null }
                              : i,
                          ),
                        )
                      }
                    >
                      <option value="">Qualquer profissional disponível</option>
                      {professionals
                        .filter(
                          (p) =>
                            p.serviceIds.includes(service.id) &&
                            p.locationIds.includes(locationId),
                        )
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </label>
                ) : (
                  <p className={b.muted}>
                    {planned?.employeeName} · {planned?.startTime}–
                    {planned?.endTime}
                  </p>
                )}
              </div>
            );
          })}
          {step > 0 && (
            <button className={b.textButton} onClick={() => go(0)}>
              <Plus size={15} /> Adicionar outro serviço
            </button>
          )}
          {slot && (
            <div className={b.note}>
              <strong>{dateLabel(date)}</strong>
              <p>
                {slot.startTime}–{slot.endTime}
              </p>
              <span className={b.muted}>{company.name}</span>
            </div>
          )}
        </>
      )}
      {Object.entries(extras)
        .filter(([, q]) => q > 0)
        .map(([id, q]) => (
          <div className={b.row} key={id}>
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
            style={{ display: "block", fontWeight: 400 }}
          >
            {duration(minutes) || "Nenhum serviço"}
          </span>
        </div>
        <strong>{money(step === 2 && quote ? quote.total : price)}</strong>
      </div>
      {step === 2 && quoteLoading && (
        <p className={b.muted} role="status">
          Conferindo valores…
        </p>
      )}
      {step === 2 && quote && quote.discount > 0 && (
        <p className={b.muted}>Desconto aplicado: −{money(quote.discount)}</p>
      )}
      <ErrorMessage message={quoteError} />
      {step === 2 && (
        <div className={b.note}>
          <strong>Reserve agora, pague no atendimento</strong>
          <p>Você não será cobrado online.</p>
        </div>
      )}
      <div className={b.summaryFooter}>
        <button
          className={`${b.button} ${b.wide}`}
          disabled={
            !selected.length ||
            !locationId ||
            (step === 1 && !slot) ||
            (step === 2 &&
              (!customer ||
                busy ||
                !slot ||
                quoteLoading ||
                !quote ||
                !customer.phone))
          }
          onClick={() => (step === 2 ? void confirm() : go(step + 1))}
        >
          {busy
            ? "Confirmando…"
            : step === 2
              ? "Confirmar agendamento"
              : "Continuar"}
          {!busy && <ArrowRight size={16} />}
        </button>
        <p className={b.trust}>
          <ShieldCheck size={13} /> Seus dados protegidos
        </p>
      </div>
    </aside>
  );
  return (
    <PublicFrame color={company.color}>
      <main className={b.main}>
        <ol className={b.progress}>
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
        <ErrorMessage message={error} />
        <div className={b.layout}>
          <div className={b.content}>
            {step > 0 && (
              <button
                className={`${b.textButton} ${b.back}`}
                onClick={() => go(step - 1)}
              >
                <ArrowLeft size={17} /> Voltar
              </button>
            )}
            <p className={b.eyebrow}>
              {step === 0
                ? "Um tempo para você"
                : step === 1
                  ? "Encontre seu melhor momento"
                  : "Falta muito pouco"}
            </p>
            <h1 ref={heading} tabIndex={-1} className={b.title}>
              {
                [
                  "O que vamos agendar?",
                  "Escolha a data e o horário",
                  "Revise e confirme seu horário",
                ][step]
              }
            </h1>
            <p className={b.subtitle}>
              {
                [
                  "Escolha os serviços e deixe o resto com a gente.",
                  `Horários locais do estabelecimento · ${company.timezone}`,
                  "Confira os detalhes e conte como podemos preparar sua visita.",
                ][step]
              }
            </p>
            {step === 0 && (
              <>
                <div className={b.profile}>
                  {company.logoUrl ? (
                    <img className={b.avatar} src={company.logoUrl} alt="" />
                  ) : (
                    <span className={b.avatar}>{company.name.slice(0, 1)}</span>
                  )}
                  <div>
                    <h2>{company.name}</h2>
                    <div className={b.muted}>{company.category}</div>
                    {company.address && (
                      <div className={`${b.muted} ${b.inline}`}>
                        <MapPin size={13} />
                        {company.address}
                      </div>
                    )}
                  </div>
                </div>
                {company.description && (
                  <p className={b.muted}>{company.description}</p>
                )}
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
                <div className={b.search}>
                  <Search size={19} />
                  <input
                    aria-label="Pesquisar serviço"
                    placeholder="Qual serviço você procura?"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
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
                    Nenhum serviço encontrado. Tente outra palavra.
                  </div>
                ) : (
                  categories.map((category) => (
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
                            ),
                            eligible = professionals.some(
                              (p) =>
                                p.serviceIds.includes(service.id) &&
                                p.locationIds.includes(locationId),
                            );
                          return (
                            <article className={b.service} key={service.id}>
                              <div>
                                {service.bookings > 0 &&
                                  service.bookings ===
                                    Math.max(
                                      ...services.map((s) => s.bookings),
                                    ) && (
                                    <span className={b.badge}>
                                      Mais escolhido
                                    </span>
                                  )}
                                {service.imageUrl && (
                                  <img
                                    className={b.serviceImage}
                                    src={service.imageUrl}
                                    alt=""
                                    loading="lazy"
                                  />
                                )}
                                <h3>{service.name}</h3>
                                {service.description && (
                                  <p className={b.muted}>
                                    {service.description}
                                  </p>
                                )}
                                <div className={`${b.muted} ${b.inline}`}>
                                  <Clock3 size={13} />
                                  {duration(service.durationMinutes)}
                                  {service.deliveryMode === "ONLINE" &&
                                    " · Online"}
                                </div>
                                {!eligible && (
                                  <p className={b.muted}>
                                    Indisponível nesta unidade
                                  </p>
                                )}
                              </div>
                              <div className={b.serviceActions}>
                                <div className={b.price}>
                                  <strong>{money(service.price)}</strong>
                                </div>
                                <button
                                  className={`${b.button} ${b.small} ${chosen ? "" : b.outline}`}
                                  aria-pressed={chosen}
                                  aria-label={`${chosen ? "Remover" : "Reservar"} ${service.name}`}
                                  disabled={
                                    !eligible || (!chosen && items.length >= 8)
                                  }
                                  onClick={() => {
                                    changeItems(
                                      chosen
                                        ? items.filter(
                                            (i) => i.serviceId !== service.id,
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
                                      <Check size={14} /> Adicionado
                                    </>
                                  ) : (
                                    "Reservar"
                                  )}
                                </button>
                              </div>
                            </article>
                          );
                        })}
                    </section>
                  ))
                )}
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
                <div className={b.muted}>
                  <p>
                    Funcionamento:{" "}
                    {settings.workingDays
                      .map(
                        (d) =>
                          ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][d],
                      )
                      .join(", ")}{" "}
                    · {settings.openTime}–{settings.closeTime}
                  </p>
                  {company.phone && (
                    <p>
                      <a href={`tel:${company.phone.replace(/[^+\d]/g, "")}`}>
                        {company.phone}
                      </a>
                    </p>
                  )}
                  {company.instagram && (
                    <a
                      href={`https://instagram.com/${company.instagram.replace(/^@/, "")}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Instagram
                    </a>
                  )}
                </div>
              </>
            )}
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
              />
            )}
            {step === 2 && (
              <>
                {!customer ? (
                  <CustomerAuth
                    returnTo={`/agendar/${company.slug}`}
                    onReady={onCustomer}
                  />
                ) : (
                  <div className={b.note}>
                    <div className={b.inline}>
                      <Check size={17} />
                      <strong>{customer.name}</strong>
                    </div>
                    <p>
                      {customer.email} · {customer.phone}
                    </p>
                  </div>
                )}
                {customer && !customer.phone && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const phone = new FormData(e.currentTarget).get("phone");
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
                <label className={b.field} style={{ marginTop: 25 }}>
                  Alguma observação para sua visita?
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={2000}
                    placeholder="Conte algo que gostaria que o profissional soubesse (opcional)."
                  />
                </label>
                {products.length > 0 && (
                  <section>
                    <h2 style={{ fontSize: 18 }}>Complete seu cuidado</h2>
                    <p className={b.muted}>
                      Produtos opcionais para levar com você.
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
                <label className={b.field} style={{ marginTop: 25 }}>
                  Código promocional (opcional)
                  <input
                    value={coupon}
                    onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                    maxLength={40}
                    placeholder="Seu cupom"
                  />
                </label>
                <div className={b.note}>
                  <strong>Cancelamento e remarcação</strong>
                  <p>
                    {company.cancellationHours < 0
                      ? "Alterações devem ser solicitadas diretamente ao estabelecimento."
                      : `Você pode alterar ou cancelar até ${company.cancellationHours} horas antes do atendimento.`}
                  </p>
                  {selected
                    .filter((s) => s.cancellationPolicy)
                    .map((s) => (
                      <p key={s.id}>
                        {s.name}: {s.cancellationPolicy}
                      </p>
                    ))}
                </div>
              </>
            )}
          </div>
          {summary}
        </div>
      </main>
    </PublicFrame>
  );
}
