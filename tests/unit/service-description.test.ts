import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getServiceDescription } from "@/lib/client-utils";

describe("Service Card Description Intelligence", () => {
  it("preserves explicit custom description when provided", () => {
    const desc = getServiceDescription({
      name: "Atendimento Padrão",
      description: "Corte completo com lavagem especial e massagem capilar inclusa.",
    });
    assert.equal(desc, "Corte completo com lavagem especial e massagem capilar inclusa.");
  });

  it("generates contextual description for 'Atendimento Padrão'", () => {
    const desc = getServiceDescription({
      name: "Atendimento Padrão",
      description: "",
    });
    assert.match(desc, /Atendimento completo e personalizado/i);
  });

  it("generates contextual description for haircut services", () => {
    const desc = getServiceDescription({
      name: "Corte Degradê Navalhado",
    });
    assert.match(desc, /Corte sob medida/i);
  });

  it("generates contextual description for beard services", () => {
    const desc = getServiceDescription({
      name: "Barboterapia Tradicional",
    });
    assert.match(desc, /toalha quente.*navalhado/i);
  });

  it("generates contextual description for haircut + beard combo", () => {
    const desc = getServiceDescription({
      name: "Corte e Barba VIP",
    });
    assert.match(desc, /Combo completo com corte personalizado/i);
  });

  it("generates contextual description for manicure and nail care", () => {
    const desc = getServiceDescription({
      name: "Manicure em Gel",
    });
    assert.match(desc, /Cuidado e hidratação completos/i);
  });

  it("generates contextual description for massage / therapy", () => {
    const desc = getServiceDescription({
      name: "Massagem Relaxante",
    });
    assert.match(desc, /Sessão relaxante para alívio de tensões/i);
  });

  it("generates contextual description for eyebrows and lashes", () => {
    const desc = getServiceDescription({
      name: "Design de Sobrancelha com Henna",
    });
    assert.match(desc, /Design anatômico/i);
  });

  it("generates premium default fallback for unknown service names", () => {
    const desc = getServiceDescription({
      name: "Procedimento Especial X",
    });
    assert.match(desc, /Atendimento exclusivo com máxima atenção/i);
  });
});
