"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight, ArrowUpDown, Ban, BarChart3, Bell, Building2, CalendarDays, CalendarPlus,
  Check, CheckCheck, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, CircleDollarSign, CircleHelp,
  Clock, Clock3, FileText, Globe, Home, LogOut, Mail, MapPin,
  Menu, MessageCircle, Moon, MoreHorizontal, Pencil, Phone, Plus, ReceiptText, Search,
  Settings2, ShieldCheck, Sparkles, Star, Sun, Tag, TrendingUp, UserPlus,
  UserRound, Users, WalletCards, X, XCircle, Zap,
} from "lucide-react";
import { useStore, type Toast } from "@/store/store";
import { api, ApiError, formatPhoneForWhatsApp } from "@/lib/api-client";
import { avatarColor, formatCurrency, initials, PAYMENT_LABELS, roleLabel, STATUS_LABELS } from "@/lib/client-utils";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/theme";
import type {
  AppointmentDTO, AppointmentStatus, ClientDTO, EmployeeDTO, PaymentMethod, ScheduleBlockDTO,
  SearchResultDTO, ServiceCategoryDTO, ServiceDTO, SuperadminStatsDTO,
} from "@/shared/types";
import { NovaeLogo } from "@/components/brand/novae-logo";

type ViewKey = "dashboard" | "agenda" | "clientes" | "servicos" | "equipe" | "financeiro" | "configuracoes";
type CalendarMode = "day" | "week" | "month";

const navItems: Array<{ id: ViewKey; label: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Início", icon: Home },
  { id: "agenda", label: "Agenda", icon: CalendarDays },
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "servicos", label: "Serviços", icon: Tag },
  { id: "equipe", label: "Equipe", icon: UserRound },
  { id: "financeiro", label: "Financeiro", icon: WalletCards },
  { id: "configuracoes", label: "Configurações", icon: Settings2 },
];

