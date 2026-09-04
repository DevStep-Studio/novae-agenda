export type AppointmentStatus =
  | "Agendado"
  | "Confirmado"
  | "Aguardando"
  | "Em atendimento"
  | "Finalizado"
  | "Cancelado"
  | "Não compareceu";

export type ViewKey = "dashboard" | "agenda" | "clientes" | "servicos" | "equipe" | "financeiro" | "relatorios" | "configuracoes";

export type Employee = {
  id: string;
  name: string;
  role: string;
  phone: string;
  color: string;
  initials: string;
  active: boolean;
  services: string[];
  appointments: number;
  revenue: number;
};

export type Client = {
  id: string;
  name: string;
  phone: string;
  email: string;
  initials: string;
  color: string;
  visits: number;
  spent: number;
  lastVisit: string;
  nextVisit?: string;
  notes?: string;
};

export type Service = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  duration: number;
  color: string;
  active: boolean;
  combo?: boolean;
};

export type Appointment = {
  id: string;
  date: string;
  time: string;
  endTime: string;
  duration: number;
  clientId: string;
  clientName: string;
  clientInitials: string;
  clientColor: string;
  phone: string;
  service: string;
  serviceId: string;
  employeeId: string;
  employee: string;
  employeeInitials: string;
  total: number;
  status: AppointmentStatus;
  notes?: string;
};

export const today = "2026-03-18";

export const employees: Employee[] = [
  { id: "ana", name: "Ana Costa", role: "Profissional", phone: "(11) 98842-1200", color: "#d6ebe6", initials: "AC", active: true, services: ["Corte", "Sobrancelha", "Unha + Gel"], appointments: 31, revenue: 4100 },
  { id: "joao", name: "João Mendes", role: "Profissional", phone: "(11) 99120-4432", color: "#e9e1d6", initials: "JM", active: true, services: ["Corte", "Barba", "Corte + Barba"], appointments: 24, revenue: 3200 },
  { id: "mariana", name: "Mariana Silva", role: "Especialista", phone: "(11) 98741-9012", color: "#e7dce8", initials: "MS", active: true, services: ["Unha", "Unha + Gel", "Sobrancelha"], appointments: 28, revenue: 3870 },
  { id: "pedro", name: "Pedro Alves", role: "Profissional", phone: "(11) 99621-7300", color: "#dce5ee", initials: "PA", active: true, services: ["Corte", "Barba"], appointments: 18, revenue: 2450 },
];

export const clients: Client[] = [
  { id: "lucas", name: "Lucas Santos", phone: "(11) 99812-4410", email: "lucas.santos@email.com", initials: "LS", color: "#d8e5f0", visits: 8, spent: 640, lastVisit: "15 mar 2026", nextVisit: "Hoje, 08:30", notes: "Prefere atendimento pela manhã." },
  { id: "camila", name: "Camila Oliveira", phone: "(11) 99731-2288", email: "camila.oliveira@email.com", initials: "CO", color: "#eadbdc", visits: 12, spent: 1430, lastVisit: "12 mar 2026", nextVisit: "Hoje, 10:30" },
  { id: "rafael", name: "Rafael Martins", phone: "(11) 99102-7734", email: "rafael.m@email.com", initials: "RM", color: "#e4e0d2", visits: 5, spent: 385, lastVisit: "08 mar 2026" },
  { id: "juliana", name: "Juliana Souza", phone: "(11) 98612-9011", email: "juliana.souza@email.com", initials: "JS", color: "#e2d9ea", visits: 19, spent: 2190, lastVisit: "16 mar 2026", nextVisit: "Hoje, 13:30" },
  { id: "bruna", name: "Bruna Ferreira", phone: "(11) 99910-5533", email: "bruna.ferreira@email.com", initials: "BF", color: "#d9e8e0", visits: 7, spent: 560, lastVisit: "02 mar 2026" },
  { id: "marcos", name: "Marcos Lima", phone: "(11) 98971-4430", email: "marcos.lima@email.com", initials: "ML", color: "#e7e0d7", visits: 3, spent: 210, lastVisit: "27 fev 2026" },
];

export const services: Service[] = [
  { id: "corte", name: "Corte", category: "Cabelo", description: "Corte personalizado com acabamento.", price: 50, duration: 45, color: "#4e8c83", active: true },
  { id: "barba", name: "Barba", category: "Barba", description: "Modelagem e finalização da barba.", price: 35, duration: 30, color: "#b17d45", active: true },
  { id: "corte-barba", name: "Corte + Barba", category: "Combos", description: "Corte completo e modelagem de barba.", price: 65, duration: 60, color: "#8b6fa3", active: true, combo: true },
  { id: "sobrancelha", name: "Sobrancelha", category: "Estética", description: "Design e acabamento das sobrancelhas.", price: 25, duration: 20, color: "#b36b77", active: true },
  { id: "unha", name: "Unha", category: "Unhas", description: "Manicure tradicional com acabamento.", price: 45, duration: 50, color: "#c78187", active: true },
  { id: "unha-gel", name: "Unha + Gel", category: "Unhas", description: "Manicure com aplicação de gel.", price: 90, duration: 90, color: "#6e8bb2", active: true },
  { id: "pacote", name: "Pacote Completo", category: "Combos", description: "Corte, barba e sobrancelha em um só atendimento.", price: 80, duration: 90, color: "#718b77", active: false, combo: true },
];

