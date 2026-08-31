"use client";

import { useEffect, useMemo, useState } from "react";
import type { ButtonHTMLAttributes, CSSProperties, FormEvent, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Banknote,
  Bell,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  Clock3,
  Command,
  CreditCard,
  FileText,
  Filter,
  Home,
  LayoutGrid,
  ListFilter,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Phone,
  Plus,
  ReceiptText,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Sun,
  Tag,
  Trash2,
  TrendingUp,
  UserPlus,
  UserRound,
  Users,
  WalletCards,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import {
  appointments as initialAppointments,
  clients as initialClients,
  employees,
  formatCurrency,
  popularServices,
  revenueByMonth,
  services as initialServices,
  today,
  timeSlots,
  weekDays,
} from "@/lib/demo-data";
import type {
  Appointment,
  AppointmentStatus,
  Client,
  Employee,
  Service,
  ViewKey,
} from "@/lib/demo-data";
import { AddEmployeeModal } from "@/components/add-employee-modal";

type Theme = "light" | "dark";
type CalendarMode = "day" | "week" | "month";
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type AvatarSize = "sm" | "md" | "lg";

type Block = {
  id: string;
  date: string;
  start: string;
  end: string;
  reason: string;
  employeeId: string;
};

type AppointmentDraft = {
  clientId: string;
  serviceId: string;
  employeeId: string;
  date: string;
  time: string;
  duration: number;
  total: number;
  notes: string;
  status: AppointmentStatus;
};

const navItems: Array<{ id: ViewKey; label: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Início", icon: Home },
  { id: "agenda", label: "Agenda", icon: CalendarDays },
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "servicos", label: "Serviços", icon: Tag },
  { id: "equipe", label: "Equipe", icon: UserRound },
  { id: "financeiro", label: "Financeiro", icon: WalletCards },
  { id: "relatorios", label: "Relatórios", icon: BarChart3 },
  { id: "configuracoes", label: "Configurações", icon: Settings2 },
];

const pageTitles: Record<ViewKey, { title: string; eyebrow: string }> = {
  dashboard: { title: "Visão geral", eyebrow: "Quarta-feira, 18 de março de 2026" },
  agenda: { title: "Agenda", eyebrow: "Organize seus atendimentos" },
  clientes: { title: "Clientes", eyebrow: "Relacionamentos que fazem seu negócio crescer" },
  servicos: { title: "Serviços", eyebrow: "Catálogo e preços do estabelecimento" },
  equipe: { title: "Equipe", eyebrow: "Profissionais e disponibilidade" },
  financeiro: { title: "Financeiro", eyebrow: "Acompanhe a saúde do seu negócio" },
  relatorios: { title: "Relatórios", eyebrow: "Dados para decisões melhores" },
  configuracoes: { title: "Configurações", eyebrow: "Deixe a Agenda com a sua cara" },
};

const statusClass: Record<AppointmentStatus, string> = {
  Agendado: "status-scheduled",
  Confirmado: "status-confirmed",
  Aguardando: "status-waiting",
  "Em atendimento": "status-progress",
  Finalizado: "status-finished",
  Cancelado: "status-cancelled",
  "Não compareceu": "status-cancelled",
};

const statusOptions: AppointmentStatus[] = ["Agendado", "Confirmado", "Aguardando", "Em atendimento", "Finalizado", "Cancelado", "Não compareceu"];

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

function dateLabel(date: string) {
  return dateFormatter.format(new Date(`${date}T12:00:00`));
}

function shortDate(date: string) {
  return shortDateFormatter.format(new Date(`${date}T12:00:00`)).replace(" de ", " ");
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60).toString().padStart(2, "0");
  const mins = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

function initialsFromName(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Avatar({ initials, color, size = "md" }: { initials: string; color: string; size?: AvatarSize }) {
  return <span className={`avatar avatar-${size}`} style={{ backgroundColor: color }}>{initials}</span>;
}

function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="brand-lockup">
      <span className="brand-mark"><Sparkles size={17} strokeWidth={2.4} /></span>
      {!collapsed && <span className="brand-name">agenda<span>.</span></span>}
    </div>
  );
}

function Button({ variant = "primary", className = "", children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={`button button-${variant} ${className}`} {...props}>{children}</button>;
}

function IconButton({ label, variant = "ghost", children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; variant?: ButtonVariant }) {
  return <button className={`icon-button icon-button-${variant} ${className}`} aria-label={label} title={label} {...props}>{children}</button>;
}

function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <span className={`status-badge ${statusClass[status]}`}><span className="status-dot" />{status}</span>;
}

function Modal({ title, eyebrow, onClose, children, wide = false }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <div>
            {eyebrow && <p className="modal-eyebrow">{eyebrow}</p>}
            <h2 id="modal-title">{title}</h2>
          </div>
          <IconButton label="Fechar" variant="ghost" onClick={onClose}><X size={19} /></IconButton>
        </div>
        {children}
      </section>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint && <span className="field-hint">{hint}</span>}</label>;
}

function SelectField(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="input select-input" {...props} />;
}

