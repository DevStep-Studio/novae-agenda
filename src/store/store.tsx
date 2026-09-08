"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import type {
  AppointmentDTO,
  AppointmentStatus,
  ClientDTO,
  ClientDetailDTO,
  CompanySettingsDTO,
  EmployeeDTO,
  LocationDTO,
  NotificationDTO,
  PaymentMethod,
  ScheduleBlockDTO,
  ServiceCategoryDTO,
  ServiceDTO,
  SessionInfo,
  StatsResponse,
} from "@/shared/types";

export type Toast = { id: string; message: string; tone: "success" | "error" };

type DataState = {
  session: SessionInfo | null;
  loading: boolean;
  locations: LocationDTO[];
  activeLocationId: string | null;
  clients: ClientDTO[];
  services: ServiceDTO[];
  categories: ServiceCategoryDTO[];
  employees: EmployeeDTO[];
  appointments: AppointmentDTO[];
  blocks: ScheduleBlockDTO[];
  notifications: NotificationDTO[];
  unreadCount: number;
  settings: CompanySettingsDTO | null;
  stats: StatsResponse | null;
  toasts: Toast[];
};

type Store = DataState & {
  setActiveLocationId: (id: string | null) => void;
  reloadSession: () => Promise<SessionInfo | null>;
  reloadLocations: () => Promise<void>;
  reloadClients: () => Promise<void>;
  reloadServices: () => Promise<void>;
  reloadEmployees: () => Promise<void>;
  reloadAppointments: () => Promise<void>;
  reloadBlocks: () => Promise<void>;
  reloadNotifications: () => Promise<void>;
  reloadSettings: () => Promise<void>;
  reloadStats: () => Promise<void>;
  refreshAll: () => Promise<void>;
  createLocation: (input: { name: string; address?: string; phone?: string; openTime?: string; closeTime?: string }) => Promise<LocationDTO>;
  updateLocation: (id: string, input: { name?: string; address?: string; phone?: string; openTime?: string; closeTime?: string }) => Promise<void>;
  createClient: (input: { name: string; phone: string; email?: string; notes?: string }) => Promise<ClientDTO>;
  updateClient: (id: string, input: { name: string; phone: string; email?: string; notes?: string }) => Promise<void>;
  createService: (input: { name: string; price: number; durationMinutes: number; categoryId?: string | null; description?: string }) => Promise<void>;
  toggleService: (id: string, active: boolean) => Promise<void>;
  createEmployee: (input: { name: string; jobTitle?: string; phone?: string; serviceIds?: string[] }) => Promise<void>;
  createAppointment: (input: { clientId: string; employeeId: string; serviceIds: string[]; date: string; startTime: string; locationId?: string; notes?: string }) => Promise<void>;
  updateAppointmentStatus: (id: string, status: AppointmentStatus) => Promise<void>;
  rescheduleAppointment: (id: string, input: { date: string; startTime: string; employeeId?: string }) => Promise<void>;
  finishAppointment: (id: string, amount: number, method: PaymentMethod, discount?: number) => Promise<void>;
  createBlock: (input: { employeeId?: string | null; locationId?: string | null; date: string; endDate?: string; startsAt?: string; endsAt?: string; allDay?: boolean; reason: string }) => Promise<void>;
  deleteBlock: (id: string) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  updateSettings: (input: Partial<CompanySettingsDTO>) => Promise<void>;
  notify: (message: string, tone?: "success" | "error") => void;
  dismissToast: (id: string) => void;
  logout: () => Promise<void>;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [booting, setBooting] = useState(true);
  const [locations, setLocations] = useState<LocationDTO[]>([]);
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientDTO[]>([]);
  const [services, setServices] = useState<ServiceDTO[]>([]);
  const [categories, setCategories] = useState<ServiceCategoryDTO[]>([]);
  const [employees, setEmployees] = useState<EmployeeDTO[]>([]);
  const [appointments, setAppointments] = useState<AppointmentDTO[]>([]);
  const [blocks, setBlocks] = useState<ScheduleBlockDTO[]>([]);
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [settings, setSettings] = useState<CompanySettingsDTO | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, tone: "success" | "error" = "success") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 3500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const reloadLocations = useCallback(async () => {
    try {
      const data = await api<LocationDTO[]>("/api/locations");
      setLocations(data);
      setActiveLocationId((current) => current ?? (data[0]?.id || null));
    } catch {
      // ignore
    }
  }, []);

  const reloadClients = useCallback(async () => {
    const data = await api<ClientDTO[]>("/api/clients");
    setClients(data);
  }, []);

  const reloadServices = useCallback(async () => {
    const data = await api<ServiceDTO[]>("/api/services");
    setServices(data);
  }, []);

  const reloadEmployees = useCallback(async () => {
    const data = await api<EmployeeDTO[]>("/api/employees");
    setEmployees(data);
  }, []);

  const reloadAppointments = useCallback(async () => {
    const data = await api<AppointmentDTO[]>("/api/appointments");
    setAppointments(data);
  }, []);

  const reloadBlocks = useCallback(async () => {
    const data = await api<ScheduleBlockDTO[]>("/api/blocks");
    setBlocks(data);
  }, []);

  const reloadNotifications = useCallback(async () => {
    try {
      const res = await api<{ notifications: NotificationDTO[]; unreadCount: number }>("/api/notifications");
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    } catch {
      // ignore
    }
  }, []);

  const reloadSettings = useCallback(async () => {
    try {
      const data = await api<CompanySettingsDTO>("/api/settings");
      setSettings(data);
    } catch {
      // ignore
    }
  }, []);

  const reloadStats = useCallback(async () => {
    const data = await api<StatsResponse>("/api/stats");
    setStats(data);
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      reloadLocations(),
      reloadClients(),
      reloadServices(),
      reloadEmployees(),
      reloadAppointments(),
      reloadBlocks(),
      reloadNotifications(),
      reloadSettings(),
      reloadStats(),
    ]);
  }, [
    reloadLocations,
    reloadClients,
    reloadServices,
    reloadEmployees,
    reloadAppointments,
    reloadBlocks,
    reloadNotifications,
    reloadSettings,
    reloadStats,
  ]);

  const createLocation = useCallback(async (input: { name: string; address?: string; phone?: string; openTime?: string; closeTime?: string }) => {
    const data = await api<LocationDTO>("/api/locations", { method: "POST", body: JSON.stringify(input) });
    await reloadLocations();
    return data;
  }, [reloadLocations]);

  const updateLocation = useCallback(async (id: string, input: { name?: string; address?: string; phone?: string; openTime?: string; closeTime?: string }) => {
    await api(`/api/locations/${id}`, { method: "PATCH", body: JSON.stringify(input) });
    await reloadLocations();
  }, [reloadLocations]);

  const createClient = useCallback(async (input: { name: string; phone: string; email?: string; notes?: string }) => {
    const data = await api<ClientDTO>("/api/clients", { method: "POST", body: JSON.stringify(input) });
    await reloadClients();
    return data;
  }, [reloadClients]);

  const updateClient = useCallback(async (id: string, input: { name: string; phone: string; email?: string; notes?: string }) => {
    await api(`/api/clients/${id}`, { method: "PATCH", body: JSON.stringify(input) });
    await reloadClients();
  }, [reloadClients]);

  const createService = useCallback(async (input: { name: string; price: number; durationMinutes: number; categoryId?: string | null; description?: string }) => {
    await api("/api/services", { method: "POST", body: JSON.stringify(input) });
    await reloadServices();
    await reloadEmployees();
  }, [reloadServices, reloadEmployees]);

  const toggleService = useCallback(async (id: string, active: boolean) => {
    setServices((current) => current.map((s) => (s.id === id ? { ...s, active } : s)));
    try {
      await api(`/api/services/${id}`, { method: "PATCH", body: JSON.stringify({ active }) });
      notify(active ? "Serviço ativado com sucesso." : "Serviço desativado.", "success");
    } catch (err) {
      setServices((current) => current.map((s) => (s.id === id ? { ...s, active: !active } : s)));
      const message = err instanceof Error ? err.message : "Não foi possível atualizar o serviço.";
      notify(message, "error");
    }
  }, [notify]);

  const createEmployee = useCallback(async (input: { name: string; jobTitle?: string; phone?: string; serviceIds?: string[] }) => {
    await api("/api/employees", { method: "POST", body: JSON.stringify(input) });
    await reloadEmployees();
  }, [reloadEmployees]);

  const createAppointment = useCallback(async (input: { clientId: string; employeeId: string; serviceIds: string[]; date: string; startTime: string; locationId?: string; notes?: string }) => {
    await api("/api/appointments", { method: "POST", body: JSON.stringify(input) });
    await Promise.all([reloadAppointments(), reloadStats(), reloadClients(), reloadNotifications()]);
  }, [reloadAppointments, reloadStats, reloadClients, reloadNotifications]);

  const updateAppointmentStatus = useCallback(async (id: string, status: AppointmentStatus) => {
    await api(`/api/appointments/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    await Promise.all([reloadAppointments(), reloadStats(), reloadNotifications()]);
  }, [reloadAppointments, reloadStats, reloadNotifications]);

  const rescheduleAppointment = useCallback(async (id: string, input: { date: string; startTime: string; employeeId?: string }) => {
    await api(`/api/appointments/${id}`, { method: "PUT", body: JSON.stringify(input) });
    await reloadAppointments();
  }, [reloadAppointments]);

  const finishAppointment = useCallback(async (id: string, amount: number, method: PaymentMethod, discount?: number) => {
    await api(`/api/appointments/${id}/finish`, { method: "POST", body: JSON.stringify({ amount, method, discount }) });
    await Promise.all([reloadAppointments(), reloadStats(), reloadClients(), reloadNotifications()]);
  }, [reloadAppointments, reloadStats, reloadClients, reloadNotifications]);

  const createBlock = useCallback(async (input: { employeeId?: string | null; locationId?: string | null; date: string; endDate?: string; startsAt?: string; endsAt?: string; allDay?: boolean; reason: string }) => {
    await api("/api/blocks", { method: "POST", body: JSON.stringify(input) });
    await reloadBlocks();
  }, [reloadBlocks]);

  const deleteBlock = useCallback(async (id: string) => {
    await api(`/api/blocks/${id}`, { method: "DELETE" });
    await reloadBlocks();
  }, [reloadBlocks]);

  const markNotificationRead = useCallback(async (id: string) => {
    await api(`/api/notifications/${id}/read`, { method: "PATCH" });
    await reloadNotifications();
  }, [reloadNotifications]);

  const markAllNotificationsRead = useCallback(async () => {
    await api("/api/notifications", { method: "POST" });
    await reloadNotifications();
  }, [reloadNotifications]);

  const updateSettings = useCallback(async (input: Partial<CompanySettingsDTO>) => {
    await api("/api/settings", { method: "PUT", body: JSON.stringify(input) });
    await reloadSettings();
  }, [reloadSettings]);

  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }, []);

  const reloadSession = useCallback(async () => {
    try {
      const data = await api<SessionInfo>("/api/auth/session");
      setSession(data);
      if (data) {
        if (data.locations?.length) {
          setLocations(data.locations);
          setActiveLocationId((cur) => cur ?? data.locations[0].id);
        }
        await refreshAll();
      }
      return data;
    } catch {
      setSession(null);
      return null;
    }
  }, [refreshAll]);

  // Bootstrap session + data
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    (async () => {
      try {
        await reloadSession();
      } finally {
        setBooting(false);
      }
    })();
  }, [reloadSession]);

  const value = useMemo<Store>(() => ({
    session,
    loading: booting,
    locations,
    activeLocationId,
    clients,
    services,
    categories,
    employees,
    appointments,
    blocks,
    notifications,
    unreadCount,
    settings,
    stats,
    toasts,
    setActiveLocationId,
    reloadSession,
    reloadLocations,
    reloadClients,
    reloadServices,
    reloadEmployees,
    reloadAppointments,
    reloadBlocks,
    reloadNotifications,
    reloadSettings,
    reloadStats,
    refreshAll,
    createLocation,
    updateLocation,
    createClient,
    updateClient,
    createService,
    toggleService,
    createEmployee,
    createAppointment,
    updateAppointmentStatus,
    rescheduleAppointment,
    finishAppointment,
    createBlock,
    deleteBlock,
    markNotificationRead,
    markAllNotificationsRead,
    updateSettings,
    notify,
    dismissToast,
    logout,
  }), [
    session, booting, locations, activeLocationId, clients, services, categories, employees, appointments, blocks, notifications, unreadCount, settings, stats, toasts,
    setActiveLocationId, reloadSession, reloadLocations, reloadClients, reloadServices, reloadEmployees, reloadAppointments, reloadBlocks, reloadNotifications, reloadSettings, reloadStats, refreshAll,
    createLocation, updateLocation, createClient, updateClient, createService, toggleService, createEmployee, createAppointment,
    updateAppointmentStatus, rescheduleAppointment, finishAppointment, createBlock, deleteBlock, markNotificationRead, markAllNotificationsRead, updateSettings, notify, dismissToast, logout,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export type { ClientDetailDTO };
