export const TRIAL_DURATION_DAYS = 15;
export const TRIAL_DAY_MS = 24 * 60 * 60 * 1000;

export type TrialTimelineState = "completed" | "current" | "future";

export type TrialDay = {
  day: number;
  state: TrialTimelineState;
};

export type TrialStatusSnapshot = {
  status: string;
  startedAt: string;
  endsAt: string;
  serverNow: string;
  remainingSeconds: number;
  remainingDays: number;
  currentDay: number;
  expired: boolean;
  visible: boolean;
  headline: string;
  remainingLabel: string;
  timeline: TrialDay[];
};

type BuildTrialStatusInput = {
  status: string;
  plan?: string;
  startedAt: Date | string;
  endsAt: Date | string;
  serverNow: Date | string;
};

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function plural(value: number, singular: string, pluralForm: string): string {
  return `${value} ${value === 1 ? singular : pluralForm}`;
}

export function formatTrialCountdown(remainingSeconds: number): {
  headline: string;
  remainingLabel: string;
} {
  if (remainingSeconds <= 0) {
    return { headline: "Seu teste gratuito terminou.", remainingLabel: "Teste encerrado" };
  }

  const remainingHours = Math.ceil(remainingSeconds / 3600);
  if (remainingHours <= 24) {
    return {
      headline: remainingHours <= 1
        ? "Seu teste gratuito encerra em breve."
        : `Seu teste gratuito encerra em ${plural(remainingHours, "hora", "horas")}.`,
      remainingLabel: remainingHours <= 1
        ? "Menos de 1h restante"
        : `${remainingHours}h restantes`,
    };
  }

  const remainingDays = Math.ceil(remainingSeconds / (24 * 3600));
  return {
    headline: `Seu teste gratuito encerra em ${plural(remainingDays, "dia", "dias")}.`,
    remainingLabel: `${plural(remainingDays, "dia", "dias")} restantes`,
  };
}

export function buildTrialStatus({ status, plan, startedAt, endsAt, serverNow }: BuildTrialStatusInput): TrialStatusSnapshot {
  const start = asDate(startedAt);
  const end = asDate(endsAt);
  const now = asDate(serverNow);
  const remainingSeconds = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 1000));
  const remainingDays = Math.max(0, Math.ceil(remainingSeconds / (24 * 3600)));
  const expired = now.getTime() >= end.getTime();
  const elapsedDays = Math.max(0, Math.floor((now.getTime() - start.getTime()) / TRIAL_DAY_MS));
  const currentDay = Math.min(TRIAL_DURATION_DAYS, elapsedDays + 1);
  const isTrialStatus = status === "trialing";
  const isTrialPlan = !plan || plan === "trial" || plan === "teste";
  const trialIsActive = !expired && isTrialStatus && isTrialPlan && remainingDays <= 20;
  const countdown = formatTrialCountdown(remainingSeconds);

  return {
    status,
    startedAt: start.toISOString(),
    endsAt: end.toISOString(),
    serverNow: now.toISOString(),
    remainingSeconds,
    remainingDays,
    currentDay,
    expired,
    visible: trialIsActive,
    ...countdown,
    timeline: Array.from({ length: TRIAL_DURATION_DAYS }, (_, index) => {
      const day = index + 1;
      const state: TrialTimelineState = expired || day < currentDay
        ? "completed"
        : day === currentDay
          ? "current"
          : "future";
      return { day, state };
    }),
  };
}