function MetricCard({ label, value, detail, icon: Icon, tone = "teal", trend }: { label: string; value: string; detail: string; icon: LucideIcon; tone?: string; trend?: "up" | "down" }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon metric-${tone}`}><Icon size={18} strokeWidth={2} /></div>
      <div className="metric-copy"><p>{label}</p><strong>{value}</strong><span className={trend === "down" ? "metric-detail negative" : "metric-detail"}>{trend === "up" && <ArrowUpRight size={13} />}{trend === "down" && <ArrowDownRight size={13} />}{detail}</span></div>
      <MoreHorizontal className="metric-more" size={17} />
    </article>
  );
}

function SectionHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="section-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>;
}

function AppointmentCard({ appointment, onClick, compact = false }: { appointment: Appointment; onClick: () => void; compact?: boolean }) {
  return (
    <button className={`appointment-card ${compact ? "appointment-compact" : ""}`} onClick={onClick} style={{ "--appointment-color": appointment.employeeId === "ana" ? "#4e8c83" : appointment.employeeId === "joao" ? "#b17d45" : appointment.employeeId === "mariana" ? "#8b6fa3" : "#6e8bb2" } as CSSProperties}>
      <div className="appointment-card-top"><span className="appointment-time">{appointment.time}</span><StatusBadge status={appointment.status} /></div>
      <div className="appointment-main"><Avatar initials={appointment.clientInitials} color={appointment.clientColor} size={compact ? "sm" : "md"} /><span className="appointment-client"><strong>{appointment.clientName}</strong><small>{appointment.service}</small></span></div>
      {!compact && <div className="appointment-meta"><span><Clock3 size={13} /> {appointment.duration} min</span><span><UserRound size={13} /> {appointment.employee}</span><strong>{formatCurrency(appointment.total)}</strong></div>}
    </button>
  );
}

function EmptyState({ icon: Icon = CalendarDays, title, description, action }: { icon?: LucideIcon; title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={22} /></span><h3>{title}</h3><p>{description}</p>{action}</div>;
}

function Dashboard({ appointments, onNew, onAppointment }: { appointments: Appointment[]; onNew: () => void; onAppointment: (appointment: Appointment) => void }) {
  const todayAppointments = appointments.filter((appointment) => appointment.date === today);
  const pending = todayAppointments.filter((appointment) => !["Cancelado", "Não compareceu"].includes(appointment.status));
  const nextAppointment = pending.find((appointment) => !["Finalizado"].includes(appointment.status)) ?? pending[0];
  const realized = todayAppointments.filter((appointment) => appointment.status === "Finalizado").reduce((sum, appointment) => sum + appointment.total, 0);
  const forecast = pending.reduce((sum, appointment) => sum + appointment.total, 0);
  return (
    <div className="page-content dashboard-page">
      <div className="page-intro"><div><p className="eyebrow">{pageTitles.dashboard.eyebrow}</p><h1>Bom dia, Camila <span className="wave">✦</span></h1><p className="intro-copy">Aqui está o resumo do que acontece no seu estabelecimento hoje.</p></div><Button onClick={onNew}><Plus size={17} /> Novo agendamento</Button></div>
      <div className="metrics-grid">
        <MetricCard label="Atendimentos hoje" value={String(pending.length)} detail="2 a mais que ontem" icon={CalendarDays} tone="teal" trend="up" />
        <MetricCard label="Receita prevista" value={formatCurrency(forecast)} detail="para hoje" icon={TrendingUp} tone="lilac" />
        <MetricCard label="Receita realizada" value={formatCurrency(realized)} detail="de 1 atendimento" icon={WalletCards} tone="amber" />
        <MetricCard label="Clientes atendidos" value="1" detail="12% da sua base" icon={Users} tone="rose" trend="up" />
      </div>
      <div className="dashboard-grid">
        <section className="panel next-panel">
          <SectionHeading title="Próximo atendimento" action={<button className="link-button" onClick={() => onAppointment(nextAppointment)}>Ver detalhes <ArrowRight size={14} /></button>} />
          {nextAppointment ? <div className="next-appointment"><div className="next-time"><span>Próximo</span><strong>{nextAppointment.time}</strong><small>em 25 min</small></div><div className="next-person"><Avatar initials={nextAppointment.clientInitials} color={nextAppointment.clientColor} size="lg" /><div><h3>{nextAppointment.clientName}</h3><p>{nextAppointment.service}</p><span><UserRound size={13} /> com {nextAppointment.employee}</span></div></div><div className="next-price"><span>Valor</span><strong>{formatCurrency(nextAppointment.total)}</strong><StatusBadge status={nextAppointment.status} /></div></div> : <EmptyState title="Agenda livre" description="Não há próximos atendimentos para hoje." action={<Button onClick={onNew}>Adicionar atendimento</Button>} />}
        </section>
        <section className="panel day-summary-panel"><SectionHeading title="Resumo do dia" /><div className="summary-progress"><div className="progress-label"><span>Atendimentos concluídos</span><strong>1 de {pending.length}</strong></div><div className="progress-bar"><span style={{ width: `${Math.round((1 / Math.max(pending.length, 1)) * 100)}%` }} /></div></div><div className="summary-list"><div><span className="summary-icon green"><CheckCheck size={15} /></span><span>Confirmados</span><strong>{todayAppointments.filter((a) => a.status === "Confirmado").length}</strong></div><div><span className="summary-icon yellow"><Clock3 size={15} /></span><span>Aguardando</span><strong>{todayAppointments.filter((a) => a.status === "Aguardando").length}</strong></div><div><span className="summary-icon blue"><Zap size={15} /></span><span>Em atendimento</span><strong>{todayAppointments.filter((a) => a.status === "Em atendimento").length}</strong></div></div><button className="summary-footer" onClick={() => onNew}><CalendarPlus size={15} /> Organizar horários livres <ArrowRight size={14} /></button></section>
      </div>
      <section className="panel agenda-today-panel"><SectionHeading title="Agenda de hoje" description="Todos os atendimentos em ordem cronológica" action={<button className="filter-button"><Filter size={15} /> Filtrar <ChevronDown size={14} /></button>} /><div className="appointment-list">{todayAppointments.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} onClick={() => onAppointment(appointment)} />)}</div></section>
    </div>
  );
}

function CalendarToolbar({ date, mode, setMode, onPrev, onNext, onToday, onNew, onBlock }: { date: string; mode: CalendarMode; setMode: (mode: CalendarMode) => void; onPrev: () => void; onNext: () => void; onToday: () => void; onNew: () => void; onBlock: () => void }) {
  return <div className="calendar-toolbar"><div className="calendar-date-controls"><button className="today-button" onClick={onToday}>Hoje</button><IconButton label="Data anterior" onClick={onPrev}><ChevronLeft size={18} /></IconButton><IconButton label="Próxima data" onClick={onNext}><ChevronRight size={18} /></IconButton><strong>{mode === "month" ? "Março 2026" : dateLabel(date)}</strong></div><div className="toolbar-actions"><div className="view-switcher">{(["day", "week", "month"] as CalendarMode[]).map((item) => <button key={item} className={mode === item ? "active" : ""} onClick={() => setMode(item)}>{item === "day" ? "Dia" : item === "week" ? "Semana" : "Mês"}</button>)}</div><Button variant="secondary" onClick={onBlock}><Clock3 size={16} /> Bloquear horário</Button><Button onClick={onNew}><Plus size={16} /> Novo agendamento</Button></div></div>;
}

function CalendarPage({ appointments, team, selectedDate, setSelectedDate, mode, setMode, employeeFilter, setEmployeeFilter, onAppointment, onNew, onBlock }: { appointments: Appointment[]; team: Employee[]; selectedDate: string; setSelectedDate: (date: string) => void; mode: CalendarMode; setMode: (mode: CalendarMode) => void; employeeFilter: string; setEmployeeFilter: (id: string) => void; onAppointment: (appointment: Appointment) => void; onNew: () => void; onBlock: () => void }) {
  const displayed = appointments.filter((appointment) => appointment.date === selectedDate && (employeeFilter === "all" || appointment.employeeId === employeeFilter));
  const changeDate = (amount: number) => { const next = new Date(`${selectedDate}T12:00:00`); next.setDate(next.getDate() + amount); setSelectedDate(next.toISOString().slice(0, 10)); };
  return <div className="page-content calendar-page"><div className="page-intro compact-intro"><div><p className="eyebrow">Agenda do estabelecimento</p><h1>{mode === "month" ? "Calendário" : dateLabel(selectedDate)}</h1><p className="intro-copy">{displayed.length} atendimentos · {formatCurrency(displayed.reduce((sum, item) => sum + item.total, 0))} previsto</p></div></div><CalendarToolbar date={selectedDate} mode={mode} setMode={setMode} onPrev={() => changeDate(-1)} onNext={() => changeDate(1)} onToday={() => setSelectedDate(today)} onNew={onNew} onBlock={onBlock} /><div className="calendar-filter-row"><div className="employee-filter-label"><Users size={15} /><span>Profissional:</span><SelectField value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}><option value="all">Todos os profissionais</option>{team.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</SelectField></div><div className="calendar-legend">{team.slice(0, 4).map((employee) => <span key={employee.id}><i style={{ backgroundColor: employee.color }} />{employee.name.split(" ")[0]}</span>)}</div></div>{mode === "day" && <DayCalendar appointments={displayed} team={team} onAppointment={onAppointment} />}{mode === "week" && <WeekCalendar appointments={appointments} onAppointment={onAppointment} setSelectedDate={setSelectedDate} />}{mode === "month" && <MonthCalendar appointments={appointments} onAppointment={onAppointment} setSelectedDate={setSelectedDate} />}</div>;
}

function DayCalendar({ appointments, team, onAppointment }: { appointments: Appointment[]; team: Employee[]; onAppointment: (appointment: Appointment) => void }) {
  const hourHeight = 74;
  const visibleEmployees = team;
  return <section className="panel day-calendar-panel"><div className="day-calendar-head"><div className="time-head">Horário</div><div className="employee-head">{visibleEmployees.map((employee) => <span key={employee.id}><i style={{ backgroundColor: employee.color }} />{employee.name.split(" ")[0]}</span>)}</div></div><div className="day-calendar-body"><div className="time-column">{timeSlots.map((time) => <span key={time} style={{ height: `${hourHeight}px` }}>{time}</span>)}</div><div className="timeline-canvas" style={{ height: `${timeSlots.length * hourHeight}px` }}><div className="hour-lines">{timeSlots.map((time) => <span key={time} style={{ height: `${hourHeight}px` }} />)}</div>{appointments.map((appointment) => { const top = ((timeToMinutes(appointment.time) - 480) / 60) * hourHeight; const height = Math.max((appointment.duration / 60) * hourHeight - 6, 52); const index = visibleEmployees.findIndex((employee) => employee.id === appointment.employeeId); return <button key={appointment.id} className="timeline-appointment" style={{ top, height, left: `calc(${Math.max(index, 0) * 25}% + 5px)`, width: "calc(25% - 10px)", "--appointment-color": appointment.employeeId === "ana" ? "#4e8c83" : appointment.employeeId === "joao" ? "#b17d45" : appointment.employeeId === "mariana" ? "#8b6fa3" : "#6e8bb2" } as CSSProperties} onClick={() => onAppointment(appointment)}><span className="timeline-time">{appointment.time} — {appointment.endTime}</span><strong>{appointment.clientName}</strong><small>{appointment.service}</small><em>{appointment.employee.split(" ")[0]}</em></button>; })}<div className="current-time-line" style={{ top: `${((10 * 60 + 12 - 480) / 60) * hourHeight}px` }}><span /></div></div></div></section>;
}

function WeekCalendar({ appointments, onAppointment, setSelectedDate }: { appointments: Appointment[]; onAppointment: (appointment: Appointment) => void; setSelectedDate: (date: string) => void }) {
  return <section className="panel week-calendar"><div className="week-head"><div className="week-time-space" />{weekDays.map((day) => <button key={day.fullDate} className={day.fullDate === today ? "week-day today" : "week-day"} onClick={() => setSelectedDate(day.fullDate)}><span>{day.label}</span><strong>{day.date}</strong></button>)}</div><div className="week-grid"><div className="week-time-column">{["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"].map((time) => <span key={time}>{time}</span>)}</div>{weekDays.map((day) => <div className="week-day-column" key={day.fullDate}>{appointments.filter((appointment) => appointment.date === day.fullDate).map((appointment) => <button key={appointment.id} className="week-appointment" onClick={() => onAppointment(appointment)}><b>{appointment.time}</b><strong>{appointment.clientName}</strong><small>{appointment.service}</small><i>{appointment.employee.split(" ")[0]}</i></button>)}</div>)}</div></section>;
}

function MonthCalendar({ appointments, onAppointment, setSelectedDate }: { appointments: Appointment[]; onAppointment: (appointment: Appointment) => void; setSelectedDate: (date: string) => void }) {
  const cells: Array<{ day: string; date?: string; muted: boolean }> = [{ day: "23", muted: true }, { day: "24", muted: true }, { day: "25", muted: true }, { day: "26", muted: true }, { day: "27", muted: true }, { day: "28", muted: true }, { day: "1", muted: false }, ...weekDays.map((day) => ({ day: day.date, date: day.fullDate, muted: false })), { day: "23", muted: false }, { day: "24", muted: false }, { day: "25", muted: false }, { day: "26", muted: false }, { day: "27", muted: false }, { day: "28", muted: false }, { day: "29", muted: false }, { day: "30", muted: false }, { day: "31", muted: false }, { day: "1", muted: true }, { day: "2", muted: true }, { day: "3", muted: true }, { day: "4", muted: true }, { day: "5", muted: true }];
  return <section className="panel month-calendar"><div className="month-weekdays">{["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"].map((day) => <span key={day}>{day}</span>)}</div><div className="month-grid">{cells.map((cell, index) => { const dayAppointments = cell.date ? appointments.filter((appointment) => appointment.date === cell.date) : []; return <button key={`${cell.day}-${index}`} className={`month-cell ${cell.muted ? "muted" : ""} ${cell.date === today ? "current" : ""}`} onClick={() => cell.date && setSelectedDate(cell.date)}><span className="month-number">{cell.day}</span>{dayAppointments.slice(0, 3).map((appointment) => <span key={appointment.id} className="month-event" onClick={(event) => { event.stopPropagation(); onAppointment(appointment); }}><i />{appointment.time} {appointment.clientName.split(" ")[0]}</span>)}{dayAppointments.length > 3 && <em>+{dayAppointments.length - 3} mais</em>}</button>; })}</div></section>;
}

function NewAppointmentModal({ clients, services, employees, defaultDate, onClose, onSave }: { clients: Client[]; services: Service[]; employees: Employee[]; defaultDate: string; onClose: () => void; onSave: (draft: AppointmentDraft) => void }) {
  const defaultService = services.find((service) => service.active) ?? services[0];
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [serviceId, setServiceId] = useState(defaultService?.id ?? "");
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("18:00");
  const [duration, setDuration] = useState(defaultService?.duration ?? 45);
  const [total, setTotal] = useState(defaultService?.price ?? 0);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<AppointmentStatus>("Confirmado");
  const handleServiceChange = (value: string) => { const service = services.find((item) => item.id === value); setServiceId(value); if (service) { setDuration(service.duration); setTotal(service.price); } };
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); onSave({ clientId, serviceId, employeeId, date, time, duration: Number(duration), total: Number(total), notes, status }); };
  return <Modal title="Novo agendamento" eyebrow="Agendamento rápido" onClose={onClose} wide><form onSubmit={submit}><div className="modal-form-grid"><Field label="Cliente"><SelectField value={clientId} onChange={(event) => setClientId(event.target.value)} required>{clients.map((client) => <option key={client.id} value={client.id}>{client.name} · {client.phone}</option>)}</SelectField></Field><Field label="Serviço"><SelectField value={serviceId} onChange={(event) => handleServiceChange(event.target.value)} required>{services.filter((service) => service.active).map((service) => <option key={service.id} value={service.id}>{service.name} · {formatCurrency(service.price)}</option>)}</SelectField></Field><Field label="Profissional"><SelectField value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} required>{employees.filter((employee) => employee.active).map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</SelectField></Field><Field label="Data"><input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></Field><Field label="Horário"><input className="input" type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></Field><Field label="Duração" hint="Preenchida pelo serviço, mas você pode ajustar"><div className="input-with-suffix"><input className="input" type="number" min="5" step="5" value={duration} onChange={(event) => setDuration(Number(event.target.value))} required /><span>min</span></div></Field><Field label="Valor"><div className="input-with-prefix"><span>R$</span><input className="input" type="number" min="0" step="1" value={total} onChange={(event) => setTotal(Number(event.target.value))} required /></div></Field><Field label="Status inicial"><SelectField value={status} onChange={(event) => setStatus(event.target.value as AppointmentStatus)}><option value="Agendado">Agendado</option><option value="Confirmado">Confirmado</option></SelectField></Field><Field label="Observações"><textarea className="input textarea" placeholder="Alguma informação importante?" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field></div><div className="modal-footer"><span className="form-note"><ShieldCheck size={14} /> A disponibilidade será verificada automaticamente</span><div className="modal-actions"><Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit"><Check size={16} /> Confirmar agendamento</Button></div></div></form></Modal>;
}

function AddClientModal({ onClose, onSave }: { onClose: () => void; onSave: (client: { name: string; phone: string; email: string }) => void }) {
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [email, setEmail] = useState("");
  return <Modal title="Novo cliente" eyebrow="Adicionar à sua base" onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); onSave({ name, phone, email }); }}><div className="modal-form-grid single"><Field label="Nome completo"><input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Fernanda Almeida" required /></Field><Field label="Telefone"><input className="input" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(11) 99999-9999" required /></Field><Field label="E-mail (opcional)"><input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="cliente@email.com" /></Field></div><div className="modal-footer"><span className="form-note"><ShieldCheck size={14} /> Os dados ficam protegidos na sua empresa</span><div className="modal-actions"><Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit"><UserPlus size={16} /> Cadastrar cliente</Button></div></div></form></Modal>;
}

function AddServiceModal({ onClose, onSave }: { onClose: () => void; onSave: (service: { name: string; category: string; price: number; duration: number; description: string }) => void }) {
  const [name, setName] = useState(""); const [category, setCategory] = useState("Serviços"); const [price, setPrice] = useState(0); const [duration, setDuration] = useState(45); const [description, setDescription] = useState("");
  return <Modal title="Novo serviço" eyebrow="Expanda seu catálogo" onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); onSave({ name, category, price, duration, description }); }}><div className="modal-form-grid"><Field label="Nome do serviço"><input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Consulta inicial" required /></Field><Field label="Categoria"><input className="input" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Ex.: Consultas" required /></Field><Field label="Valor"><div className="input-with-prefix"><span>R$</span><input className="input" type="number" min="0" value={price} onChange={(event) => setPrice(Number(event.target.value))} required /></div></Field><Field label="Duração"><div className="input-with-suffix"><input className="input" type="number" min="5" step="5" value={duration} onChange={(event) => setDuration(Number(event.target.value))} required /><span>min</span></div></Field><Field label="Descrição"><textarea className="input textarea" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Uma breve descrição para sua equipe." /></Field></div><div className="modal-footer"><span className="form-note"><Tag size={14} /> Você poderá editar depois</span><div className="modal-actions"><Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit"><Plus size={16} /> Criar serviço</Button></div></div></form></Modal>;
}

function BlockModal({ defaultDate, team, onClose, onSave }: { defaultDate: string; team: Employee[]; onClose: () => void; onSave: (block: Omit<Block, "id">) => void }) {
  const [date, setDate] = useState(defaultDate); const [start, setStart] = useState("13:00"); const [end, setEnd] = useState("14:00"); const [employeeId, setEmployeeId] = useState("all"); const [reason, setReason] = useState("Intervalo");
  return <Modal title="Bloquear horário" eyebrow="Reserve um período da agenda" onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); onSave({ date, start, end, reason, employeeId }); }}><div className="modal-form-grid"><Field label="Data"><input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></Field><Field label="Profissional"><SelectField value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}><option value="all">Todos os profissionais</option>{team.map((employee) => <option value={employee.id} key={employee.id}>{employee.name}</option>)}</SelectField></Field><Field label="Início"><input className="input" type="time" value={start} onChange={(event) => setStart(event.target.value)} required /></Field><Field label="Fim"><input className="input" type="time" value={end} onChange={(event) => setEnd(event.target.value)} required /></Field><Field label="Motivo"><input className="input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ex.: almoço, feriado..." required /></Field></div><div className="modal-footer"><span className="form-note"><CircleAlert size={14} /> Novos atendimentos não poderão ocupar este período</span><div className="modal-actions"><Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit"><Clock3 size={16} /> Bloquear horário</Button></div></div></form></Modal>;
}

function AppointmentDetail({ appointment, onClose, onStatus, onFinish }: { appointment: Appointment; onClose: () => void; onStatus: (status: AppointmentStatus) => void; onFinish: () => void }) {
  return <Modal title="Detalhes do atendimento" eyebrow={`${shortDate(appointment.date)} · ${appointment.time}`} onClose={onClose}><div className="detail-person"><Avatar initials={appointment.clientInitials} color={appointment.clientColor} size="lg" /><div><h3>{appointment.clientName}</h3><p>{appointment.phone}</p></div><StatusBadge status={appointment.status} /></div><div className="detail-grid"><div><span>Serviço</span><strong>{appointment.service}</strong></div><div><span>Profissional</span><strong>{appointment.employee}</strong></div><div><span>Horário</span><strong>{appointment.time} – {appointment.endTime}</strong></div><div><span>Duração</span><strong>{appointment.duration} minutos</strong></div><div><span>Valor</span><strong>{formatCurrency(appointment.total)}</strong></div><div><span>Pagamento</span><strong>{appointment.status === "Finalizado" ? "Confirmado" : "Pendente"}</strong></div></div>{appointment.notes && <div className="detail-note"><FileText size={15} /><span>{appointment.notes}</span></div>}<div className="detail-actions"><a className="whatsapp-button" href={`https://wa.me/55${appointment.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Abrir WhatsApp</a><SelectField value={appointment.status} onChange={(event) => onStatus(event.target.value as AppointmentStatus)} aria-label="Atualizar status">{statusOptions.map((status) => <option value={status} key={status}>{status}</option>)}</SelectField></div><div className="modal-footer detail-footer"><Button variant="ghost" onClick={onClose}>Fechar</Button>{appointment.status !== "Finalizado" && appointment.status !== "Cancelado" && <Button onClick={onFinish}><CheckCircle2 size={16} /> Finalizar atendimento</Button>}</div></Modal>;
}