export const appointments: Appointment[] = [
  { id: "a1", date: today, time: "08:30", endTime: "09:15", duration: 45, clientId: "lucas", clientName: "Lucas Santos", clientInitials: "LS", clientColor: "#d8e5f0", phone: "(11) 99812-4410", service: "Corte", serviceId: "corte", employeeId: "ana", employee: "Ana Costa", employeeInitials: "AC", total: 50, status: "Confirmado" },
  { id: "a2", date: today, time: "09:00", endTime: "09:30", duration: 30, clientId: "rafael", clientName: "Rafael Martins", clientInitials: "RM", clientColor: "#e4e0d2", phone: "(11) 99102-7734", service: "Barba", serviceId: "barba", employeeId: "joao", employee: "João Mendes", employeeInitials: "JM", total: 35, status: "Aguardando" },
  { id: "a3", date: today, time: "10:30", endTime: "11:30", duration: 60, clientId: "camila", clientName: "Camila Oliveira", clientInitials: "CO", clientColor: "#eadbdc", phone: "(11) 99731-2288", service: "Corte + Barba", serviceId: "corte-barba", employeeId: "joao", employee: "João Mendes", employeeInitials: "JM", total: 65, status: "Confirmado" },
  { id: "a4", date: today, time: "11:00", endTime: "11:50", duration: 50, clientId: "bruna", clientName: "Bruna Ferreira", clientInitials: "BF", clientColor: "#d9e8e0", phone: "(11) 99910-5533", service: "Unha", serviceId: "unha", employeeId: "mariana", employee: "Mariana Silva", employeeInitials: "MS", total: 45, status: "Em atendimento" },
  { id: "a5", date: today, time: "13:30", endTime: "15:00", duration: 90, clientId: "juliana", clientName: "Juliana Souza", clientInitials: "JS", clientColor: "#e2d9ea", phone: "(11) 98612-9011", service: "Unha + Gel", serviceId: "unha-gel", employeeId: "mariana", employee: "Mariana Silva", employeeInitials: "MS", total: 90, status: "Confirmado" },
  { id: "a6", date: today, time: "14:00", endTime: "14:45", duration: 45, clientId: "marcos", clientName: "Marcos Lima", clientInitials: "ML", clientColor: "#e7e0d7", phone: "(11) 98971-4430", service: "Corte", serviceId: "corte", employeeId: "pedro", employee: "Pedro Alves", employeeInitials: "PA", total: 50, status: "Agendado" },
  { id: "a7", date: today, time: "16:00", endTime: "16:20", duration: 20, clientId: "camila", clientName: "Camila Oliveira", clientInitials: "CO", clientColor: "#eadbdc", phone: "(11) 99731-2288", service: "Sobrancelha", serviceId: "sobrancelha", employeeId: "ana", employee: "Ana Costa", employeeInitials: "AC", total: 25, status: "Finalizado" },
  { id: "a8", date: today, time: "17:00", endTime: "18:00", duration: 60, clientId: "rafael", clientName: "Rafael Martins", clientInitials: "RM", clientColor: "#e4e0d2", phone: "(11) 99102-7734", service: "Corte + Barba", serviceId: "corte-barba", employeeId: "joao", employee: "João Mendes", employeeInitials: "JM", total: 65, status: "Agendado" },
  { id: "a9", date: "2026-03-19", time: "09:30", endTime: "10:20", duration: 50, clientId: "bruna", clientName: "Bruna Ferreira", clientInitials: "BF", clientColor: "#d9e8e0", phone: "(11) 99910-5533", service: "Unha", serviceId: "unha", employeeId: "mariana", employee: "Mariana Silva", employeeInitials: "MS", total: 45, status: "Confirmado" },
  { id: "a10", date: "2026-03-19", time: "11:00", endTime: "11:45", duration: 45, clientId: "lucas", clientName: "Lucas Santos", clientInitials: "LS", clientColor: "#d8e5f0", phone: "(11) 99812-4410", service: "Corte", serviceId: "corte", employeeId: "ana", employee: "Ana Costa", employeeInitials: "AC", total: 50, status: "Agendado" },
  { id: "a11", date: "2026-03-20", time: "14:00", endTime: "15:00", duration: 60, clientId: "juliana", clientName: "Juliana Souza", clientInitials: "JS", clientColor: "#e2d9ea", phone: "(11) 98612-9011", service: "Corte + Barba", serviceId: "corte-barba", employeeId: "joao", employee: "João Mendes", employeeInitials: "JM", total: 65, status: "Confirmado" },
];

export const popularServices = [
  { name: "Corte", count: 58, color: "#4e8c83" },
  { name: "Barba", count: 37, color: "#b17d45" },
  { name: "Corte + Barba", count: 29, color: "#8b6fa3" },
  { name: "Sobrancelha", count: 17, color: "#b36b77" },
];

export const revenueByMonth = [
  { month: "Out", value: 6800 },
  { month: "Nov", value: 7400 },
  { month: "Dez", value: 9150 },
  { month: "Jan", value: 8230 },
  { month: "Fev", value: 9780 },
  { month: "Mar", value: 11240 },
];

export const weekDays = [
  { label: "Seg", date: "16", fullDate: "2026-03-16" },
  { label: "Ter", date: "17", fullDate: "2026-03-17" },
  { label: "Qua", date: "18", fullDate: today },
  { label: "Qui", date: "19", fullDate: "2026-03-19" },
  { label: "Sex", date: "20", fullDate: "2026-03-20" },
  { label: "Sáb", date: "21", fullDate: "2026-03-21" },
  { label: "Dom", date: "22", fullDate: "2026-03-22" },
];

export const timeSlots = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
