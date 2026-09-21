"use client";
import { useEffect, useState } from "react";
import { CalendarClock, ChevronDown, Clock3, Plus, UsersRound } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { useStore } from "@/store/store";
import { api, formatPhoneForWhatsApp } from "@/lib/api-client";
import { localDate, shiftDate } from "@/lib/booking/time";
import { PAYMENT_LABELS } from "@/lib/client-utils";
import type { AppointmentDTO, AppointmentStatus, PaymentMethod } from "@/shared/types";

export type QuickPrefill = { date?: string; startTime?: string; employeeId?: string; clientId?: string; serviceId?: string; locationId?: string };
const advance: Partial<Record<AppointmentStatus, { status: AppointmentStatus; label: string }>> = {
  waiting: { status: "in_progress", label: "Iniciar atendimento" },
};
export function QuickStatus({
  appointment,
  contact = true,
  onDetails,
}: {
  appointment: AppointmentDTO;
  contact?: boolean;
  onDetails?: () => void;
}) {
  const { updateAppointmentStatus, finishAppointment, notify } = useStore();
  const [busy, setBusy] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [amount, setAmount] = useState(String(appointment.total));
  const next = advance[appointment.status];
  const phone = appointment.clientPhone?.replace(/\D/g, "");
  const parsedAmount = Number(amount.replace(",", "."));
  async function run(status?: AppointmentStatus) {
    setBusy(true);
    try {
      if (status) await updateAppointmentStatus(appointment.id, status);
      else await finishAppointment(appointment.id, parsedAmount, method);
      notify(status ? "Status atualizado." : "Atendimento finalizado.");
      setFinishing(false);
    } catch (e) { notify((e as Error).message, "error"); }
    finally { setBusy(false); }
  }
  return <div className="quick-actions">
    {appointment.status === "scheduled" && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => run("confirmed")}>{busy ? "Salvando…" : "Confirmar"}</button>}
    {(appointment.status === "scheduled" || appointment.status === "confirmed") && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run("waiting")}>{busy ? "Salvando…" : "Cliente chegou"}</button>}
    {next && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run(next.status)}>{busy ? "Salvando…" : next.label}</button>}
    {appointment.status === "in_progress" && !finishing && <button type="button" className="btn btn-primary" onClick={() => setFinishing(true)}>Finalizar</button>}
    {finishing && <div className="quick-actions"><label>Valor recebido<input className="input" aria-label="Valor recebido" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} /></label><label>Pagamento<select className="input" value={method} onChange={e => setMethod(e.target.value as PaymentMethod)}>{Object.entries(PAYMENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button type="button" className="btn btn-primary" disabled={busy || !amount || !Number.isFinite(parsedAmount) || parsedAmount < 0} onClick={() => run()}>Confirmar finalização</button><button type="button" className="link-button" disabled={busy} onClick={() => setFinishing(false)}>Voltar</button></div>}
    {contact && phone && <a className="btn whatsapp-button" target="_blank" rel="noreferrer" href={`https://wa.me/${formatPhoneForWhatsApp(appointment.clientPhone)}`}><WhatsAppIcon size={14} aria-hidden="true" /> WhatsApp</a>}
    {onDetails && <button type="button" className="btn btn-secondary" onClick={onDetails}>Detalhes</button>}
  </div>;
}

