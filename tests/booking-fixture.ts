import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import * as t from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { localDate, shiftDate } from "@/lib/booking/time";
export async function bookingFixture(){
  const key=randomUUID().slice(0,8),password="TestBooking123!";
  const [company]=await db.insert(t.companies).values({name:`Studio QA ${key}`,publicSlug:`qa-${key}`,publicEnabled:true,onboarded:true,cancellationHours:2}).returning();
  const [location]=await db.insert(t.locations).values({companyId:company.id,name:"Unidade Central",openTime:"08:00",closeTime:"20:00"}).returning();
  const [owner]=await db.insert(t.users).values({companyId:company.id,name:"Profissional QA",email:`owner-${key}@example.test`,passwordHash:await hashPassword(password),role:"owner",emailVerified:true}).returning();
  const customers=await db.insert(t.users).values(["Ana","Beatriz"].map(name=>({companyId:null,name,email:`${name.toLowerCase()}-${key}@example.test`,phone:"11987654321",passwordHash:owner.passwordHash,role:"customer",emailVerified:true}))).returning();
  const team=await db.insert(t.employees).values(["Ingrid QA","Maria QA"].map(name=>({companyId:company.id,locationId:location.id,name,active:true}))).returning();
  await db.insert(t.employeeLocations).values(team.map(e=>({employeeId:e.id,locationId:location.id,isPrimary:true})));
  await db.insert(t.employeeSchedules).values(team.flatMap(e=>Array.from({length:7},(_,day)=>({employeeId:e.id,locationId:location.id,dayOfWeek:day,startTime:"09:00",endTime:"18:00",breakStart:"12:00",breakEnd:"13:00"}))));
  const services=await db.insert(t.services).values([{companyId:company.id,name:"Manicure e Pedicure",price:"50.00",durationMinutes:90},{companyId:company.id,name:"Banho de gel",price:"90.00",durationMinutes:60,bufferMinutes:10}]).returning();
  await db.insert(t.employeeServices).values(team.flatMap(e=>services.map(s=>({employeeId:e.id,serviceId:s.id}))));
  let date=shiftDate(localDate(new Date(),company.timezone),7);if(new Date(`${date}T12:00Z`).getUTCDay()===0)date=shiftDate(date,1);
  return {company,location,owner,customers,team,services,date,password,key};
}
export type Fixture=Awaited<ReturnType<typeof bookingFixture>>;
export async function cleanupFixture(f:Fixture){
  const appts=await db.select({id:t.appointments.id}).from(t.appointments).where(eq(t.appointments.companyId,f.company.id));
  const aptIds=appts.map(a=>a.id);const orders=await db.select({id:t.bookings.id}).from(t.bookings).where(eq(t.bookings.companyId,f.company.id));const bookingIds=orders.map(b=>b.id);
  if(bookingIds.length){await db.delete(t.notificationLogs).where(inArray(t.notificationLogs.bookingId,bookingIds));await db.delete(t.bookingProducts).where(inArray(t.bookingProducts.bookingId,bookingIds));}
  if(aptIds.length){await db.delete(t.appointmentHistory).where(inArray(t.appointmentHistory.appointmentId,aptIds));await db.delete(t.payments).where(inArray(t.payments.appointmentId,aptIds));await db.delete(t.appointmentServices).where(inArray(t.appointmentServices.appointmentId,aptIds));}
  await db.delete(t.appointments).where(eq(t.appointments.companyId,f.company.id));
  await db.delete(t.bookings).where(eq(t.bookings.companyId,f.company.id));
  for(const table of [t.auditLogs,t.notifications,t.bookingEvents,t.bookingWaitlist,t.scheduleBlocks,t.products,t.coupons])await db.delete(table).where(eq(table.companyId,f.company.id));
  const empIds=f.team.map(e=>e.id);
  for(const table of [t.employeeSchedules,t.employeeLocations,t.employeeServices])await db.delete(table).where(inArray(table.employeeId,empIds));
  await db.delete(t.employees).where(eq(t.employees.companyId,f.company.id));await db.delete(t.services).where(eq(t.services.companyId,f.company.id));await db.delete(t.serviceCategories).where(eq(t.serviceCategories.companyId,f.company.id));await db.delete(t.clients).where(eq(t.clients.companyId,f.company.id));
  await db.delete(t.users).where(inArray(t.users.id,[f.owner.id,...f.customers.map(c=>c.id)]));await db.delete(t.companySettings).where(eq(t.companySettings.companyId,f.company.id));await db.delete(t.locations).where(eq(t.locations.companyId,f.company.id));await db.delete(t.companies).where(eq(t.companies.id,f.company.id));
}
