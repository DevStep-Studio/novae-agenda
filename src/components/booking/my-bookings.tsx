/* eslint-disable react-hooks/set-state-in-effect -- Synchronizes server availability, URL state and persisted booking drafts. */
"use client";
import { useCallback, useEffect, useState } from "react";
import {
  CalendarPlus,
  Check,
  ExternalLink,
  MapPin,
  Share2,
} from "lucide-react";
import { api } from "@/lib/api-client";
import type { BookingDetails } from "@/lib/booking/service";
import type { PublicCatalog } from "@/lib/booking/catalog";
import type { AvailableSlot } from "@/lib/booking/engine";
import { STATUS_LABELS } from "@/lib/client-utils";
import type { AppointmentStatus } from "@/shared/types";
import { AvailabilityPicker } from "./availability-picker";
import { CustomerAuth, type Customer } from "./customer-auth";
import {
  b,
  dateLabel,
  ErrorMessage,
  money,
  PublicFrame,
  Skeleton,
} from "./primitives";
type Detail = Omit<BookingDetails, "startsAt" | "endsAt"> & {
  startsAt: string;
  endsAt: string;
};
export function MyBookings() {
  const [user, setUser] = useState<Customer | null>(null),
    [rows, setRows] = useState<Detail[]>([]),
    [loading, setLoading] = useState(false),
    [tab, setTab] = useState("Próximos"),
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
      setRows(await api<Detail[]>("/api/my/bookings"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (user) void load();
  }, [user, load]);
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
  async function reschedule() {
    if (!current) return;
    setBusy(true);
    setError("");
    try {
      const c = await api<PublicCatalog>(`/api/public/${current.company.slug}`);
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
  );
  const stamp = (v: string) =>
    new Date(v)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
  return (
    <PublicFrame>
      <main className={`${b.main} ${current ? b.success : ""}`}>
        <ErrorMessage message={error} />
        {message && (
          <div className={b.note} role="status">
            {message}
          </div>
        )}
        {!user ? (
          <>
            <h1 className={b.title}>Seus agendamentos, em um só lugar.</h1>
            <p className={b.subtitle}>
              Entre na sua conta para acompanhar seus próximos horários.
            </p>
            <CustomerAuth onReady={onReady} requireVerified={false} />
          </>
        ) : loading ? (
          <Skeleton label="Buscando seus agendamentos…" />
        ) : current ? (
          <>
            {confirmed && (
              <div className={b.successMark}>
                <Check size={30} />
              </div>
            )}
            <p className={b.eyebrow}>
              {confirmed ? "Está tudo certo" : "Seu próximo encontro"}
            </p>
            <h1 className={b.title}>
              {confirmed
                ? "Agendamento confirmado!"
                : "Detalhes do agendamento"}
            </h1>
            <p className={b.subtitle}>
              {confirmed
                ? "Seu horário está reservado. Esperamos você!"
                : current.company.name}
            </p>
            <article className={b.detail}>
              <div className={b.row}>
                <h2>{current.company.name}</h2>
                <span className={b.status}>
                  {STATUS_LABELS[current.status as AppointmentStatus] ??
                    current.status}
                </span>
              </div>
              <strong>
                {dateLabel(
                  current.items[0]?.date ?? current.startsAt.slice(0, 10),
                )}
              </strong>
              <p>
                {current.items[0]?.startTime.slice(0, 5)}–
                {current.items.at(-1)?.endTime.slice(0, 5)} · {current.timezone}
              </p>
              {current.company.address && (
                <p className={`${b.muted} ${b.inline}`}>
                  <MapPin size={15} />
                  {current.company.address}
                </p>
              )}
              <hr />
              {current.items.map((i) => (
                <div className={b.summaryItem} key={i.id}>
                  <div className={b.row}>
                    <strong>{i.name}</strong>
                    <span>{money(i.price)}</span>
                  </div>
                  <span className={b.muted}>
                    {i.employeeName} · {i.startTime.slice(0, 5)}–
                    {i.endTime.slice(0, 5)}
                  </span>
                </div>
              ))}
              {current.products.map((p) => (
                <div className={b.row} key={p.productId}>
                  <span>
                    {p.quantity} × {p.name}
                  </span>
                  <span>{money(Number(p.unitPrice) * p.quantity)}</span>
                </div>
              ))}
              {Number(current.discount) > 0 && (
                <p>Desconto: −{money(current.discount)}</p>
              )}
              <div className={b.total}>
                <span>Total</span>
                <strong>{money(current.total)}</strong>
              </div>
              <p className={b.muted}>Pagamento no atendimento</p>
              {current.notes && (
                <>
                  <hr />
                  <strong>Sua observação</strong>
                  <p>{current.notes}</p>
                </>
              )}
            </article>
            {action === "reschedule" && catalog ? (
              <div className={b.detail}>
                <h2>Escolha seu novo horário</h2>
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
                <button
                  className={`${b.button} ${b.wide}`}
                  disabled={!slot || busy}
                  onClick={change}
                >
                  {busy ? "Remarcando…" : "Confirmar novo horário"}
                </button>
                <button
                  className={b.textButton}
                  onClick={() => setAction(null)}
                >
                  Manter meu horário atual
                </button>
              </div>
            ) : action === "cancel" ? (
              <div className={b.note}>
                <strong>Cancelar este agendamento?</strong>
                <p>O horário será liberado para outras pessoas.</p>
                <div className={b.inline}>
                  <button className={b.button} disabled={busy} onClick={change}>
                    {busy ? "Cancelando…" : "Sim, cancelar agendamento"}
                  </button>
                  <button
                    className={`${b.button} ${b.outline}`}
                    onClick={() => setAction(null)}
                  >
                    Manter agendamento
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className={b.inline}>
                  <a
                    className={b.button}
                    href={`/api/my/bookings/${current.id}/calendar`}
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
                <p className={b.muted}>
                  O arquivo de calendário também funciona no Apple Calendar e
                  Outlook.
                </p>
                <div className={b.note}>
                  <strong>Política de alterações</strong>
                  <p>
                    {current.company.cancellationHours < 0
                      ? "Cancelamento e remarcação diretamente com o estabelecimento."
                      : `Cancele ou remarque até ${current.company.cancellationHours} horas antes do atendimento.`}
                  </p>
                </div>
                {current.canChange && (
                  <div className={b.inline}>
                    <button
                      className={`${b.button} ${b.outline}`}
                      disabled={busy}
                      onClick={reschedule}
                    >
                      Remarcar
                    </button>
                    <button
                      className={b.textButton}
                      onClick={() => setAction("cancel")}
                    >
                      Cancelar agendamento
                    </button>
                  </div>
                )}
                {current.status === "completed" && (
                  <a
                    className={b.button}
                    href={`/agendar/${current.company.slug}?services=${current.items.map((i) => i.serviceId).join(",")}${current.items.every((i) => i.employeeId === current.items[0]?.employeeId) ? `&professional=${current.items[0]?.employeeId}` : ""}`}
                  >
                    Agendar novamente
                  </a>
                )}
              </>
            )}
            <button
              className={b.textButton}
              onClick={() => {
                setSelected("");
                setConfirmed(false);
                setAction(null);
                window.history.replaceState({}, "", "/meus-agendamentos");
              }}
            >
              Ver todos os meus agendamentos
            </button>
          </>
        ) : (
          <>
            <div className={b.row}>
              <div>
                <p className={b.eyebrow}>Olá, {user.name.split(" ")[0]}</p>
                <h1 className={b.title}>Meus agendamentos</h1>
              </div>
              <button
                className={b.textButton}
                onClick={async () => {
                  await api("/api/auth/logout", { method: "POST" });
                  setUser(null);
                  setRows([]);
                }}
              >
                Sair
              </button>
            </div>
            <div className={b.periods}>
              {["Próximos", "Anteriores", "Cancelados"].map((t) => (
                <button
                  className={`${b.pill} ${tab === t ? b.selected : ""}`}
                  key={t}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            {visible.length ? (
              visible.map((r) => (
                <article className={b.detail} key={r.id}>
                  <div className={b.row}>
                    <div>
                      <p className={b.eyebrow}>
                        {dateLabel(r.items[0]?.date ?? r.startsAt.slice(0, 10))}
                      </p>
                      <h2>{r.items.map((i) => i.name).join(" + ")}</h2>
                      <p className={b.muted}>
                        {r.company.name} · {r.items[0]?.startTime.slice(0, 5)}
                      </p>
                      <strong>{money(r.total)}</strong>
                    </div>
                    <button
                      className={`${b.button} ${b.outline}`}
                      onClick={() => setSelected(r.id)}
                    >
                      Detalhes
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className={b.empty}>
                <h3>Nenhum agendamento por aqui.</h3>
                <p>
                  Suas reservas aparecerão nesta página assim que forem
                  confirmadas.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </PublicFrame>
  );
}