function FinishModal({ appointment, onClose, onFinish }: { appointment: Appointment; onClose: () => void; onFinish: (amount: number, method: string) => void }) {
  const [amount, setAmount] = useState(appointment.total); const [method, setMethod] = useState("PIX");
  return <Modal title="Finalizar atendimento" eyebrow="Registrar recebimento" onClose={onClose}><div className="finish-summary"><Avatar initials={appointment.clientInitials} color={appointment.clientColor} /><div><strong>{appointment.clientName}</strong><span>{appointment.service} · {appointment.employee}</span></div></div><div className="finish-value"><span>Valor original</span><strong>{formatCurrency(appointment.total)}</strong></div><div className="modal-form-grid single"><Field label="Valor recebido"><div className="input-with-prefix"><span>R$</span><input className="input" type="number" min="0" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></div></Field><Field label="Forma de pagamento"><SelectField value={method} onChange={(event) => setMethod(event.target.value)}><option>PIX</option><option>Dinheiro</option><option>Débito</option><option>Crédito</option><option>Outro</option></SelectField></Field></div><div className="modal-footer"><span className="form-note"><ReceiptText size={14} /> Receita contabilizada no financeiro</span><div className="modal-actions"><Button variant="ghost" onClick={onClose}>Voltar</Button><Button onClick={() => onFinish(amount, method)}><CheckCheck size={16} /> Finalizar e receber</Button></div></div></Modal>;
}

