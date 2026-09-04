export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "waiting"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

export type CommissionType = "none" | "percentage" | "fixed";
export type PaymentMethod = "pix" | "cash" | "debit" | "credit" | "other";
export type Role = "owner" | "admin" | "employee";

export type Company = {
  id: string;
  name: string;
  businessType: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  instagram: string | null;
  website: string | null;
  timezone: string;
  currency: string;
  primaryColor: string;
  secondaryColor: string;
  onboarded: boolean;
};

export type SessionInfo = {
  userId: string;
  companyId: string;
  role: Role;
  name: string;
  employeeId: string | null;
  company: Company;
};

export type EmployeeDTO = {
  id: string;
  name: string;
  jobTitle: string | null;
  phone: string | null;
  active: boolean;
  color: string;
  initials: string;
  commissionType: CommissionType;
  commissionValue: number;
  services: string[];
  serviceIds: string[];
};

export type ServiceDTO = {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  description: string | null;
  price: number;
  durationMinutes: number;
  color: string | null;
  active: boolean;
};

export type ServiceCategoryDTO = {
  id: string;
  name: string;
  count: number;
};

export type ClientDTO = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  active: boolean;
  initials: string;
  color: string;
  visits: number;
  spent: number;
  lastVisit: string | null;
  nextVisit: string | null;
  createdAt: string;
};

export type ClientDetailDTO = ClientDTO & {
  history: HistoryItemDTO[];
};

export type HistoryItemDTO = {
  id: string;
  date: string;
  time: string;
  service: string;
  employee: string;
  total: number;
  status: AppointmentStatus;
};

export type EmployeeScheduleDTO = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakStart: string | null;
  breakEnd: string | null;
};

export type ScheduleBlockDTO = {
  id: string;
  employeeId: string | null;
  date: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  reason: string;
};

export type AppointmentDTO = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientInitials: string;
  clientColor: string;
  employeeId: string;
  employeeName: string;
  employeeInitials: string;
  serviceId: string;
  serviceName: string;
  serviceColor: string | null;
  total: number;
  status: AppointmentStatus;
  notes: string | null;
  paid: boolean;
};

export type AvailabilitySlot = {
  startTime: string;
  endTime: string;
};

export type AvailabilityResponse = {
  date: string;
  employeeId: string;
  durationMinutes: number;
  slots: AvailabilitySlot[];
};

export type StatsResponse = {
  today: {
    date: string;
    appointments: number;
    completed: number;
    forecast: number;
    realized: number;
    clientsServed: number;
    averageTicket: number;
  };
  week: { appointments: number; revenue: number };
  month: { appointments: number; revenue: number };
  byEmployee: Array<{ employeeId: string; employeeName: string; appointments: number; revenue: number; commission: number }>;
  byMethod: Array<{ method: PaymentMethod; total: number }>;
  byService: Array<{ serviceId: string; serviceName: string; count: number; revenue: number }>;
};
