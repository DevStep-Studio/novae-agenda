import "dotenv/config";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { appointments, bookings, companies, coupons, employeeSchedules, notificationLogs, products, scheduleBlocks, services, bookingPages } from "@/db/schema";
import { loadAvailability } from "@/lib/booking/engine";
import { createBooking, changeBooking, ownedBooking, bookingDetails } from "@/lib/booking/service";
import { localInstant, canCustomerChange, shiftDate } from "@/lib/booking/time";
import { accessibleColor, slugSchema } from "@/lib/booking/validation";
import { processBookingNotifications } from "@/lib/booking/notifications";
import { verificationEmail, passwordResetEmail } from "@/lib/mailer";
import { calendarIcs } from "@/lib/booking/calendar";
import { isValidDateKey } from "@/lib/domain";
import { publicCatalog, publicCompany } from "@/lib/booking/catalog";
import { BookingError } from "@/lib/booking/errors";
import { bookingFixture, cleanupFixture, type Fixture } from "./booking-fixture";
let f:Fixture;
const request=(startTime="09:00",index=0)=>({slug:f.company.publicSlug!,locationId:f.location.id,date:f.date,startTime,items:[{serviceId:f.services[index].id,employeeId:f.team[0].id}],idempotencyKey:randomUUID(),products:[],intendedPaymentMethod:"pix" as const});
describe("Public booking production invariants",()=>{
  before(async()=>{f=await bookingFixture();});after(async()=>{if(f)await cleanupFixture(f);await pool.end();});
  it("validates real dates, reserved slugs, contrast, timezone and cancellation boundary",()=>{
    assert.equal(isValidDateKey("2026-02-30"),false);assert.equal(slugSchema.safeParse("admin").success,false);assert.equal(slugSchema.safeParse("ingrid-amaral").success,true);assert.equal(accessibleColor("#ffffff"),false);assert.equal(accessibleColor("#234e3d"),true);
    assert.equal(localInstant("2026-09-09","12:00","America/Sao_Paulo").toISOString(),"2026-09-09T15:00:00.000Z");assert.throws(()=>localInstant("2026-03-08","02:30","America/New_York"));
    const start=new Date("2026-09-09T15:00Z");assert.equal(canCustomerChange(start,24,new Date("2026-09-08T15:00Z")),true);assert.equal(canCustomerChange(start,24,new Date("2026-09-08T15:01Z")),false);assert.equal(canCustomerChange(start,-1),false);
  });
  it("escapes customer-provided names in authentication e-mails",()=>{
    for(const template of [verificationEmail,passwordResetEmail]){
      const mail=template('<img/src=x/onerror=alert(1)>',"https://example.test/verify");
      assert.ok(!mail.html.includes("<img/src"));
      assert.ok(mail.html.includes("&lt;img/src"));
    }
  });
  it("computes consecutive services, individual professionals, lunch and buffers",async()=>{
    const engine=await loadAvailability(f.company,f.location.id,[{serviceId:f.services[0].id,employeeId:f.team[0].id},{serviceId:f.services[1].id,employeeId:f.team[1].id}],f.date,f.date);
    const slots=engine.slots(f.date);const first=slots.find(s=>s.startTime==="09:00")!;assert.equal(first.endTime,"11:30");assert.deepEqual(first.items.map(i=>i.employeeId),f.team.map(e=>e.id));assert.equal(slots.some(s=>s.startTime==="10:00"),false);assert.equal(slots.some(s=>s.startTime==="16:00"),false);
  });
  it("honors timezone-correct blocks, vacations and multiple periods",async()=>{
    const blockId = randomUUID();
    await db.insert(scheduleBlocks).values({id: blockId, companyId:f.company.id,employeeId:f.team[0].id,startsAt:localInstant(f.date,"09:00",f.company.timezone),endsAt:localInstant(f.date,"11:00",f.company.timezone),reason:"Dentista"});
    const engine=await loadAvailability(f.company,f.location.id,request().items,f.date,f.date);assert.equal(engine.slots(f.date).some(s=>s.startTime==="09:00"),false);await db.delete(scheduleBlocks).where(eq(scheduleBlocks.id,blockId));
    const vacationId = randomUUID();
    await db.insert(scheduleBlocks).values({id: vacationId, companyId:f.company.id,startsAt:localInstant(f.date,"00:00",f.company.timezone),endsAt:localInstant(shiftDate(f.date,3),"00:00",f.company.timezone),reason:"Férias",allDay:true});assert.equal((await loadAvailability(f.company,f.location.id,request().items,f.date,f.date)).slots(f.date).length,0);await db.delete(scheduleBlocks).where(eq(scheduleBlocks.id,vacationId));
  });
  it("only one of two simultaneous clients reserves the same professional",async()=>{
    const results=await Promise.allSettled([createBooking(f.customers[0],request()),createBooking(f.customers[1],request())]);assert.equal(results.filter(r=>r.status==="fulfilled").length,1);assert.equal(results.filter(r=>r.status==="rejected").length,1);
    const winner=results.find(r=>r.status==="fulfilled")!;if(winner.status!=="fulfilled")throw new Error("No booking");const booking=winner.value;
    assert.equal((await loadAvailability(f.company,f.location.id,request().items,f.date,f.date)).slots(f.date).some(s=>s.startTime==="09:00"),false);
    await assert.rejects(()=>ownedBooking(booking.id,randomUUID()),/não encontrado/);
    await changeBooking(booking.id,booking.userId,"cancel");
  });
  it("prevents overlapping booking writes via transactional lock and validation",async()=>{
    const booking=await createBooking(f.customers[0],request());
    await assert.rejects(()=>createBooking(f.customers[1],request("09:00")),/reservado/);
    await changeBooking(booking.id,f.customers[0].id,"cancel");
  });
  it("uses authoritative prices, idempotent retries and atomic rescheduling",async()=>{
    const input=request();const first=await createBooking(f.customers[0],input),retry=await createBooking(f.customers[0],input);assert.equal(first.id,retry.id);assert.equal(first.total,"50.00");
    const second=await createBooking(f.customers[1],request("13:00"));await assert.rejects(()=>changeBooking(first.id,f.customers[0].id,"reschedule",{date:f.date,startTime:"13:00"}),/reservado/);
    const [unchanged]=await db.select().from(bookings).where(eq(bookings.id,first.id));assert.equal(unchanged.startsAt.toISOString(),first.startsAt.toISOString());
    await changeBooking(first.id,f.customers[0].id,"reschedule",{date:f.date,startTime:"15:00"});const detail=await bookingDetails(first.id,f.customers[0].id);assert.equal(detail.items[0].startTime.slice(0,5),"15:00");assert.equal(detail.revision,2);assert.match(calendarIcs(detail),/BEGIN:VCALENDAR/);assert.match(calendarIcs(detail),/DTSTART:.*T180000Z/);
    const logs=await db.select().from(notificationLogs).where(eq(notificationLogs.bookingId,first.id));assert.equal(new Set(logs.map(l=>`${l.event}:${l.revision}`)).size,logs.length);
    await changeBooking(first.id,f.customers[0].id,"cancel");await changeBooking(second.id,f.customers[1].id,"cancel");
  });
  it("rejects tenant injection and inactive services without requiring e-mail verification",async()=>{
    await assert.rejects(()=>createBooking(f.customers[0],{...request(),locationId:randomUUID()}),/Unidade/);
    await assert.rejects(()=>createBooking(f.customers[0],{...request(),items:[{serviceId:f.services[0].id,employeeId:randomUUID()}]}),/profissional/);
    const pinCustomerBooking=await createBooking({...f.customers[0],emailVerified:false},request());
    await changeBooking(pinCustomerBooking.id,f.customers[0].id,"cancel");
    await db.update(services).set({active:false}).where(eq(services.id,f.services[0].id));await assert.rejects(()=>createBooking(f.customers[0],request()),/disponível/);await db.update(services).set({active:true}).where(eq(services.id,f.services[0].id));
  });
  it("keeps price and duration snapshots when the catalog changes before rescheduling",async()=>{
    const booking=await createBooking(f.customers[0],request());
    await db.update(services).set({price:"200.00",durationMinutes:15}).where(eq(services.id,f.services[0].id));
    await changeBooking(booking.id,f.customers[0].id,"reschedule",{date:f.date,startTime:"13:00"});
    const detail=await bookingDetails(booking.id,f.customers[0].id);assert.equal(detail.total,"50.00");assert.equal(detail.items[0].durationMinutes,90);assert.equal(detail.items[0].endTime.slice(0,5),"14:30");
    await db.update(services).set({price:"50.00",durationMinutes:90}).where(eq(services.id,f.services[0].id));await changeBooking(booking.id,f.customers[0].id,"cancel");
  });
  it("applies products and coupons from the server and reconciles agenda receivables",async()=>{
    await db.update(companies).set({allowProducts:true}).where(eq(companies.id,f.company.id));
    const productId = randomUUID();
    await db.insert(products).values({id: productId, companyId:f.company.id,name:"Óleo hidratante",price:"15.00"});
    await db.insert(coupons).values({id: randomUUID(), companyId:f.company.id,code:"WELCOME10",type:"percentage",value:"10"});
    const booking=await createBooking(f.customers[0],{...request(),products:[{productId,quantity:1}],couponCode:"WELCOME10"});
    assert.equal(booking.subtotal,"65.00");assert.equal(booking.total,"58.50");
    const rows=await db.select().from(appointments).where(eq(appointments.bookingId,booking.id));assert.equal(rows.reduce((sum,a)=>sum+Number(a.total),0),58.5);
    await changeBooking(booking.id,f.customers[0].id,"cancel");
  });
  it("enforces disabled customer changes and safely processes notification jobs once",async()=>{
    const booking=await createBooking(f.customers[0],request());
    await db.update(companies).set({cancellationHours:-1}).where(eq(companies.id,f.company.id));
    await assert.rejects(()=>changeBooking(booking.id,f.customers[0].id,"cancel"),/prazo/);
    await db.update(companies).set({cancellationHours:2}).where(eq(companies.id,f.company.id));
    const sent:string[]=[];const channel={async send(m:{idempotencyKey:string}){sent.push(m.idempotencyKey);return {ok:true};}};
    await Promise.all([processBookingNotifications(10,channel,booking.id),processBookingNotifications(10,channel,booking.id)]);
    await processBookingNotifications(10,channel,booking.id);assert.equal(sent.length,1);
    await changeBooking(booking.id,f.customers[0].id,"cancel");
  });

  it("resolves public company and catalog with uppercase, spaces, and company id fallback", async () => {
    // 1. Direct slug
    const cat = await publicCatalog(f.company.publicSlug!);
    assert.equal(cat.company.name, f.company.name);
    assert.equal(cat.services.length >= 1, true);

    // 2. Uppercase and spaces
    const catUpper = await publicCatalog(`  ${f.company.publicSlug!.toUpperCase()}  `);
    assert.equal(catUpper.company.name, f.company.name);

    // 3. By Company ID
    const catById = await publicCatalog(f.company.id);
    assert.equal(catById.company.name, f.company.name);

    // 4. Unknown slug throws BookingError with 404
    await assert.rejects(
      () => publicCatalog("slug-que-definitivamente-nao-existe-999999"),
      (err: any) => err instanceof BookingError && err.status === 404,
    );
  });

  it("handles malformed pageBuilder layout gracefully without crashing catalog", async () => {
    const pageId = randomUUID();
    await db.insert(bookingPages).values({
      id: pageId,
      companyId: f.company.id,
      status: "published",
      publishedLayout: "CORRUPTED_JSON_NOT_VALID{",
      globalTokens: "CORRUPTED_TOKENS{",
      draftLayout: "{}",
    });

    const cat = await publicCatalog(f.company.publicSlug!);
    assert.equal(cat.company.name, f.company.name);
    assert.equal(cat.company.pageBuilder, null);

    await db.delete(bookingPages).where(eq(bookingPages.id, pageId));
  });
});