type FreeDay = { date: string; slots: { startTime: string; employeeId: string }[] };
type WaitEntry = { id: string; clientName: string; clientPhone: string | null; requestedDate: string; period: string; serviceNames: string[]; available: { startTime: string; employeeId: string } | null };
export function OperationsAvailability({ onNew, date }: { onNew: (prefill: QuickPrefill) => void; date?: string }) {
  const { services, locations, activeLocationId, session, appointments } = useStore();
  const [serviceId, setServiceId] = useState("");
  const [days, setDays] = useState<FreeDay[]>([]);
  const [waiting, setWaiting] = useState<WaitEntry[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const selectedService = serviceId || services.find(s => s.active)?.id;
  const locationId = activeLocationId || locations[0]?.id;
  const currentToday = localDate(new Date(), session?.company?.timezone || "America/Sao_Paulo");
  const today = date || currentToday;
  const tomorrow = shiftDate(today, 1);
  const dayMeta = (day: string) => {
    const value = new Date(`${day}T12:00Z`);
    const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(value).replace(".", "");
    if (day === currentToday) return { label: "Hoje", date: shortDate };
    if (day === tomorrow) return { label: "Amanhã", date: shortDate };
    const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" }).format(value);
    return { label: weekday.charAt(0).toUpperCase() + weekday.slice(1), date: shortDate };
  };
  useEffect(() => {
    if (!selectedService || !locationId) return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Invalidate availability after appointment mutations.
    setLoading(true); setDays([]); setError("");
    const searchDate = today < currentToday ? currentToday : today;
    const q = new URLSearchParams({ date: searchDate, locationId, items: JSON.stringify([{ serviceId: selectedService, employeeId: session?.role === "employee" ? session.employeeId : null }]) });
    api<FreeDay[]>(`/api/next-availability?${q}`, { signal: controller.signal }).then(setDays).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    if (session && ["owner", "admin", "manager", "superadmin"].includes(session.role)) api<WaitEntry[]>("/api/waitlist", { signal: controller.signal }).then(setWaiting).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [selectedService, locationId, today, currentToday, appointments, session]);
  return (
    <section className="panel operations-availability" aria-labelledby="availability-title">
      <header className="operations-availability-header">
        <div className="operations-availability-heading">
          <span className="operations-availability-icon" aria-hidden="true">
            <CalendarClock size={19} strokeWidth={1.8} />
          </span>
          <div>
            <h2 id="availability-title">Horários livres</h2>
            <p>Próximas vagas disponíveis para agendar</p>
          </div>
        </div>

        <label className="quick-service">
          <span>Serviço</span>
          <span className="quick-service-control">
            <select
              value={selectedService || ""}
              onChange={e => setServiceId(e.target.value)}
            >
              <option value="" disabled>Selecione um serviço</option>
              {services.filter(s => s.active).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </span>
        </label>
      </header>

      {error && <p className="operations-message operations-message-error" role="alert">{error}</p>}

      <div className="availability-days" aria-live="polite">
        {loading ? (
          <div className="operations-loading" role="status">
            <span className="operations-loading-dot" aria-hidden="true" />
            Consultando vagas…
          </div>
        ) : days.map(day => {
          const meta = dayMeta(day.date);
          return (
            <div key={day.date} className={`availability-day ${day.date === today ? "availability-day-today" : ""}`}>
              <div className="availability-day-label">
                <strong>{meta.label}</strong>
                <span>{meta.date} · {day.slots.length} {day.slots.length === 1 ? "horário" : "horários"}</span>
              </div>
              <div className="availability-slots">
                {day.slots.map(slot => (
                  <button
                    type="button"
                    key={`${slot.startTime}-${slot.employeeId}`}
                    className="availability-slot"
                    aria-label={`Agendar ${meta.label.toLowerCase()} às ${slot.startTime}`}
                    onClick={() => onNew({ date: day.date, startTime: slot.startTime, employeeId: slot.employeeId, serviceId: selectedService, locationId })}
                  >
                    <Clock3 size={14} aria-hidden="true" />
                    <span>{slot.startTime}</span>
                    <Plus className="availability-slot-add" size={14} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {!loading && !days.length && !error && (
        <div className="operations-empty">
          <CalendarClock size={20} aria-hidden="true" />
          <div>
            <strong>Nenhuma vaga nos próximos 7 dias</strong>
            <span>Tente outro serviço ou profissional.</span>
          </div>
        </div>
      )}

      {waiting.length > 0 && (
        <section className="operations-waitlist" aria-labelledby="waitlist-title">
          <div className="operations-waitlist-heading">
            <span className="operations-waitlist-icon" aria-hidden="true"><UsersRound size={17} /></span>
            <div>
              <h3 id="waitlist-title">Lista de espera</h3>
              <p>{waiting.filter(w => w.available).length} clientes com vaga semelhante disponível</p>
            </div>
          </div>
          {waiting.map(w => (
            <div key={w.id} className="waitlist-row">
              <div>
                <strong>{w.clientName}</strong>
                <p>{w.requestedDate.split("-").reverse().join("/")} · {({ any: "Qualquer horário", morning: "Manhã", afternoon: "Tarde", evening: "Noite" } as Record<string,string>)[w.period]}{w.available ? ` · Vaga às ${w.available.startTime}` : " · Aguardando vaga"}</p>
              </div>
              {w.clientPhone && <a className="btn whatsapp-button" target="_blank" rel="noreferrer" href={`https://wa.me/${formatPhoneForWhatsApp(w.clientPhone)}`}><WhatsAppIcon size={14} aria-hidden="true" /> WhatsApp</a>}
            </div>
          ))}
        </section>
      )}
    </section>
  );
}
