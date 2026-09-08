/* eslint-disable react-hooks/set-state-in-effect -- Synchronizes server availability, URL state and persisted booking drafts. */
"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { api } from "@/lib/api-client";
import type { AvailableSlot } from "@/lib/booking/engine";
import type { Selection } from "@/lib/booking/validation";
import { b, dateLabel, ErrorMessage, Skeleton } from "./primitives";
type Availability = {
  dates: Array<{ date: string; count: number }>;
  slots: AvailableSlot[];
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
}) {
  const [month, setMonth] = useState((date || today).slice(0, 7)),
    [counts, setCounts] = useState<Record<string, number>>({}),
    [slots, setSlots] = useState<AvailableSlot[]>([]),
    [loading, setLoading] = useState(true),
    [calendarLoading, setCalendarLoading] = useState(true),
    [error, setError] = useState(""),
    [period, setPeriod] = useState("Todos"),
    [nextBusy, setNextBusy] = useState(false),
    [reload, setReload] = useState(0);
  const encoded = JSON.stringify(items);
  const query = (day: string) =>
    new URLSearchParams({
      locationId,
      date: day,
      items: encoded,
      ...(bookingId ? { bookingId } : {}),
    });
  useEffect(() => {
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
          setError(e.message);
          setCalendarLoading(false);
        }
      });
    return () => controller.abort();
  }, [slug, locationId, encoded, month, bookingId, reload]);
  useEffect(() => {
    if (!date) {
      setSlots([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setSlots([]);
    setError("");
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
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [slug, locationId, encoded, date, bookingId, reload]);
  async function next() {
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
      } else
        setError(
          "Não há horários disponíveis no período de reservas. Entre em contato com o estabelecimento.",
        );
    } catch (e) {
      setError((e as Error).message);
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
  return (
    <div>
      <ErrorMessage message={error} />
      <div className={b.calendarHeader}>
        <h2>
          {new Intl.DateTimeFormat("pt-BR", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(new Date(`${month}-01T12:00:00Z`))}
        </h2>
        <div className={b.inline}>
          <button
            className={b.iconButton}
            aria-label="Mês anterior"
            disabled={month <= today.slice(0, 7)}
            onClick={() => setMonth(moveMonth(month, -1))}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className={b.iconButton}
            aria-label="Próximo mês"
            disabled={month >= last.toISOString().slice(0, 7)}
            onClick={() => setMonth(moveMonth(month, 1))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div
        className={b.calendar}
        aria-label="Datas disponíveis"
        aria-busy={calendarLoading}
      >
        {["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"].map((d) => (
          <span key={d} className={b.weekday}>
            {d}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`empty${i}`} />
        ))}
        {Array.from({ length: monthDays(month) }, (_, i) => {
          const key = `${month}-${String(i + 1).padStart(2, "0")}`,
            count = counts[key] ?? 0;
          return (
            <button
              key={key}
              className={`${b.day} ${date === key ? b.selected : ""}`}
              aria-label={`${dateLabel(key)}, ${calendarLoading ? "carregando" : `${count} horários`}`}
              aria-pressed={date === key}
              disabled={calendarLoading || !count || key < today}
              onClick={() => {
                onDate(key);
                onSelect(null);
              }}
            >
              {i + 1}
              {count > 0 && (
                <span className={`${b.dot} ${count < 6 ? b.few : ""}`} />
              )}
            </button>
          );
        })}
      </div>
      <div className={b.legend}>
        <span>
          <i className={b.dot} /> Boa disponibilidade
        </span>
        <span>
          <i className={`${b.dot} ${b.few}`} /> Poucos horários
        </span>
        {calendarLoading && <span role="status">Consultando agenda…</span>}
      </div>
      <div className={b.row}>
        <span className={b.muted}>
          {date ? dateLabel(date) : "Escolha um dia para ver os horários."}
        </span>
        <button className={b.textButton} disabled={nextBusy} onClick={next}>
          {nextBusy ? "Buscando…" : "Próximo horário"}
          <ArrowRight size={14} />
        </button>
      </div>
      {date && (
        <>
          <div className={b.periods} aria-label="Filtrar parte do dia">
            {["Todos", "Manhã", "Tarde", "Noite"].map((p) => (
              <button
                key={p}
                aria-pressed={period === p}
                className={`${b.pill} ${period === p ? b.selected : ""}`}
                onClick={() => setPeriod(p)}
              >
                {p}
              </button>
            ))}
          </div>
          {loading ? (
            <Skeleton label="Consultando horários disponíveis…" />
          ) : slots.length ? (
            <div
              className={b.slots}
              style={
                period !== "Todos" ? { gridTemplateColumns: "1fr" } : undefined
              }
            >
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
                  return (
                    <section key={g.name}>
                      <h3>
                        {g.name} ({times.length})
                      </h3>
                      {times.length ? (
                        times.map((slot) => (
                          <button
                            key={slot.startTime}
                            className={`${b.slot} ${selected?.startTime === slot.startTime ? b.selected : ""}`}
                            aria-pressed={
                              selected?.startTime === slot.startTime
                            }
                            onClick={() => onSelect(slot)}
                          >
                            {slot.startTime}
                          </button>
                        ))
                      ) : (
                        <p className={b.muted} style={{ textAlign: "center" }}>
                          Sem horários
                        </p>
                      )}
                    </section>
                  );
                })}
            </div>
          ) : (
            <div className={b.empty}>
              <p>Nenhum horário disponível neste dia.</p>
              <button
                className={`${b.button} ${b.outline}`}
                onClick={next}
                disabled={nextBusy}
              >
                Ver próxima data disponível
              </button>
            </div>
          )}
        </>
      )}
      <p className={b.muted}>
        Os horários são confirmados novamente ao concluir a reserva.
      </p>
    </div>
  );
}