function ClientsPage({ clients, onNew, onSelect }: { clients: Client[]; onNew: () => void; onSelect: (client: Client) => void }) {
  const [query, setQuery] = useState("");
  const filtered = clients.filter((client) => `${client.name} ${client.phone} ${client.email}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="page-content"><div className="page-intro"><div><p className="eyebrow">Base de relacionamento</p><h1>Clientes</h1><p className="intro-copy">{clients.length} pessoas já fazem parte da sua história.</p></div><Button onClick={onNew}><UserPlus size={17} /> Novo cliente</Button></div><div className="client-insight-row"><div className="mini-insight"><span className="mini-insight-icon"><Users size={17} /></span><div><strong>{clients.length}</strong><span>clientes ativos</span></div></div><div className="mini-insight"><span className="mini-insight-icon purple"><TrendingUp size={17} /></span><div><strong>{formatCurrency(clients.reduce((sum, client) => sum + client.spent, 0))}</strong><span>valor total da base</span></div></div><div className="mini-insight"><span className="mini-insight-icon orange"><CalendarDays size={17} /></span><div><strong>4</strong><span>aniversários este mês</span></div></div></div><section className="panel clients-panel"><div className="panel-toolbar"><div><h2>Todos os clientes</h2><p>Pesquise por nome, telefone ou e-mail</p></div><div className="table-tools"><div className="search-box small"><Search size={16} /><input placeholder="Buscar cliente..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><IconButton label="Filtrar clientes"><SlidersHorizontal size={17} /></IconButton></div></div>{filtered.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Cliente</th><th>Contato</th><th>Último atendimento</th><th>Atendimentos</th><th>Total gasto</th><th /></tr></thead><tbody>{filtered.map((client) => <tr key={client.id} onClick={() => onSelect(client)}><td><div className="table-person"><Avatar initials={client.initials} color={client.color} /><strong>{client.name}</strong></div></td><td><span className="muted-text">{client.phone}</span><small>{client.email}</small></td><td>{client.lastVisit}</td><td><span className="visit-count">{client.visits}</span></td><td><strong>{formatCurrency(client.spent)}</strong></td><td><IconButton label={`Abrir ${client.name}`}><ChevronRight size={17} /></IconButton></td></tr>)}</tbody></table></div> : <EmptyState icon={Users} title="Nenhum cliente encontrado" description="Tente buscar por outro nome ou cadastre uma nova pessoa." action={<Button onClick={onNew}><UserPlus size={16} /> Novo cliente</Button>} />}</section></div>;
}

function ClientProfile({ client, onClose, onNewAppointment }: { client: Client; onClose: () => void; onNewAppointment: () => void }) {
  return <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="profile-drawer"><div className="drawer-header"><span className="eyebrow">Perfil do cliente</span><IconButton label="Fechar perfil" onClick={onClose}><X size={19} /></IconButton></div><div className="profile-hero"><Avatar initials={client.initials} color={client.color} size="lg" /><h2>{client.name}</h2><p>Cliente desde 12 jan 2025</p><div className="profile-actions"><a className="whatsapp-button" href={`https://wa.me/55${client.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp</a><Button onClick={onNewAppointment}><CalendarPlus size={15} /> Agendar</Button></div></div><div className="profile-contact"><div><Phone size={15} /><span>{client.phone}</span></div><div><Mail size={15} /><span>{client.email}</span></div></div><div className="profile-stats"><div><strong>{client.spent.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</strong><span>Total gasto</span></div><div><strong>{client.visits}</strong><span>Atendimentos</span></div><div><strong>{client.lastVisit.split(" ")[0]}</strong><span>Última visita</span></div></div><section className="profile-section"><SectionHeading title="Histórico de atendimentos" action={<button className="link-button">Ver tudo <ArrowRight size={14} /></button>} /><div className="history-list"><div><span className="history-date">12<br /><small>mar</small></span><div><strong>Corte + Barba</strong><span>João Mendes · 60 min</span></div><b>{formatCurrency(65)}</b></div><div><span className="history-date">03<br /><small>mar</small></span><div><strong>Corte</strong><span>João Mendes · 45 min</span></div><b>{formatCurrency(50)}</b></div><div><span className="history-date">18<br /><small>fev</small></span><div><strong>Barba</strong><span>Pedro Alves · 30 min</span></div><b>{formatCurrency(35)}</b></div></div></section><section className="profile-section"><SectionHeading title="Observações" /><div className="profile-note"><Pencil size={14} /><span>{client.notes ?? "Nenhuma observação adicionada."}</span></div></section></aside></div>;
}

function ServicesPage({ services, onNew, onToggle }: { services: Service[]; onNew: () => void; onToggle: (id: string) => void }) {
  const categories = ["Todos", ...Array.from(new Set(services.map((service) => service.category)))];
  const [category, setCategory] = useState("Todos");
  const visible = category === "Todos" ? services : services.filter((service) => service.category === category);
  return <div className="page-content"><div className="page-intro"><div><p className="eyebrow">Catálogo de serviços</p><h1>Serviços</h1><p className="intro-copy">Crie experiências claras para seus clientes e sua equipe.</p></div><Button onClick={onNew}><Plus size={17} /> Novo serviço</Button></div><div className="category-tabs">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="service-grid">{visible.map((service) => <article className={`service-card ${!service.active ? "inactive" : ""}`} key={service.id}><div className="service-card-head"><span className="service-color" style={{ backgroundColor: service.color }}><Tag size={17} /></span><button className="more-button"><MoreHorizontal size={18} /></button></div><div className="service-card-body"><div className="service-title-row"><h3>{service.name}</h3>{service.combo && <span className="combo-pill">Combo</span>}</div><span className="service-category">{service.category}</span><p>{service.description}</p></div><div className="service-card-footer"><div><strong>{formatCurrency(service.price)}</strong><span><Clock3 size={13} /> {service.duration} min</span></div><label className="toggle"><input type="checkbox" checked={service.active} onChange={() => onToggle(service.id)} /><span /></label></div></article>)}<button className="add-service-card" onClick={onNew}><span><Plus size={19} /></span><strong>Criar novo serviço</strong><small>Adicione preço, duração e categoria</small></button></div><div className="tip-banner"><Sparkles size={18} /><div><strong>Dica para seu catálogo</strong><span>Combos aumentam o ticket médio. Crie uma experiência completa com preço especial.</span></div><ArrowRight size={17} /></div></div>;
}

function TeamPage({ team, onNew }: { team: Employee[]; onNew: () => void }) {
  return <div className="page-content"><div className="page-intro"><div><p className="eyebrow">Pessoas e permissões</p><h1>Equipe</h1><p className="intro-copy">4 profissionais ativos no Studio Prime.</p></div><Button onClick={onNew}><UserPlus size={17} /> Adicionar profissional</Button></div><div className="team-summary"><div><span className="team-summary-icon"><Users size={17} /></span><strong>4</strong><small>profissionais ativos</small></div><div><span className="team-summary-icon yellow"><Clock3 size={17} /></span><strong>32h</strong><small>disponíveis hoje</small></div><div><span className="team-summary-icon purple"><ShieldCheck size={17} /></span><strong>100%</strong><small>escalas configuradas</small></div></div><section className="panel team-panel"><div className="panel-toolbar"><div><h2>Profissionais</h2><p>Serviços e desempenho de cada pessoa</p></div><div className="table-tools"><button className="filter-button"><ListFilter size={15} /> Filtrar</button></div></div><div className="team-grid">{team.map((employee) => <article className="team-card" key={employee.id}><div className="team-card-top"><Avatar initials={employee.initials} color={employee.color} size="lg" /><span className="active-dot" /><IconButton label={`Mais ações para ${employee.name}`}><MoreHorizontal size={18} /></IconButton></div><h3>{employee.name}</h3><span className="team-role">{employee.role}</span><div className="team-services">{employee.services.map((service) => <span key={service}>{service}</span>)}</div><div className="team-card-stats"><div><span>Atendimentos</span><strong>{employee.appointments}</strong></div><div><span>Faturamento</span><strong>{formatCurrency(employee.revenue)}</strong></div></div><button className="team-schedule"><Clock3 size={14} /> Ver agenda <ArrowRight size={14} /></button></article>)}</div></section></div>;
}

function FinancialPage() {
  const maxValue = Math.max(...revenueByMonth.map((item) => item.value));
  return <div className="page-content"><div className="page-intro"><div><p className="eyebrow">Visão financeira</p><h1>Financeiro</h1><p className="intro-copy">Acompanhe os resultados do seu negócio.</p></div><div className="period-select"><CalendarDays size={15} /><span>01 mar — 18 mar 2026</span><ChevronDown size={14} /></div></div><div className="metrics-grid finance-metrics"><MetricCard label="Receita hoje" value="R$ 430" detail="12% vs. ontem" icon={TrendingUp} tone="teal" trend="up" /><MetricCard label="Receita na semana" value="R$ 2.840" detail="8% vs. semana anterior" icon={WalletCards} tone="lilac" trend="up" /><MetricCard label="Receita no mês" value="R$ 11.240" detail="12% da meta mensal" icon={BarChart3} tone="amber" trend="up" /><MetricCard label="Ticket médio" value="R$ 63" detail="4% vs. mês anterior" icon={ReceiptText} tone="rose" trend="up" /></div><div className="finance-grid"><section className="panel revenue-chart"><SectionHeading title="Receita ao longo do tempo" description="Últimos 6 meses" action={<button className="filter-button">Mensal <ChevronDown size={14} /></button>} /><div className="chart-value"><strong>R$ 11.240</strong><span><ArrowUpRight size={14} /> 14,9% este mês</span></div><div className="bar-chart">{revenueByMonth.map((item) => <div className="bar-column" key={item.month}><span className="bar-value">{item.value > 10000 ? "11,2k" : item.value > 9000 ? "9,7k" : item.value > 8000 ? "8,2k" : `${Math.round(item.value / 1000)}k`}</span><div className="bar" style={{ height: `${(item.value / maxValue) * 100}%` }} /><small>{item.month}</small></div>)}</div></section><section className="panel payment-panel"><SectionHeading title="Por forma de pagamento" description="Distribuição do período" /><div className="payment-donut"><div><strong>R$ 11.240</strong><span>total recebido</span></div></div><div className="payment-legend"><div><i className="legend-teal" /><span>PIX</span><strong>58%</strong></div><div><i className="legend-purple" /><span>Crédito</span><strong>24%</strong></div><div><i className="legend-amber" /><span>Débito</span><strong>12%</strong></div><div><i className="legend-muted" /><span>Dinheiro</span><strong>6%</strong></div></div></section></div><section className="panel revenue-team-panel"><SectionHeading title="Receita por profissional" description="Desempenho no período selecionado" action={<button className="link-button">Ver relatório completo <ArrowRight size={14} /></button>} /><div className="revenue-table">{employees.slice(0, 3).map((employee, index) => <div key={employee.id}><div className="revenue-person"><span className="rank">{index + 1}</span><Avatar initials={employee.initials} color={employee.color} size="sm" /><strong>{employee.name}</strong></div><div className="revenue-bar"><span style={{ width: `${(employee.revenue / 4100) * 100}%`, backgroundColor: employee.color }} /></div><span className="revenue-visits">{employee.appointments} atendimentos</span><strong className="revenue-total">{formatCurrency(employee.revenue)}</strong></div>)}</div></section></div>;
}

function ReportsPage() {
  return <div className="page-content"><div className="page-intro"><div><p className="eyebrow">Indicadores do negócio</p><h1>Relatórios</h1><p className="intro-copy">Entenda o que está funcionando e onde crescer.</p></div><button className="period-select"><CalendarDays size={15} /><span>Este mês</span><ChevronDown size={14} /></button></div><div className="report-tabs"><button className="active">Visão geral</button><button>Atendimentos</button><button>Clientes</button><button>Cancelamentos</button></div><div className="report-grid"><section className="panel report-card-large"><SectionHeading title="Serviços mais vendidos" description="Ranking por quantidade de atendimentos" action={<button className="filter-button">30 dias <ChevronDown size={14} /></button>} /><div className="ranking-list">{popularServices.map((service, index) => <div key={service.name}><span className="ranking-position">{String(index + 1).padStart(2, "0")}</span><span className="ranking-color" style={{ backgroundColor: service.color }} /><div className="ranking-copy"><strong>{service.name}</strong><span>{service.count} atendimentos</span></div><div className="ranking-track"><span style={{ width: `${(service.count / popularServices[0].count) * 100}%`, backgroundColor: service.color }} /></div><strong className="ranking-count">{service.count}</strong></div>)}</div></section><section className="panel report-card-large"><SectionHeading title="Clientes mais frequentes" description="Quem mais escolhe você" /><div className="frequent-list">{initialClients.slice(0, 4).map((client, index) => <div key={client.id}><span className="ranking-position">{index + 1}</span><Avatar initials={client.initials} color={client.color} size="sm" /><div className="ranking-copy"><strong>{client.name}</strong><span>Última visita: {client.lastVisit}</span></div><div className="frequent-total"><strong>{client.visits}</strong><span>visitas</span></div><ArrowRight size={15} /></div>)}</div></section></div><div className="report-metric-grid"><MetricCard label="Taxa de retorno" value="74%" detail="6% vs. mês anterior" icon={TrendingUp} tone="teal" trend="up" /><MetricCard label="Cancelamentos" value="3,2%" detail="1,1% melhor que antes" icon={XCircle} tone="rose" trend="up" /><MetricCard label="Novos clientes" value="18" detail="Neste mês" icon={UserPlus} tone="lilac" /></div></div>;
}

function SettingsPage({ theme, setTheme }: { theme: Theme; setTheme: (theme: Theme) => void }) {
  const [saved, setSaved] = useState(false);
  return <div className="page-content settings-page"><div className="page-intro"><div><p className="eyebrow">Preferências do espaço</p><h1>Configurações</h1><p className="intro-copy">Personalize a experiência do Studio Prime.</p></div><Button onClick={() => { setSaved(true); window.setTimeout(() => setSaved(false), 2500); }}>{saved ? <><Check size={16} /> Salvo</> : <><CheckCheck size={16} /> Salvar alterações</>}</Button></div><div className="settings-layout"><aside className="settings-nav"><button className="active"><Settings2 size={16} /> Empresa</button><button><Sparkles size={16} /> Identidade visual</button><button><Clock3 size={16} /> Funcionamento</button><button><Bell size={16} /> Notificações</button><button><ShieldCheck size={16} /> Acesso e segurança</button></aside><div className="settings-sections"><section className="settings-section"><SectionHeading title="Informações da empresa" description="Esses dados aparecem nos seus agendamentos e comunicações." /><div className="settings-form"><Field label="Nome da empresa"><input className="input" defaultValue="Studio Prime" /></Field><Field label="Telefone"><input className="input" defaultValue="(11) 3042-1980" /></Field><Field label="WhatsApp"><input className="input" defaultValue="(11) 99842-1200" /></Field><Field label="E-mail"><input className="input" defaultValue="ola@studioprime.com.br" /></Field><Field label="Endereço"><div className="input-with-icon"><MapPin size={16} /><input className="input" defaultValue="Rua Harmonia, 284 · Vila Madalena, São Paulo" /></div></Field><Field label="Instagram"><div className="input-with-icon"><span className="at-symbol">@</span><input className="input" defaultValue="studioprime" /></div></Field></div></section><section className="settings-section"><SectionHeading title="Identidade visual" description="Escolha como sua marca aparece na Agenda." /><div className="identity-row"><div className="company-logo-preview"><Sparkles size={24} /><span>SP</span></div><div><strong>Logo do Studio Prime</strong><p>PNG ou JPG · até 2 MB</p><button className="link-button">Alterar logo <ArrowRight size={14} /></button></div></div><div className="color-setting"><div><strong>Cor principal</strong><span>Usada em botões e destaques</span></div><div className="color-choice"><span className="color-swatch" /><code>#1F6F66</code><ChevronDown size={14} /></div></div></section><section className="settings-section"><SectionHeading title="Aparência" description="A Agenda se adapta ao seu jeito de trabalhar." /><div className="theme-options"><button className={theme === "light" ? "theme-option active" : "theme-option"} onClick={() => setTheme("light")}><span className="theme-preview light-preview"><Sun size={17} /></span><strong>Claro</strong><small>Leve e arejado</small>{theme === "light" && <CheckCircle2 size={17} />}</button><button className={theme === "dark" ? "theme-option active" : "theme-option"} onClick={() => setTheme("dark")}><span className="theme-preview dark-preview"><Moon size={17} /></span><strong>Escuro</strong><small>Confortável à noite</small>{theme === "dark" && <CheckCircle2 size={17} />}</button></div></section><section className="settings-section schedule-settings"><SectionHeading title="Funcionamento" description="Defina os horários padrão do estabelecimento." action={<button className="link-button">Editar horários <Pencil size={13} /></button>} /><div className="schedule-list">{["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira"].map((day) => <div key={day}><strong>{day}</strong><span>09:00 — 18:00</span><em>1h de intervalo</em></div>)}<div className="closed-day"><strong>Sábado e domingo</strong><span>Fechado</span></div></div></section></div></div></div>;
}

export function AgendaApp() {
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [services, setServices] = useState<Service[]>(initialServices);
  const [team, setTeam] = useState<Employee[]>(employees);
  const [selectedDate, setSelectedDate] = useState(today);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("day");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [newAppointmentOpen, setNewAppointmentOpen] = useState(false);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newServiceOpen, setNewServiceOpen] = useState(false);
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [detailAppointment, setDetailAppointment] = useState<Appointment | null>(null);
  const [finishAppointment, setFinishAppointment] = useState<Appointment | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [globalSearch, setGlobalSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(null), 3200); };
  const navigate = (view: ViewKey) => { setActiveView(view); setMobileMenu(false); };
  const openNewAppointment = () => { setNewAppointmentOpen(true); };

  const saveAppointment = (draft: AppointmentDraft) => {
    const client = clients.find((item) => item.id === draft.clientId);
    const service = services.find((item) => item.id === draft.serviceId);
    const employee = employees.find((item) => item.id === draft.employeeId);
    if (!client || !service || !employee || draft.duration <= 0 || draft.total < 0) { notify("Revise os campos obrigatórios do atendimento."); return; }
    const start = timeToMinutes(draft.time); const end = start + draft.duration;
    const conflict = appointments.some((item) => item.date === draft.date && item.employeeId === draft.employeeId && item.status !== "Cancelado" && start < timeToMinutes(item.endTime) && end > timeToMinutes(item.time));
    const blocked = blocks.some((block) => block.date === draft.date && (block.employeeId === "all" || block.employeeId === draft.employeeId) && start < timeToMinutes(block.end) && end > timeToMinutes(block.start));
    if (conflict) { notify("Este profissional já possui um atendimento nesse horário."); return; }
    if (blocked) { notify("Esse horário está bloqueado na agenda."); return; }
    const appointment: Appointment = { id: `new-${Date.now()}`, date: draft.date, time: draft.time, endTime: minutesToTime(end), duration: draft.duration, clientId: client.id, clientName: client.name, clientInitials: client.initials, clientColor: client.color, phone: client.phone, service: service.name, serviceId: service.id, employeeId: employee.id, employee: employee.name, employeeInitials: employee.initials, total: draft.total, status: draft.status, notes: draft.notes };
    setAppointments((current) => [...current, appointment]); setNewAppointmentOpen(false); setSelectedDate(draft.date); notify("Agendamento criado com sucesso.");
  };

  const saveClient = (data: { name: string; phone: string; email: string }) => { const client: Client = { id: `client-${Date.now()}`, name: data.name, phone: data.phone, email: data.email || "Não informado", initials: initialsFromName(data.name), color: "#dce9e3", visits: 0, spent: 0, lastVisit: "Ainda não atendido" }; setClients((current) => [client, ...current]); setNewClientOpen(false); notify("Cliente cadastrado com sucesso."); };
  const saveService = (data: { name: string; category: string; price: number; duration: number; description: string }) => { const service: Service = { id: `service-${Date.now()}`, ...data, color: "#6e8bb2", active: true }; setServices((current) => [...current, service]); setNewServiceOpen(false); notify("Serviço criado com sucesso."); };
  const saveEmployee = (data: Pick<Employee, "name" | "role" | "phone">) => { const employee: Employee = { id: `employee-${Date.now()}`, ...data, color: "#dce9e3", initials: initialsFromName(data.name), active: true, services: [], appointments: 0, revenue: 0 }; setTeam((current) => [...current, employee]); setEmployeeOpen(false); notify("Profissional adicionado com sucesso."); };
  const saveBlock = (data: Omit<Block, "id">) => { if (timeToMinutes(data.end) <= timeToMinutes(data.start)) { notify("O horário final precisa ser depois do início."); return; } setBlocks((current) => [...current, { ...data, id: `block-${Date.now()}` }]); setBlockOpen(false); notify("Horário bloqueado com sucesso."); };
  const updateStatus = (appointmentId: string, status: AppointmentStatus) => { setAppointments((current) => current.map((item) => item.id === appointmentId ? { ...item, status } : item)); setDetailAppointment((current) => current ? { ...current, status } : current); notify(`Atendimento marcado como ${status.toLowerCase()}.`); };
  const completeAppointment = (amount: number) => { if (!finishAppointment) return; setAppointments((current) => current.map((item) => item.id === finishAppointment.id ? { ...item, status: "Finalizado", total: amount } : item)); setFinishAppointment(null); setDetailAppointment(null); notify("Atendimento finalizado e receita registrada."); };
  const toggleService = (id: string) => { setServices((current) => current.map((service) => service.id === id ? { ...service, active: !service.active } : service)); notify("Status do serviço atualizado."); };

  const searchResults = useMemo(() => { if (!globalSearch.trim()) return []; const query = globalSearch.toLowerCase(); return [...clients.filter((item) => item.name.toLowerCase().includes(query)).slice(0, 3).map((item) => ({ type: "Cliente", label: item.name, icon: Users })), ...services.filter((item) => item.name.toLowerCase().includes(query)).slice(0, 2).map((item) => ({ type: "Serviço", label: item.name, icon: Tag }))]; }, [globalSearch, clients, services]);

  const renderPage = () => {
    if (activeView === "dashboard") return <Dashboard appointments={appointments} onNew={openNewAppointment} onAppointment={setDetailAppointment} />;
    if (activeView === "agenda") return <CalendarPage appointments={appointments} team={team} selectedDate={selectedDate} setSelectedDate={setSelectedDate} mode={calendarMode} setMode={setCalendarMode} employeeFilter={employeeFilter} setEmployeeFilter={setEmployeeFilter} onAppointment={setDetailAppointment} onNew={openNewAppointment} onBlock={() => setBlockOpen(true)} />;
    if (activeView === "clientes") return <ClientsPage clients={clients} onNew={() => setNewClientOpen(true)} onSelect={setSelectedClient} />;
    if (activeView === "servicos") return <ServicesPage services={services} onNew={() => setNewServiceOpen(true)} onToggle={toggleService} />;
    if (activeView === "equipe") return <TeamPage team={team} onNew={() => setEmployeeOpen(true)} />;
    if (activeView === "financeiro") return <FinancialPage />;
    if (activeView === "relatorios") return <ReportsPage />;
    return <SettingsPage theme={theme} setTheme={setTheme} />;
  };

  return <div className="app-shell"><aside className={`sidebar ${sidebarExpanded ? "" : "sidebar-collapsed"} ${mobileMenu ? "mobile-open" : ""}`}><div className="sidebar-top"><Logo collapsed={!sidebarExpanded} /><IconButton label={sidebarExpanded ? "Recolher menu" : "Expandir menu"} className="collapse-button" onClick={() => setSidebarExpanded((value) => !value)}>{sidebarExpanded ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}</IconButton></div><div className="workspace-switcher"><span className="workspace-logo">SP</span>{sidebarExpanded && <><div><strong>Studio Prime</strong><small>Unidade principal</small></div><ChevronDown size={15} /></>}</div><nav className="sidebar-nav">{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={activeView === id ? "active" : ""} onClick={() => navigate(id)}><Icon size={18} /><span>{label}</span>{id === "agenda" && sidebarExpanded && <em>8</em>}</button>)}</nav><div className="sidebar-bottom">{sidebarExpanded && <div className="sidebar-help"><CircleHelp size={17} /><div><strong>Precisa de ajuda?</strong><span>Fale com nosso time</span></div><ArrowUpRight size={14} /></div>}<button className="profile-nav" onClick={() => navigate("configuracoes")}><span className="profile-avatar">CA</span>{sidebarExpanded && <span><strong>Camila Almeida</strong><small>Proprietária</small></span>}<MoreHorizontal size={17} /></button><button className="logout-button" onClick={() => notify("Até logo, Camila!")}><LogOut size={17} /><span>{sidebarExpanded ? "Sair da conta" : "Sair"}</span></button></div></aside><main className={`main-content ${sidebarExpanded ? "" : "main-expanded"}`}><header className="topbar"><div className="topbar-left"><IconButton label="Abrir menu" className="mobile-menu-button" onClick={() => setMobileMenu((value) => !value)}><Menu size={20} /></IconButton><div className="breadcrumb"><span>Studio Prime</span><ChevronRight size={14} /><strong>{pageTitles[activeView].title}</strong></div></div><div className="topbar-actions"><div className="global-search"><Search size={17} /><input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Buscar na Agenda" /><kbd><Command size={12} /> K</kbd>{globalSearch && <button className="clear-search" onClick={() => setGlobalSearch("")}><X size={14} /></button>}{globalSearch && <div className="search-results">{searchResults.length ? searchResults.map((result) => <button key={`${result.type}-${result.label}`} onClick={() => { setGlobalSearch(""); if (result.type === "Cliente") navigate("clientes"); else navigate("servicos"); }}><result.icon size={15} /><span>{result.label}</span><small>{result.type}</small></button>) : <span className="no-results">Nenhum resultado encontrado</span>}</div>}</div><IconButton label="Alternar tema" onClick={() => setTheme(theme === "light" ? "dark" : "light")} className="theme-button">{theme === "light" ? <Moon size={18} /> : <Sun size={18} />}</IconButton><button className="notification-button" aria-label="Notificações" onClick={() => notify("Você não tem novas notificações.")}><Bell size={18} /><i /></button><span className="topbar-avatar">CA</span></div></header><div className="mobile-page-title"><div><span>Studio Prime</span><h2>{pageTitles[activeView].title}</h2></div><IconButton label="Notificações" onClick={() => notify("Você não tem novas notificações.")}><Bell size={18} /></IconButton></div>{renderPage()}</main><nav className="mobile-bottom-nav">{navItems.slice(0, 5).map(({ id, label, icon: Icon }) => <button key={id} className={activeView === id ? "active" : ""} onClick={() => navigate(id)}><Icon size={19} /><span>{label}</span></button>)}<button className="mobile-add-button" onClick={openNewAppointment}><Plus size={21} /></button></nav><button className="floating-add" onClick={openNewAppointment} aria-label="Novo agendamento"><Plus size={23} /></button>{newAppointmentOpen && <NewAppointmentModal clients={clients} services={services} employees={team} defaultDate={selectedDate} onClose={() => setNewAppointmentOpen(false)} onSave={saveAppointment} />}{newClientOpen && <AddClientModal onClose={() => setNewClientOpen(false)} onSave={saveClient} />}{newServiceOpen && <AddServiceModal onClose={() => setNewServiceOpen(false)} onSave={saveService} />}{employeeOpen && <AddEmployeeModal onClose={() => setEmployeeOpen(false)} onSave={saveEmployee} />}{blockOpen && <BlockModal defaultDate={selectedDate} team={team} onClose={() => setBlockOpen(false)} onSave={saveBlock} />}{detailAppointment && <AppointmentDetail appointment={detailAppointment} onClose={() => setDetailAppointment(null)} onStatus={(status) => updateStatus(detailAppointment.id, status)} onFinish={() => { setFinishAppointment(detailAppointment); }} />}{finishAppointment && <FinishModal appointment={finishAppointment} onClose={() => setFinishAppointment(null)} onFinish={(amount) => completeAppointment(amount)} />}{selectedClient && <ClientProfile client={selectedClient} onClose={() => setSelectedClient(null)} onNewAppointment={() => { setSelectedClient(null); setNewAppointmentOpen(true); }} />}{toast && <div className="toast"><CheckCircle2 size={17} /><span>{toast}</span><button onClick={() => setToast(null)}><X size={14} /></button></div>}</div>;
}
