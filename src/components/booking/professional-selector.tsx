/* eslint-disable react-hooks/set-state-in-effect -- Loads live availability when the selector opens. */
"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Clock3, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api-client";
import type { AvailableSlot } from "@/lib/booking/engine";
import { b, dateLabelShort } from "./primitives";

type Professional = {
  id: string;
  name: string;
  jobTitle: string | null;
  photoUrl: string | null;
};

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("");
}

function ProfessionalAvatar({ professional, any = false }: { professional?: Professional; any?: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (any) return <span className={`${b.professionalAvatar} ${b.professionalAvatarAny}`}><Sparkles size={18} /></span>;
  return (
    <span className={b.professionalAvatar}>
      {professional?.photoUrl && failedSrc !== professional.photoUrl
        ? <img src={professional.photoUrl} alt="" onError={() => setFailedSrc(professional.photoUrl)} />
        : <span>{initials(professional?.name || "Profissional")}</span>}
    </span>
  );
}

export function ProfessionalIdentity({ professional, fallbackName }: { professional?: Professional; fallbackName?: string }) {
  if (!professional && !fallbackName) return null;
  const display = professional || { id: "", name: fallbackName || "Profissional", jobTitle: null, photoUrl: null };
  return (
    <div className={b.professionalIdentity}>
      <ProfessionalAvatar professional={display} />
      <span>
        <strong>{display.name}</strong>
        <small>{display.jobTitle || "Profissional"}</small>
      </span>
    </div>
  );
}

export function ProfessionalSelector({
  slug,
  locationId,
  serviceId,
  today,
  professionals,
  value,
  onChange,
}: {
  slug: string;
  locationId: string;
  serviceId: string;
  today: string;
  professionals: Professional[];
  value: string | null;
  onChange: (employeeId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [availability, setAvailability] = useState<Record<string, { date: string; time: string }>>({});
  const [loading, setLoading] = useState(false);
  const firstOption = useRef<HTMLButtonElement>(null);
  const selected = professionals.find(professional => professional.id === value);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => firstOption.current?.focus());
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open || !professionals.length) return;
    const controller = new AbortController();
    setLoading(true);
    Promise.all(professionals.map(async professional => {
      try {
        const query = new URLSearchParams({
          locationId,
          date: today,
          groups: "1",
          items: JSON.stringify([{ serviceId, employeeId: professional.id }]),
        });
        const result = await api<{ date: string; slot: AvailableSlot } | null>(
          `/api/public/${slug}/next-availability?${query}`,
          { signal: controller.signal },
        );
        return result ? [professional.id, { date: result.date, time: result.slot.startTime }] as const : null;
      } catch {
        return null;
      }
    })).then(results => {
      if (!controller.signal.aborted) {
        setAvailability(Object.fromEntries(results.filter((result): result is NonNullable<typeof result> => Boolean(result))));
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, [locationId, open, professionals, serviceId, slug, today]);

  const choose = (employeeId: string | null) => {
    onChange(employeeId);
    setOpen(false);
  };

  return (
    <div className={b.professionalSelector}>
      <button
        type="button"
        className={b.professionalTrigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <ProfessionalAvatar professional={selected} any={!selected} />
        <span className={b.professionalTriggerCopy}>
          <small>Profissional</small>
          <strong>{selected?.name || "Qualquer profissional disponível"}</strong>
          <span>{selected?.jobTitle || (selected ? "Profissional" : "Horário mais rápido")}</span>
        </span>
        <span className={b.professionalChange}>{selected ? "Alterar" : "Escolher"}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>

      {open && (
        <>
          <button className={b.professionalOverlay} type="button" aria-label="Fechar seleção de profissional" onClick={() => setOpen(false)} />
          <section className={b.professionalPopover} role="dialog" aria-modal="true" aria-labelledby={`professional-title-${serviceId}`}>
            <header className={b.professionalPopoverHeader}>
              <div>
                <p>Escolha quem vai atender você</p>
                <h3 id={`professional-title-${serviceId}`}>Profissional</h3>
              </div>
              <button type="button" aria-label="Fechar" onClick={() => setOpen(false)}><X size={18} /></button>
            </header>

            <div className={b.professionalOptions}>
              <button
                ref={firstOption}
                type="button"
                className={`${b.professionalOption} ${b.professionalOptionRecommended} ${!value ? b.professionalOptionSelected : ""}`}
                aria-pressed={!value}
                onClick={() => choose(null)}
              >
                <ProfessionalAvatar any />
                <span className={b.professionalOptionCopy}>
                  <span className={b.professionalRecommendation}><Sparkles size={12} /> Horário mais rápido</span>
                  <strong>Qualquer profissional disponível</strong>
                  <small>Encontraremos automaticamente a melhor opção para você.</small>
                </span>
                {!value && <Check size={17} className={b.professionalOptionCheck} />}
              </button>

              {professionals.map(professional => {
                const next = availability[professional.id];
                const active = professional.id === value;
                return (
                  <button
                    key={professional.id}
                    type="button"
                    className={`${b.professionalOption} ${active ? b.professionalOptionSelected : ""}`}
                    aria-pressed={active}
                    onClick={() => choose(professional.id)}
                  >
                    <ProfessionalAvatar professional={professional} />
                    <span className={b.professionalOptionCopy}>
                      <strong>{professional.name}</strong>
                      <small>{professional.jobTitle || "Profissional"}</small>
                      <span className={b.professionalNextSlot}>
                        <Clock3 size={12} />
                        {loading
                          ? "Consultando próximo horário…"
                          : next
                            ? `${next.date === today ? "Hoje" : dateLabelShort(next.date)} às ${next.time}`
                            : "Consulte os horários disponíveis"}
                      </span>
                    </span>
                    {active && <Check size={17} className={b.professionalOptionCheck} />}
                  </button>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
