"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Sparkles } from "lucide-react";
import { api } from "@/lib/api-client";
import type { TrialStatusSnapshot } from "@/lib/trial";

type TrialStatusResponse = TrialStatusSnapshot & { timezone: string };

function expirationLabel(value: string, timezone: string): string {
  const date = new Date(value);
  const datePart = new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    day: "numeric",
    month: "long",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${datePart} às ${timePart}`;
}

export function TrialStatusCard() {
  const [trial, setTrial] = useState<TrialStatusResponse | null>(null);

  const loadTrial = useCallback(() => {
    api<TrialStatusResponse>("/api/saas/trial-status")
      .then(setTrial)
      .catch(() => setTrial(null));
  }, []);

  useEffect(() => {
    loadTrial();
    const timer = window.setInterval(loadTrial, 60_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") loadTrial();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadTrial]);

  if (!trial?.visible) return null;

  return (
    <section className="trial-status-card" aria-labelledby="trial-status-title">
      <Sparkles className="trial-status-watermark" aria-hidden="true" />
      <div className="trial-status-main">
        <div className="trial-status-message">
          <span className="trial-status-icon" aria-hidden="true"><Sparkles size={27} /></span>
          <div>
            <h2 id="trial-status-title">{trial.headline}</h2>
            <p>
              <span>Válido até {expirationLabel(trial.endsAt, trial.timezone)}</span>
              <span className="trial-status-separator" aria-hidden="true"> · </span>
              <span className="trial-status-no-charge">Sem cobrança automática</span>
            </p>
          </div>
        </div>

        <Link className="trial-status-cta" href="/planos">
          Conhecer os planos <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </div>

      <div className="trial-status-footer">
        <div className="trial-status-remaining">
          <span>DIAS RESTANTES:</span>
          <strong><Check size={16} aria-hidden="true" /> {trial.remainingLabel}</strong>
        </div>

        <ol className="trial-status-timeline" aria-label={`Progresso do teste gratuito: dia ${trial.currentDay} de 7`}>
          {trial.timeline.map((item) => (
            <li key={item.day} className={`trial-day trial-day-${item.state}`}>
              <span aria-hidden="true">{item.state === "completed" ? <Check size={13} /> : "●"}</span>
              Dia {item.day}
              <span className="sr-only">
                {item.state === "completed" ? " concluído" : item.state === "current" ? " atual" : " futuro"}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
