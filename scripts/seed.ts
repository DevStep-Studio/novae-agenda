import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db";
import {
  appointmentServices,
  appointments,
  clients,
  companies,
  companySettings,
  employeeSchedules,
  employeeServices,
  employees,
  locations,
  notifications,
  payments,
  reviews,
  services,
  subscriptions,
  users,
} from "../src/db/schema";
import { hashPassword } from "../src/lib/auth";

function dateKey(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function seed() {
  console.log("🌱 Iniciando o seed de demonstração completa do Reservei...");

  const defaultPasswordHash = await hashPassword("senha123");
  const verified = { emailVerified: true, emailVerifiedAt: new Date() };

  // =========================================================================
  // 1. EMPRESA PRINCIPAL: Studio Prime (Barbearia & Estética Masculina)
  // =========================================================================
  let [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.name, "Studio Prime"))
    .limit(1);

  const primeId = company ? company.id : crypto.randomUUID();

  if (!company) {
    await db.insert(companies).values({
      id: primeId,
      name: "Studio Prime",
      businessType: "Barbearia & Estética",
      phone: "(11) 3042-1980",
      whatsapp: "(11) 99842-1200",
      email: "ola@studioprime.com.br",
      address: "Rua Harmonia, 284 - Vila Madalena, São Paulo - SP",
      instagram: "studioprime",
      timezone: "America/Sao_Paulo",
      currency: "BRL",
      logoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
      primaryColor: "#dcff4c",
      secondaryColor: "#14171d",
      publicSlug: "studio-prime",
      publicEnabled: true,
      publicDescription: "A melhor experiência em cortes modernos, barba tradicional e tratamentos capilares masculinos na Vila Madalena.",
      publicColor: "#dcff4c",
      publicPhone: true,
      publicInstagram: true,
      cancellationHours: 2,
      onboarded: true,
    });
    [company] = await db.select().from(companies).where(eq(companies.id, primeId)).limit(1);
  } else {
    await db
      .update(companies)
      .set({
        logoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
        publicSlug: "studio-prime",
        publicEnabled: true,
        businessType: "Barbearia & Estética",
        address: "Rua Harmonia, 284 - Vila Madalena, São Paulo - SP",
        publicDescription: "A melhor experiência em cortes modernos, barba tradicional e tratamentos capilares masculinos na Vila Madalena.",
        primaryColor: "#dcff4c",
        secondaryColor: "#14171d",
        publicColor: "#dcff4c",
        publicPhone: true,
        publicInstagram: true,
        cancellationHours: 2,
        onboarded: true,
      })
      .where(eq(companies.id, company.id));
    [company] = await db.select().from(companies).where(eq(companies.id, company.id)).limit(1);
  }

  // Location for Studio Prime
  const [primeLoc] = await db.select().from(locations).where(eq(locations.companyId, company.id)).limit(1);
  if (!primeLoc) {
    await db.insert(locations).values({
      id: crypto.randomUUID(),
      companyId: company.id,
      name: "Unidade Principal",
      address: "Rua Harmonia, 284 - Vila Madalena, São Paulo - SP",
      phone: "(11) 3042-1980",
      openTime: "08:00:00",
      closeTime: "19:00:00",
      active: true,
    });
  }

  // Settings for Studio Prime
  const primeSettings = [
    { key: "open_time", value: "08:00" },
    { key: "close_time", value: "19:00" },
    { key: "slot_interval_minutes", value: "30" },
    { key: "working_days", value: "[1,2,3,4,5,6]" },
    { key: "cancellation_hours", value: "2" },
    { key: "reschedule_hours", value: "2" },
    { key: "allow_holiday_bookings", value: "false" },
    { key: "daily_booking_limit", value: "0" },
    { key: "banner_url", value: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80" },
  ];
  for (const s of primeSettings) {
    const [exist] = await db.select().from(companySettings).where(and(eq(companySettings.companyId, company.id), eq(companySettings.key, s.key))).limit(1);
    if (!exist) {
      await db.insert(companySettings).values({ id: crypto.randomUUID(), companyId: company.id, key: s.key, value: s.value });
    }
  }

  // Active Subscription for Studio Prime
  const [primeSub] = await db.select().from(subscriptions).where(eq(subscriptions.companyId, company.id)).limit(1);
  const now = new Date();
  const nextMonth = new Date();
  nextMonth.setDate(now.getDate() + 30);
  if (!primeSub) {
    await db.insert(subscriptions).values({
      id: crypto.randomUUID(),
      companyId: company.id,
      plan: "pro_monthly",
      status: "active",
      trialEndsAt: nextMonth,
      currentPeriodStart: now,
      currentPeriodEnd: nextMonth,
    });
  } else {
    await db.update(subscriptions).set({ status: "active", plan: "pro_monthly", currentPeriodEnd: nextMonth }).where(eq(subscriptions.id, primeSub.id));
  }

  // -------------------------------------------------------------------------
  // USERS & ROLES FOR STUDIO PRIME
  // -------------------------------------------------------------------------
  // 1. Owner: Camila Almeida (both owner@demo.reservei.test and dono@studioprime.com.br)
  const ownerUsers = [
    { email: "owner@demo.reservei.test", name: "Camila Almeida (Proprietária)", role: "owner" },
    { email: "dono@studioprime.com.br", name: "Camila Almeida (Dona)", role: "owner" },
    { email: "admin@studioprime.com.br", name: "Lucas Ferreira (Administrador)", role: "admin" },
  ];

  for (const u of ownerUsers) {
    const [exist] = await db.select().from(users).where(eq(users.email, u.email)).limit(1);
    if (!exist) {
      await db.insert(users).values({
        id: crypto.randomUUID(),
        companyId: company.id,
        name: u.name,
        email: u.email,
        passwordHash: defaultPasswordHash,
        role: u.role,
        active: true,
        ...verified,
      });
    } else {
      await db.update(users).set({ role: u.role, companyId: company.id }).where(eq(users.id, exist.id));
    }
  }

  // 2. Professionals: Ana Costa & João Mendes
  const staffUsers = [
    { email: "ana@studioprime.com.br", name: "Ana Costa", role: "employee", alias: "usuario@studioprime.com.br" },
    { email: "joao@studioprime.com.br", name: "João Mendes", role: "employee", alias: "funcionario@studioprime.com.br" },
  ];

  const empMap = new Map<string, typeof employees.$inferSelect>();

  for (const staff of staffUsers) {
    // Check main email and alias
    for (const em of [staff.email, staff.alias]) {
      const [u] = await db.select().from(users).where(eq(users.email, em)).limit(1);
      if (!u) {
        await db.insert(users).values({
          id: crypto.randomUUID(),
          companyId: company.id,
          name: staff.name,
          email: em,
          passwordHash: defaultPasswordHash,
          role: "employee",
          active: true,
          ...verified,
        });
      }
    }

    const [mainUser] = await db.select().from(users).where(eq(users.email, staff.email)).limit(1);

    let [emp] = await db.select().from(employees).where(and(eq(employees.companyId, company.id), eq(employees.name, staff.name))).limit(1);
    if (!emp) {
      const empId = crypto.randomUUID();
      await db.insert(employees).values({
        id: empId,
        companyId: company.id,
        userId: mainUser ? mainUser.id : null,
        name: staff.name,
        jobTitle: staff.name.includes("Ana") ? "Barbeira & Terapeuta Capilar" : "Barbeiro Master",
        phone: staff.name.includes("Ana") ? "(11) 98842-1200" : "(11) 99120-4432",
        active: true,
        commissionType: "percentage",
        commissionValue: "50",
      });
      [emp] = await db.select().from(employees).where(eq(employees.id, empId)).limit(1);
    } else {
      if (mainUser) {
        await db.update(employees).set({ userId: mainUser.id }).where(eq(employees.id, emp.id));
      }
    }
    empMap.set(staff.name, emp);
  }

  // 3. Superadmin Novae
  const [existSuper] = await db.select().from(users).where(eq(users.email, "superadmin@novae.app")).limit(1);
  if (!existSuper) {
    await db.insert(users).values({
      id: crypto.randomUUID(),
      name: "Superadmin Novae",
      email: "superadmin@novae.app",
      passwordHash: defaultPasswordHash,
      role: "owner",
      isSuperadmin: true,
      active: true,
      ...verified,
    });
  }

  // 4. Client User Demo
  const [existClientUser] = await db.select().from(users).where(eq(users.email, "cliente@email.com")).limit(1);
  if (!existClientUser) {
    await db.insert(users).values({
      id: crypto.randomUUID(),
      name: "Carlos Silva",
      email: "cliente@email.com",
      phone: "(11) 99999-9999",
      passwordHash: defaultPasswordHash,
      role: "customer",
      active: true,
      ...verified,
    });
  }

  // -------------------------------------------------------------------------
  // SERVICES FOR STUDIO PRIME (Full catalog requested in prompt)
  // -------------------------------------------------------------------------
  const serviceDefs = [
    { name: "Corte", price: "50.00", duration: 30, description: "Corte moderno com acabamento na navalha, lavagem e finalização premium." },
    { name: "Barba", price: "35.00", duration: 30, description: "Design e alinhamento de barba com toalha quente, óleos essenciais e pós-barba." },
    { name: "Corte + Barba", price: "75.00", duration: 60, description: "Combo completo: corte de cabelo personalizado e barba modelada na toalha quente." },
    { name: "Sobrancelha", price: "25.00", duration: 20, description: "Limpeza e alinhamento natural da sobrancelha masculina com pinça ou navalha." },
    { name: "Hidratação", price: "60.00", duration: 45, description: "Tratamento de hidratação profunda e recuperação dos fios com massagem capilar." },
  ];

  const serviceMap = new Map<string, typeof services.$inferSelect>();

  for (const sDef of serviceDefs) {
    let [s] = await db.select().from(services).where(and(eq(services.companyId, company.id), eq(services.name, sDef.name))).limit(1);
    if (!s) {
      const sId = crypto.randomUUID();
      await db.insert(services).values({
        id: sId,
        companyId: company.id,
        name: sDef.name,
        price: sDef.price,
        durationMinutes: sDef.duration,
        description: sDef.description,
        active: true,
      });
      [s] = await db.select().from(services).where(eq(services.id, sId)).limit(1);
    } else {
      await db.update(services).set({ price: sDef.price, durationMinutes: sDef.duration, description: sDef.description, active: true }).where(eq(services.id, s.id));
    }
    serviceMap.set(sDef.name, s);
  }

  // Link services to professionals with commissions
  const ana = empMap.get("Ana Costa")!;
  const joao = empMap.get("João Mendes")!;

  // Ana: Corte, Barba, Corte + Barba, Hidratação
  // João: Barba, Corte, Corte + Barba, Sobrancelha
  const empServiceAssignments = [
    { emp: ana, svcs: ["Corte", "Barba", "Corte + Barba", "Hidratação"], comm: "50" },
    { emp: joao, svcs: ["Corte", "Barba", "Corte + Barba", "Sobrancelha"], comm: "40" },
  ];

  for (const assign of empServiceAssignments) {
    for (const sName of assign.svcs) {
      const svc = serviceMap.get(sName);
      if (svc) {
        await db.delete(employeeServices).where(and(eq(employeeServices.employeeId, assign.emp.id), eq(employeeServices.serviceId, svc.id)));
        await db.insert(employeeServices).values({
          employeeId: assign.emp.id,
          serviceId: svc.id,
          commissionType: "percentage",
          commissionValue: assign.comm,
        });
      }
    }
  }

  // Schedules (Mon-Sat 08:00 - 19:00, lunch 12:00 - 13:00)
  for (const emp of [ana, joao]) {
    await db.delete(employeeSchedules).where(eq(employeeSchedules.employeeId, emp.id));
    for (const dow of [1, 2, 3, 4, 5, 6]) {
      await db.insert(employeeSchedules).values({
        id: crypto.randomUUID(),
        employeeId: emp.id,
        dayOfWeek: dow,
        startTime: "08:00:00",
        endTime: "19:00:00",
        breakStart: "12:00:00",
        breakEnd: "13:00:00",
        active: true,
      });
    }
  }

  // -------------------------------------------------------------------------
  // CLIENTS FOR STUDIO PRIME (15-20 realistic clients)
  // -------------------------------------------------------------------------
  const demoClients = [
    { name: "Carlos Silva", phone: "(11) 99999-9999", email: "carlos.silva@email.com", notes: "Prefere navalhete e acabamento fino." },
    { name: "Mariana Souza", phone: "(11) 98888-1122", email: "mariana.souza@email.com", notes: "Agenda para o namorado e para si." },
    { name: "Roberto Santos", phone: "(11) 97777-3344", email: "roberto.santos@email.com", notes: "Cliente semanal, sempre pontual." },
    { name: "Juliana Oliveira", phone: "(11) 96666-5566", email: "juliana.oliveira@email.com", notes: "Gosta de hidratação pós-corte." },
    { name: "Felipe Costa", phone: "(11) 95555-7788", email: "felipe.costa@email.com", notes: "Barba desenhada com toalha quente." },
    { name: "Rodrigo Almeida", phone: "(11) 94444-9900", email: "rodrigo.almeida@email.com", notes: "Atendimento rápido, prefere Ana." },
    { name: "Lucas Fernandes", phone: "(11) 93333-1122", email: "lucas.fernandes@email.com", notes: "Novo morador do bairro." },
    { name: "Gabriel Rocha", phone: "(11) 92222-3344", email: "gabriel.rocha@email.com", notes: "Corte degradê navalhado." },
    { name: "Bruno Martins", phone: "(11) 91111-5566", email: "bruno.martins@email.com", notes: "Barba e sobrancelha quinzenal." },
    { name: "Diego Pereira", phone: "(11) 98765-4321", email: "diego.pereira@email.com", notes: "Paga sempre no PIX presencial." },
    { name: "Thiago Lima", phone: "(11) 97654-3210", email: "thiago.lima@email.com", notes: "Gosta de produtos modeladores." },
    { name: "Eduardo Ribeiro", phone: "(11) 96543-2109", email: "eduardo.ribeiro@email.com", notes: "Cliente VIP desde a inauguração." },
    { name: "Matheus Barbosa", phone: "(11) 95432-1098", email: "matheus.barbosa@email.com", notes: "Corte social tradicional." },
    { name: "Henrique Castro", phone: "(11) 94321-0987", email: "henrique.castro@email.com", notes: "Prefere horário matutino." },
    { name: "Vinicius Mendes", phone: "(11) 93210-9876", email: "vinicius.mendes@email.com", notes: "Atendimento no final da tarde." },
  ];

  const clientMap = new Map<string, typeof clients.$inferSelect>();

  for (const c of demoClients) {
    let [cl] = await db.select().from(clients).where(and(eq(clients.companyId, company.id), eq(clients.name, c.name))).limit(1);
    if (!cl) {
      const cId = crypto.randomUUID();
      await db.insert(clients).values({
        id: cId,
        companyId: company.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        notes: c.notes,
        active: true,
      });
      [cl] = await db.select().from(clients).where(eq(clients.id, cId)).limit(1);
    }
    clientMap.set(c.name, cl);
  }

  // -------------------------------------------------------------------------
  // APPOINTMENTS & PAYMENTS FOR STUDIO PRIME (Relative Dates: Today, Tomorrow, Past, Future)
  // -------------------------------------------------------------------------
  // Delete older generated appointments to ensure clean, consistent data
  await db.delete(appointments).where(eq(appointments.companyId, company.id));

  const cCorte = serviceMap.get("Corte")!;
  const cBarba = serviceMap.get("Barba")!;
  const cCorteBarba = serviceMap.get("Corte + Barba")!;
  const cSobrancelha = serviceMap.get("Sobrancelha")!;
  const cHidratacao = serviceMap.get("Hidratação")!;

  type AptDemo = {
    clientName: string;
    empName: string;
    svc: typeof services.$inferSelect;
    date: string;
    start: string;
    status: string;
    paid: boolean;
    method?: string;
  };

  const aptDemos: AptDemo[] = [
    // --- HOJE (dateKey(0)) ---
    { clientName: "Carlos Silva", empName: "João Mendes", svc: cBarba, date: dateKey(0), start: "14:00:00", status: "in_progress", paid: false },
    { clientName: "Mariana Souza", empName: "Ana Costa", svc: cCorte, date: dateKey(0), start: "09:00:00", status: "completed", paid: true, method: "pix" },
    { clientName: "Roberto Santos", empName: "Ana Costa", svc: cCorteBarba, date: dateKey(0), start: "10:30:00", status: "completed", paid: true, method: "credit" },
    { clientName: "Juliana Oliveira", empName: "Ana Costa", svc: cHidratacao, date: dateKey(0), start: "15:30:00", status: "confirmed", paid: false },
    { clientName: "Felipe Costa", empName: "João Mendes", svc: cCorteBarba, date: dateKey(0), start: "16:30:00", status: "scheduled", paid: false },
    { clientName: "Rodrigo Almeida", empName: "João Mendes", svc: cSobrancelha, date: dateKey(0), start: "18:00:00", status: "scheduled", paid: false },

    // --- AMANHÃ (dateKey(1)) ---
    { clientName: "Lucas Fernandes", empName: "Ana Costa", svc: cCorte, date: dateKey(1), start: "09:30:00", status: "scheduled", paid: false },
    { clientName: "Gabriel Rocha", empName: "João Mendes", svc: cCorteBarba, date: dateKey(1), start: "11:00:00", status: "scheduled", paid: false },
    { clientName: "Bruno Martins", empName: "Ana Costa", svc: cBarba, date: dateKey(1), start: "14:00:00", status: "confirmed", paid: false },
    { clientName: "Diego Pereira", empName: "João Mendes", svc: cCorte, date: dateKey(1), start: "16:00:00", status: "scheduled", paid: false },

    // --- DEPOIS DE AMANHÃ (dateKey(2)) ---
    { clientName: "Thiago Lima", empName: "Ana Costa", svc: cHidratacao, date: dateKey(2), start: "10:00:00", status: "scheduled", paid: false },
    { clientName: "Eduardo Ribeiro", empName: "João Mendes", svc: cCorteBarba, date: dateKey(2), start: "14:30:00", status: "scheduled", paid: false },

    // --- PASSADOS (dateKey(-1), dateKey(-2), dateKey(-3), dateKey(-5)) ---
    { clientName: "Matheus Barbosa", empName: "Ana Costa", svc: cCorte, date: dateKey(-1), start: "10:00:00", status: "completed", paid: true, method: "pix" },
    { clientName: "Henrique Castro", empName: "João Mendes", svc: cBarba, date: dateKey(-1), start: "11:30:00", status: "completed", paid: true, method: "cash" },
    { clientName: "Vinicius Mendes", empName: "Ana Costa", svc: cCorteBarba, date: dateKey(-1), start: "15:00:00", status: "completed", paid: true, method: "debit" },
    { clientName: "Carlos Silva", empName: "João Mendes", svc: cCorte, date: dateKey(-2), start: "14:00:00", status: "completed", paid: true, method: "credit" },
    { clientName: "Mariana Souza", empName: "Ana Costa", svc: cHidratacao, date: dateKey(-2), start: "16:00:00", status: "completed", paid: true, method: "pix" },
    { clientName: "Roberto Santos", empName: "João Mendes", svc: cBarba, date: dateKey(-3), start: "10:00:00", status: "cancelled", paid: false },
    { clientName: "Juliana Oliveira", empName: "Ana Costa", svc: cCorteBarba, date: dateKey(-5), start: "11:00:00", status: "completed", paid: true, method: "pix" },
  ];

  for (const apt of aptDemos) {
    const cl = clientMap.get(apt.clientName) ?? Array.from(clientMap.values())[0];
    const emp = empMap.get(apt.empName) ?? ana;
    const dur = apt.svc.durationMinutes;
    const priceNum = Number(apt.svc.price);
    const startHour = Number(apt.start.slice(0, 2));
    const startMin = Number(apt.start.slice(3, 5));
    const endMinutes = startHour * 60 + startMin + dur;
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}:00`;

    const aptId = crypto.randomUUID();
    await db.insert(appointments).values({
      id: aptId,
      companyId: company.id,
      clientId: cl.id,
      employeeId: emp.id,
      appointmentDate: apt.date,
      startTime: apt.start,
      endTime: endTime,
      status: apt.status,
      total: priceNum.toFixed(2),
      notes: `Agendamento de demonstração para ${cl.name}.`,
    });

    await db.insert(appointmentServices).values({
      appointmentId: aptId,
      serviceId: apt.svc.id,
      price: priceNum.toFixed(2),
      durationMinutes: dur,
      commissionType: "percentage",
      commissionValue: emp.commissionValue || "50",
      commissionAmount: (priceNum * (Number(emp.commissionValue || 50) / 100)).toFixed(2),
    });

    if (apt.paid) {
      await db.insert(payments).values({
        id: crypto.randomUUID(),
        companyId: company.id,
        appointmentId: aptId,
        amount: priceNum.toFixed(2),
        method: apt.method ?? "pix",
        status: "paid",
        paidAt: new Date(`${apt.date}T${apt.start}`),
      });
    }
  }
  console.log(`  ${aptDemos.length} agendamentos e transações de demonstração criados para Studio Prime.`);

  // -------------------------------------------------------------------------
  // NOTIFICATIONS FOR STUDIO PRIME
  // -------------------------------------------------------------------------
  const [ownerAdmin] = await db.select().from(users).where(eq(users.email, "owner@demo.reservei.test")).limit(1);
  const ownerId = ownerAdmin ? ownerAdmin.id : null;

  const notifDefs = [
    { type: "booking_created", title: "Novo agendamento online", body: "Carlos Silva agendou Barba para hoje às 14:00." },
    { type: "payment_received", title: "Pagamento recebido", body: "R$ 50,00 recebido via PIX de Mariana Souza." },
    { type: "booking_rescheduled", title: "Agendamento remarcado", body: "Juliana Oliveira alterou seu horário para 15:30." },
    { type: "review_received", title: "Nova avaliação 5 estrelas", body: "Roberto Santos avaliou o atendimento de Ana Costa com nota máxima!" },
    { type: "subscription_active", title: "Assinatura Pro ativa", body: "Seu plano Studio Prime está 100% regularizado com todos os recursos liberados." },
  ];

  for (const n of notifDefs) {
    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      companyId: company.id,
      userId: ownerId,
      type: n.type,
      title: n.title,
      body: n.body,
      createdAt: new Date(),
    });
  }

  // -------------------------------------------------------------------------
  // REVIEWS FOR STUDIO PRIME
  // -------------------------------------------------------------------------
  const [firstApt] = await db.select().from(appointments).where(and(eq(appointments.companyId, company.id), eq(appointments.status, "completed"))).limit(1);
  if (firstApt) {
    const cl = Array.from(clientMap.values())[0];
    await db.insert(reviews).values({
      id: crypto.randomUUID(),
      companyId: company.id,
      appointmentId: firstApt.id,
      clientId: cl.id,
      employeeId: firstApt.employeeId,
      serviceId: cCorte.id,
      rating: 5,
      comment: "Excelente atendimento! Pontualidade impecável e ambiente muito agradável.",
      status: "approved",
    });
  }

  // =========================================================================
  // 2. SEGUNDA EMPRESA: Studio Bella (Salão & Estética Feminina - Multi-Tenant)
  // =========================================================================
  let [bellaCompany] = await db.select().from(companies).where(eq(companies.name, "Studio Bella")).limit(1);
  const bellaId = bellaCompany ? bellaCompany.id : crypto.randomUUID();

  if (!bellaCompany) {
    await db.insert(companies).values({
      id: bellaId,
      name: "Studio Bella",
      logoUrl: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=200&q=80",
      businessType: "Salão & Estética",
      phone: "(11) 3210-5500",
      whatsapp: "(11) 98765-4320",
      email: "contato@studiobella.com.br",
      address: "Av. Paulista, 1000 - Bela Vista, São Paulo - SP",
      instagram: "studiobella.sp",
      timezone: "America/Sao_Paulo",
      currency: "BRL",
      primaryColor: "#ec4899", // Rosa/Magenta distinct from Lime
      secondaryColor: "#1a1018",
      publicSlug: "studio-bella",
      publicEnabled: true,
      publicDescription: "Espaço premium de manicure, pedicure, coloração e tratamentos capilares personalizados.",
      publicColor: "#ec4899",
      publicPhone: true,
      publicInstagram: true,
      cancellationHours: 3,
      onboarded: true,
    });
    [bellaCompany] = await db.select().from(companies).where(eq(companies.id, bellaId)).limit(1);
  } else {
    await db
      .update(companies)
      .set({
        logoUrl: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=200&q=80",
        publicSlug: "studio-bella",
        publicEnabled: true,
        businessType: "Salão & Estética",
        primaryColor: "#ec4899",
        publicColor: "#ec4899",
        onboarded: true,
      })
      .where(eq(companies.id, bellaCompany.id));
  }

  // Location for Studio Bella
  const [bellaLoc] = await db.select().from(locations).where(eq(locations.companyId, bellaCompany.id)).limit(1);
  if (!bellaLoc) {
    await db.insert(locations).values({
      id: crypto.randomUUID(),
      companyId: bellaCompany.id,
      name: "Unidade Jardins / Paulista",
      address: "Av. Paulista, 1000 - Bela Vista, São Paulo - SP",
      phone: "(11) 3210-5500",
      openTime: "08:00:00",
      closeTime: "19:00:00",
      active: true,
    });
  }

  // Owner for Studio Bella
  const [bellaOwner] = await db.select().from(users).where(eq(users.email, "owner@demo.studiobella.test")).limit(1);
  if (!bellaOwner) {
    await db.insert(users).values({
      id: crypto.randomUUID(),
      companyId: bellaCompany.id,
      name: "Beatriz Oliveira (Proprietária)",
      email: "owner@demo.studiobella.test",
      passwordHash: defaultPasswordHash,
      role: "owner",
      active: true,
      ...verified,
    });
  }

  // Professionals for Studio Bella
  const bellaStaff = [
    { name: "Beatriz Lima", job: "Especialista em Mechas & Coloração" },
    { name: "Carla Souza", job: "Manicure & Nail Designer" },
  ];
  const bellaEmpMap = new Map<string, typeof employees.$inferSelect>();
  for (const bs of bellaStaff) {
    let [bEmp] = await db.select().from(employees).where(and(eq(employees.companyId, bellaCompany.id), eq(employees.name, bs.name))).limit(1);
    if (!bEmp) {
      const bId = crypto.randomUUID();
      await db.insert(employees).values({
        id: bId,
        companyId: bellaCompany.id,
        name: bs.name,
        jobTitle: bs.job,
        phone: "(11) 98765-0011",
        active: true,
        commissionType: "percentage",
        commissionValue: "50",
      });
      [bEmp] = await db.select().from(employees).where(eq(employees.id, bId)).limit(1);
    }
    bellaEmpMap.set(bs.name, bEmp);
  }

  // Services for Studio Bella
  const bellaServices = [
    { name: "Manicure", price: "40.00", duration: 40, desc: "Cutilagem e esmaltação tradicional ou em gel." },
    { name: "Pedicure", price: "45.00", duration: 40, desc: "Tratamento completo para os pés com esfoliação e hidratação." },
    { name: "Escova Modelada", price: "65.00", duration: 45, desc: "Lavagem com shampoo premium e escova com acabamento impecável." },
    { name: "Coloração Global", price: "150.00", duration: 90, desc: "Aplicação profissional de tinta e banho de brilho nutritivo." },
  ];
  for (const bSvc of bellaServices) {
    let [sv] = await db.select().from(services).where(and(eq(services.companyId, bellaCompany.id), eq(services.name, bSvc.name))).limit(1);
    if (!sv) {
      await db.insert(services).values({
        id: crypto.randomUUID(),
        companyId: bellaCompany.id,
        name: bSvc.name,
        price: bSvc.price,
        durationMinutes: bSvc.duration,
        description: bSvc.desc,
        active: true,
      });
    }
  }

  // Settings for Studio Bella
  const bellaSettings = [
    { key: "banner_url", value: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80" },
  ];
  for (const s of bellaSettings) {
    const [exist] = await db.select().from(companySettings).where(and(eq(companySettings.companyId, bellaCompany.id), eq(companySettings.key, s.key))).limit(1);
    if (!exist) {
      await db.insert(companySettings).values({ id: crypto.randomUUID(), companyId: bellaCompany.id, key: s.key, value: s.value });
    }
  }

  // Studio Bella Subscription
  const [bellaSub] = await db.select().from(subscriptions).where(eq(subscriptions.companyId, bellaCompany.id)).limit(1);
  if (!bellaSub) {
    await db.insert(subscriptions).values({
      id: crypto.randomUUID(),
      companyId: bellaCompany.id,
      plan: "pro_monthly",
      status: "active",
      trialEndsAt: nextMonth,
      currentPeriodStart: now,
      currentPeriodEnd: nextMonth,
    });
  }

  console.log("\n=================================================================================");
  console.log("✅ SEED COMPLETO EXECUTADO COM SUCESSO!");
  console.log("=================================================================================");
  console.log("ACESSO DEMO — CREDENCIAIS E PORTAIS DISPONÍVEIS:");
  console.log("---------------------------------------------------------------------------------");
  console.log("PERFIL          | E-MAIL                         | SENHA    | PORTAL");
  console.log("---------------------------------------------------------------------------------");
  console.log("Superadmin (5)  | superadmin@novae.app           | senha123 | /admin");
  console.log("Owner Demo (4)  | owner@demo.reservei.test       | senha123 | /gestao");
  console.log("Owner Prime (4) | dono@studioprime.com.br        | senha123 | /gestao");
  console.log("Admin Prime (3) | admin@studioprime.com.br       | senha123 | /gestao");
  console.log("Profissional Ana| ana@studioprime.com.br         | senha123 | /profissional");
  console.log("Profissional J. | joao@studioprime.com.br        | senha123 | /profissional");
  console.log("Cliente Demo (0)| cliente@email.com              | senha123 | /cliente");
  console.log("Tenant 2 Owner  | owner@demo.studiobella.test    | senha123 | /gestao");
  console.log("---------------------------------------------------------------------------------");
  console.log("LINKS PÚBLICOS DE AGENDAMENTO:");
  console.log("  👉 Studio Prime: http://localhost:3001/agendar/studio-prime");
  console.log("  👉 Studio Bella: http://localhost:3001/agendar/studio-bella");
  console.log("=================================================================================\n");
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Falha no seed:", error);
    process.exit(1);
  });

export { appointments };

