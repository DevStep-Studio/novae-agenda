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
export type Role = "owner" | "admin" | "manager" | "employee";

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

export type LocationDTO = {
  id: string;
  companyId: string;
  name: string;
  address: string | null;
  phone: string | null;
  openTime: string;
  closeTime: string;
  active: boolean;
};

export type SessionInfo = {
  userId: string;
  companyId: string;
  role: Role;
  name: string;
  email: string;
  emailVerified: boolean;
  isSuperadmin: boolean;
  createdAt: string;
  employeeId: string | null;
  company: Company;
  locations: LocationDTO[];
};

export type EmployeeDTO = {
  id: string;
  name: string;
  jobTitle: string | null;
  phone: string | null;
  photoUrl?: string | null;
  active: boolean;
  color: string;
  initials: string;
  commissionType: CommissionType;
  commissionValue: number;
  services: string[];
  serviceIds: string[];
  locationIds?: string[];
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
  photoUrl?: string | null;
  notes: string | null;
  active: boolean;
  initials: string;
  color: string;
  visits: number;
  spent: number;
  firstVisit?: string | null;
  lastVisit: string | null;
  nextVisit: string | null;
  averageTicket?: number;
  createdAt: string;
};

export type HistoryItemDTO = {
  id: string;
  date: string;
  time: string;
  service: string;
  employee: string;
  locationName: string | null;
  total: number;
  paymentMethod: PaymentMethod | null;
  status: AppointmentStatus;
};

export type ClientDetailDTO = ClientDTO & {
  history: HistoryItemDTO[];
};

export type EmployeeScheduleDTO = {
  id: string;
  employeeId: string;
  locationId: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakStart: string | null;
  breakEnd: string | null;
  active: boolean;
};

export type ScheduleBlockDTO = {
  id: string;
  employeeId: string | null;
  locationId: string | null;
  date: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  reason: string;
};

export type AppointmentDTO = {
  id: string;
  locationId: string | null;
  locationName: string | null;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientPhotoUrl?: string | null;
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
  paymentMethod?: PaymentMethod | null;
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

export type NotificationDTO = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
};

export type SearchResultDTO = {
  clients: Array<{ id: string; name: string; phone: string; email: string | null }>;
  employees: Array<{ id: string; name: string; jobTitle: string | null }>;
  services: Array<{ id: string; name: string; price: number; durationMinutes: number }>;
  appointments: Array<{ id: string; clientName: string; serviceName: string; employeeName: string; date: string; time: string; status: AppointmentStatus }>;
};

export type CompanySettingsDTO = {
  openTime: string;
  closeTime: string;
  workingDays: number[];
  slotIntervalMinutes: number;
  defaultDurationMinutes: number;
  bufferMinutes: number;
  maxLeadDays: number;
  timezone: string;
};

export type SuperadminCompanyDTO = {
  id: string;
  name: string;
  businessType: string | null;
  email: string | null;
  phone: string | null;
  usersCount: number;
  employeesCount: number;
  locationsCount: number;
  appointmentsCount: number;
  createdAt: string;
  active: boolean;
};

export type SuperadminStatsDTO = {
  totalCompanies: number;
  totalUsers: number;
  totalEmployees: number;
  totalLocations: number;
  totalAppointments: number;
  recentCompanies: SuperadminCompanyDTO[];
};

export type StatsResponse = {
  today: {
    date: string;
    appointments: number;
    completed: number;
    cancelled: number;
    noShow: number;
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
