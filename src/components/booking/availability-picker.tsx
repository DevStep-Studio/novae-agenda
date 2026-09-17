/* eslint-disable react-hooks/set-state-in-effect -- Synchronizes server availability, URL state and persisted booking drafts. */
"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ArrowRight, Clock, CalendarDays, Sparkles, AlertCircle, RefreshCw } from "lucide-react";
import { api } from "@/lib/api-client";
import type { AvailableSlot } from "@/lib/booking/engine";
import type { Selection } from "@/lib/booking/validation";
import { b, dateLabel, dateLabelShort, ErrorMessage, Skeleton, TimeSlotButton } from "./primitives";

type Availability = {
  dates: Array<{ date: string; count: number }>;
  slots: AvailableSlot[];
};

type NextDay = {
  date: string;
  label: string;
  slots: AvailableSlot[];
  totalCount: number;
};

function monthDays(month: string) {
  return new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    0,
  ).getDate();
}

function moveMonth(month: string, delta: number) {
  const d = new Date(`${month}-15T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 7);
}

export function AvailabilityPicker({
  slug,
  locationId,
  items,
  today,
  maxLeadDays,
  date,
  onDate,
  selected,
  onSelect,
  bookingId,
  onWaitlist,
  waitlistStatus = "idle",
}: {
  slug: string;
  locationId: string;
  items: Selection;
  today: string;
  maxLeadDays: number;
  date: string;
  onDate: (d: string) => void;
  selected: AvailableSlot | null;
  onSelect: (slot: AvailableSlot | null) => void;
  bookingId?: string;
  onWaitlist?: () => void;
  waitlistStatus?: "idle" | "loading" | "success" | "error";
}) {
  const [month, setMonth] = useState((date || today).slice(0, 7));
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("Todos");
  const [nextSuggestion, setNextSuggestion] = useState<{ date: string; slot: AvailableSlot } | null>(null);
  const [nextDays, setNextDays] = useState<NextDay[]>([]);
  const [loadingNextDays, setLoadingNextDays] = useState(false);
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  const [nextBusy, setNextBusy] = useState(false);
  const [reload, setReload] = useState(0);

  const encoded = JSON.stringify(items);
  const query = useCallback(
    (day: string) =>
      new URLSearchParams({
        locationId,
        date: day,
        items: encoded,
        ...(bookingId ? { bookingId } : {}),
      }),
    [bookingId, encoded, locationId],
  );

  // Load next availability slots on mount / selection change
  useEffect(() => {
    const controller = new AbortController();
    setLoadingNextDays(true);
    setNextDays([]);
    setError("");

    api<{ date: string; slot: AvailableSlot; nextDays?: NextDay[] } | null>(
      `/api/public/${slug}/next-availability?${query(today)}`,
      { signal: controller.signal }
    )
      .then((res) => {
        if (controller.signal.aborted) return;
        setNextDays(res?.nextDays ?? []);
        setLoadingNextDays(false);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e.message || "Não foi possível carregar os próximos horários.");
          setLoadingNextDays(false);
        }
      });

    return () => controller.abort();
  }, [slug, today, reload, query]);

  // Fetch the month only when the customer opens the calendar.
  useEffect(() => {
    if (!showFullCalendar) return;
    const controller = new AbortController();
    setCalendarLoading(true);
    setCounts({});
    const q = new URLSearchParams({
      locationId,
      date: `${month}-01`,
      items: encoded,
      days: String(monthDays(month)),
      ...(bookingId ? { bookingId } : {}),
    });

    api<Availability>(`/api/public/${slug}/availability?${q}`, {
      signal: controller.signal,
    })
      .then((data) => {
        setCounts(Object.fromEntries(data.dates.map((d) => [d.date, d.count])));
        setCalendarLoading(false);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e.message || "Não foi possível carregar o calendário.");
          setCalendarLoading(false);
        }
      });

    return () => controller.abort();
  }, [slug, locationId, encoded, month, bookingId, reload, showFullCalendar]);

  // Load time slots for selected date
  useEffect(() => {
    if (!date || !showFullCalendar) {
      setSlots([]);
      setLoading(false);
      setNextSuggestion(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setSlots([]);
    setError("");
    setNextSuggestion(null);

    const q = new URLSearchParams({
      locationId,
      date,
      items: encoded,
      ...(bookingId ? { bookingId } : {}),
    });

    api<Availability>(`/api/public/${slug}/availability?${q}`, {
      signal: controller.signal,
    })
      .then((data) => {
        setSlots(data.slots);
        setLoading(false);

        // If no slots on this date, fetch next availability in background for suggestion
        if (data.slots.length === 0) {
          api<{ date: string; slot: AvailableSlot } | null>(
            `/api/public/${slug}/next-availability?${query(date)}`,
            { signal: controller.signal }
          )
            .then((next) => {
              if (next) setNextSuggestion(next);
            })
            .catch(() => {});
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e.message || "Não conseguimos carregar os horários para esta data.");
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [slug, locationId, encoded, date, bookingId, reload, showFullCalendar, query]);

  async function handleFindNext() {
    setNextBusy(true);
    setError("");
    try {
      const result = await api<{ date: string; slot: AvailableSlot } | null>(
        `/api/public/${slug}/next-availability?${query(date || today)}`,
      );
      if (result) {
        setMonth(result.date.slice(0, 7));
        onDate(result.date);
        onSelect(result.slot);
        setReload((v) => v + 1);
      } else {
        setError(
          "Não encontramos vagas livres nos próximos dias. Entre na lista de espera ou contate o estabelecimento.",
        );
      }
    } catch (e) {
      setError((e as Error).message || "Não foi possível buscar a próxima data.");
    } finally {
      setNextBusy(false);
    }
  }

  const offset = (new Date(`${month}-01T12:00:00Z`).getUTCDay() + 6) % 7;
  const last = new Date(`${today}T12:00:00Z`);
  last.setUTCDate(last.getUTCDate() + maxLeadDays);

  const groups = [
    { name: "Manhã", min: 6, max: 12 },
    { name: "Tarde", min: 12, max: 18 },
    { name: "Noite", min: 18, max: 24 },
  ];

  // Count slots per group
  const groupCounts = groups.reduce((acc, g) => {
    const c = slots.filter((s) => {
      const h = Number(s.startTime.slice(0, 2));
      return (h >= g.min && h < g.max) || (g.name === "Noite" && h < 6);
    }).length;
    acc[g.name] = c;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className={b.pickerContainer}>
      <ErrorMessage message={error} />

      {/* QUICK NEXT AVAILABILITY SECTION (FRICTIONLESS) */}
      {nextDays.length > 0 && (
        <div className={b.quickNextSection}>
          <div className={b.quickNextHeader}>
            <h3 className={b.quickNextTitle}>
              <Sparkles size={16} /> Próximos horários disponíveis
            </h3>
            <button
              type="button"
              className={b.fullCalendarToggleBtn}
              onClick={() => setShowFullCalendar((prev) => !prev)}
            >
              <CalendarDays size={13} />
              <span>{showFullCalendar ? "Ocultar calendário" : "Ver calendário completo"}</span>
            </button>
          </div>

          <div className={b.quickNextDaysList}>
            {nextDays.map((nd) => (
              <div key={nd.date} className={b.quickNextDayGroup}>
                <span className={b.quickNextDayLabel}>
                  {nd.label}
                </span>
                <div className={b.quickNextSlotsGrid}>
                  {nd.slots.map((s) => {
                    const isSelected = selected?.startTime === s.startTime && date === nd.date;
                    return (
                      <TimeSlotButton
                        key={`${nd.date}-${s.startTime}`}
                        label={s.startTime}
                        selected={isSelected}
                        compact
                        onClick={() => {
                          onDate(nd.date);
                          onSelect(s);
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loadingNextDays && <Skeleton label="Buscando próximos horários…" />}
      {!loadingNextDays && nextDays.length === 0 && (
        <div className={b.emptyStateCard}>
          <div className={b.emptyStateIcon}>
            <CalendarDays size={26} />
          </div>
          <h3 className={b.emptyStateTitle}>
            {error ? "Não foi possível carregar os horários" : "Nenhum horário livre nos próximos dias"}
          </h3>
          <p className={b.emptyStateText}>
            {error
              ? "Tente recarregar para consultar vagas em tempo real ou consulte o calendário completo."
              : "Não encontramos vagas automáticas imediatas. Você pode explorar outras datas ou registrar interesse."}
          </p>

          <div className={b.emptyStateActions}>
            {error && (
              <button
                type="button"
                className={`${b.button} ${b.outline}`}
                onClick={() => setReload((v) => v + 1)}
              >
                <RefreshCw size={14} /> Tentar novamente
              </button>
            )}
            <button
              type="button"
              className={`${b.button} ${b.outline}`}
              onClick={() => setShowFullCalendar(true)}
            >
              <CalendarDays size={14} /> Ver calendário completo
            </button>
            {onWaitlist && (
              <button
                type="button"
                className={b.button}
                disabled={waitlistStatus === "loading" || waitlistStatus === "success"}
                onClick={onWaitlist}
              >
                <Clock size={14} />
                {waitlistStatus === "success" ? "Interesse registrado" : "Avise-me se surgir uma vaga"}
              </button>
            )}
          </div>
        </div>
      )}
      {/* Full Month Calendar (Rendered when toggled or when no quick slots found) */}
      {showFullCalendar && (
        <>
          {/* Calendar Header with Unified Navigation Group */}
          <div className={b.calendarHeader}>
            <div className={b.calendarMonthGroup}>
              <h2 className={b.calendarMonthTitle}>
                {new Intl.DateTimeFormat("pt-BR", {
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                }).format(new Date(`${month}-01T12:00:00Z`))}
              </h2>
              <div className={b.calendarNavGroup}>
                <button
                  type="button"
                  className={b.calendarNavBtn}
                  aria-label="Mês anterior"
                  disabled={month <= today.slice(0, 7)}
                  onClick={() => setMonth(moveMonth(month, -1))}
                >
                  <ChevronLeft size={17} />
                </button>
                <button
                  type="button"
                  className={b.calendarNavBtn}
                  aria-label="Próximo mês"
                  disabled={month >= last.toISOString().slice(0, 7)}
                  onClick={() => setMonth(moveMonth(month, 1))}
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>

            <button
              type="button"
              className={b.nextAvailableLink}
              disabled={nextBusy}
              onClick={handleFindNext}
            >
              <span>{nextBusy ? "Buscando…" : "Próximo horário livre"}</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Calendar Grid */}
          <div
            className={b.calendar}
            aria-label="Calendário de agendamento"
            aria-busy={calendarLoading}
          >
            {["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"].map((d) => (
              <span key={d} className={b.weekday}>
                {d}
              </span>
            ))}

            {Array.from({ length: offset }, (_, i) => (
              <span key={`empty-${i}`} className={b.emptyDay} />
            ))}

            {Array.from({ length: monthDays(month) }, (_, i) => {
              const key = `${month}-${String(i + 1).padStart(2, "0")}`;
              const count = counts[key] ?? 0;
              const isSelected = date === key;
              const isToday = key === today;
              const isPast = key < today;
              const isAvailable = !calendarLoading && count > 0 && !isPast;
              const isFew = count > 0 && count <= 4;

              return (
                <button
                  key={key}
                  type="button"
                  className={`${b.day} ${isSelected ? b.daySelected : ""} ${isToday ? b.dayToday : ""} ${isAvailable ? b.dayAvailable : b.dayDisabled}`}
                  aria-label={`${dateLabel(key)}, ${calendarLoading ? "carregando" : `${count} horários disponíveis`}`}
                  aria-pressed={isSelected}
                  disabled={calendarLoading || !count || isPast}
                  onClick={() => {
                    onDate(key);
                    onSelect(null);
                  }}
                >
                  <span className={b.dayNumber}>{i + 1}</span>
                  {isToday && !isSelected && <span className={b.todayBadge}>Hoje</span>}
                  {isAvailable && !isSelected && (
                    <span className={`${b.availabilityDot} ${isFew ? b.dotFew : b.dotGood}`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Discrete Availability Legend */}
          <div className={b.legend}>
            <span className={b.legendItem}>
              <span className={`${b.legendIndicator} ${b.dotGood}`} />
              Boa disponibilidade
            </span>
            <span className={b.legendItem}>
              <span className={`${b.legendIndicator} ${b.dotFew}`} />
              Poucos horários
            </span>
            {calendarLoading && (
              <span className={b.legendLoading} role="status">
                Atualizando calendário…
              </span>
            )}
          </div>
        </>
      )}

      {/* The detailed slot grid belongs to the expanded calendar only. */}
      {showFullCalendar && <div className={b.slotsSection}>
        <div className={b.slotsSectionHeader}>
          <div className={b.slotsSectionTitle}>
            <Clock size={16} />
            <h3>Horários disponíveis</h3>
            {date && (
              <span className={b.slotsDateHighlight}>
                · {dateLabelShort(date)}
              </span>
            )}
          </div>

          {date && slots.length > 0 && (
            <div className={b.segmentedControl} role="tablist" aria-label="Filtrar turnos">
              {["Todos", "Manhã", "Tarde", "Noite"].map((p) => {
                const count = p === "Todos" ? slots.length : (groupCounts[p] ?? 0);
                if (p !== "Todos" && count === 0) return null;

                return (
                  <button
                    key={p}
                    type="button"
                    role="tab"
                    aria-selected={period === p}
                    className={`${b.segmentBtn} ${period === p ? b.segmentBtnActive : ""}`}
                    onClick={() => setPeriod(p)}
                  >
                    <span>{p}</span>
                    {count > 0 && <small className={b.segmentCount}>{count}</small>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {!date ? (
          <div className={b.selectDatePrompt}>
            <CalendarDays size={24} />
            <p>Selecione um dia disponível no calendário acima para visualizar os horários.</p>
          </div>
        ) : loading ? (
          <Skeleton label="Consultando horários disponíveis nesta data…" />
        ) : slots.length > 0 ? (
          <div className={b.slotsGridWrap}>
            {groups
              .filter((g) => period === "Todos" || period === g.name)
              .map((g) => {
                const times = slots.filter((s) => {
                  const hour = Number(s.startTime.slice(0, 2));
                  return (
                    (hour >= g.min && hour < g.max) ||
                    (g.name === "Noite" && hour < 6)
                  );
                });

                if (period === "Todos" && times.length === 0) return null;

                return (
                  <div key={g.name} className={b.periodGroup}>
                    {period === "Todos" && (
                      <h4 className={b.periodGroupTitle}>
                        {g.name} <span className={b.periodGroupCount}>({times.length})</span>
                      </h4>
                    )}
                    <div className={b.slotsGrid}>
                      {times.map((slot) => {
                        const isSlotSelected = selected?.startTime === slot.startTime;
                        return (
                          <TimeSlotButton
                            key={slot.startTime}
                            label={slot.startTime}
                            selected={isSlotSelected}
                            onClick={() => onSelect(slot)}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          /* Empty Slots Fallback with Next Availability Suggestion & Waitlist */
          <div className={b.noSlotsCard}>
            <div className={b.noSlotsIconWrap}>
              <AlertCircle size={22} />
            </div>
            <div className={b.noSlotsContent}>
              <h4>Nenhum horário disponível neste dia</h4>
              <p>Os horários para esta data já foram preenchidos ou o estabelecimento não possui expediente.</p>

              {nextSuggestion && (
                <div className={b.nextSuggestionBox}>
                  <div className={b.nextSuggestionText}>
                    <Sparkles size={14} />
                    <span>
                      Próximo horário disponível: <strong>{dateLabelShort(nextSuggestion.date)} às {nextSuggestion.slot.startTime}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    className={b.acceptNextBtn}
                    onClick={() => {
                      setMonth(nextSuggestion.date.slice(0, 7));
                      onDate(nextSuggestion.date);
                      onSelect(nextSuggestion.slot);
                      setReload((v) => v + 1);
                    }}
                  >
                    Selecionar este horário
                  </button>
                </div>
              )}

              {onWaitlist && (
                <div className={b.waitlistInlineWrap}>
                  <button
                    type="button"
                    disabled={waitlistStatus === "loading" || waitlistStatus === "success"}
                    onClick={onWaitlist}
                    className={b.waitlistInlineBtn}
                  >
                    {waitlistStatus === "success"
                      ? "✓ Você está na lista de espera deste dia"
                      : waitlistStatus === "loading"
                        ? "Registrando..."
                        : "Avise-me se surgir uma vaga nesta data"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>}
    </div>
  );
}
