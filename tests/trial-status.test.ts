import assert from "node:assert/strict";
import test from "node:test";
import { buildTrialStatus, formatTrialCountdown } from "../src/lib/trial";

const start = new Date("2026-09-15T12:00:00.000Z");
const end = new Date("2026-09-22T12:00:00.000Z");

test("trial começa com sete dias e destaca o primeiro dia", () => {
  const result = buildTrialStatus({ status: "trialing", startedAt: start, endsAt: end, serverNow: start });

  assert.equal(result.remainingSeconds, 7 * 24 * 3600);
  assert.equal(result.remainingDays, 7);
  assert.equal(result.currentDay, 1);
  assert.equal(result.expired, false);
  assert.equal(result.visible, true);
  assert.equal(result.timeline[0]?.state, "current");
  assert.equal(result.timeline[1]?.state, "future");
});

test("timeline marca dias anteriores como concluídos e o dia atual", () => {
  const result = buildTrialStatus({
    status: "trialing",
    startedAt: start,
    endsAt: end,
    serverNow: new Date("2026-09-18T13:00:00.000Z"),
  });

  assert.equal(result.currentDay, 4);
  assert.deepEqual(result.timeline.map((item) => item.state), [
    "completed", "completed", "completed", "current", "future", "future", "future",
  ]);
});

test("último dia troca a contagem para horas", () => {
  const result = buildTrialStatus({
    status: "trialing",
    startedAt: start,
    endsAt: end,
    serverNow: new Date("2026-09-21T13:00:00.000Z"),
  });

  assert.equal(result.currentDay, 7);
  assert.equal(result.remainingLabel, "23h restantes");
  assert.equal(result.headline, "Seu teste gratuito encerra em 23 horas.");
});

test("trial expira exatamente no instante final e completa a timeline", () => {
  const result = buildTrialStatus({ status: "trialing", startedAt: start, endsAt: end, serverNow: end });

  assert.equal(result.remainingSeconds, 0);
  assert.equal(result.expired, true);
  assert.equal(result.visible, false);
  assert.equal(result.headline, "Seu teste gratuito terminou.");
  assert.ok(result.timeline.every((item) => item.state === "completed"));
});

test("assinatura ativa nunca exibe o card de trial", () => {
  const result = buildTrialStatus({ status: "active", startedAt: start, endsAt: end, serverNow: start });
  assert.equal(result.visible, false);
});

test("contador usa singular e aviso inferior a uma hora", () => {
  assert.deepEqual(formatTrialCountdown(3600), {
    headline: "Seu teste gratuito encerra em breve.",
    remainingLabel: "Menos de 1h restante",
  });
  assert.deepEqual(formatTrialCountdown(7200), {
    headline: "Seu teste gratuito encerra em 2 horas.",
    remainingLabel: "2h restantes",
  });
});
