/* eslint-disable react-hooks/set-state-in-effect -- Synchronizes server availability, URL state and persisted booking drafts. */
"use client";
import { useEffect, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { Copy, ExternalLink, Plus, QrCode, Share2, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { useStore } from "@/store/store";
import { b, ErrorMessage, money, Skeleton } from "./primitives";
import type { companies, coupons, products } from "@/db/schema";
type Schedule = {
  employeeId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakStart: string | null;
  breakEnd: string | null;
  active: boolean;
};
type Data = {
  company: typeof companies.$inferSelect;
  schedules: Schedule[];
  products: Array<typeof products.$inferSelect>;
  coupons: Array<typeof coupons.$inferSelect>;
  funnel: Array<{ event: string; count: number }>;
};
export function BookingSettings() {
  const {
    employees,
    notify,
    settings,
    updateSettings,
    reloadServices,
    reloadEmployees,
  } = useStore();
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [slug, setSlug] = useState(""),
    [url, setUrl] = useState(""),
    [qr, setQr] = useState(""),
    [showQr, setShowQr] = useState(false),
    [employeeId, setEmployeeId] = useState(""),
    [schedule, setSchedule] = useState<Schedule[]>([]),
    [interval, setIntervalValue] = useState(30),
    [cancellation, setCancellation] = useState(24),
    [color, setColor] = useState("#234e3d");
  async function load() {
    const result = await api<Data>("/api/booking-settings");
    setData(result);
    setSlug(
      result.company.publicSlug ||
        result.company.name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 60),
    );
    setColor(result.company.publicColor);
    setCancellation(result.company.cancellationHours);
    setUrl(
      result.company.publicSlug
        ? `${window.location.origin}/agendar/${result.company.publicSlug}`
        : "",
    );
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    setIntervalValue(settings?.slotIntervalMinutes ?? 30);
  }, [settings?.slotIntervalMinutes]);
  useEffect(() => {
    if (data && employeeId)
      setSchedule(
        data.schedules
          .filter((s) => s.employeeId === employeeId)
          .map((s) => ({
            ...s,
            startTime: s.startTime.slice(0, 5),
            endTime: s.endTime.slice(0, 5),
            breakStart: s.breakStart?.slice(0, 5) || null,
            breakEnd: s.breakEnd?.slice(0, 5) || null,
          })),
      );
  }, [data, employeeId]);
  useEffect(() => {
    if (url)
      void QRCode.toDataURL(url, {
        width: 512,
        margin: 2,
        color: { dark: "#193c2e", light: "#ffffff" },
      })
        .then(setQr)
        .catch(() => setError("Não foi possível gerar o QR Code."));
  }, [url]);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await api("/api/booking-settings", {
        method: "PUT",
        body: JSON.stringify({
          slug,
          enabled: f.get("enabled") === "on",
          name: f.get("name"),
          description: f.get("description"),
          category: f.get("category"),
          address: f.get("address"),
          phone: f.get("phone"),
          whatsapp: f.get("whatsapp"),
          instagram: f.get("instagram"),
          logoUrl: f.get("logoUrl"),
          photos: String(f.get("photos") || "")
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          color,
          showPhone: f.get("showPhone") === "on",
          showInstagram: f.get("showInstagram") === "on",
          cancellationHours: cancellation,
          allowProducts: f.get("allowProducts") === "on",
          timezone: f.get("timezone"),
        }),
      });
      await load();
      notify("Página de agendamento atualizada.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveSchedule() {
    setBusy(true);
    setError("");
    try {
      await api(`/api/employees/${employeeId}/schedules`, {
        method: "PUT",
        body: JSON.stringify({
          schedules: schedule.length
            ? schedule
            : [
                {
                  dayOfWeek: 0,
                  startTime: "08:00",
                  endTime: "18:00",
                  active: false,
                },
              ],
        }),
      });
      await updateSettings({ slotIntervalMinutes: interval });
      await load();
      await reloadEmployees();
      notify("Disponibilidade atualizada.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function createExtra(
    e: FormEvent<HTMLFormElement>,
    kind: "product" | "coupon",
  ) {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await api("/api/booking-settings", {
        method: "POST",
        body: JSON.stringify(
          kind === "product"
            ? { kind, name: f.get("name"), price: Number(f.get("price")) }
            : {
                kind,
                code: f.get("code"),
                type: f.get("type"),
                value: Number(f.get("value")),
              },
        ),
      });
      form.reset();
      await load();
      notify(kind === "product" ? "Produto cadastrado." : "Cupom cadastrado.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      notify("Link copiado.");
    } catch {
      setError(
        "Não foi possível copiar. Selecione o endereço e copie manualmente.",
      );
    }
  }
  async function share() {
    try {
      if (navigator.share)
        await navigator.share({
          title: data?.company.name,
          text: "Agende seu horário comigo",
          url,
        });
      else await copy();
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setError("Não foi possível compartilhar.");
    }
  }
  if (!data)
    return (
      <div className={`${b.page} ${b.settings}`}>
        <ErrorMessage message={error} />
        <Skeleton label="Carregando configurações…" />
      </div>
    );
  const c = data.company;
  return (
    <div className={`${b.page} ${b.settings}`}>
      <p className={b.eyebrow}>Sua agenda, a um clique de distância</p>
      <h1 className={b.title}>Link de agendamento</h1>
      <p className={b.subtitle}>
        Receba reservas pelo Instagram, WhatsApp ou onde seus clientes
        estiverem.
      </p>
      <ErrorMessage message={error} />
      <div className={b.detail}>
        <div className={b.row}>
          <h2>Seu link público</h2>
          <span className={b.status}>
            {c.publicEnabled ? "Página ativa" : "Página desativada"}
          </span>
        </div>
        {url ? (
          <>
            <input
              aria-label="Seu link público"
              readOnly
              value={url}
              onFocus={(e) => e.target.select()}
            />
            <div className={b.inline} style={{ marginTop: 15 }}>
              <button className={b.button} onClick={copy}>
                <Copy size={16} /> Copiar link
              </button>
              <a
                className={`${b.button} ${b.outline}`}
                href={url}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={16} /> Visualizar página
              </a>
              <button className={`${b.button} ${b.outline}`} onClick={share}>
                <Share2 size={16} /> Compartilhar
              </button>
              <button
                className={`${b.button} ${b.outline}`}
                onClick={() => setShowQr(!showQr)}
              >
                <QrCode size={16} /> QR Code
              </button>
            </div>
            <div className={b.inline}>
              <a
                className={b.textButton}
                href={`https://wa.me/?text=${encodeURIComponent(`Agende seu horário comigo: ${url}`)}`}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp
              </a>
              <a
                className={b.textButton}
                href={`mailto:?subject=Agende%20seu%20horário&body=${encodeURIComponent(url)}`}
              >
                E-mail
              </a>
            </div>
            {showQr && qr && (
              <div style={{ marginTop: 20 }}>
                <img src={qr} className={b.qr} alt="QR Code para agendar" />
                <p>Escaneie para agendar</p>
                <div className={b.inline}>
                  <a
                    className={b.textButton}
                    href={qr}
                    download={`agendar-${slug}.png`}
                  >
                    Baixar PNG
                  </a>
                  <button
                    className={b.textButton}
                    onClick={async () => {
                      const svg = await QRCode.toString(url, {
                        type: "svg",
                        margin: 2,
                      });
                      const objectUrl = URL.createObjectURL(
                        new Blob([svg], { type: "image/svg+xml" }),
                      );
                      const a = document.createElement("a");
                      a.href = objectUrl;
                      a.download = `agendar-${slug}.svg`;
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
                    }}
                  >
                    Baixar SVG
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className={b.muted}>
            Escolha seu endereço e salve abaixo para gerar seu link.
          </p>
        )}
      </div>
      <form onSubmit={save}>
        <section>
          <h2>Personalize sua página</h2>
          <div className={b.grid2}>
            <label className={b.field}>
              Endereço do link
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
                minLength={3}
                maxLength={60}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
              />
              <small className={b.muted}>/agendar/{slug}</small>
            </label>
            <label className={b.field}>
              Nome público
              <input name="name" defaultValue={c.name} required minLength={2} />
            </label>
            <label className={b.field}>
              Profissão ou categoria
              <input name="category" defaultValue={c.businessType ?? ""} />
            </label>
            <label className={b.field}>
              Logo ou foto (URL)
              <input
                name="logoUrl"
                defaultValue={c.logoUrl ?? ""}
                placeholder="https://…"
              />
            </label>
          </div>
          <label className={b.field}>
            Apresentação
            <textarea
              name="description"
              defaultValue={c.publicDescription ?? ""}
              maxLength={2000}
            />
          </label>
          <label className={b.field}>
            Endereço
            <input name="address" defaultValue={c.address ?? ""} />
          </label>
          <div className={b.grid2}>
            <label className={b.field}>
              Telefone
              <input name="phone" defaultValue={c.phone ?? ""} />
            </label>
            <label className={b.field}>
              WhatsApp
              <input name="whatsapp" defaultValue={c.whatsapp ?? ""} />
            </label>
            <label className={b.field}>
              Instagram (usuário)
              <input
                name="instagram"
                defaultValue={c.instagram ?? ""}
                placeholder="@seunegocio"
              />
            </label>
            <label className={b.field}>
              Fuso horário
              <input name="timezone" defaultValue={c.timezone} required />
            </label>
            <label className={b.field}>
              Cor principal
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </label>
            <div>
              <span className={b.muted}>Prévia do botão</span>
              <div
                className={b.button}
                style={{ background: color, borderColor: color, marginTop: 8 }}
              >
                Reservar meu horário
              </div>
            </div>
          </div>
          <label className={b.field}>
            Fotos do espaço (uma URL por linha)
            <textarea
              name="photos"
              defaultValue={c.publicPhotos.join("\n")}
              placeholder="https://…"
            />
          </label>
          <label className={b.check}>
            <input
              name="showPhone"
              type="checkbox"
              defaultChecked={c.publicPhone}
            />{" "}
            Mostrar telefone e WhatsApp
          </label>
          <label className={b.check}>
            <input
              name="showInstagram"
              type="checkbox"
              defaultChecked={c.publicInstagram}
            />{" "}
            Mostrar Instagram
          </label>
          <label className={b.check}>
            <input
              name="allowProducts"
              type="checkbox"
              defaultChecked={c.allowProducts}
            />{" "}
            Permitir produtos complementares
          </label>
          <label className={b.field} style={{ marginTop: 20 }}>
            Prazo para cancelamento e remarcação
            <select
              value={cancellation}
              onChange={(e) => setCancellation(Number(e.target.value))}
            >
              {[-1, 0, 2, 6, 12, 24, 48, 72].map((h) => (
                <option value={h} key={h}>
                  {h < 0
                    ? "Somente pelo estabelecimento"
                    : h === 0
                      ? "Até o início do atendimento"
                      : `${h} horas antes`}
                </option>
              ))}
            </select>
          </label>
          <label className={b.check}>
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={c.publicEnabled}
            />{" "}
            Ativar reservas pelo link público
          </label>
          <div className={b.note}>
            Cadastre os serviços, vincule os profissionais e revise as jornadas
            antes de compartilhar.
          </div>
          <button className={b.button} disabled={busy}>
            {busy ? "Salvando…" : "Salvar página e gerar link"}
          </button>
        </section>
      </form>
      <section>
        <h2>Configurações de disponibilidade</h2>
        <p className={b.muted}>
          Cadastre vários períodos por dia. Férias, folgas e feriados podem ser
          registrados em Agenda → Bloquear horário.
        </p>
        <div className={b.grid2}>
          <label className={b.field}>
            Profissional
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="">Selecione</option>
              {employees
                .filter((e) => e.active)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
            </select>
          </label>
          <label className={b.field}>
            Intervalo das opções de horários
            <select
              value={interval}
              onChange={(e) => setIntervalValue(Number(e.target.value))}
            >
              {[5, 10, 15, 20, 30, 60].map((v) => (
                <option key={v} value={v}>
                  {v} minutos
                </option>
              ))}
            </select>
          </label>
        </div>
        {employeeId && (
          <>
            {schedule.map((s, i) => (
              <div className={b.scheduleRow} key={i}>
                <input
                  aria-label={`Período ${i + 1} ativo`}
                  type="checkbox"
                  checked={s.active}
                  onChange={(e) =>
                    setSchedule(
                      schedule.map((r, n) =>
                        n === i ? { ...r, active: e.target.checked } : r,
                      ),
                    )
                  }
                />
                <select
                  aria-label={`Dia do período ${i + 1}`}
                  value={s.dayOfWeek}
                  onChange={(e) =>
                    setSchedule(
                      schedule.map((r, n) =>
                        n === i
                          ? { ...r, dayOfWeek: Number(e.target.value) }
                          : r,
                      ),
                    )
                  }
                >
                  {[
                    "Domingo",
                    "Segunda",
                    "Terça",
                    "Quarta",
                    "Quinta",
                    "Sexta",
                    "Sábado",
                  ].map((d, n) => (
                    <option key={d} value={n}>
                      {d}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`Início do período ${i + 1}`}
                  type="time"
                  value={s.startTime}
                  onChange={(e) =>
                    setSchedule(
                      schedule.map((r, n) =>
                        n === i ? { ...r, startTime: e.target.value } : r,
                      ),
                    )
                  }
                />
                <span>até</span>
                <input
                  aria-label={`Fim do período ${i + 1}`}
                  type="time"
                  value={s.endTime}
                  onChange={(e) =>
                    setSchedule(
                      schedule.map((r, n) =>
                        n === i ? { ...r, endTime: e.target.value } : r,
                      ),
                    )
                  }
                />
                <input
                  title="Início do almoço (opcional)"
                  aria-label={`Início do almoço ${i + 1}`}
                  type="time"
                  value={s.breakStart ?? ""}
                  onChange={(e) =>
                    setSchedule(
                      schedule.map((r, n) =>
                        n === i
                          ? { ...r, breakStart: e.target.value || null }
                          : r,
                      ),
                    )
                  }
                />
                <input
                  title="Fim do almoço (opcional)"
                  aria-label={`Fim do almoço ${i + 1}`}
                  type="time"
                  value={s.breakEnd ?? ""}
                  onChange={(e) =>
                    setSchedule(
                      schedule.map((r, n) =>
                        n === i
                          ? { ...r, breakEnd: e.target.value || null }
                          : r,
                      ),
                    )
                  }
                />
                <button
                  className={b.remove}
                  aria-label={`Remover período ${i + 1}`}
                  onClick={() =>
                    setSchedule(schedule.filter((_, n) => n !== i))
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <div className={b.inline}>
              <button
                className={`${b.button} ${b.outline}`}
                onClick={() =>
                  setSchedule([
                    ...schedule,
                    {
                      employeeId,
                      dayOfWeek: 1,
                      startTime: "09:00",
                      endTime: "18:00",
                      breakStart: null,
                      breakEnd: null,
                      active: true,
                    },
                  ])
                }
              >
                <Plus size={15} /> Adicionar período
              </button>
              <button
                className={b.button}
                disabled={busy}
                onClick={saveSchedule}
              >
                Salvar disponibilidade
              </button>
            </div>
          </>
        )}
      </section>
      <section>
        <h2>Produtos complementares</h2>
        {data.products.map((p) => (
          <div className={b.product} key={p.id}>
            <span>
              {p.name} · {money(p.price)}
            </span>
            <button
              className={b.textButton}
              disabled={busy}
              onClick={async () => {
                try {
                  await api("/api/booking-settings", {
                    method: "POST",
                    body: JSON.stringify({
                      kind: "product",
                      ...p,
                      price: Number(p.price),
                      active: !p.active,
                    }),
                  });
                  await load();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {p.active ? "Desativar" : "Ativar"}
            </button>
          </div>
        ))}
        <form
          onSubmit={(e) => createExtra(e, "product")}
          className={b.grid2}
          style={{ marginTop: 16 }}
        >
          <label className={b.field}>
            Nome
            <input name="name" required minLength={2} />
          </label>
          <label className={b.field}>
            Preço (R$)
            <input name="price" type="number" required min={0} step="0.01" />
          </label>
          <button className={`${b.button} ${b.outline}`} disabled={busy}>
            Adicionar produto
          </button>
        </form>
      </section>
      <section>
        <h2>Cupons promocionais</h2>
        {data.coupons.map((coupon) => (
          <div className={b.product} key={coupon.id}>
            <span>
              {coupon.code} ·{" "}
              {coupon.type === "percentage"
                ? `${coupon.value}%`
                : money(coupon.value)}
            </span>
            <button
              className={b.textButton}
              onClick={async () => {
                try {
                  await api("/api/booking-settings", {
                    method: "POST",
                    body: JSON.stringify({
                      kind: "coupon",
                      ...coupon,
                      value: Number(coupon.value),
                      active: !coupon.active,
                    }),
                  });
                  await load();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {coupon.active ? "Desativar" : "Ativar"}
            </button>
          </div>
        ))}
        <form
          onSubmit={(e) => createExtra(e, "coupon")}
          className={b.grid2}
          style={{ marginTop: 16 }}
        >
          <label className={b.field}>
            Código
            <input name="code" required minLength={2} />
          </label>
          <label className={b.field}>
            Tipo
            <select name="type">
              <option value="percentage">Percentual</option>
              <option value="fixed">Valor em reais</option>
            </select>
          </label>
          <label className={b.field}>
            Desconto
            <input name="value" type="number" min="0.01" step="0.01" required />
          </label>
          <button className={`${b.button} ${b.outline}`} disabled={busy}>
            Adicionar cupom
          </button>
        </form>
      </section>
      <section>
        <h2>Reservas pelo link</h2>
        <div className={b.grid2}>
          {[
            ["public_profile_view", "Visualizações"],
            ["service_selected", "Serviços selecionados"],
            ["date_selected", "Datas selecionadas"],
            ["time_selected", "Horários selecionados"],
            ["checkout_started", "Confirmações iniciadas"],
            ["booking_completed", "Reservas concluídas"],
          ].map(([key, label]) => (
            <div className={b.row} key={key}>
              <span>{label}</span>
              <strong>
                {data.funnel.find((f) => f.event === key)?.count ?? 0}
              </strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
