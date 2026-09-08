import "dotenv/config";
import { test, expect } from "@playwright/test";
import { eq } from "drizzle-orm";
import { db, pool } from "../../src/db";
import { users } from "../../src/db/schema";
import { bookingFixture, cleanupFixture, type Fixture } from "../booking-fixture";
let f:Fixture;
test.beforeAll(async()=>{f=await bookingFixture();});
test.afterAll(async()=>{await cleanupFixture(f);await pool.end();});
test("public booking, real registration, confirmation, tenant guards and responsive layouts",async({page})=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto(`/agendar/${f.company.publicSlug}`);
  await expect(page.getByRole("heading",{name:"O que vamos agendar?"})).toBeVisible();
  for(const width of [320,375,390,430,768,1024,1366,1440,1920]){
    await page.setViewportSize({width,height:1000});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`no overflow at ${width}`).toBe(true);
  }
  await page.setViewportSize({width:1366,height:1000});
  await page.getByRole("button",{name:"Reservar Manicure e Pedicure",exact:true}).click();
  await expect(page.getByRole("complementary")).toContainText("R$ 50,00");
  await page.getByRole("button",{name:"Continuar",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Escolha a data e o horário"})).toBeVisible();
  // Select the deterministic future date from the fixture via accessible calendar label.
  const label=new Intl.DateTimeFormat("pt-BR",{weekday:"long",day:"numeric",month:"long",timeZone:"UTC"}).format(new Date(`${f.date}T12:00Z`));
  const month=f.date.slice(0,7);const currentMonth=new Date().toISOString().slice(0,7);if(month!==currentMonth)await page.getByRole("button",{name:"Próximo mês",exact:true}).click();
  await page.getByRole("button",{name:new RegExp(`^${label},`)}).click();
  await page.getByRole("button",{name:"09:00",exact:true}).click();
  for(const width of [320,375,390,430,768,1024,1366,1440,1920]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);}
  await page.getByRole("button",{name:"Continuar",exact:true}).click();
  await page.getByLabel("Seu nome",{exact:true}).fill("Cliente real QA");
  await page.getByLabel("Telefone com DDD").fill("11999998888");
  const email=`browser-${f.key}@example.test`;
  await page.getByLabel("E-mail",{exact:true}).fill(email);
  await page.getByLabel("Senha",{exact:true}).fill(f.password);
  const registration=page.waitForResponse(r=>r.url().endsWith("/api/auth/register")&&r.request().method()==="POST");
  await page.getByRole("button",{name:"Criar conta e continuar"}).click();
  const response=await registration;expect(response.status()).toBe(201);const payload=await response.json();
  const [created]=await db.select().from(users).where(eq(users.email,email));f.customers.push(created);
  expect(payload.data.devToken).toBeTruthy();
  expect((await page.request.post("/api/auth/verify-email",{data:{token:payload.data.devToken}})).ok()).toBe(true);
  await page.getByRole("button",{name:"Já confirmei meu e-mail"}).click();
  await page.getByLabel("Alguma observação para sua visita?").fill("Gostaria de esmalte claro.");
  await expect(page.getByRole("button",{name:"Confirmar agendamento",exact:true})).toBeEnabled();
  for(const width of [320,375,390,430,768,1024,1366,1440,1920]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`confirmation at ${width}`).toBe(true);}
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:"/tmp/novae-public-confirmation-mobile.png",fullPage:true});
  await page.getByRole("button",{name:"Confirmar agendamento",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Agendamento confirmado!"})).toBeVisible();
  await expect(page.getByText("Gostaria de esmalte claro.")).toBeVisible();
  const id=new URL(page.url()).searchParams.get("booking")!;
  const calendar=await page.request.get(`/api/my/bookings/${id}/calendar`);expect(await calendar.text()).toContain("BEGIN:VCALENDAR");
  expect((await page.request.get("/api/appointments")).status()).toBe(401);
  expect((await page.request.get("/api/booking-settings")).status()).toBe(401);
  await page.getByRole("button",{name:"Remarcar",exact:true}).click();
  await page.getByRole("button",{name:new RegExp(`^${label},`)}).click();
  await page.getByRole("button",{name:"13:00",exact:true}).click();
  await page.getByRole("button",{name:"Confirmar novo horário",exact:true}).click();
  await expect(page.getByText("Seu horário foi atualizado.",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Cancelar agendamento",exact:true}).click();
  await page.getByRole("button",{name:"Sim, cancelar agendamento"}).click();
  await expect(page.getByText("Agendamento cancelado.",{exact:true})).toBeVisible();
  await page.request.post("/api/auth/logout");
  await page.request.post("/api/auth/login",{data:{email:f.customers[1].email,password:f.password}});
  expect((await page.request.get(`/api/my/bookings/${id}`)).status()).toBe(404);
  expect(errors).toEqual([]);
});
test("professional publishes link, QR code and creates assigned service",async({page})=>{
  await page.request.post("/api/auth/login",{data:{email:f.owner.email,password:f.password}});
  await page.goto("/");
  await page.getByRole("button",{name:"Link de agendamento",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Link de agendamento",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"QR Code",exact:true}).click();
  await expect(page.getByAltText("QR Code para agendar")).toBeVisible();
  await page.getByRole("button",{name:"Serviços",exact:true}).click();
  await page.getByRole("button",{name:"Novo serviço",exact:true}).click();
  await page.getByLabel("Nome do serviço",{exact:true}).fill("Manicure completa QA");
  await page.getByLabel("Preço (R$)",{exact:true}).fill("50");
  await page.getByLabel("Duração em minutos").fill("90");
  await page.getByLabel("Ingrid QA",{exact:true}).check();
  await page.getByRole("button",{name:"Salvar serviço",exact:true}).click();
  await expect(page.getByText("Manicure completa QA",{exact:true})).toBeVisible();
  const result=await page.request.get(`/api/public/${f.company.publicSlug}`);const data=(await result.json()).data;
  expect(data.services.find((s:{name:string})=>s.name==="Manicure completa QA")).toMatchObject({price:50,durationMinutes:90});
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
