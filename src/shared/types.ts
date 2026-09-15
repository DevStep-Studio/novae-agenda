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
export type Role = "owner" | "admin" | "manager" | "employee" | "client" | "superadmin";
export type UserRole = Role;

export type CompanyMembershipDTO = {
  id: string;
  companyId: string;
  companyName: string;
  role: Role;
  isPrimary?: boolean;
};

export type DashboardPreferences = {
  showBanner?: boolean;
  showChecklist?: boolean;
  showKpis?: boolean;
  showSubmetrics?: boolean;
  showNextAppointment?: boolean;
  showDaySummary?: boolean;
  showQuickSlots?: boolean;
  showTodayAppointments?: boolean;
};

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
  logoUrl?: string | null;
  bannerUrl?: string | null;
  dashboardPreferences?: DashboardPreferences;
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
  primaryRole?: Role;
  targetPortal?: "/cliente" | "/gestao" | "/profissional" | "/admin";
  name: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  emailVerified: boolean;
  isSuperadmin: boolean;
  createdAt: string;
  employeeId: string | null;
  memberships?: CompanyMembershipDTO[];
  company: Company;
  locations: LocationDTO[];
};

export type EmployeeDTO = {
  id: string;
  name: string;
  jobTitle: string | null;
  phone: string | null;
  photoUrl?: string | null;
  bannerUrl?: string | null;
  active: boolean;
  color: string;
  initials: string;
  commissionType: CommissionType;
  commissionValue: number;
  services: string[];
  serviceIds: string[];
  locationIds?: string[];
  hasLogin: boolean;
};

export type ServiceDTO = {
  bufferMinutes?: number;
  imageUrl?: string | null;
  deliveryMode?: string;
  paymentType?: string;
  depositAmount?: number;
  cancellationPolicy?: string | null;
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
  internalNotes?: string | null;
  active: boolean;
  initials: string;
  color: string;
  visits: number;
  spent: number;
  firstVisit?: string | null;
  lastVisit: string | null;
  nextVisit: string | null;
  averageTicket?: number;
  tags?: string[];
  favoriteEmployeeName?: string | null;
  cancelledCount?: number;
  noShowCount?: number;
  createdAt: string;
  hasActiveMembership?: boolean;
  isMembershipActive?: boolean;
  membershipPlanName?: string | null;
  membershipStatus?: CustomerMembershipStatus | null;
};

export type HistoryItemDTO = {
  id: string;
  date: string;
  time: string;
  endTime?: string | null;
  durationMinutes?: number;
  service: string;
  serviceIds?: string[];
  employee: string;
  employeeId?: string;
  locationId?: string | null;
  locationName: string | null;
  total: number;
  paymentMethod: PaymentMethod | null;
  status: AppointmentStatus;
  notes?: string | null;
  cancelledReason?: string | null;
  isMembershipBooking?: boolean;
  membershipPlanName?: string | null;
};

export type ClientDetailDTO = ClientDTO & {
  history: HistoryItemDTO[];
  membership?: CustomerMembershipDTO | null;
  activeMembership?: CustomerMembershipDTO | null;
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
  isMembershipBooking?: boolean;
  membershipPlanName?: string | null;
  membershipUsageId?: string | null;
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
  minLeadMinutes?: number;
  cancellationHours?: number;
  rescheduleHours?: number;
  dailyBookingLimit?: number;
  allowHolidayBookings?: boolean;
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
  plan?: string;
  subscriptionStatus?: string;
  createdAt: string;
  active: boolean;
};

export type SuperadminStatsDTO = {
  totalCompanies: number;
  totalUsers: number;
  totalEmployees: number;
  totalLocations: number;
  totalAppointments: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  estimatedMRR: number;
  recentCompanies: SuperadminCompanyDTO[];
  recentLogs?: Array<{
    id: string;
    action: string;
    entity: string;
    createdAt: string;
  }>;
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
  customerMembershipRevenue?: number;
  activeCustomerMemberships?: number;
  pendingCustomerMembershipPayments?: number;
  scheduledMembershipSessions?: number;
};