const pageTitles: Record<ViewKey, { title: string; eyebrow: string }> = {
  dashboard: { title: "Visão geral", eyebrow: "Acompanhe o dia de hoje" },
  agenda: { title: "Agenda", eyebrow: "Organize seus atendimentos" },
  clientes: { title: "Clientes", eyebrow: "Relacionamentos que fazem seu negócio crescer" },
  servicos: { title: "Serviços", eyebrow: "Catálogo e preços do estabelecimento" },
  equipe: { title: "Equipe", eyebrow: "Profissionais e disponibilidade" },
  financeiro: { title: "Financeiro", eyebrow: "Acompanhe a saúde do seu negócio" },
  configuracoes: { title: "Configurações", eyebrow: "Deixe a Agenda com a sua cara" },
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
function normalizeTime(time: string): string {
  return time.length > 5 ? time.slice(0, 5) : time;
}

const statusClass: Record<AppointmentStatus, string> = {
  scheduled: "status-scheduled",
  confirmed: "status-confirmed",
  waiting: "status-waiting",
  in_progress: "status-progress",
  completed: "status-finished",
  cancelled: "status-cancelled",
  no_show: "status-cancelled",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateLabel(date: string): string {
  return dateFormatter.format(new Date(`${date}T12:00:00`));
}
function shortDate(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${date}T12:00:00`));
}

/* ---------- Small UI primitives ---------- */
function Avatar({
  name,
  photoUrl,
  color,
  size = "md",
  className = "",
}: {
  name: string;
  photoUrl?: string | null;
  color?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const [error, setError] = useState(false);
  const bg = color || avatarColor(name);
  const hasPhoto = Boolean(photoUrl) && !error;

  return (
    <span
      key={photoUrl ?? name}
      className={`avatar avatar-${size} ${hasPhoto ? "avatar--photo" : ""} ${className}`}
      style={{ backgroundColor: hasPhoto ? "transparent" : bg }}
      title={name}
    >
      {hasPhoto ? (
        <img
          src={photoUrl!}
          alt={name}
          onError={() => setError(true)}
          className="avatar-img"
          loading="lazy"
        />
      ) : (
        <span className="avatar-initials">{initials(name)}</span>
      )}
    </span>
  );
}
function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className={`brand-lockup ${collapsed ? "brand-lockup--collapsed" : ""}`}>
      {collapsed ? (
        <NovaeLogo variant="symbol" size={28} />
      ) : (
        <NovaeLogo variant="full" size={28} />
      )}
    </div>
  );
}
function Button({ variant = "primary", className = "", children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return <button className={`button button-${variant} ${className}`} {...props}>{children}</button>;
}
function IconButton({ label, children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button className={`icon-button ${className}`} aria-label={label} title={label} {...props}>{children}</button>;
}
function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <span className={`status-badge ${statusClass[status]}`}><span className="status-dot" />{STATUS_LABELS[status]}</span>;
}
function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint && <span className="field-hint">{hint}</span>}</label>;
}
function SelectField(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="input select-input" {...props} />;
}
function SectionHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="section-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>;
}
function Modal({
  title,
  eyebrow,
  onClose,
  children,
  wide = false,
  headerVariant = "default",
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  headerVariant?: "default" | "primary";
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className={`modal ${wide ? "modal-wide" : ""} ${headerVariant === "primary" ? "modal-has-primary-header" : ""}`} role="dialog" aria-modal="true">
        <div className={`modal-header ${headerVariant === "primary" ? "modal-header-primary" : ""}`}>
          <div>
            {eyebrow && <p className="modal-eyebrow">{eyebrow}</p>}
            <h2>{title}</h2>
          </div>
          <IconButton label="Fechar" onClick={onClose}><X size={19} /></IconButton>
        </div>
        {children}
      </section>
    </div>
  );
}
function EmptyState({ icon: Icon = CalendarDays, title, description, action }: { icon?: LucideIcon; title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={22} /></span><h3>{title}</h3><p>{description}</p>{action}</div>;
}
function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return <div className="toast-stack">{toasts.map((toast) => <div key={toast.id} className={`toast ${toast.tone === "error" ? "toast-error" : ""}`}>{toast.tone === "error" ? <XCircle size={17} /> : <CheckCircle size={17} />}<span>{toast.message}</span><button onClick={() => onDismiss(toast.id)}><X size={14} /></button></div>)}</div>;
}

/* ---------- Pages ---------- */
function DashboardPage({ onNew, onAppointment, onGoToAgenda }: { onNew: () => void; onAppointment: (apt: AppointmentDTO) => void; onGoToAgenda: () => void }) {
  const { stats, appointments, services, clients } = useStore();
  const today = todayKey();
  const todayApts = appointments.filter((apt) => apt.date === today).filter((apt) => !["cancelled", "no_show"].includes(apt.status));
  const pending = todayApts.filter((apt) => apt.status !== "completed");
  const next = pending[0];
  const realized = stats?.today.realized ?? 0;
  const forecast = stats?.today.forecast ?? 0;

  return (
    <div className="page-content dashboard-page">
      <div className="page-intro"><div><p className="eyebrow">{pageTitles.dashboard.eyebrow}</p><h1>Olá! Aqui está seu dia</h1><p className="intro-copy">Acompanhe os atendimentos e a receita do seu estabelecimento hoje.</p></div><Button onClick={onNew}><Plus size={17} /> Novo agendamento</Button></div>

      <div className="metrics-grid">
        <div className="metric-card"><div className="metric-icon metric-teal"><CalendarDays size={18} /></div><div className="metric-copy"><p>Atendimentos hoje</p><strong>{stats?.today.appointments ?? 0}</strong><span className="metric-detail">agendados para hoje</span></div></div>
        <div className="metric-card"><div className="metric-icon metric-lilac"><TrendingUp size={18} /></div><div className="metric-copy"><p>Receita prevista</p><strong>{formatCurrency(forecast)}</strong><span className="metric-detail">para hoje</span></div></div>
        <div className="metric-card"><div className="metric-icon metric-amber"><WalletCards size={18} /></div><div className="metric-copy"><p>Receita realizada</p><strong>{formatCurrency(realized)}</strong><span className="metric-detail">já recebida hoje</span></div></div>
        <div className="metric-card"><div className="metric-icon metric-rose"><Users size={18} /></div><div className="metric-copy"><p>Clientes atendidos</p><strong>{stats?.today.clientsServed ?? 0}</strong><span className="metric-detail">finalizados hoje</span></div></div>
      </div>

      <div className="dashboard-grid">
        <section className="panel next-panel">
          <SectionHeading title="Próximo atendimento" action={next ? <button className="link-button" onClick={() => onAppointment(next)}>Ver detalhes <ArrowRight size={14} /></button> : undefined} />
          {next ? (
            <div className="next-appointment" onClick={() => onAppointment(next)}>
              <div className="next-time">
                <span className="next-time-badge">Próximo</span>
                <strong>{normalizeTime(next.startTime)}</strong>
                <small>{timeToMinutes(next.endTime) - timeToMinutes(next.startTime)} min</small>
              </div>
              <div className="next-person">
                <div className="next-avatar-wrap">
                  <Avatar
                    name={next.clientName}
                    photoUrl={next.clientPhotoUrl || clients.find((c) => c.id === next.clientId)?.photoUrl}
                    color={avatarColor(next.clientName)}
                    size="lg"
                    className="next-client-avatar"
                  />
                  <span className="next-avatar-status" title={STATUS_LABELS[next.status]} />
                </div>
                <div className="next-person-details">
                  <h3 className="next-client-name">{next.clientName}</h3>
                  <p className="next-service-name">{next.serviceName}</p>
                  <span className="next-professional"><UserRound size={13} /> com {next.employeeName}</span>
                </div>
              </div>
              <div className="next-price">
                <div className="next-price-val">
                  <span>Valor</span>
                  <strong>{formatCurrency(next.total)}</strong>
                </div>
                <StatusBadge status={next.status} />
              </div>
            </div>
          ) : (
            <EmptyState title="Agenda livre hoje" description="Você ainda não tem atendimentos para hoje." action={<Button onClick={onNew}><Plus size={16} /> Criar atendimento</Button>} />
          )}
        </section>

        <section className="panel day-summary-panel">
          <SectionHeading title="Resumo do dia" />
          <div className="summary-list">
            <div><span className="summary-icon green"><CheckCheck size={15} /></span><span>Confirmados</span><strong>{todayApts.filter((a) => a.status === "confirmed").length}</strong></div>
            <div><span className="summary-icon yellow"><Clock3 size={15} /></span><span>Aguardando</span><strong>{todayApts.filter((a) => a.status === "waiting").length}</strong></div>
            <div><span className="summary-icon blue"><Zap size={15} /></span><span>Em atendimento</span><strong>{todayApts.filter((a) => a.status === "in_progress").length}</strong></div>
            <div><span className="summary-icon green"><Check size={15} /></span><span>Finalizados</span><strong>{todayApts.filter((a) => a.status === "completed").length}</strong></div>
          </div>
          <button className="summary-footer" onClick={onGoToAgenda}><CalendarPlus size={15} /> Abrir agenda completa <ArrowRight size={14} /></button>
        </section>
      </div>

      <section className="panel agenda-today-panel">
        <SectionHeading title="Agenda de hoje" description="Atendimentos em ordem cronológica" action={<button className="link-button" onClick={onGoToAgenda}>Ver agenda <ArrowRight size={14} /></button>} />
        {todayApts.length ? <div className="appointment-list">{todayApts.map((apt) => <AppointmentCard key={apt.id} appointment={apt} onClick={() => onAppointment(apt)} />)}</div> : <EmptyState title="Nenhum atendimento hoje" description="Sua agenda de hoje está vazia." action={<Button onClick={onNew}><Plus size={16} /> Novo agendamento</Button>} />}
        {services.length === 0 && <div className="dashboard-onboarding-hint"><ShieldCheck size={15} /><span>Cadastre serviços para começar a agendar.</span></div>}
      </section>
    </div>
  );
}

function AppointmentCard({ appointment, onClick }: { appointment: AppointmentDTO; onClick: () => void }) {
  const { clients } = useStore();
  const photo = appointment.clientPhotoUrl || clients.find((c) => c.id === appointment.clientId)?.photoUrl;
  const accentColor = appointment.serviceColor && appointment.serviceColor !== "#1f6f66"
    ? appointment.serviceColor
    : "var(--primary)";

  return (
    <button
      className="appointment-card"
      onClick={onClick}
      style={{ "--appointment-color": accentColor } as React.CSSProperties}
    >
      <div className="appointment-card-top">
        <span className="appointment-time">{normalizeTime(appointment.startTime)}</span>
        <StatusBadge status={appointment.status} />
      </div>
      <div className="appointment-main">
        <Avatar
          name={appointment.clientName}
          photoUrl={photo}
          color={avatarColor(appointment.clientName)}
          size="md"
        />
        <span className="appointment-client">
          <strong>{appointment.clientName}</strong>
          <small>{appointment.serviceName}</small>
        </span>
      </div>
      <div className="appointment-meta">
        <span><Clock3 size={13} /> {appointment.durationMinutes} min</span>
        <span><UserRound size={13} /> {appointment.employeeName}</span>
        <strong>{formatCurrency(appointment.total)}</strong>
      </div>
    </button>
  );
}

type ClientTab = "all" | "vip" | "new" | "with_appointment";
type ClientSort = "visits-desc" | "spent-desc" | "recent" | "name-asc";

function ClientsPage({
  onSelect,
  onNew,
  onNewAppointment,
}: {
  onSelect: (client: ClientDTO) => void;
  onNew: () => void;
  onNewAppointment: (client: ClientDTO) => void;
}) {
  const { clients, appointments, session } = useStore();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ClientTab>("all");
  const [sortBy, setSortBy] = useState<ClientSort>("visits-desc");

  // Metric computations matching the Home page KPIs
  const totalClients = clients.length;
  const totalSpent = clients.reduce((acc, c) => acc + (c.spent || 0), 0);
  const totalVisits = clients.reduce((acc, c) => acc + (c.visits || 0), 0);
  const averageTicket = totalVisits > 0 ? Math.round(totalSpent / totalVisits) : 0;

  const vipClients = clients.filter((c) => c.visits >= 2 || (c.spent && c.spent >= 200));
  const retentionRate = totalClients > 0 ? Math.round((vipClients.length / totalClients) * 100) : 0;

  // Tab counts
  const thirtyDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  }, []);

  const newClientsCount = clients.filter((c) => new Date(c.createdAt) >= thirtyDaysAgo).length;

  const todayStr = new Date().toISOString().slice(0, 10);
  const clientIdsWithAppointment = useMemo(() => {
    return new Set(
      appointments
        .filter((a) => a.date >= todayStr && a.status !== "cancelled")
        .map((a) => a.clientId)
    );
  }, [appointments, todayStr]);

  const withAppointmentCount = clients.filter(
    (c) => clientIdsWithAppointment.has(c.id) || Boolean(c.nextVisit)
  ).length;

  // Filtered by query & active tab
  const filtered = useMemo(() => {
    return clients.filter((client) => {
      const q = query.trim().toLowerCase();
      if (q) {
        const matchName = client.name.toLowerCase().includes(q);
        const matchPhone = (client.phone ?? "").toLowerCase().includes(q);
        const matchEmail = (client.email ?? "").toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchEmail) return false;
      }

      if (activeTab === "vip") {
        return client.visits >= 2 || (client.spent && client.spent >= 200);
      }
      if (activeTab === "new") {
        return new Date(client.createdAt) >= thirtyDaysAgo;
      }
      if (activeTab === "with_appointment") {
        return clientIdsWithAppointment.has(client.id) || Boolean(client.nextVisit);
      }
      return true;
    });
  }, [clients, query, activeTab, thirtyDaysAgo, clientIdsWithAppointment]);

  // Sorted list
  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sortBy) {
      case "visits-desc":
        return list.sort((a, b) => (b.visits || 0) - (a.visits || 0));
      case "spent-desc":
        return list.sort((a, b) => (b.spent || 0) - (a.spent || 0));
      case "recent":
        return list.sort((a, b) => (b.lastVisit || "").localeCompare(a.lastVisit || ""));
      case "name-asc":
        return list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      default:
        return list;
    }
  }, [filtered, sortBy]);

  const tabs: Array<{ id: ClientTab; label: string; count: number; icon?: LucideIcon }> = [
    { id: "all", label: "Todos os clientes", count: totalClients },
    { id: "vip", label: "Frequentes & VIPs", count: vipClients.length, icon: Sparkles },
    { id: "new", label: "Novos no mês", count: newClientsCount, icon: UserPlus },
    { id: "with_appointment", label: "Com agendamento", count: withAppointmentCount, icon: CalendarDays },
  ];

  return (
    <div className="page-content clients-page-content">
      {/* Intro Header */}
      <div className="page-intro">
        <div>
          <p className="eyebrow">Base de relacionamento</p>
          <h1>Clientes</h1>
          <p className="intro-copy">{totalClients} pessoas já fazem parte da sua história.</p>
        </div>
        <Button onClick={onNew}>
          <UserPlus size={17} /> Novo cliente
        </Button>
      </div>

      {/* Metrics Grid matching Home page KPIs */}
      <div className="metrics-grid client-metrics-grid">
        <div className="metric-card">
          <div className="metric-icon metric-teal"><Users size={18} /></div>
          <div className="metric-copy">
            <p>Total de clientes</p>
            <strong>{totalClients}</strong>
            <span className="metric-detail">base cadastrada</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon metric-lilac"><Sparkles size={18} /></div>
          <div className="metric-copy">
            <p>Clientes frequentes</p>
            <strong>{vipClients.length}</strong>
            <span className="metric-detail">{retentionRate}% taxa de retenção</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon metric-amber"><CircleDollarSign size={18} /></div>
          <div className="metric-copy">
            <p>Ticket médio</p>
            <strong>{formatCurrency(averageTicket)}</strong>
            <span className="metric-detail">por atendimento</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon metric-rose"><TrendingUp size={18} /></div>
          <div className="metric-copy">
            <p>LTV total acumulado</p>
            <strong>{formatCurrency(totalSpent)}</strong>
            <span className="metric-detail">faturamento da base</span>
          </div>
        </div>
      </div>

      {/* Main Clients Panel */}
      <section className="panel clients-panel">
        {/* Interactive Segment Tabs ("Aba acima") */}
        <div className="client-tabs-container">
          <div className="client-segment-tabs" role="tablist">
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`client-tab-btn ${activeTab === tab.id ? "active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {TabIcon && <TabIcon size={14} />}
                  <span>{tab.label}</span>
                  <span className="client-tab-pill">{tab.count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Toolbar: Search + Sort + Count */}
        <div className="client-panel-toolbar">
          <div className="client-search-wrapper">
            <div className="search-box client-search-box">
              <Search size={16} />
              <input
                placeholder="Buscar por nome, telefone ou e-mail..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  type="button"
                  className="clear-search-btn"
                  onClick={() => setQuery("")}
                  title="Limpar busca"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="client-toolbar-right">
            <div className="client-sort-group">
              <span className="sort-label"><ArrowUpDown size={13} /> Ordenar:</span>
              <select
                className="select-input client-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as ClientSort)}
              >
                <option value="visits-desc">Mais atendimentos</option>
                <option value="spent-desc">Maior valor total</option>
                <option value="recent">Última visita</option>
                <option value="name-asc">Nome (A–Z)</option>
              </select>
            </div>
            <span className="client-results-count">
              Exibindo <strong>{sorted.length}</strong> de {totalClients}
            </span>
          </div>
        </div>

        {/* Table Content */}
        {sorted.length ? (
          <div className="data-table-wrap">
            <table className="data-table client-data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Contato & WhatsApp</th>
                  <th>Último atendimento</th>
                  <th>Atendimentos</th>
                  <th>Total gasto (LTV)</th>
                  <th className="actions-header">Ações rápidas</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((client) => {
                  const isVip = client.visits >= 3 || (client.spent && client.spent >= 250);
                  const isFrequent = !isVip && client.visits >= 2;
                  const isNew = !isVip && !isFrequent;
                  const avgClientTicket = client.visits > 0 ? Math.round((client.spent || 0) / client.visits) : 0;
                  const hasUpcoming = clientIdsWithAppointment.has(client.id) || Boolean(client.nextVisit);

                  return (
                    <tr
                      key={client.id}
                      className="client-table-row"
                      onClick={() => onSelect(client)}
                    >
                      <td>
                        <div className="table-person">
                          <div className="client-avatar-container">
                            <Avatar
                              name={client.name}
                              photoUrl={client.photoUrl}
                              color={avatarColor(client.name)}
                            />
                            {isVip && (
                              <span className="client-vip-star" title="Cliente VIP">★</span>
                            )}
                          </div>
                          <div className="client-identity">
                            <div className="client-name-line">
                              <strong className="client-name-text">{client.name}</strong>
                              {isVip && <span className="client-badge badge-vip">VIP</span>}
                              {isFrequent && <span className="client-badge badge-frequent">Frequente</span>}
                              {isNew && <span className="client-badge badge-new">Novo</span>}
                            </div>
                            <small className="client-sub-info">
                              {client.email || (client.phone ? "Cliente verificado" : "Sem e-mail")}
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="client-contact-col">
                          {client.phone ? (
                            <a
                              href={`https://wa.me/${formatPhoneForWhatsApp(client.phone)}?text=${encodeURIComponent(`Olá, ${client.name}! Tudo bem? Falamos da ${session?.company.name || "Agenda"}.`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="client-whatsapp-btn"
                              title="Abrir WhatsApp com o cliente"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MessageCircle size={13} />
                              <span>{client.phone}</span>
                            </a>
                          ) : (
                            <span className="muted-text">—</span>
                          )}
                          {hasUpcoming && (
                            <span className="client-has-upcoming" title="Possui agendamento ativo">
                              <CalendarDays size={11} /> Agendado
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        <div className="client-visit-col">
                          <Clock3 size={13} className="text-muted" />
                          <span>{client.lastVisit ? shortDate(client.lastVisit) : "Nenhum ainda"}</span>
                        </div>
                      </td>

                      <td>
                        <div className="client-visits-badge-wrap">
                          <span className={`visit-count-badge ${client.visits >= 2 ? "active" : ""}`}>
                            {client.visits} {client.visits === 1 ? "visita" : "visitas"}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="client-spending-col">
                          <strong className="client-total-spent">{formatCurrency(client.spent)}</strong>
                          {client.visits > 0 && (
                            <span className="client-spending-detail">
                              méd. {formatCurrency(avgClientTicket)}/atend.
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        <div className="client-actions-cell" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="client-action-btn schedule"
                            title={`Criar novo agendamento para ${client.name}`}
                            onClick={() => onNewAppointment(client)}
                          >
                            <CalendarPlus size={14} />
                            <span>Agendar</span>
                          </button>
                          <IconButton
                            label={`Abrir ficha de ${client.name}`}
                            onClick={() => onSelect(client)}
                            className="client-action-btn view"
                          >
                            <ChevronRight size={16} />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Users}
            title={query || activeTab !== "all" ? "Nenhum cliente encontrado" : "Você ainda não tem clientes"}
            description={
              query || activeTab !== "all"
                ? "Nenhum cliente corresponde aos filtros ou busca selecionados."
                : "Cadastre seu primeiro cliente para começar a agendar."
            }
            action={
              query || activeTab !== "all" ? (
                <Button variant="secondary" onClick={() => { setQuery(""); setActiveTab("all"); }}>
                  Limpar filtros
                </Button>
              ) : (
                <Button onClick={onNew}>
                  <UserPlus size={16} /> Novo cliente
                </Button>
              )
            }
          />
        )}
      </section>
    </div>
  );
}

function ClientDrawer({ clientId, onClose, onNewAppointment }: { clientId: string; onClose: () => void; onNewAppointment: (client: ClientDTO) => void }) {
  const { clients } = useStore();
  const [detail, setDetail] = useState<import("@/shared/types").ClientDetailDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const client = clients.find((c) => c.id === clientId);

  useEffect(() => {
    let active = true;
    api<import("@/shared/types").ClientDetailDTO>(`/api/clients/${clientId}`)
      .then((data) => { if (active) setDetail(data); })
      .catch((e) => { if (active) setError(e instanceof ApiError ? e.message : "Erro ao carregar."); });
    return () => { active = false; };
  }, [clientId]);

  if (!client) return null;
  const phone = detail?.phone ?? client.phone ?? "";

  return (
    <div className="drawer-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="profile-drawer">
        <div className="drawer-header"><span className="eyebrow">Perfil do cliente</span><IconButton label="Fechar perfil" onClick={onClose}><X size={19} /></IconButton></div>
        <div className="profile-hero">
          <Avatar name={client.name} photoUrl={detail?.photoUrl ?? client.photoUrl} color={avatarColor(client.name)} size="lg" />
          <h2>{client.name}</h2>
          {detail?.createdAt && <p>Cliente desde {new Date(detail.createdAt).toLocaleDateString("pt-BR")}</p>}
          <div className="profile-actions">
            {phone && (
              <a
                className="whatsapp-button"
                href={`https://wa.me/${formatPhoneForWhatsApp(phone)}?text=${encodeURIComponent(`Olá, ${client.name}! Agradecemos a sua preferência na Agenda.`)}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle size={15} /> WhatsApp
              </a>
            )}
            <Button onClick={() => onNewAppointment(client)}><CalendarPlus size={15} /> Agendar</Button>
          </div>
        </div>
        <div className="profile-contact"><div><Phone size={15} /><span>{phone}</span></div>{detail?.email && <div><Mail size={15} /><span>{detail.email}</span></div>}</div>
        <div className="profile-stats">
          <div><strong>{formatCurrency(detail?.spent ?? client.spent)}</strong><span>Total gasto</span></div>
          <div><strong>{detail?.visits ?? client.visits}</strong><span>Atendimentos</span></div>
          <div><strong>{formatCurrency(detail?.averageTicket ?? 0)}</strong><span>Ticket médio</span></div>
          <div><strong>{detail?.lastVisit ? shortDate(detail.lastVisit) : "—"}</strong><span>Última visita</span></div>
        </div>
        {detail?.nextVisit && <div className="profile-next"><CalendarDays size={14} /> Próximo: {detail.nextVisit}</div>}
        <section className="profile-section">
          <SectionHeading title="Histórico de atendimentos" />
          {error && <p className="profile-error">{error}</p>}
          {detail && !detail.history.length && <p className="profile-empty">Nenhum atendimento registrado ainda.</p>}
          {detail?.history && detail.history.length > 0 && (
            <div className="history-list">
              {detail.history.slice(0, 15).map((item) => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <div>
                    <span className="history-date">{shortDate(item.date)} às {item.time}</span>
                    <div><strong>{item.service}</strong> · <small>{item.employee}</small></div>
                    {item.locationName && <small className="muted-text"><MapPin size={11} /> {item.locationName}</small>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <b>{formatCurrency(item.total)}</b>
                    <div><small className="muted-text">{item.paymentMethod ? PAYMENT_LABELS[item.paymentMethod] : "Pendente"}</small></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="profile-section">
          <SectionHeading title="Observações" />
          <div className="profile-note"><Pencil size={14} /><span>{detail?.notes || client.notes || "Nenhuma observação."}</span></div>
        </section>
      </aside>
    </div>
  );
}

function ServicesPage({ onNew }: { onNew: () => void }) {
  const { services, toggleService, categories } = useStore();
  const [filter, setFilter] = useState("Todos");

  const visible = services.filter((service) => filter === "Todos" || (service.active === (filter === "Ativos")));

  return (
    <div className="page-content">
      <div className="page-intro"><div><p className="eyebrow">Catálogo de serviços</p><h1>Serviços</h1><p className="intro-copy">Crie experiências claras para seus clientes e sua equipe.</p></div><Button onClick={onNew}><Plus size={17} /> Novo serviço</Button></div>
      {categories.length > 0 && <div className="category-tabs">{["Todos", "Ativos", "Inativos"].map((tab) => <button key={tab} className={filter === tab ? "active" : ""} onClick={() => setFilter(tab)}>{tab}</button>)}</div>}
      <div className="service-grid">
        {visible.map((service) => (
          <article className={`service-card ${!service.active ? "inactive" : ""}`} key={service.id}>
            <div className="service-card-head"><span className="service-color" style={{ backgroundColor: service.color ?? "var(--primary)" }}><Tag size={16} /></span></div>
            <div className="service-card-body"><h3>{service.name}</h3><span className="service-category">{service.categoryName ?? "Sem categoria"}</span>{service.description && <p>{service.description}</p>}</div>
            <div className="service-card-footer"><div><strong>{formatCurrency(service.price)}</strong><span><Clock3 size={13} /> {service.durationMinutes} min</span></div><label className="toggle"><input type="checkbox" checked={service.active} onChange={() => toggleService(service.id, !service.active)} /><span /></label></div>
          </article>
        ))}
        <button className="add-service-card" onClick={onNew}><span><Plus size={19} /></span><strong>Criar novo serviço</strong><small>Adicione preço, duração e categoria</small></button>
      </div>
      {visible.length === 0 && <EmptyState icon={Tag} title="Nenhum serviço" description="Cadastre serviços para começar a agendar." action={<Button onClick={onNew}><Plus size={16} /> Novo serviço</Button>} />}
    </div>
  );
}

function TeamPage({ onNew }: { onNew: () => void }) {
  const { employees } = useStore();
  return (
    <div className="page-content">
      <div className="page-intro"><div><p className="eyebrow">Pessoas e permissões</p><h1>Equipe</h1><p className="intro-copy">{employees.length} profissionais ativos no seu estabelecimento.</p></div><Button onClick={onNew}><UserPlus size={17} /> Adicionar profissional</Button></div>
      <div className="team-grid">
        {employees.map((employee) => (
          <article className="team-card" key={employee.id}>
            <div className="team-card-top"><Avatar name={employee.name} photoUrl={employee.photoUrl} color={avatarColor(employee.name)} size="lg" /><span className="active-dot" /></div>
            <h3>{employee.name}</h3>
            <span className="team-role">{employee.jobTitle ?? "Profissional"}</span>
            <div className="team-services">{employee.services.map((service) => <span key={service}>{service}</span>)}{employee.services.length === 0 && <span className="team-no-services">Sem serviços vinculados</span>}</div>
            <div className="team-schedule-static"><Clock3 size={13} /> {employee.active ? "Ativo" : "Inativo"} · Comissão: {employee.commissionType === "percentage" ? `${employee.commissionValue}%` : employee.commissionType === "fixed" ? formatCurrency(employee.commissionValue) : "Sem comissão"}</div>
          </article>
        ))}
        {employees.length === 0 && <EmptyState icon={UserRound} title="Nenhum profissional" description="Adicione profissionais para atribuir atendimentos." action={<Button onClick={onNew}><UserPlus size={16} /> Adicionar profissional</Button>} />}
      </div>
    </div>
  );
}

type FinancialPeriod = "today" | "week" | "month" | "all";

function FinancialPage() {
  const { stats, employees, appointments } = useStore();
  const [period, setPeriod] = useState<FinancialPeriod>("month");

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Filter appointments according to selected period
  const filteredAppointments = useMemo(() => {
    const now = new Date();

    if (period === "today") {
      return appointments.filter((a) => a.date === todayStr);
    }
    if (period === "week") {
      const d = new Date(now);
      const day = d.getDay();
      const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diffToMonday));
      monday.setHours(0, 0, 0, 0);
      const mondayStr = monday.toISOString().slice(0, 10);
      return appointments.filter((a) => a.date >= mondayStr && a.date <= todayStr);
    }
    if (period === "month") {
      const currentMonthPrefix = todayStr.slice(0, 7);
      return appointments.filter((a) => a.date.startsWith(currentMonthPrefix));
    }
    return appointments;
  }, [appointments, period, todayStr]);

  const completedApts = useMemo(
    () => filteredAppointments.filter((a) => a.status === "completed"),
    [filteredAppointments]
  );
  const pendingApts = useMemo(
    () => filteredAppointments.filter((a) => ["scheduled", "confirmed", "waiting", "in_progress"].includes(a.status)),
    [filteredAppointments]
  );

  const realizedRevenue = useMemo(() => {
    const fromApts = completedApts.reduce((acc, a) => acc + (a.total || 0), 0);
    if (fromApts > 0) return fromApts;
    if (period === "today") return stats?.today.realized ?? 0;
    if (period === "week") return stats?.week.revenue ?? 0;
    if (period === "month") return stats?.month.revenue ?? 0;
    return fromApts;
  }, [completedApts, period, stats]);

  const forecastRevenue = useMemo(() => {
    const fromApts = pendingApts.reduce((acc, a) => acc + (a.total || 0), 0);
    if (fromApts > 0) return fromApts;
    if (period === "today") return stats?.today.forecast ?? 0;
    return fromApts;
  }, [pendingApts, period, stats]);

  // Calculate commissions per professional
  const teamCommissions = useMemo(() => {
    const map = new Map<string, { employeeId: string; name: string; appointments: number; revenue: number; commission: number }>();

    employees.forEach((emp) => {
      map.set(emp.id, {
        employeeId: emp.id,
        name: emp.name,
        appointments: 0,
        revenue: 0,
        commission: 0,
      });
    });

    completedApts.forEach((apt) => {
      const emp = employees.find((e) => e.id === apt.employeeId);
      const empId = apt.employeeId || emp?.id || "other";
      let commissionVal = 0;
      if (emp?.commissionType === "percentage") {
        commissionVal = Math.round(((apt.total || 0) * (emp.commissionValue || 0)) / 100);
      } else if (emp?.commissionType === "fixed") {
        commissionVal = emp.commissionValue || 0;
      } else {
        commissionVal = Math.round(((apt.total || 0) * 30) / 100);
      }

      const entry = map.get(empId) || {
        employeeId: empId,
        name: apt.employeeName || "Profissional",
        appointments: 0,
        revenue: 0,
        commission: 0,
      };

      entry.appointments += 1;
      entry.revenue += apt.total || 0;
      entry.commission += commissionVal;
      map.set(empId, entry);
    });

    const list = Array.from(map.values()).filter((e) => e.appointments > 0 || e.revenue > 0);

    if (list.length === 0 && stats?.byEmployee && stats.byEmployee.length > 0) {
      return stats.byEmployee.map((s) => ({
        employeeId: s.employeeId,
        name: s.employeeName,
        appointments: s.appointments,
        revenue: s.revenue,
        commission: s.commission,
      }));
    }

    return list.sort((a, b) => b.revenue - a.revenue);
  }, [employees, completedApts, stats]);

  const totalCommissions = useMemo(
    () => teamCommissions.reduce((acc, c) => acc + c.commission, 0),
    [teamCommissions]
  );

  const netProfit = Math.max(realizedRevenue - totalCommissions, 0);
  const netMargin = realizedRevenue > 0 ? Math.round((netProfit / realizedRevenue) * 100) : 100;
  const averageTicket = completedApts.length > 0
    ? Math.round(realizedRevenue / completedApts.length)
    : (stats?.today.averageTicket ?? 0);

  // Top Services Ranking
  const topServices = useMemo(() => {
    const map = new Map<string, { name: string; count: number; revenue: number }>();

    completedApts.forEach((apt) => {
      const name = apt.serviceName || "Serviço";
      const entry = map.get(name) || { name, count: 0, revenue: 0 };
      entry.count += 1;
      entry.revenue += apt.total || 0;
      map.set(name, entry);
    });

    const list = Array.from(map.values());
    if (list.length === 0 && stats?.byService && stats.byService.length > 0) {
      return stats.byService.map((s) => ({
        name: s.serviceName,
        count: s.count,
        revenue: s.revenue,
      }));
    }

    return list.sort((a, b) => b.count - a.count);
  }, [completedApts, stats]);

  // Payment Methods Breakdown
  const paymentBreakdown = useMemo(() => {
    const map = new Map<string, { method: string; count: number; total: number }>();

    completedApts.forEach((apt) => {
      const method = apt.paymentMethod || "pix";
      const entry = map.get(method) || { method, count: 0, total: 0 };
      entry.count += 1;
      entry.total += apt.total || 0;
      map.set(method, entry);
    });

    const list = Array.from(map.values());
    if (list.length === 0 && stats?.byMethod && stats.byMethod.length > 0) {
      return stats.byMethod.map((m) => ({
        method: m.method,
        count: 1,
        total: m.total,
      }));
    }

    return list.sort((a, b) => b.total - a.total);
  }, [completedApts, stats]);

  // 7-day Revenue Evolution Bar Chart
  const last7DaysData = useMemo(() => {
    const days: Array<{ date: string; label: string; weekday: string; revenue: number; count: number; isToday: boolean }> = [];
    const weekdayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayName = weekdayNames[d.getDay()];
      const dayMonth = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

      const dayCompleted = appointments.filter((a) => a.date === dateStr && a.status === "completed");
      const dayRevenue = dayCompleted.reduce((acc, a) => acc + (a.total || 0), 0);

      days.push({
        date: dateStr,
        label: dayMonth,
        weekday: dayName,
        revenue: dayRevenue || (dateStr === todayStr ? (stats?.today.realized ?? 0) : 0),
        count: dayCompleted.length,
        isToday: dateStr === todayStr,
      });
    }

    const maxDayRevenue = Math.max(...days.map((d) => d.revenue), 100);
    const total7Days = days.reduce((acc, d) => acc + d.revenue, 0);
    const dailyAverage = Math.round(total7Days / 7);

    return { days, maxDayRevenue, dailyAverage, total7Days };
  }, [appointments, todayStr, stats]);

  const periodTabs: Array<{ id: FinancialPeriod; label: string }> = [
    { id: "today", label: "Hoje" },
    { id: "week", label: "Esta semana" },
    { id: "month", label: "Este mês" },
    { id: "all", label: "Todo o histórico" },
  ];

  return (
    <div className="page-content financial-page-content">
      {/* Intro Header */}
      <div className="page-intro">
        <div>
          <p className="eyebrow">Visão financeira</p>
          <h1>Financeiro</h1>
          <p className="intro-copy">Faturamento real calculado a partir dos atendimentos finalizados e comissões da equipe.</p>
        </div>
      </div>

      {/* Segmented Period Tabs ("Aba acima") */}
      <div className="financial-period-container">
        <div className="client-segment-tabs" role="tablist">
          {periodTabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={period === tab.id}
              className={`client-tab-btn ${period === tab.id ? "active" : ""}`}
              onClick={() => setPeriod(tab.id)}
            >
              <CalendarDays size={13} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Grid matching Home page KPIs */}
      <div className="metrics-grid finance-metrics">
        <div className="metric-card">
          <div className="metric-icon metric-teal"><WalletCards size={18} /></div>
          <div className="metric-copy">
            <p>Receita realizada</p>
            <strong>{formatCurrency(realizedRevenue)}</strong>
            <span className="metric-detail">{completedApts.length} atendimentos recebidos</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon metric-lilac"><TrendingUp size={18} /></div>
          <div className="metric-copy">
            <p>Receita prevista</p>
            <strong>{formatCurrency(forecastRevenue)}</strong>
            <span className="metric-detail">{pendingApts.length} atendimentos futuros</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon metric-amber"><BarChart3 size={18} /></div>
          <div className="metric-copy">
            <p>Comissões a pagar</p>
            <strong>{formatCurrency(totalCommissions)}</strong>
            <span className="metric-detail">{teamCommissions.length} profissionais comissionados</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon metric-rose"><ReceiptText size={18} /></div>
          <div className="metric-copy">
            <p>Lucro líquido</p>
            <strong>{formatCurrency(netProfit)}</strong>
            <span className="metric-detail">{netMargin}% margem de rentabilidade</span>
          </div>
        </div>
      </div>

      {/* 7-Day Revenue Evolution Bar Chart */}
      <section className="panel financial-chart-panel" style={{ marginTop: 20 }}>
        <div className="chart-header">
          <div>
            <h2>Evolução de faturamento (últimos 7 dias)</h2>
            <p className="intro-copy">Receita diária obtida de atendimentos concluídos</p>
          </div>
          <div className="chart-stat-badge">
            <span>Média diária dos 7 dias:</span>
            <strong>{formatCurrency(last7DaysData.dailyAverage)}</strong>
          </div>
        </div>

        <div className="financial-bar-chart">
          {last7DaysData.days.map((day) => {
            const heightPct = Math.max(Math.round((day.revenue / last7DaysData.maxDayRevenue) * 100), 6);
            return (
              <div key={day.date} className={`financial-bar-col ${day.isToday ? "today" : ""}`}>
                <span className="financial-bar-val">
                  {day.revenue > 0 ? formatCurrency(day.revenue) : "R$ 0"}
                </span>
                <div className="financial-bar-track">
                  <div
                    className="financial-bar-fill"
                    style={{ height: `${heightPct}%` }}
                    title={`${day.weekday} (${day.label}): ${formatCurrency(day.revenue)} (${day.count} atendimentos)`}
                  />
                </div>
                <strong className="financial-bar-weekday">{day.weekday}</strong>
                <small className="financial-bar-date">{day.label}</small>
              </div>
            );
          })}
        </div>
      </section>

      {/* Rankings: Team & Services */}
      <div className="dashboard-grid financial-grid-rankings" style={{ marginTop: 20 }}>
        {/* Top Professionals */}
        <section className="panel revenue-team-panel">
          <SectionHeading
            title="Profissionais que mais trabalharam"
            description="Volume de atendimentos, faturamento e comissões calculadas"
          />
          {teamCommissions.length ? (
            <div className="team-ranking-list">
              {teamCommissions.map((row, index) => {
                const emp = employees.find((e) => e.id === row.employeeId);
                const maxRev = teamCommissions[0]?.revenue || 1;
                const pct = Math.min(Math.round((row.revenue / maxRev) * 100), 100);

                return (
                  <div key={row.employeeId} className="team-rank-item">
                    <div className="team-rank-left">
                      <span className={`rank-podium rank-${index + 1}`}>#{index + 1}</span>
                      <Avatar
                        name={row.name}
                        photoUrl={emp?.photoUrl}
                        color={avatarColor(row.name)}
                        size="sm"
                      />
                      <div className="team-rank-info">
                        <strong>{row.name}</strong>
                        <small>{emp?.jobTitle ?? "Profissional"}</small>
                      </div>
                    </div>

                    <div className="team-rank-center">
                      <div className="team-rank-bar-wrap">
                        <div className="team-rank-bar" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="team-rank-meta">
                        {row.appointments} {row.appointments === 1 ? "atendimento" : "atendimentos"}
                        {" · "}
                        <span className="commission-text">
                          Comissão: {formatCurrency(row.commission)}
                        </span>
                      </span>
                    </div>

                    <div className="team-rank-right">
                      <strong className="team-rank-revenue">{formatCurrency(row.revenue)}</strong>
                      <small className="team-rank-net">
                        Líq: {formatCurrency(Math.max(row.revenue - row.commission, 0))}
                      </small>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title="Sem faturamento no período"
              description="Conclua atendimentos para visualizar o desempenho da equipe."
            />
          )}
        </section>

        {/* Top Services */}
        <section className="panel revenue-services-panel">
          <SectionHeading
            title="Serviços mais realizados"
            description="Serviços com maior volume e faturamento no período"
          />
          {topServices.length ? (
            <div className="service-ranking-list">
              {topServices.map((row, index) => {
                const maxCount = topServices[0]?.count || 1;
                const pct = Math.min(Math.round((row.count / maxCount) * 100), 100);

                return (
                  <div key={row.name} className="service-rank-item">
                    <div className="service-rank-left">
                      <span className="service-rank-num">#{index + 1}</span>
                      <div className="service-rank-info">
                        <strong>{row.name}</strong>
                        <small>{row.count} {row.count === 1 ? "atendimento" : "atendimentos"}</small>
                      </div>
                    </div>

                    <div className="service-rank-center">
                      <div className="service-rank-bar-wrap">
                        <div className="service-rank-bar" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    <div className="service-rank-right">
                      <strong className="service-rank-revenue">{formatCurrency(row.revenue)}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Tag}
              title="Nenhum serviço finalizado"
              description="Nenhum atendimento foi concluído no período selecionado."
            />
          )}
        </section>
      </div>

      {/* Payment Methods Breakdown */}
      {paymentBreakdown.length > 0 && (
        <section className="panel payment-panel" style={{ marginTop: 20 }}>
          <SectionHeading
            title="Por forma de pagamento"
            description="Distribuição dos valores recebidos no período"
          />
          <div className="payment-methods-grid">
            {paymentBreakdown.map((row) => {
              const totalAll = paymentBreakdown.reduce((acc, p) => acc + p.total, 0) || 1;
              const pct = Math.round((row.total / totalAll) * 100);
              return (
                <div key={row.method} className="payment-method-card">
                  <div className="payment-method-top">
                    <span className="payment-method-name">{PAYMENT_LABELS[row.method as PaymentMethod] || row.method}</span>
                    <span className="payment-method-pct">{pct}%</span>
                  </div>
                  <strong className="payment-method-val">{formatCurrency(row.total)}</strong>
                  <div className="payment-method-track">
                    <div className="payment-method-bar" style={{ width: `${pct}%` }} />
                  </div>
                  <small className="payment-method-count">{row.count} recebimentos</small>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function SettingsPage({ theme, setTheme, onNewLocation }: { theme: Theme; setTheme: (t: Theme) => void; onNewLocation: () => void }) {
  const { session, notify, locations, settings, updateSettings } = useStore();
  const company = session?.company;
  const [activeTab, setActiveTab] = useState<"empresa" | "unidades" | "funcionamento" | "seguranca" | "ajuda">("empresa");

  // Company profile fields
  const [name, setName] = useState(company?.name ?? "");
  const [phone, setPhone] = useState(company?.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(company?.whatsapp ?? "");
  const [email, setEmail] = useState(company?.email ?? "");
  const [address, setAddress] = useState(company?.address ?? "");
  const [instagram, setInstagram] = useState(company?.instagram ?? "");
  const [savingCompany, setSavingCompany] = useState(false);

  // Operational settings fields
  const [openTime, setOpenTime] = useState(settings?.openTime ?? "08:00");
  const [closeTime, setCloseTime] = useState(settings?.closeTime ?? "19:00");
  const [workingDays, setWorkingDays] = useState<number[]>(settings?.workingDays ?? [1, 2, 3, 4, 5, 6]);
  const [slotInterval, setSlotInterval] = useState(settings?.slotIntervalMinutes ?? 30);
  const [bufferMinutes, setBufferMinutes] = useState(settings?.bufferMinutes ?? 0);
  const [timezone, setTimezone] = useState(settings?.timezone ?? "America/Sao_Paulo");
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (settings) {
      setOpenTime(settings.openTime);
      setCloseTime(settings.closeTime);
      setWorkingDays(settings.workingDays);
      setSlotInterval(settings.slotIntervalMinutes);
      setBufferMinutes(settings.bufferMinutes);
      setTimezone(settings.timezone);
    }
  }, [settings]);

  const saveCompany = async () => {
    setSavingCompany(true);
    try {
      await api("/api/company", { method: "PATCH", body: JSON.stringify({ name, phone, whatsapp, email, address, instagram }) });
      notify("Informações da empresa salvas.");
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Erro ao salvar.", "error");
    } finally {
      setSavingCompany(false);
    }
  };

  const saveOperational = async () => {
    setSavingSettings(true);
    try {
      await updateSettings({
        openTime,
        closeTime,
        workingDays,
        slotIntervalMinutes: slotInterval,
        bufferMinutes,
        timezone,
      });
      notify("Configurações da agenda salvas.");
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Erro ao salvar funcionamento.", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleDay = (day: number) => {
    setWorkingDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort());
  };

  const daysOfWeekLabels = [
    { day: 0, label: "Dom" },
    { day: 1, label: "Seg" },
    { day: 2, label: "Ter" },
    { day: 3, label: "Qua" },
    { day: 4, label: "Qui" },
    { day: 5, label: "Sex" },
    { day: 6, label: "Sáb" },
  ];

  return (
    <div className="page-content settings-page">
      <div className="page-intro"><div><p className="eyebrow">Preferências do espaço</p><h1>Configurações</h1><p className="intro-copy">Personalize a experiência do seu estabelecimento.</p></div></div>
      <div className="settings-layout">
        <aside className="settings-nav">
          <button className={activeTab === "empresa" ? "active" : ""} onClick={() => setActiveTab("empresa")}><Settings2 size={16} /> Empresa</button>
          <button className={activeTab === "unidades" ? "active" : ""} onClick={() => setActiveTab("unidades")}><Building2 size={16} /> Unidades</button>
          <button className={activeTab === "funcionamento" ? "active" : ""} onClick={() => setActiveTab("funcionamento")}><Clock3 size={16} /> Funcionamento</button>
          <button className={activeTab === "seguranca" ? "active" : ""} onClick={() => setActiveTab("seguranca")}><ShieldCheck size={16} /> Segurança</button>
          <button className={activeTab === "ajuda" ? "active" : ""} onClick={() => setActiveTab("ajuda")}><CircleHelp size={16} /> Ajuda</button>
        </aside>

        <div className="settings-sections">
          {activeTab === "empresa" && (
            <>
              <section className="settings-section">
                <SectionHeading title="Informações da empresa" description="Esses dados aparecem nos seus agendamentos e comunicações." action={<Button onClick={saveCompany} disabled={savingCompany}>{savingCompany ? "Salvando..." : "Salvar empresa"}</Button>} />
                <div className="settings-form">
                  <Field label="Nome da empresa"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
                  <Field label="Telefone"><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" /></Field>
                  <Field label="WhatsApp"><input className="input" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" /></Field>
                  <Field label="E-mail"><input className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
                  <Field label="Endereço"><div className="input-with-icon"><MapPin size={16} /><input className="input" value={address} onChange={(e) => setAddress(e.target.value)} /></div></Field>
                  <Field label="Instagram"><div className="input-with-icon"><span className="at-symbol">@</span><input className="input" value={instagram} onChange={(e) => setInstagram(e.target.value)} /></div></Field>
                </div>
              </section>

              <section className="settings-section">
                <SectionHeading title="Aparência" description="A Agenda se adapta ao seu jeito de trabalhar." />
                <div className="theme-options">
                  <button className={theme === "light" ? "theme-option active" : "theme-option"} onClick={() => setTheme("light")}>
                    <span className="theme-preview light-preview"><Sun size={17} /></span>
                    <span className="theme-copy"><strong>Claro</strong><small>Leve e arejado</small></span>
                    {theme === "light" && <CheckCircle size={17} className="theme-check" />}
                  </button>
                  <button className={theme === "dark" ? "theme-option active" : "theme-option"} onClick={() => setTheme("dark")}>
                    <span className="theme-preview dark-preview"><Moon size={17} /></span>
                    <span className="theme-copy"><strong>Escuro</strong><small>Confortável à noite</small></span>
                    {theme === "dark" && <CheckCircle size={17} className="theme-check" />}
                  </button>
                </div>
              </section>
            </>
          )}

          {activeTab === "unidades" && (
            <section className="settings-section">
              <SectionHeading title="Unidades do estabelecimento" description="Gerencie as lojas e filiais onde seus clientes são atendidos." action={<Button onClick={onNewLocation}><Plus size={16} /> Nova unidade</Button>} />
              <div className="service-grid">
                {locations.map((loc) => (
                  <article className="service-card" key={loc.id}>
                    <div className="service-card-head"><span className="service-color" style={{ backgroundColor: "var(--primary)" }}><Building2 size={16} /></span></div>
                    <div className="service-card-body">
                      <h3>{loc.name}</h3>
                      {loc.address && <p><MapPin size={12} /> {loc.address}</p>}
                      <p><Clock3 size={12} /> {loc.openTime} às {loc.closeTime}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {activeTab === "funcionamento" && (
            <section className="settings-section">
              <SectionHeading title="Regras de funcionamento e agenda" description="Configure os horários, dias e intervalos calculados pelo motor de disponibilidade." action={<Button onClick={saveOperational} disabled={savingSettings}>{savingSettings ? "Salvando..." : "Salvar funcionamento"}</Button>} />
              <div className="settings-form">
                <Field label="Dias de atendimento">
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                    {daysOfWeekLabels.map(({ day, label }) => (
                      <button
                        type="button"
                        key={day}
                        className={`slot-chip ${workingDays.includes(day) ? "active" : ""}`}
                        onClick={() => toggleDay(day)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </Field>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <Field label="Horário de abertura"><input className="input" type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} /></Field>
                  <Field label="Horário de fechamento"><input className="input" type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} /></Field>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <Field label="Intervalo entre slots">
                    <SelectField value={slotInterval} onChange={(e) => setSlotInterval(Number(e.target.value))}>
                      <option value={15}>15 minutos</option>
                      <option value={30}>30 minutos</option>
                      <option value={60}>60 minutos</option>
                    </SelectField>
                  </Field>
                  <Field label="Intervalo entre atendimentos (buffer)">
                    <SelectField value={bufferMinutes} onChange={(e) => setBufferMinutes(Number(e.target.value))}>
                      <option value={0}>0 minutos</option>
                      <option value={5}>5 minutos</option>
                      <option value={10}>10 minutos</option>
                      <option value={15}>15 minutos</option>
                      <option value={30}>30 minutos</option>
                    </SelectField>
                  </Field>
                </div>

                <Field label="Fuso horário (Timezone)">
                  <SelectField value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                    <option value="America/Sao_Paulo">Horário de Brasília (America/Sao_Paulo)</option>
                    <option value="America/Manaus">Manaus (America/Manaus)</option>
                    <option value="America/Fortaleza">Fortaleza (America/Fortaleza)</option>
                    <option value="America/Bahia">Salvador (America/Bahia)</option>
                    <option value="UTC">UTC Universal</option>
                  </SelectField>
                </Field>
              </div>
            </section>
          )}

          {activeTab === "seguranca" && (
            <section className="settings-section">
              <SectionHeading title="Segurança e acesso" description="Status de proteção e permissões da sua conta." />
              <div className="profile-note"><UserRound size={15} /><span>Conectado como <strong>{session?.name}</strong> ({session?.email}) · Papel: <strong>{roleLabel(session?.role)}</strong></span></div>
              <div className="profile-note"><ShieldCheck size={15} /><span>Verificação de e-mail: <strong>{session?.emailVerified ? "Confirmado" : "Pendente"}</strong></span></div>
              {session?.isSuperadmin && <div className="profile-note" style={{ background: "#e0e7ff", color: "#3730a3" }}><Sparkles size={15} /><span>Você possui privilégios de <strong>Superadmin Nova(e)</strong></span></div>}
            </section>
          )}

          {activeTab === "ajuda" && (
            <section className="settings-section">
              <SectionHeading title="Ajuda e Suporte" description="Acesse guias e tire dúvidas com o time Nova(e)." />
              <div className="settings-feature-grid">
                <div className="settings-feature-card"><span className="feature-pill">Agendamentos</span><strong>Motor em tempo real</strong><small>Cálculo automático de horários livres</small></div>
                <div className="settings-feature-card"><span className="feature-pill">Financeiro</span><strong>Receita realizada</strong><small>Derivada de atendimentos pagos</small></div>
                <div className="settings-feature-card"><span className="feature-pill">Suporte</span><strong>WhatsApp e E-mail</strong><small>Atendimento direto ao cliente</small></div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Modals ---------- */
function NewAppointmentModal({
  onClose,
  defaultDate,
  defaultEmployeeId,
  defaultStartTime,
  defaultClientId,
}: {
  onClose: () => void;
  defaultDate: string;
  defaultEmployeeId?: string;
  defaultStartTime?: string;
  defaultClientId?: string;
}) {
  const { clients, services, employees, locations, activeLocationId, createAppointment, notify } = useStore();
  const [clientId, setClientId] = useState(defaultClientId || "");
  const [locationId, setLocationId] = useState(activeLocationId || locations[0]?.id || "");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [employeeId, setEmployeeId] = useState(defaultEmployeeId || "");
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState(defaultStartTime || "09:00");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<Array<{ startTime: string; endTime: string }>>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const selectedServices = services.filter((s) => serviceIds.includes(s.id));
  const duration = selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);
  const total = selectedServices.reduce((sum, s) => sum + s.price, 0);

  const eligibleEmployees = employees.filter((employee) => {
    if (serviceIds.length === 0) return employee.active;
    return serviceIds.every((sid) => employee.serviceIds.includes(sid));
  });

  const toggleService = (id: string) => {
    setServiceIds((current) => (current.includes(id) ? current.filter((s) => s !== id) : [...current, id]));
  };

  // Availability calculation hook
  useEffect(() => {
    if (!employeeId || !date || duration <= 0) {
      setAvailableSlots([]);
      return;
    }
    let active = true;
    setLoadingSlots(true);
    api<{ slots: Array<{ startTime: string; endTime: string }> }>(
      `/api/availability?employeeId=${employeeId}&date=${date}&duration=${duration}`
    )
      .then((res) => {
        if (active) {
          const slots = res.slots || [];
          setAvailableSlots(slots);
          if (slots.length > 0 && !slots.some((s) => s.startTime === startTime)) {
            setStartTime(slots[0].startTime);
          }
        }
      })
      .catch(() => {
        if (active) setAvailableSlots([]);
      })
      .finally(() => {
        if (active) setLoadingSlots(false);
      });
    return () => { active = false; };
  }, [employeeId, date, duration]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!clientId || serviceIds.length === 0 || !employeeId) {
      notify("Selecione cliente, serviço e profissional.", "error");
      return;
    }
    setSubmitting(true);
    try {
      await createAppointment({
        clientId,
        employeeId,
        locationId: locationId || undefined,
        serviceIds,
        date,
        startTime,
        notes: notes || undefined,
      });
      notify("Agendamento criado com sucesso.");
      onClose();
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Não foi possível criar o agendamento.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Novo agendamento" eyebrow="Motor em tempo real" onClose={onClose} wide headerVariant="primary">
      <form onSubmit={submit}>
        <div className="modal-form-grid">
          <Field label="Cliente"><SelectField value={clientId} onChange={(e) => setClientId(e.target.value)} required><option value="">Selecione...</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</SelectField></Field>
          <Field label="Unidade">
            <SelectField value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              {locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
            </SelectField>
          </Field>
          <Field label="Profissional"><SelectField value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required><option value="">Selecione...</option>{eligibleEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</SelectField></Field>
          <Field label="Data"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>

          <Field label="Serviços">
            <div className="service-multi-select">
              {services.filter((s) => s.active).map((service) => (
                <button type="button" key={service.id} className={serviceIds.includes(service.id) ? "service-option active" : "service-option"} onClick={() => toggleService(service.id)}>
                  <span>{service.name}</span><small>{formatCurrency(service.price)} · {service.durationMinutes} min</small>
                </button>
              ))}
              {services.filter((s) => s.active).length === 0 && <span className="field-hint">Cadastre serviços primeiro.</span>}
            </div>
            {selectedServices.length > 0 && (
              <div className="selected-services-summary">
                <span className="summary-pill">{selectedServices.length} {selectedServices.length === 1 ? "serviço" : "serviços"}</span>
                <span className="summary-pill highlight"><Clock3 size={12} /> {duration} min</span>
                <span className="summary-pill highlight-price">{formatCurrency(total)}</span>
              </div>
            )}
          </Field>

          <Field label="Horário">
            <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            {loadingSlots && <span className="field-hint">Calculando horários livres...</span>}
            {!loadingSlots && availableSlots.length > 0 && (
              <div className="slot-chips-wrap">
                <span className="slot-chips-label">Horários livres sugeridos ({availableSlots.length}):</span>
                <div className="slot-chips-grid">
                  {availableSlots.map((slot) => (
                    <button
                      type="button"
                      key={slot.startTime}
                      className={`slot-chip ${startTime === slot.startTime ? "active" : ""}`}
                      onClick={() => setStartTime(slot.startTime)}
                    >
                      {slot.startTime}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!loadingSlots && employeeId && date && duration > 0 && availableSlots.length === 0 && (
              <span className="field-hint" style={{ color: "var(--warning)" }}>
                Nenhum horário livre para este profissional nesta data.
              </span>
            )}
          </Field>

          <Field label="Observações"><textarea className="input textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Alguma informação importante?" /></Field>
        </div>
        {serviceIds.length > 0 && eligibleEmployees.length === 0 && <div className="form-note" style={{ color: "var(--warning)", marginTop: 10 }}><CircleAlert size={14} /> Nenhum profissional selecionável realiza os serviços escolhidos.</div>}
        <div className="modal-footer"><span className="form-note"><ShieldCheck size={14} /> Conflitos são validados pelo motor</span><div className="modal-actions"><Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={submitting}>{submitting ? "Criando..." : <><Check size={16} /> Confirmar agendamento</>}</Button></div></div>
      </form>
    </Modal>
  );
}

function NewClientModal({ onClose }: { onClose: () => void }) {
  const { createClient, notify } = useStore();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits ? `(${digits}` : "";
    if (digits.length <= 7) return `(${digits.slice(0, 2)})${digits.slice(2)}`;
    return `(${digits.slice(0, 2)})${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const isValidPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 11;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextPhone = formatPhone(phone);
    if (!isValidPhone(nextPhone)) {
      notify("Digite um telefone celular válido.", "error");
      return;
    }

    setSubmitting(true);
    try {
      await createClient({ name, phone: nextPhone, email: email || undefined, notes: notes || undefined });
      notify("Cliente cadastrado com sucesso.");
      onClose();
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Não foi possível cadastrar o cliente.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Novo cliente" eyebrow="Adicionar à sua base" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="modal-form-grid single">
          <Field label="Nome completo"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Fernanda Almeida" required minLength={2} /></Field>
          <Field label="Telefone"><input className="input" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="(11) 99999-9999" inputMode="numeric" required /></Field>
          <Field label="E-mail (opcional)"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seuemail@dominio.com" /></Field>
          <Field label="Observações (opcional)"><textarea className="input textarea" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>
        <div className="modal-footer"><div className="modal-actions"><Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={submitting}>{submitting ? "Salvando..." : <><UserPlus size={16} /> Cadastrar cliente</>}</Button></div></div>
      </form>
    </Modal>
  );
}

function NewServiceModal({ onClose }: { onClose: () => void }) {
  const { createService, notify, categories } = useStore();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("60");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await createService({ name, price: Number(price) || 0, durationMinutes: Number(duration) || 60, description: description || undefined });
      notify("Serviço criado com sucesso.");
      onClose();
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Não foi possível criar o serviço.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Novo serviço" eyebrow="Expanda seu catálogo" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-form-grid">
          <Field label="Nome do serviço"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Corte" required minLength={2} /></Field>
          <Field label="Valor"><div className="input-with-prefix"><span>R$</span><input className="input" type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} required /></div></Field>
          <Field label="Duração"><div className="input-with-suffix"><input className="input" type="number" min="5" step="5" value={duration} onChange={(e) => setDuration(e.target.value)} required /><span>min</span></div></Field>
          <Field label="Descrição"><textarea className="input textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Breve descrição." /></Field>
        </div>
        {categories.length === 0 && <div className="form-note" style={{ marginTop: 8 }}><Tag size={14} /> Você poderá organizar em categorias depois.</div>}
        <div className="modal-footer"><div className="modal-actions"><Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={submitting}>{submitting ? "Criando..." : <><Plus size={16} /> Criar serviço</>}</Button></div></div>
      </form>
    </Modal>
  );
}

function NewEmployeeModal({ onClose }: { onClose: () => void }) {
  const { createEmployee, notify, services } = useStore();
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("Profissional");
  const [phone, setPhone] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await createEmployee({ name, jobTitle, phone: phone || undefined, serviceIds });
      notify("Profissional adicionado e horários configurados.");
      onClose();
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Não foi possível adicionar o profissional.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Adicionar profissional" eyebrow="Pessoas e horários" onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="modal-form-grid">
          <Field label="Nome completo"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Beatriz Ramos" required minLength={2} /></Field>
          <Field label="Cargo ou especialidade"><input className="input" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /></Field>
          <Field label="Telefone"><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" /></Field>
          <Field label="Serviços que realiza">
            <div className="service-multi-select">
              {services.map((service) => (
                <button type="button" key={service.id} className={serviceIds.includes(service.id) ? "service-option active" : "service-option"} onClick={() => setServiceIds((current) => current.includes(service.id) ? current.filter((s) => s !== service.id) : [...current, service.id])}>
                  <span>{service.name}</span>
                </button>
              ))}
              {services.length === 0 && <span className="field-hint">Cadastre serviços primeiro.</span>}
            </div>
          </Field>
        </div>
        <div className="modal-footer"><div className="modal-actions"><Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={submitting}>{submitting ? "Salvando..." : <><UserPlus size={16} /> Adicionar</>}</Button></div></div>
      </form>
    </Modal>
  );
}

function NewLocationModal({ onClose }: { onClose: () => void }) {
  const { createLocation, notify } = useStore();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [openTime, setOpenTime] = useState("08:00");
  const [closeTime, setCloseTime] = useState("19:00");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await createLocation({ name, address: address || undefined, phone: phone || undefined, openTime, closeTime });
      notify("Unidade criada com sucesso.");
      onClose();
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Erro ao criar unidade.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Nova unidade" eyebrow="Multiunidade" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-form-grid">
          <Field label="Nome da unidade"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Unidade Centro" required minLength={2} /></Field>
          <Field label="Endereço"><input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Av. Principal, 100" /></Field>
          <Field label="Telefone"><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 3333-4444" /></Field>
          <Field label="Abertura"><input className="input" type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} required /></Field>
          <Field label="Fechamento"><input className="input" type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} required /></Field>
        </div>
        <div className="modal-footer"><div className="modal-actions"><Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={submitting}>{submitting ? "Criando..." : "Criar unidade"}</Button></div></div>
      </form>
    </Modal>
  );
}

function BlockModal({ onClose, defaultDate }: { onClose: () => void; defaultDate: string }) {
  const { employees, locations, createBlock, notify } = useStore();
  const [employeeId, setEmployeeId] = useState("all");
  const [locationId, setLocationId] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [endDate, setEndDate] = useState(defaultDate);
  const [blockType, setBlockType] = useState<"hours" | "allDay" | "period">("hours");
  const [startsAt, setStartsAt] = useState("12:00");
  const [endsAt, setEndsAt] = useState("13:00");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await createBlock({
        employeeId: employeeId === "all" ? null : employeeId,
        locationId: locationId || null,
        date,
        endDate: blockType === "period" ? endDate : date,
        startsAt: blockType === "hours" ? startsAt : undefined,
        endsAt: blockType === "hours" ? endsAt : undefined,
        allDay: blockType !== "hours",
        reason: reason || (blockType === "period" ? "Férias" : blockType === "allDay" ? "Feriado" : "Bloqueio"),
      });
      notify("Período bloqueado com sucesso.");
      onClose();
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Não foi possível bloquear.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Bloquear horário ou período" eyebrow="Reserve horários na agenda" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-form-grid">
          <Field label="Profissional">
            <SelectField value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="all">Toda a equipe (Geral da empresa)</option>
              {employees.filter((e) => e.active).map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </SelectField>
          </Field>
          <Field label="Unidade">
            <SelectField value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">Todas as unidades</option>
              {locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
            </SelectField>
          </Field>
          <Field label="Tipo de bloqueio">
            <SelectField value={blockType} onChange={(e) => setBlockType(e.target.value as "hours" | "allDay" | "period")}>
              <option value="hours">Parcial (Horário específico)</option>
              <option value="allDay">Dia inteiro (Feriado/Folga)</option>
              <option value="period">Período de múltiplos dias (Férias)</option>
            </SelectField>
          </Field>
          <Field label="Motivo"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: Almoço, Reforma, Férias..." required /></Field>
          <Field label="Data inicial"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
          {blockType === "period" && <Field label="Data final"><input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required /></Field>}
          {blockType === "hours" && <Field label="Horário início"><input className="input" type="time" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required /></Field>}
          {blockType === "hours" && <Field label="Horário fim"><input className="input" type="time" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required /></Field>}
        </div>
        <div className="modal-footer"><span className="form-note"><CircleAlert size={14} /> O motor impedirá agendamentos neste intervalo</span><div className="modal-actions"><Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={submitting}>{submitting ? "Bloqueando..." : "Bloquear"}</Button></div></div>
      </form>
    </Modal>
  );
}

function AppointmentDetailModal({ appointment, onClose }: { appointment: AppointmentDTO; onClose: () => void }) {
  const { updateAppointmentStatus, finishAppointment, rescheduleAppointment, notify, employees, services, clients } = useStore();
  const shareUrl = `https://wa.me/${formatPhoneForWhatsApp(appointment.clientPhone)}?text=${encodeURIComponent(`Olá, ${appointment.clientName}! Seu atendimento de ${appointment.serviceName} com ${appointment.employeeName} está confirmado para ${shortDate(appointment.date)} às ${normalizeTime(appointment.startTime)}.`)}`;

  const confirm = async () => {
    try { await updateAppointmentStatus(appointment.id, "confirmed"); notify("Atendimento confirmado."); onClose(); } catch (e) { notify(e instanceof ApiError ? e.message : "Erro.", "error"); }
  };
  const start = async () => {
    try { await updateAppointmentStatus(appointment.id, "in_progress"); notify("Atendimento iniciado."); onClose(); } catch (e) { notify(e instanceof ApiError ? e.message : "Erro.", "error"); }
  };
  const cancel = async () => {
    if (!window.confirm("Cancelar este atendimento?")) return;
    try { await updateAppointmentStatus(appointment.id, "cancelled"); notify("Atendimento cancelado."); onClose(); } catch (e) { notify(e instanceof ApiError ? e.message : "Erro.", "error"); }
  };
  const arrived = async () => {
    try { await updateAppointmentStatus(appointment.id, "waiting"); notify("Cliente marcado como aguardando."); onClose(); } catch (e) { notify(e instanceof ApiError ? e.message : "Erro.", "error"); }
  };
  const noShow = async () => {
    if (!window.confirm("Marcar como não compareceu?")) return;
    try { await updateAppointmentStatus(appointment.id, "no_show"); notify("Registrado como não compareceu."); onClose(); } catch (e) { notify(e instanceof ApiError ? e.message : "Erro.", "error"); }
  };

  const [finishing, setFinishing] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [amount, setAmount] = useState(appointment.total);
  const [discount, setDiscount] = useState(0);

  const [rescheduling, setRescheduling] = useState(false);
  const [newDate, setNewDate] = useState(appointment.date);
  const [newTime, setNewTime] = useState(normalizeTime(appointment.startTime));
  const [newEmployee, setNewEmployee] = useState(appointment.employeeId);
  const [rescheduleSlots, setRescheduleSlots] = useState<Array<{ startTime: string; endTime: string }>>([]);

  const finalCharge = Math.max(0, amount - discount);

  // Availability calculation for rescheduling
  useEffect(() => {
    if (!newEmployee || !newDate) return;
    let active = true;
    api<{ slots: Array<{ startTime: string; endTime: string }> }>(
      `/api/availability?employeeId=${newEmployee}&date=${newDate}&duration=${appointment.durationMinutes}`
    )
      .then((res) => {
        if (active) setRescheduleSlots(res.slots || []);
      })
      .catch(() => {
        if (active) setRescheduleSlots([]);
      });
    return () => { active = false; };
  }, [newEmployee, newDate, appointment.durationMinutes]);

  const doFinish = async () => {
    setFinishing(true);
    try {
      await finishAppointment(appointment.id, finalCharge, method, discount);
      notify("Atendimento finalizado e pagamento registrado com sucesso.");
      onClose();
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Erro ao finalizar.", "error");
    } finally {
      setFinishing(false);
    }
  };

  const doReschedule = async () => {
    setRescheduling(true);
    try {
      await rescheduleAppointment(appointment.id, { date: newDate, startTime: newTime, employeeId: newEmployee });
      notify("Atendimento reagendado com sucesso.");
      onClose();
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Não foi possível reagendar.", "error");
    } finally {
      setRescheduling(false);
    }
  };

  return (
    <Modal title="Detalhes do atendimento" eyebrow={`${shortDate(appointment.date)} · ${normalizeTime(appointment.startTime)}`} onClose={onClose} wide>
      <div className="detail-person"><Avatar name={appointment.clientName} photoUrl={appointment.clientPhotoUrl || clients.find((c) => c.id === appointment.clientId)?.photoUrl} color={avatarColor(appointment.clientName)} size="lg" /><div><h3>{appointment.clientName}</h3><p>{appointment.clientPhone}</p></div><StatusBadge status={appointment.status} /></div>
      <div className="detail-grid">
        <div><span>Serviço</span><strong>{appointment.serviceName}</strong></div>
        <div><span>Profissional</span><strong>{appointment.employeeName}</strong></div>
        <div><span>Unidade</span><strong>{appointment.locationName ?? "Unidade Principal"}</strong></div>
        <div><span>Horário</span><strong>{normalizeTime(appointment.startTime)} – {normalizeTime(appointment.endTime)}</strong></div>
        <div><span>Duração</span><strong>{appointment.durationMinutes} minutos</strong></div>
        <div><span>Valor previsto</span><strong>{formatCurrency(appointment.total)}</strong></div>
        <div><span>Pagamento</span><strong>{appointment.paid ? `Recebido (${appointment.paymentMethod ? PAYMENT_LABELS[appointment.paymentMethod] : "OK"})` : "Pendente"}</strong></div>
      </div>
      {appointment.notes && <div className="detail-note"><FileText size={15} /><span>{appointment.notes}</span></div>}

      {appointment.status !== "completed" && appointment.status !== "cancelled" && appointment.status !== "no_show" && (
        <>
          <div className="detail-actions-inline">
            {appointment.status === "scheduled" && <Button variant="secondary" onClick={confirm}><Check size={15} /> Confirmar</Button>}
            {(appointment.status === "scheduled" || appointment.status === "confirmed") && <Button variant="secondary" onClick={arrived}><UserRound size={15} /> Cliente chegou</Button>}
            {appointment.status !== "in_progress" && <Button variant="secondary" onClick={start}><Zap size={15} /> Iniciar</Button>}
            <Button variant="danger" onClick={cancel}><X size={15} /> Cancelar</Button>
            {(appointment.status === "scheduled" || appointment.status === "confirmed" || appointment.status === "waiting") && <Button variant="ghost" onClick={noShow}><CircleAlert size={15} /> Não compareceu</Button>}
            {appointment.clientPhone && <a className="whatsapp-button" href={shareUrl} target="_blank" rel="noreferrer"><MessageCircle size={16} /> WhatsApp</a>}
          </div>

          <div className="detail-section">
            <div className="detail-section-head"><h3>Finalizar atendimento e receber</h3><Button onClick={doFinish} disabled={finishing}>{finishing ? "Processando..." : <><CheckCheck size={16} /> Finalizar e registrar {formatCurrency(finalCharge)}</>}</Button></div>
            <div className="finish-fields">
              <Field label="Valor original"><div className="input-with-prefix"><span>R$</span><input className="input" type="number" min="0" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div></Field>
              <Field label="Desconto opcional"><div className="input-with-prefix"><span>R$</span><input className="input" type="number" min="0" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></div></Field>
              <Field label="Total final cobrado"><input className="input" value={formatCurrency(finalCharge)} readOnly style={{ fontWeight: 700 }} /></Field>
              <Field label="Forma de pagamento"><SelectField value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>{(["pix", "cash", "debit", "credit", "other"] as PaymentMethod[]).map((m) => <option key={m} value={m}>{PAYMENT_LABELS[m]}</option>)}</SelectField></Field>
            </div>
          </div>

          <div className="detail-section">
            <div className="detail-section-head"><h3>Reagendar</h3><Button variant="secondary" onClick={doReschedule} disabled={rescheduling}>{rescheduling ? "Reagendando..." : <><CalendarDays size={15} /> Reagendar</>}</Button></div>
            <div className="finish-fields">
              <Field label="Nova data"><input className="input" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} /></Field>
              <Field label="Profissional"><SelectField value={newEmployee} onChange={(e) => setNewEmployee(e.target.value)}>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</SelectField></Field>
              <Field label="Novo horário">
                <input className="input" type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
                {rescheduleSlots.length > 0 && (
                  <div className="slot-chips-wrap">
                    <span className="slot-chips-label">Horários livres:</span>
                    <div className="slot-chips-grid">
                      {rescheduleSlots.slice(0, 10).map((s) => (
                        <button type="button" key={s.startTime} className={`slot-chip ${newTime === s.startTime ? "active" : ""}`} onClick={() => setNewTime(s.startTime)}>
                          {s.startTime}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Field>
            </div>
          </div>
        </>
      )}
      <div className="modal-footer"><Button variant="ghost" onClick={onClose}>Fechar</Button></div>
    </Modal>
  );
}

function SuperadminModal({ onClose }: { onClose: () => void }) {
  const [stats, setStats] = useState<SuperadminStatsDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<SuperadminStatsDTO>("/api/superadmin")
      .then((data) => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Modal title="Painel Superadmin Nova(e)" eyebrow="Administração da Plataforma" onClose={onClose} wide>
      {loading && <div className="popover-empty">Carregando dados da plataforma...</div>}
      {stats && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="metrics-grid">
            <div className="metric-card"><div className="metric-icon metric-teal"><Building2 size={18} /></div><div className="metric-copy"><p>Empresas</p><strong>{stats.totalCompanies}</strong></div></div>
            <div className="metric-card"><div className="metric-icon metric-lilac"><Users size={18} /></div><div className="metric-copy"><p>Usuários totais</p><strong>{stats.totalUsers}</strong></div></div>
            <div className="metric-card"><div className="metric-icon metric-amber"><UserRound size={18} /></div><div className="metric-copy"><p>Profissionais</p><strong>{stats.totalEmployees}</strong></div></div>
            <div className="metric-card"><div className="metric-icon metric-rose"><CalendarDays size={18} /></div><div className="metric-copy"><p>Agendamentos totais</p><strong>{stats.totalAppointments}</strong></div></div>
          </div>

          <section>
            <SectionHeading title="Empresas cadastradas no Nova(e)" description="Visão global dos clientes da plataforma" />
            <div className="data-table-wrap">
              <table className="data-table">
                <thead><tr><th>Empresa</th><th>Ramo</th><th>Usuários</th><th>Profissionais</th><th>Unidades</th><th>Agendamentos</th><th>Cadastro</th></tr></thead>
                <tbody>
                  {stats.recentCompanies.map((c) => (
                    <tr key={c.id}>
                      <td><strong>{c.name}</strong><br /><small className="muted-text">{c.email ?? "—"}</small></td>
                      <td>{c.businessType ?? "Geral"}</td>
                      <td>{c.usersCount}</td>
                      <td>{c.employeesCount}</td>
                      <td>{c.locationsCount}</td>
                      <td><strong>{c.appointmentsCount}</strong></td>
                      <td><small>{shortDate(c.createdAt.slice(0, 10))}</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
      <div className="modal-footer"><Button variant="ghost" onClick={onClose}>Fechar</Button></div>
    </Modal>
  );
}

/* ---------- Main shell ---------- */
export function AppShell() {
  const {
    session, appointments, employees, locations, activeLocationId, setActiveLocationId,
    blocks, deleteBlock,
    notifications, unreadCount, markAllNotificationsRead, markNotificationRead, logout, toasts, dismissToast,
  } = useStore();

  const [view, setView] = useState<ViewKey>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("agenda-view");
      return (saved as ViewKey) || "dashboard";
    }
    return "dashboard";
  });
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());
  const [collapsed, setCollapsed] = useState(false);
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [calMode, setCalMode] = useState<CalendarMode>("day");
  const [employeeFilter, setEmployeeFilter] = useState("all");

  // Interactive header widgets
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultDTO | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  // Modals
  const [newAppointmentOpen, setNewAppointmentOpen] = useState(false);
  const [newAppointmentPrefill, setNewAppointmentPrefill] = useState<{
    clientId?: string;
    employeeId?: string;
    startTime?: string;
    date?: string;
  } | null>(null);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newServiceOpen, setNewServiceOpen] = useState(false);
  const [newEmployeeOpen, setNewEmployeeOpen] = useState(false);
  const [newLocationOpen, setNewLocationOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [superadminOpen, setSuperadminOpen] = useState(false);
  const [detailAppointment, setDetailAppointment] = useState<AppointmentDTO | null>(null);
  const [clientDrawer, setClientDrawer] = useState<ClientDTO | null>(null);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("agenda-view", view);
  }, [view]);

  // Global search hook
  useEffect(() => {
    if (!globalSearch.trim() || globalSearch.trim().length < 2) {
      setSearchResults(null);
      setSearchOpen(false);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      api<SearchResultDTO>(`/api/search?q=${encodeURIComponent(globalSearch.trim())}`)
        .then((res) => {
          if (active) {
            setSearchResults(res);
            setSearchOpen(true);
          }
        })
        .catch(() => {});
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [globalSearch]);

  const navigate = (v: ViewKey) => { setView(v); setMobileMenu(false); };

  const activeLoc = locations.find((l) => l.id === activeLocationId) ?? locations[0];

  const render = () => {
    switch (view) {
      case "dashboard":
        return <DashboardPage onNew={() => setNewAppointmentOpen(true)} onAppointment={setDetailAppointment} onGoToAgenda={() => navigate("agenda")} />;
      case "clientes":
        return (
          <ClientsPage
            onSelect={setClientDrawer}
            onNew={() => setNewClientOpen(true)}
            onNewAppointment={(client) => {
              setNewAppointmentPrefill({ clientId: client.id });
              setNewAppointmentOpen(true);
            }}
          />
        );
      case "servicos":
        return <ServicesPage onNew={() => setNewServiceOpen(true)} />;
      case "equipe":
        return <TeamPage onNew={() => setNewEmployeeOpen(true)} />;
      case "financeiro":
        return <FinancialPage />;
      case "configuracoes":
        return <SettingsPage theme={theme} setTheme={setTheme} onNewLocation={() => setNewLocationOpen(true)} />;
      case "agenda":
        return <CalendarPage />;
    }
  };

  function CalendarPage() {
    const byEmployee = appointments.filter((a) => employeeFilter === "all" || a.employeeId === employeeFilter);
    const displayed = byEmployee.filter((a) => a.date === selectedDate);

    const changeDate = (direction: number) => {
      const d = new Date(`${selectedDate}T12:00:00Z`);
      if (calMode === "day") {
        d.setUTCDate(d.getUTCDate() + direction);
      } else if (calMode === "week") {
        d.setUTCDate(d.getUTCDate() + direction * 7);
      } else if (calMode === "month") {
        d.setUTCMonth(d.getUTCMonth() + direction);
      }
      setSelectedDate(d.toISOString().slice(0, 10));
    };

    // Calculate dynamic title for the view
    const calendarTitle = useMemo(() => {
      if (calMode === "month") {
        const d = new Date(`${selectedDate}T12:00:00`);
        const formatted = monthFormatter.format(d);
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
      }
      if (calMode === "week") {
        const start = new Date(`${selectedDate}T12:00:00Z`);
        const monday = new Date(start);
        monday.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
        const sunday = new Date(monday);
        sunday.setUTCDate(monday.getUTCDate() + 6);

        const monDay = String(monday.getUTCDate()).padStart(2, "0");
        const sunDay = String(sunday.getUTCDate()).padStart(2, "0");
        const monMonth = monday.toLocaleString("pt-BR", { month: "short" }).replace(".", "");
        const sunMonth = sunday.toLocaleString("pt-BR", { month: "short" }).replace(".", "");
        const year = sunday.getUTCFullYear();

        if (monMonth === sunMonth) {
          return `${monDay} a ${sunDay} de ${monMonth}, ${year}`;
        }
        return `${monDay} de ${monMonth} a ${sunDay} de ${sunMonth}, ${year}`;
      }
      return dateLabel(selectedDate);
    }, [calMode, selectedDate]);

    // View-specific appointment collections
    const weekDays = useMemo(() => {
      const start = new Date(`${selectedDate}T12:00:00Z`);
      const monday = new Date(start);
      monday.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setUTCDate(monday.getUTCDate() + i);
        return d.toISOString().slice(0, 10);
      });
    }, [selectedDate]);

    const weekAppointments = useMemo(() => {
      return byEmployee.filter((a) => weekDays.includes(a.date));
    }, [byEmployee, weekDays]);

    const monthAppointments = useMemo(() => {
      const ym = selectedDate.slice(0, 7);
      return byEmployee.filter((a) => a.date.startsWith(ym));
    }, [byEmployee, selectedDate]);

    const currentApts = calMode === "day" ? displayed : calMode === "week" ? weekAppointments : monthAppointments;
    const projectedRevenue = currentApts.reduce((sum, a) => sum + (a.status !== "cancelled" ? a.total : 0), 0);
    const activeCount = currentApts.filter((a) => a.status !== "cancelled").length;

    return (
      <div className="page-content calendar-page">
        <div className="page-intro compact-intro">
          <div>
            <p className="eyebrow">Agenda do estabelecimento</p>
            <h1>{calendarTitle}</h1>
            <p className="intro-copy">
              {activeCount} {activeCount === 1 ? "atendimento" : "atendimentos"} · {formatCurrency(projectedRevenue)} previsto
            </p>
          </div>
        </div>

        <div className="calendar-toolbar">
          <div className="calendar-date-controls">
            <button className="today-button" onClick={() => setSelectedDate(todayKey())}>
              Hoje
            </button>
            <IconButton label="Anterior" onClick={() => changeDate(-1)}>
              <ChevronLeft size={18} />
            </IconButton>
            <IconButton label="Próxima" onClick={() => changeDate(1)}>
              <ChevronRight size={18} />
            </IconButton>
            <strong className="calendar-title-display">{calendarTitle}</strong>
          </div>
          <div className="toolbar-actions">
            <div className="view-switcher">
              {(["day", "week", "month"] as CalendarMode[]).map((m) => (
                <button
                  key={m}
                  className={calMode === m ? "active" : ""}
                  onClick={() => setCalMode(m)}
                >
                  {m === "day" ? "Dia" : m === "week" ? "Semana" : "Mês"}
                </button>
              ))}
            </div>
            <Button variant="secondary" onClick={() => setBlockOpen(true)}>
              <Clock3 size={16} /> Bloquear horário
            </Button>
            <Button onClick={() => { setNewAppointmentPrefill(null); setNewAppointmentOpen(true); }}>
              <Plus size={16} /> Novo agendamento
            </Button>
          </div>
        </div>

        <div className="calendar-filter-row">
          <div className="employee-filter-label">
            <Users size={15} />
            <span>Profissional:</span>
            <SelectField value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)}>
              <option value="all">Todos os profissionais ({employees.filter((e) => e.active).length})</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} {!e.active ? "(Inativo)" : ""}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="calendar-legend">
            {employees.filter((e) => e.active).slice(0, 5).map((e) => (
              <span key={e.id} className="legend-chip">
                <i style={{ backgroundColor: e.color || "var(--primary)" }} />
                {e.name.split(" ")[0]}
              </span>
            ))}
          </div>
        </div>

        {calMode === "day" && (
          <DayCalendar
            appointments={displayed}
            employees={employees}
            employeeFilter={employeeFilter}
            selectedDate={selectedDate}
            blocks={blocks}
            deleteBlock={deleteBlock}
            onAppointment={setDetailAppointment}
            onNewAt={(empId, time) => {
              setNewAppointmentPrefill({ employeeId: empId, startTime: time, date: selectedDate });
              setNewAppointmentOpen(true);
            }}
          />
        )}
        {calMode === "week" && (
          <WeekCalendar
            appointments={byEmployee}
            employees={employees}
            anchorDate={selectedDate}
            weekDays={weekDays}
            blocks={blocks}
            onAppointment={setDetailAppointment}
            setDate={(d) => {
              setSelectedDate(d);
              setCalMode("day");
            }}
            onNewAt={(date, time) => {
              setNewAppointmentPrefill({ date, startTime: time });
              setNewAppointmentOpen(true);
            }}
          />
        )}
        {calMode === "month" && (
          <MonthCalendar
            appointments={byEmployee}
            anchorDate={selectedDate}
            onAppointment={setDetailAppointment}
            setDate={(d) => {
              setSelectedDate(d);
              setCalMode("day");
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="app-shell" onClick={() => { setSearchOpen(false); setNotificationsOpen(false); setWorkspaceOpen(false); }}>
      <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""} ${mobileMenu ? "mobile-open" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="sidebar-top">
          <Logo collapsed={collapsed} />
          <IconButton
            className="collapse-button"
            label="Recolher menu"
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </IconButton>
        </div>
        
        {/* Workspace Switcher */}
        <div className="popover-container">
          <div className="workspace-switcher" onClick={() => setWorkspaceOpen((v) => !v)} style={{ cursor: "pointer" }}>
            <span className="workspace-logo">{initials(session?.company.name ?? "A")}</span>
            {!collapsed && (
              <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><strong>{session?.company.name}</strong><small>{activeLoc?.name ?? "Unidade principal"}</small></div>
                <ChevronDown size={14} className="muted-text" />
              </div>
            )}
          </div>
          {workspaceOpen && (
            <div className="workspace-dropdown">
              <div style={{ padding: "6px 12px", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>Suas unidades</div>
              {locations.map((loc) => (
                <button
                  key={loc.id}
                  className={`workspace-option ${activeLocationId === loc.id ? "active" : ""}`}
                  onClick={() => { setActiveLocationId(loc.id); setWorkspaceOpen(false); }}
                >
                  <span>{loc.name}</span>
                  {activeLocationId === loc.id && <Check size={14} />}
                </button>
              ))}
              <button
                className="workspace-option"
                style={{ borderTop: "1px solid var(--border)", color: "var(--primary)" }}
                onClick={() => { setNewLocationOpen(true); setWorkspaceOpen(false); }}
              >
                <span>+ Nova unidade</span>
              </button>
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={view === id ? "active" : ""} onClick={() => navigate(id)}>
              <Icon size={18} />
              <span>{label}</span>
              {id === "agenda" && !collapsed && <em>{appointments.filter((a) => a.date === todayKey() && !["cancelled", "no_show"].includes(a.status)).length}</em>}
            </button>
          ))}
          {session?.isSuperadmin && !collapsed && (
            <button className="superadmin-button" onClick={() => setSuperadminOpen(true)} style={{ marginTop: 12, border: "1px dashed var(--primary)", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, background: "transparent", color: "var(--primary)", cursor: "pointer", width: "100%" }}>
              <Sparkles size={16} /><span>Superadmin</span>
            </button>
          )}
        </nav>

        <div className="sidebar-bottom">
          <button className="profile-nav" onClick={() => setProfileDrawerOpen(true)}>
            <span className="profile-avatar">{initials(session?.name ?? "U")}</span>
            {!collapsed && <span><strong>{session?.name}</strong><small>{roleLabel(session?.role)}</small></span>}
            <MoreHorizontal size={17} />
          </button>
          <button className="logout-button" onClick={logout}><LogOut size={17} /><span>{!collapsed ? "Sair da conta" : "Sair"}</span></button>
        </div>
      </aside>

      <main className={`main-content ${collapsed ? "main-expanded" : ""}`}>
        <header className="topbar" onClick={(e) => e.stopPropagation()}>
          <div className="topbar-left">
            <IconButton label="Menu" className="mobile-menu-button" onClick={() => setMobileMenu((v) => !v)}><Menu size={20} /></IconButton>
            <div className="breadcrumb">
              <span className="breadcrumb-company">
                <Building2 size={13} />
                <span>{session?.company.name}</span>
              </span>
              <ChevronRight size={13} className="breadcrumb-arrow" />
              <strong className="breadcrumb-page">{pageTitles[view].title}</strong>
            </div>
          </div>
          
          <div className="topbar-actions">
            {/* Global Search */}
            <div className="popover-container" style={{ flex: 1, maxWidth: 320 }}>
              <div className="global-search">
                <Search size={16} />
                <input
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  placeholder="Buscar clientes, serviços, equipe..."
                  onFocus={() => { if (searchResults) setSearchOpen(true); }}
                />
                {globalSearch ? (
                  <button
                    onClick={() => { setGlobalSearch(""); setSearchOpen(false); }}
                    className="clear-search-btn"
                    title="Limpar busca"
                  >
                    <X size={14} />
                  </button>
                ) : (
                  <kbd className="topbar-search-kbd">⌘K</kbd>
                )}
              </div>

              {searchOpen && searchResults && (
                <div className="search-dropdown">
                  {searchResults.clients.length > 0 && (
                    <div className="search-section">
                      <div className="search-section-title">Clientes</div>
                      {searchResults.clients.map((c) => (
                        <button key={c.id} className="search-item" onClick={() => { setClientDrawer(c as ClientDTO); setSearchOpen(false); }}>
                          <div className="search-item-main"><strong>{c.name}</strong><span>{c.phone}</span></div>
                          <span className="search-item-badge">Cliente</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.employees.length > 0 && (
                    <div className="search-section">
                      <div className="search-section-title">Profissionais</div>
                      {searchResults.employees.map((e) => (
                        <button key={e.id} className="search-item" onClick={() => { navigate("equipe"); setSearchOpen(false); }}>
                          <div className="search-item-main"><strong>{e.name}</strong><span>{e.jobTitle ?? "Profissional"}</span></div>
                          <span className="search-item-badge">Equipe</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.services.length > 0 && (
                    <div className="search-section">
                      <div className="search-section-title">Serviços</div>
                      {searchResults.services.map((s) => (
                        <button key={s.id} className="search-item" onClick={() => { navigate("servicos"); setSearchOpen(false); }}>
                          <div className="search-item-main"><strong>{s.name}</strong><span>{s.durationMinutes} min</span></div>
                          <span className="search-item-badge">{formatCurrency(s.price)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.appointments.length > 0 && (
                    <div className="search-section">
                      <div className="search-section-title">Agendamentos</div>
                      {searchResults.appointments.map((a) => (
                        <button key={a.id} className="search-item" onClick={() => { navigate("agenda"); setSearchOpen(false); }}>
                          <div className="search-item-main"><strong>{a.clientName} ({a.time})</strong><span>com {a.employeeName} em {shortDate(a.date)}</span></div>
                          <span className="search-item-badge">{STATUS_LABELS[a.status]}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {!searchResults.clients.length && !searchResults.employees.length && !searchResults.services.length && !searchResults.appointments.length && (
                    <div className="popover-empty">Nenhum resultado encontrado para &quot;{globalSearch}&quot;.</div>
                  )}
                </div>
              )}
            </div>

            <IconButton label="Alternar tema" onClick={() => setTheme((t) => {
              const next = t === "light" ? "dark" : "light";
              applyTheme(next);
              return next;
            })}>{theme === "light" ? <Moon size={18} /> : <Sun size={18} />}</IconButton>

            {/* Notifications Popover */}
            <div className="popover-container">
              <button
                className="notification-button"
                aria-label="Notificações"
                onClick={() => setNotificationsOpen((v) => !v)}
              >
                <Bell size={18} />
                {unreadCount > 0 && <i />}
              </button>

              {notificationsOpen && (
                <div className="popover-dropdown">
                  <div className="popover-header">
                    <h3>Notificações ({unreadCount} novas)</h3>
                    {unreadCount > 0 && <button onClick={() => markAllNotificationsRead()}>Marcar lidas</button>}
                  </div>
                  <div className="popover-body">
                    {notifications.length > 0 ? (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          className={`notification-item ${!n.readAt ? "unread" : ""}`}
                          onClick={() => markNotificationRead(n.id)}
                        >
                          <div className="notification-item-top">
                            <span className="notification-item-title">{n.title}</span>
                            <span className="notification-item-time">{shortDate(n.createdAt.slice(0, 10))}</span>
                          </div>
                          {n.body && <p className="notification-item-body">{n.body}</p>}
                        </button>
                      ))
                    ) : (
                      <div className="popover-empty">Nenhuma notificação no momento.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Agendar Button in Topbar */}
            <button
              type="button"
              className="topbar-quick-add-btn"
              onClick={() => {
                setNewAppointmentPrefill(null);
                setNewAppointmentOpen(true);
              }}
              title="Novo agendamento rápido"
            >
              <CalendarPlus size={14} />
              <span>Agendar</span>
            </button>

            <button className="topbar-profile-button" onClick={() => setProfileDrawerOpen(true)} aria-label="Perfil">
              <span className="topbar-avatar-wrap">
                <span className="topbar-avatar">{initials(session?.name ?? "U")}</span>
                <span className="topbar-online-dot" title="Online" />
              </span>
            </button>
          </div>
        </header>

        {render()}
      </main>

      <nav className="mobile-bottom-nav">{navItems.slice(0, 5).map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? "active" : ""} onClick={() => navigate(id)}><Icon size={19} /><span>{label}</span></button>)}<button className="mobile-add-button" onClick={() => setNewAppointmentOpen(true)}><Plus size={21} /></button></nav>

      <button className="floating-add" onClick={() => setNewAppointmentOpen(true)} aria-label="Novo agendamento"><Plus size={23} /></button>

      {newAppointmentOpen && (
        <NewAppointmentModal
          onClose={() => {
            setNewAppointmentOpen(false);
            setNewAppointmentPrefill(null);
          }}
          defaultDate={newAppointmentPrefill?.date || selectedDate}
          defaultEmployeeId={newAppointmentPrefill?.employeeId}
          defaultStartTime={newAppointmentPrefill?.startTime}
          defaultClientId={newAppointmentPrefill?.clientId}
        />
      )}
      {newClientOpen && <NewClientModal onClose={() => setNewClientOpen(false)} />}
      {newServiceOpen && <NewServiceModal onClose={() => setNewServiceOpen(false)} />}
      {newEmployeeOpen && <NewEmployeeModal onClose={() => setNewEmployeeOpen(false)} />}
      {newLocationOpen && <NewLocationModal onClose={() => setNewLocationOpen(false)} />}
      {blockOpen && <BlockModal onClose={() => setBlockOpen(false)} defaultDate={selectedDate} />}
      {superadminOpen && <SuperadminModal onClose={() => setSuperadminOpen(false)} />}
      {detailAppointment && <AppointmentDetailModal appointment={detailAppointment} onClose={() => setDetailAppointment(null)} />}
      {clientDrawer && <ClientDrawer clientId={clientDrawer.id} onClose={() => setClientDrawer(null)} onNewAppointment={(client) => { setClientDrawer(null); setSelectedDate(todayKey()); setNewAppointmentOpen(true); }} />}
      {profileDrawerOpen && session && (
        <ProfileDrawer
          onClose={() => setProfileDrawerOpen(false)}
          session={session}
          onSettings={() => navigate("configuracoes")}
          onSuperadmin={session.isSuperadmin ? () => setSuperadminOpen(true) : undefined}
          onLogout={logout}
        />
      )}

      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function ProfileDrawer({ onClose, session, onSettings, onSuperadmin, onLogout }: { onClose: () => void; session: import("@/shared/types").SessionInfo; onSettings: () => void; onSuperadmin?: () => void; onLogout: () => void }) {
  return (
    <div className="drawer-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="profile-drawer">
        <div className="drawer-header"><span className="eyebrow">Sua conta</span><IconButton label="Fechar perfil" onClick={onClose}><X size={19} /></IconButton></div>

        <div className="profile-hero">
          <span className="profile-avatar-large">{initials(session?.name ?? "U")}</span>
          <h2>{session?.name}</h2>
          <p className="profile-role">{roleLabel(session?.role)}</p>
          <p className="profile-company">{session?.company.name}</p>
        </div>

        <div className="profile-info">
          <div className="info-item"><span className="info-label">E-mail</span><strong>{session?.email || "não informado"}</strong></div>
          <div className="info-item"><span className="info-label">Acesso desde</span><strong>{session?.createdAt ? new Date(session.createdAt).toLocaleDateString("pt-BR") : "—"}</strong></div>
        </div>

        <div className="profile-actions-drawer">
          {onSuperadmin && (
            <Button onClick={() => { onSuperadmin(); onClose(); }} className="full-width" variant="secondary">
              <Sparkles size={16} /> Painel Superadmin Nova(e)
            </Button>
          )}
          <Button onClick={() => { onSettings(); onClose(); }} className="full-width"><Settings2 size={16} /> Configurações da conta</Button>
          <Button variant="secondary" onClick={() => { onLogout(); onClose(); }} className="full-width"><LogOut size={16} /> Sair da conta</Button>
        </div>

        <div className="profile-footer"><span className="profile-version">Nova(e) Agenda v2.0 · Comercial</span></div>
      </aside>
    </div>
  );
}

function computeOverlapLayout(apts: AppointmentDTO[]) {
  const valid = apts.filter((a) => a.status !== "cancelled");
  if (valid.length === 0) return new Map<string, { col: number; totalCols: number }>();

  const sorted = [...valid].sort((a, b) => {
    const aStart = timeToMinutes(normalizeTime(a.startTime));
    const bStart = timeToMinutes(normalizeTime(b.startTime));
    if (aStart !== bStart) return aStart - bStart;
    return b.durationMinutes - a.durationMinutes;
  });

  const layoutMap = new Map<string, { col: number; totalCols: number }>();
  const tracks: Array<{ end: number; id: string }[]> = [];

  for (const apt of sorted) {
    const start = timeToMinutes(normalizeTime(apt.startTime));
    const end = start + apt.durationMinutes;

    let placed = false;
    for (let t = 0; t < tracks.length; t++) {
      const track = tracks[t];
      const lastInTrack = track[track.length - 1];
      if (lastInTrack.end <= start) {
        track.push({ end, id: apt.id });
        layoutMap.set(apt.id, { col: t, totalCols: tracks.length });
        placed = true;
        break;
      }
    }
    if (!placed) {
      tracks.push([{ end, id: apt.id }]);
      layoutMap.set(apt.id, { col: tracks.length - 1, totalCols: tracks.length });
    }
  }

  // Update totalCols for overlapping clusters
  for (const apt of sorted) {
    const start = timeToMinutes(normalizeTime(apt.startTime));
    const end = start + apt.durationMinutes;
    const overlapping = sorted.filter((other) => {
      const oStart = timeToMinutes(normalizeTime(other.startTime));
      const oEnd = oStart + other.durationMinutes;
      return start < oEnd && end > oStart;
    });
    const maxCol = Math.max(...overlapping.map((o) => layoutMap.get(o.id)?.col ?? 0)) + 1;
    for (const o of overlapping) {
      const cur = layoutMap.get(o.id);
      if (cur && cur.totalCols < maxCol) {
        cur.totalCols = maxCol;
      }
    }
  }

  return layoutMap;
}

function DayCalendar({
  appointments,
  employees,
  employeeFilter,
  selectedDate,
  blocks,
  deleteBlock,
  onAppointment,
  onNewAt,
}: {
  appointments: AppointmentDTO[];
  employees: EmployeeDTO[];
  employeeFilter: string;
  selectedDate: string;
  blocks: ScheduleBlockDTO[];
  deleteBlock: (id: string) => Promise<void>;
  onAppointment: (a: AppointmentDTO) => void;
  onNewAt: (employeeId: string, time: string) => void;
}) {
  const START_HOUR = 8;
  const END_HOUR = 20;
  const hourHeight = 74;
  const slots = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => {
    const h = START_HOUR + i;
    return `${String(h).padStart(2, "0")}:00`;
  });

  const visibleEmployees = useMemo(() => {
    if (employeeFilter !== "all") {
      const found = employees.filter((e) => e.id === employeeFilter);
      if (found.length > 0) return found;
    }
    const active = employees.filter((e) => e.active);
    return active.length > 0 ? active : employees;
  }, [employees, employeeFilter]);

  const isToday = selectedDate === todayKey();
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const nowTop = ((currentMinutes - START_HOUR * 60) / 60) * hourHeight;
  const nowVisible = isToday && nowTop >= 0 && nowTop <= slots.length * hourHeight;

  if (visibleEmployees.length === 0) {
    return (
      <section className="panel day-calendar-panel">
        <div className="day-empty" style={{ padding: "64px 20px", textAlign: "center" }}>
          <Users size={36} style={{ color: "var(--primary)", margin: "0 auto 14px", opacity: 0.8 }} />
          <h3>Nenhum profissional disponível</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "6px" }}>
            Cadastre membros da equipe para visualizar e gerenciar a grade de horários.
          </p>
        </div>
      </section>
    );
  }

  const columnWidthStyle = {
    gridTemplateColumns: `repeat(${visibleEmployees.length}, minmax(200px, 1fr))`,
  };

  return (
    <section className="panel day-calendar-panel">
      {/* Calendar Header with Employee Columns */}
      <div className="day-calendar-head">
        <div className="time-head">
          <Clock size={13} />
          <span>Horário</span>
        </div>
        <div className="employee-head-track" style={columnWidthStyle}>
          {visibleEmployees.map((emp) => {
            const empApts = appointments.filter((a) => a.employeeId === emp.id && a.status !== "cancelled");
            const empAllDayBlock = blocks.find(
              (b) => b.date === selectedDate && b.allDay && (!b.employeeId || b.employeeId === emp.id)
            );
            return (
              <div key={emp.id} className="employee-column-header">
                <div
                  className="employee-column-avatar"
                  style={{ backgroundColor: emp.color || "var(--primary)" }}
                >
                  {emp.photoUrl ? (
                    <img src={emp.photoUrl} alt={emp.name} className="employee-column-img" />
                  ) : (
                    <span>{emp.initials || emp.name.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div className="employee-column-info">
                  <strong className="employee-column-name" title={emp.name}>
                    {emp.name}
                  </strong>
                  <span className="employee-column-sub">
                    {empAllDayBlock ? (
                      <em className="emp-blocked-tag">Indisponível</em>
                    ) : (
                      `${empApts.length} ${empApts.length === 1 ? "atendimento" : "atendimentos"}`
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Calendar Body: Times + Columns */}
      <div className="day-calendar-body">
        <div className="time-column">
          {slots.map((time) => (
            <div key={time} className="time-slot-label" style={{ height: `${hourHeight}px` }}>
              <span>{time}</span>
            </div>
          ))}
        </div>

        <div
          className="day-columns-track"
          style={{
            ...columnWidthStyle,
            height: `${slots.length * hourHeight}px`,
          }}
        >
          {visibleEmployees.map((emp) => {
            const empApts = appointments.filter((a) => a.employeeId === emp.id);
            const empBlocks = blocks.filter(
              (b) => b.date === selectedDate && (!b.employeeId || b.employeeId === emp.id)
            );
            const overlapMap = computeOverlapLayout(empApts);

            return (
              <div key={emp.id} className="timeline-employee-column">
                {/* Background hour cells */}
                <div className="column-grid-lines">
                  {slots.map((time) => (
                    <div
                      key={time}
                      className="column-hour-cell"
                      style={{ height: `${hourHeight}px` }}
                      onClick={() => onNewAt(emp.id, time)}
                      title={`Clique para agendar com ${emp.name} às ${time}`}
                    >
                      <div className="column-half-hour-line" />
                    </div>
                  ))}
                </div>

                {/* Scheduled Blocks */}
                {empBlocks.map((b) => {
                  if (b.allDay) {
                    return (
                      <div
                        key={b.id}
                        className="timeline-block all-day-block"
                        style={{
                          top: 0,
                          height: `${slots.length * hourHeight}px`,
                          left: "4px",
                          right: "4px",
                        }}
                        title={`Dia todo bloqueado: ${b.reason}. Clique para remover.`}
                        onClick={() => {
                          if (window.confirm(`Deseja remover o bloqueio "${b.reason || "Dia bloqueado"}"?`)) {
                            deleteBlock(b.id);
                          }
                        }}
                      >
                        <div className="timeline-block-inner">
                          <Ban size={14} />
                          <strong>Dia Bloqueado</strong>
                          <span>{b.reason}</span>
                          <small>Clique para remover</small>
                        </div>
                      </div>
                    );
                  }
                  const bStart = timeToMinutes(normalizeTime(b.startsAt));
                  const bEnd = timeToMinutes(normalizeTime(b.endsAt));
                  const bTop = ((bStart - START_HOUR * 60) / 60) * hourHeight;
                  const bHeight = Math.max(((bEnd - bStart) / 60) * hourHeight, 28);
                  return (
                    <div
                      key={b.id}
                      className="timeline-block"
                      style={{
                        top: `${bTop}px`,
                        height: `${bHeight}px`,
                        left: "4px",
                        right: "4px",
                      }}
                      title={`Bloqueio: ${b.reason} (${normalizeTime(b.startsAt)} – ${normalizeTime(b.endsAt)}). Clique para remover.`}
                      onClick={() => {
                        if (window.confirm(`Deseja remover o bloqueio "${b.reason || "Horário bloqueado"}"?`)) {
                          deleteBlock(b.id);
                        }
                      }}
                    >
                      <div className="timeline-block-inner">
                        <Clock size={12} />
                        <strong>{b.reason || "Bloqueado"}</strong>
                        <small>{normalizeTime(b.startsAt)} – {normalizeTime(b.endsAt)}</small>
                      </div>
                    </div>
                  );
                })}

                {/* Appointments */}
                {empApts.map((apt) => {
                  const startMins = timeToMinutes(normalizeTime(apt.startTime));
                  const top = ((startMins - START_HOUR * 60) / 60) * hourHeight;
                  const height = Math.max((apt.durationMinutes / 60) * hourHeight - 6, 36);
                  const isCancelled = apt.status === "cancelled";
                  const accentColor =
                    apt.serviceColor && apt.serviceColor !== "#1f6f66"
                      ? apt.serviceColor
                      : emp.color || "var(--primary)";

                  const overlap = overlapMap.get(apt.id) || { col: 0, totalCols: 1 };
                  const widthPct = 100 / overlap.totalCols;
                  const leftPct = overlap.col * widthPct;
                  const isCompact = height < 50;

                  return (
                    <button
                      key={apt.id}
                      className={`timeline-appointment ${isCancelled ? "cancelled" : ""} ${isCompact ? "compact" : ""}`}
                      style={
                        {
                          top: `${top}px`,
                          height: `${height}px`,
                          left: `calc(${leftPct}% + 4px)`,
                          width: `calc(${widthPct}% - 8px)`,
                          "--appointment-color": accentColor,
                        } as React.CSSProperties
                      }
                      onClick={() => onAppointment(apt)}
                      title={`${apt.clientName} · ${apt.serviceName} (${normalizeTime(apt.startTime)} – ${normalizeTime(apt.endTime)})`}
                    >
                      {isCompact ? (
                        <div className="timeline-compact-row">
                          <span className="timeline-time">
                            <Clock size={10} />
                            {normalizeTime(apt.startTime)}
                          </span>
                          <strong className="timeline-client">{apt.clientName}</strong>
                          <span
                            className={`timeline-status-dot status-${apt.status}`}
                            title={STATUS_LABELS[apt.status]}
                          />
                        </div>
                      ) : (
                        <>
                          <div className="timeline-apt-header">
                            <span className="timeline-time">
                              <Clock size={10} />
                              {normalizeTime(apt.startTime)} – {normalizeTime(apt.endTime)}
                            </span>
                            <span
                              className={`timeline-status-dot status-${apt.status}`}
                              title={STATUS_LABELS[apt.status]}
                            />
                          </div>

                          <strong className="timeline-client">{apt.clientName}</strong>

                          <span className="timeline-service">{apt.serviceName}</span>
                          {height >= 68 && (
                            <div className="timeline-apt-footer">
                              <span className="timeline-price">{formatCurrency(apt.total)}</span>
                              {apt.durationMinutes && (
                                <span className="timeline-duration">{apt.durationMinutes} min</span>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}

          {/* Current time indicator line across all columns */}
          {nowVisible && (
            <div className="timeline-now-line" style={{ top: `${nowTop}px` }}>
              <div className="timeline-now-badge">
                <span className="timeline-now-dot" />
                <span>
                  {String(now.getHours()).padStart(2, "0")}:{String(now.getMinutes()).padStart(2, "0")}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {appointments.length === 0 && (
        <div className="day-empty-banner">
          <CalendarDays size={16} />
          <span>Nenhum atendimento agendado para este dia. Clique em qualquer horário para criar.</span>
        </div>
      )}
    </section>
  );
}

function WeekCalendar({
  appointments,
  employees,
  anchorDate,
  weekDays,
  blocks,
  onAppointment,
  setDate,
  onNewAt,
}: {
  appointments: AppointmentDTO[];
  employees: EmployeeDTO[];
  anchorDate: string;
  weekDays: string[];
  blocks: ScheduleBlockDTO[];
  onAppointment: (a: AppointmentDTO) => void;
  setDate: (d: string) => void;
  onNewAt: (date: string, time: string) => void;
}) {
  const today = todayKey();
  const START_HOUR = 8;
  const END_HOUR = 20;
  const hourHeight = 64;
  const slots = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => {
    const h = START_HOUR + i;
    return `${String(h).padStart(2, "0")}:00`;
  });

  const dayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  return (
    <section className="panel week-calendar-panel">
      {/* Week Header */}
      <div className="week-calendar-head">
        <div className="week-time-head">
          <Clock size={13} />
        </div>
        <div className="week-days-track">
          {weekDays.map((day, idx) => {
            const isToday = day === today;
            const isSelected = day === anchorDate;
            const dayApts = appointments.filter((a) => a.date === day && a.status !== "cancelled");
            return (
              <button
                key={day}
                className={`week-day-header-btn ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}`}
                onClick={() => setDate(day)}
                title={`Ver detalhes de ${day}`}
              >
                <span className="week-day-name">{dayLabels[idx]}</span>
                <strong className="week-day-num">{day.slice(8, 10)}</strong>
                <span className="week-day-count">{dayApts.length} atend.</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Week Body */}
      <div className="week-calendar-body">
        <div className="week-time-column">
          {slots.map((time) => (
            <div key={time} className="week-time-slot-label" style={{ height: `${hourHeight}px` }}>
              <span>{time}</span>
            </div>
          ))}
        </div>

        <div className="week-days-columns-track" style={{ height: `${slots.length * hourHeight}px` }}>
          {weekDays.map((day) => {
            const dayApts = appointments.filter((a) => a.date === day);
            const overlapMap = computeOverlapLayout(dayApts);

            return (
              <div key={day} className="week-day-col">
                {/* Background hours */}
                <div className="column-grid-lines">
                  {slots.map((time) => (
                    <div
                      key={time}
                      className="column-hour-cell week-hour-cell"
                      style={{ height: `${hourHeight}px` }}
                      onClick={() => onNewAt(day, time)}
                      title={`Agendar em ${day} às ${time}`}
                    >
                      <div className="column-half-hour-line" />
                    </div>
                  ))}
                </div>

                {/* Day Appointments */}
                {dayApts.map((apt) => {
                  const startMins = timeToMinutes(normalizeTime(apt.startTime));
                  const top = ((startMins - START_HOUR * 60) / 60) * hourHeight;
                  const height = Math.max((apt.durationMinutes / 60) * hourHeight - 4, 30);
                  const isCancelled = apt.status === "cancelled";
                  const emp = employees.find((e) => e.id === apt.employeeId);
                  const accentColor =
                    apt.serviceColor && apt.serviceColor !== "#1f6f66"
                      ? apt.serviceColor
                      : emp?.color || "var(--primary)";

                  const overlap = overlapMap.get(apt.id) || { col: 0, totalCols: 1 };
                  const widthPct = 100 / overlap.totalCols;
                  const leftPct = overlap.col * widthPct;

                  return (
                    <button
                      key={apt.id}
                      className={`week-appointment ${isCancelled ? "cancelled" : ""}`}
                      style={
                        {
                          top: `${top}px`,
                          height: `${height}px`,
                          left: `calc(${leftPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`,
                          "--appointment-color": accentColor,
                        } as React.CSSProperties
                      }
                      onClick={() => onAppointment(apt)}
                      title={`${normalizeTime(apt.startTime)}: ${apt.clientName} (${apt.serviceName})`}
                    >
                      <span className="week-apt-time">{normalizeTime(apt.startTime)}</span>
                      <strong className="week-apt-client">{apt.clientName}</strong>
                      {height >= 48 && <span className="week-apt-service">{apt.serviceName}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MonthCalendar({
  appointments,
  anchorDate,
  onAppointment,
  setDate,
}: {
  appointments: AppointmentDTO[];
  anchorDate: string;
  onAppointment: (a: AppointmentDTO) => void;
  setDate: (d: string) => void;
}) {
  const today = todayKey();
  const year = Number(anchorDate.slice(0, 4));
  const month = Number(anchorDate.slice(5, 7)) - 1;
  const first = new Date(Date.UTC(year, month, 1));
  const startOffset = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: Array<{ day: number; date: string } | null> = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      date: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    });
  }

  return (
    <section className="panel month-calendar-panel">
      <div className="month-weekdays">
        {["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="month-grid">
        {cells.map((cell, i) =>
          cell ? (
            <button
              key={cell.date}
              className={`month-cell ${cell.date === today ? "current" : ""} ${cell.date === anchorDate ? "selected" : ""}`}
              onClick={() => setDate(cell.date)}
            >
              <div className="month-cell-header">
                <span className="month-number">{cell.day}</span>
                {cell.date === today && <span className="month-today-pill">Hoje</span>}
              </div>
              <div className="month-events-list">
                {appointments
                  .filter((a) => a.date === cell.date && a.status !== "cancelled")
                  .slice(0, 3)
                  .map((apt) => (
                    <span
                      key={apt.id}
                      className="month-event-chip"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAppointment(apt);
                      }}
                      title={`${normalizeTime(apt.startTime)}: ${apt.clientName}`}
                    >
                      <i style={{ backgroundColor: apt.serviceColor || "var(--primary)" }} />
                      <b>{normalizeTime(apt.startTime)}</b>
                      <span>{apt.clientName.split(" ")[0]}</span>
                    </span>
                  ))}
                {appointments.filter((a) => a.date === cell.date && a.status !== "cancelled").length > 3 && (
                  <em className="month-more-chip">
                    +{appointments.filter((a) => a.date === cell.date && a.status !== "cancelled").length - 3} mais
                  </em>
                )}
              </div>
            </button>
          ) : (
            <div key={`empty-${i}`} className="month-cell muted" />
          )
        )}
      </div>
    </section>
  );
}
