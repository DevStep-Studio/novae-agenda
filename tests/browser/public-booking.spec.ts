import "dotenv/config";
import { test, expect } from "@playwright/test";
import { pool } from "../../src/db";
import { bookingFixture, cleanupFixture, type Fixture } from "../booking-fixture";
let f:Fixture;
test.beforeAll(async()=>{f=await bookingFixture();});
test.afterAll(async()=>{await cleanupFixture(f);await pool.end();});
test("fast booking, rescheduling and responsive customer portal use real slots", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.request.post("/api/auth/login", { data: { email: f.customers[0].email, password: f.password } });
  const bookingPhone = `(11) 9${Date.now().toString().slice(-8)}`;
  const phoneResponse = await page.request.patch("/api/my/session", { data: { phone: bookingPhone } });
  expect(phoneResponse.ok()).toBe(true);
  const generatedPinResponse = await page.request.get("/api/customer-access/pin/random");
  const generatedPin = (await generatedPinResponse.json()).data.pin as string;
  const setupPinResponse = await page.request.post("/api/customer-access/pin/setup", {
    data: { pin: generatedPin, confirmPin: generatedPin, phone: bookingPhone },
  });
  const setupPinBody = await setupPinResponse.json();
  expect(setupPinResponse.ok(), setupPinBody.error).toBe(true);
  await page.goto(`/agendar/${f.company.publicSlug}`);
  await expect(page.getByRole("heading", { name: "Escolha seu serviço", exact: true })).toBeVisible();
  const widths = [320, 360, 375, 390, 412, 430, 768, 820, 1024, 1280, 1440, 1920];
  const checkWidths = async () => { for (const width of widths) { await page.setViewportSize({ width, height: 1000 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}`).toBe(true); } };
  await checkWidths();
  // Selecting a service keeps the next-slots path available even when its optional preview has loaded.
  await page.getByRole("button", { name: "Selecionar Manicure e Pedicure", exact: true }).click();
  await page.getByRole("button", { name: /Qualquer profissional disponível/ }).click();
  await expect(page.getByRole("dialog", { name: "Profissional" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Ingrid QA/ })).toBeVisible();
  await page.getByRole("button", { name: /Ingrid QA/ }).click();
  await expect(page.getByRole("button", { name: /Ingrid QA/ })).toBeVisible();
  await page.getByRole("button", { name: /Ver horários|Continuar/, exact: false }).first().click();
  await expect(page.getByText("Próximos horários disponíveis", { exact: true })).toBeVisible();
  await checkWidths();
  await page.getByRole("button", { name: /^\d{2}:\d{2}$/, exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Revise seu agendamento" })).toBeVisible();
  await expect(page.getByLabel("Seu nome", { exact: true })).toHaveCount(0);
  const confirmButton = page.getByRole("button", { name: "Confirmar agendamento", exact: true }).first();
  await expect(confirmButton).toBeDisabled();
  await page.locator('button[role="radio"]').filter({ hasText: "PIX" }).click();
  await expect(confirmButton).toBeEnabled();
  await page.getByLabel("Alguma observação para o estabelecimento?").fill("Reserva rápida QA");
  await page.reload();
  await expect(page.getByLabel("Alguma observação para o estabelecimento?")).toHaveValue("Reserva rápida QA");
  await checkWidths();
  const createdResponse = page.waitForResponse(r => r.url().endsWith("/api/bookings") && r.request().method() === "POST");
  await confirmButton.click();
  const response = await createdResponse; expect(response.status()).toBe(201);
  const id = (await response.json()).data.id;
  await expect(page.getByRole("heading", { name: "Agendamento confirmado!" })).toBeVisible();
  expect(await (await page.request.get(`/api/my/bookings/${id}/calendar`)).text()).toContain("BEGIN:VCALENDAR");
  await page.goto("/meus-agendamentos");
  await expect(page.getByText("Próximo agendamento", { exact: true })).toBeVisible();
  await checkWidths();
  // A separate future reservation avoids crossing the tenant's cancellation cutoff during the test.
  const future = await page.request.post("/api/bookings", { data: { slug: f.company.publicSlug, locationId: f.location.id, date: f.date, startTime: "09:00", items: [{ serviceId: f.services[1].id, employeeId: f.team[1].id }], idempotencyKey: crypto.randomUUID() } });
  expect(future.status()).toBe(201); const futureId = (await future.json()).data.id;
  await page.goto(`/meus-agendamentos?booking=${futureId}&action=reschedule`);
  await expect(page.getByRole("heading", { name: "Escolha seu novo horário" })).toBeVisible();
  await expect(page.getByText("Próximos horários disponíveis", { exact: true })).toBeVisible();
  await checkWidths();
  await page.getByRole("button", { name: "Ver calendário completo", exact: false }).click();
  const label = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${f.date}T12:00Z`));
  const month = f.date.slice(0, 7); if (month !== new Date().toISOString().slice(0, 7)) await page.getByRole("button", { name: "Próximo mês", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(`^${label},`) }).click();
  await page.getByRole("button", { name: "14:00", exact: true }).last().click();
  await page.getByRole("button", { name: "Confirmar novo horário" }).click();
  await expect(page.getByText("Seu horário foi atualizado.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar agendamento", exact: true }).click();
  await page.getByRole("button", { name: /Sim, (confirmar cancelamento|cancelar agendamento)/ }).click();
  await expect(page.getByText("Agendamento cancelado.", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test("professional publishes link, QR code and creates assigned service",async({page})=>{
  await page.request.post("/api/auth/login",{data:{email:f.owner.email,password:f.password}});
  await page.goto("/");
  await page.getByRole("button",{name:"Link de agendamento",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Link de agendamento",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Link & Informações",exact:true}).click();
  await page.getByRole("button",{name:"QR Code",exact:true}).click();
  await expect(page.getByAltText("QR Code para agendar")).toBeVisible();
  await page.getByRole("button",{name:"Serviços",exact:true}).click();
  await page.getByRole("button",{name:"Novo serviço",exact:true}).click();
  await page.getByLabel("Nome do serviço",{exact:true}).fill("Manicure completa QA");
  await page.getByLabel("Preço (R$)",{exact:true}).fill("50");
  await page.getByLabel("Duração em minutos").fill("90");
  await page.getByText("Ingrid QA",{exact:true}).click();
  await expect(page.getByLabel("Ingrid QA",{exact:true})).toBeChecked();
  await page.getByRole("button",{name:"Salvar serviço",exact:true}).click();
  await expect(page.getByText("Manicure completa QA",{exact:true})).toBeVisible();
  const result=await page.request.get(`/api/public/${f.company.publicSlug}`);const data=(await result.json()).data;
  expect(data.services.find((s:{name:string})=>s.name==="Manicure completa QA")).toMatchObject({price:50,durationMinutes:90});
});

test("visual regression covers booking and professional selector themes", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.clear());
  await page.route("**/next-availability?**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: null }) });
  });
  const scenarios = [
    { viewport: "desktop", width: 1440, height: 1000 },
    { viewport: "mobile", width: 390, height: 844 },
  ] as const;

  for (const theme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    for (const scenario of scenarios) {
      await page.setViewportSize({ width: scenario.width, height: scenario.height });
      await page.goto(`/agendar/${f.company.publicSlug}`);
      await expect(page.getByRole("heading", { name: "Escolha seu serviço", exact: true })).toBeVisible();
      await page.addStyleTag({ content: '[class*="servicePrice"] small,[class*="professionalNextSlot"]{visibility:hidden!important}' });
      await page.evaluate(() => document.fonts.ready);
      const dynamicCompanyName = page.getByText(f.company.name, { exact: true });
      await expect(page).toHaveScreenshot(`booking-services-${scenario.viewport}-${theme}.png`, {
        animations: "disabled",
        fullPage: true,
        mask: [dynamicCompanyName],
        maxDiffPixelRatio: 0.01,
      });

      await page.getByRole("button", { name: "Selecionar Manicure e Pedicure", exact: true }).click();
      if (scenario.viewport === "mobile") {
        await page.getByRole("button", { name: "Abrir resumo do agendamento" }).click();
      }
      await page.getByRole("button", { name: /Qualquer profissional disponível/ }).click();
      await expect(page.getByRole("dialog", { name: "Profissional" })).toBeVisible();
      await expect(page).toHaveScreenshot(`professional-selector-${scenario.viewport}-${theme}.png`, {
        animations: "disabled",
        fullPage: true,
        mask: [dynamicCompanyName],
        maxDiffPixelRatio: 0.01,
      });
    }
  }
});

test("HTTP concurrency and professional reschedule/completion update the customer booking",async({playwright})=>{
  const baseURL=process.env.TEST_BASE_URL??"http://localhost:3100";
  const customerA=await playwright.request.newContext({baseURL}),customerB=await playwright.request.newContext({baseURL}),staff=await playwright.request.newContext({baseURL});
  try{
    for(const [context,email] of [[customerA,f.customers[0].email],[customerB,f.customers[1].email],[staff,f.owner.email]] as const){expect((await context.post("/api/auth/login",{data:{email,password:f.password}})).ok()).toBe(true);}
    const payload=(time:string)=>({slug:f.company.publicSlug,locationId:f.location.id,date:f.date,startTime:time,items:[{serviceId:f.services[0].id,employeeId:f.team[0].id}],idempotencyKey:crypto.randomUUID()});
    const results=await Promise.all([customerA.post("/api/bookings",{data:payload("13:00")}),customerB.post("/api/bookings",{data:payload("13:00")})]);
    expect(results.map(r=>r.status()).sort()).toEqual([201,409]);
    const winner=results[0].status()===201?customerA:customerB;
    const bookingId=(await results.find(r=>r.status()===201)!.json()).data.id;
    const detail=(await (await winner.get(`/api/my/bookings/${bookingId}`)).json()).data;
    const appointmentId=detail.items[0].id;
    expect((await staff.get("/api/appointments")).ok()).toBe(true);
    expect((await staff.put(`/api/appointments/${appointmentId}`,{data:{date:f.date,startTime:"15:00"}})).ok()).toBe(true);
    const updated=(await (await winner.get(`/api/my/bookings/${bookingId}`)).json()).data;
    expect(updated.items[0].startTime.slice(0,5)).toBe("15:00");
    expect((await staff.patch(`/api/appointments/${appointmentId}`,{data:{status:"waiting"}})).ok()).toBe(true);
    expect((await staff.patch(`/api/appointments/${appointmentId}`,{data:{status:"in_progress"}})).ok()).toBe(true);
    expect((await staff.post(`/api/appointments/${appointmentId}/finish`,{data:{amount:50,method:"pix"}})).ok()).toBe(true);
    const completed=(await (await winner.get(`/api/my/bookings/${bookingId}`)).json()).data;
    expect(completed.status).toBe("completed");
    const race=await Promise.all([staff.post("/api/appointments",{data:{clientId:detail.clientId,employeeId:f.team[0].id,serviceIds:[f.services[0].id],locationId:f.location.id,date:f.date,startTime:"09:00"}}),customerA.post("/api/bookings",{data:payload("09:00")})]);
    expect(race.map(r=>r.status()).sort()).toEqual([201,409]);
    const q=new URLSearchParams({locationId:f.location.id,date:f.date,items:JSON.stringify([{serviceId:f.services[0].id}])});
    const publicData=await (await customerA.get(`/api/public/${f.company.publicSlug}/availability?${q}`)).json();
    expect(JSON.stringify(publicData)).not.toContain("commission");
  }finally{await customerA.dispose();await customerB.dispose();await staff.dispose();}
});

test("direct navigation to /agendar/[slug] loads public booking interface without crashing", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  // 1. Valid public slug renders booking interface
  const response = await page.goto(`/agendar/${f.company.publicSlug}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Escolha seu serviço", exact: true })).toBeVisible();
  expect(pageErrors.length).toBe(0);

  // 2. Non-existent slug renders clean not-found screen rather than crashing error boundary
  const notFoundResponse = await page.goto("/agendar/slug-inexistente-xyz-999");
  expect([200, 404]).toContain(notFoundResponse?.status());
  await expect(page.getByRole("heading", { name: "Estabelecimento não encontrado", exact: true })).toBeVisible();
});