// ========================================================
// CUSTOMER MEMBERSHIP TYPES (PLANOS MENSAIS RECORRENTES)
// ========================================================

export type MembershipFrequencyType =
  | "WEEKLY_CALENDAR_BASED"
  | "FIXED_MONTHLY_QUOTA"
  | "CUSTOM_WEEKLY_FREQUENCY";

export type CustomerMembershipStatus =
  | "active"
  | "paused"
  | "cancelled"
  | "expired"
  | "pending";

export type MembershipPeriodPaymentStatus = "pending" | "paid" | "waived";

export type MembershipPlanDTO = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  billingPeriod: string;
  frequencyType: MembershipFrequencyType;
  sessionsPerPeriod: number;
  weeklyFrequency: number;
  allowReschedule: boolean;
  rescheduleHoursNotice: number;
  allowCarryOver: boolean;
  noShowConsumesSession: boolean;
  lateCancelConsumesSession: boolean;
  badgeColor: string | null;
  active: boolean;
  serviceIds: string[];
  services: Array<{ id: string; name: string; price: number; durationMinutes: number }>;
  employeeIds?: string[];
  employees: Array<{ id: string; name: string }>;
  activeMembersCount?: number;
};

export type CustomerMembershipDTO = {
  id: string;
  companyId: string;
  clientId: string;
  clientName?: string;
  clientPhone?: string;
  clientPhotoUrl?: string | null;
  membershipPlanId: string;
  membershipPlanName: string;
  membershipPlanDescription?: string | null;
  frequencyType: MembershipFrequencyType;
  startsAt: string;
  endsAt: string | null;
  status: CustomerMembershipStatus;
  preferredProfessionalId: string | null;
  preferredProfessionalName?: string | null;
  preferredWeekdays: number[];
  preferredTime: string | null;
  monthlyPriceSnapshot: number;
  notes: string | null;
  createdAt: string;
  currentPeriod?: MembershipPeriodDTO | null;
  includedServices?: Array<{ id: string; name: string; durationMinutes: number; price: number }>;
};

export type MembershipPeriodDTO = {
  id: string;
  customerMembershipId: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  sessionAllowance: number;
  sessionsBooked: number;
  sessionsUsed: number;
  sessionsRemaining: number;
  paymentStatus: MembershipPeriodPaymentStatus;
  paidAt: string | null;
  paymentMethod: string | null;
  amount: number;
  status: "active" | "closed" | "cancelled";
  bookings?: Array<{
    appointmentId: string;
    date: string;
    startTime: string;
    endTime: string;
    serviceName: string;
    employeeName: string;
    status: AppointmentStatus;
  }>;
};

export type CustomerMembershipPaymentDTO = {
  id: string;
  customerMembershipId: string;
  membershipPeriodId: string;
  amount: number;
  method: string;
  status: string;
  paidAt: string;
  notes: string | null;
};

export type MonthSlotDay = {
  date: string; // YYYY-MM-DD
  weekday: number; // 0 = Sun, 1 = Mon ...
  weekdayLabel: string; // e.g. "Quinta-feira"
  dateLabel: string; // e.g. "03 de Setembro"
  shortDateLabel: string; // e.g. "QUI, 03 SET"
  selectedStartTime?: string | null;
  isBooked?: boolean;
  existingAppointment?: {
    id: string;
    startTime: string;
    endTime: string;
    status: AppointmentStatus;
  } | null;
  availableSlots: AvailabilitySlot[];
};

export type MonthScheduleBatchInput = {
  customerMembershipId: string;
  periodId?: string;
  employeeId?: string;
  serviceId?: string;
  slots: Array<{
    date: string; // YYYY-MM-DD
    startTime: string; // HH:mm
    serviceId?: string;
    employeeId?: string;
  }>;
};

export type BatchBookingConflict = {
  date: string;
  requestedStartTime: string;
  reason: string;
  alternativeSlots?: AvailabilitySlot[];
};

export type BatchBookingResultDTO = {
  success: boolean;
  bookedCount: number;
  totalRequested: number;
  createdAppointments: AppointmentDTO[];
  conflicts: BatchBookingConflict[];
  message: string;
};

