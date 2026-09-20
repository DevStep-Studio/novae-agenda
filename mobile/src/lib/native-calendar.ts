import * as Calendar from "expo-calendar";
import { Platform } from "react-native";

export interface CalendarEventData {
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  notes?: string;
}

export async function requestCalendarPermissions(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === "granted";
}

async function getDefaultCalendarSource(): Promise<Calendar.Source> {
  const defaultCalendar = await Calendar.getDefaultCalendarAsync().catch(() => null);
  if (defaultCalendar?.source) {
    return defaultCalendar.source;
  }
  return { isLocalAccount: true, name: "Reservei", type: "LOCAL" };
}

async function getOrCreateReserveiCalendar(): Promise<string | null> {
  try {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const existing = calendars.find((c) => c.allowsModifications);
    if (existing) {
      return existing.id;
    }

    if (Platform.OS === "ios") {
      const defaultCalendar = await Calendar.getDefaultCalendarAsync().catch(() => null);
      if (defaultCalendar) return defaultCalendar.id;
    }

    const defaultSource = await getDefaultCalendarSource();
    const newCalendarId = await Calendar.createCalendarAsync({
      title: "Reservei Agendamentos",
      color: "#10B981",
      entityType: Calendar.EntityTypes.EVENT,
      sourceId: defaultSource.id,
      source: defaultSource,
      name: "reservei_appointments",
      ownerAccount: "personal",
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
    });

    return newCalendarId;
  } catch {
    return null;
  }
}

export async function addBookingToNativeCalendar(data: CalendarEventData): Promise<{ success: boolean; eventId?: string }> {
  try {
    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) {
      return { success: false };
    }

    const calendarId = await getOrCreateReserveiCalendar();
    if (!calendarId) {
      return { success: false };
    }

    const eventId = await Calendar.createEventAsync(calendarId, {
      title: data.title,
      startDate: data.startDate,
      endDate: data.endDate,
      location: data.location || "",
      notes: data.notes || "Agendado via Reservei",
      alarms: [
        { relativeOffset: -120 }, // 2 hours before
        { relativeOffset: -15 },  // 15 minutes before
      ],
    });

    return { success: true, eventId };
  } catch {
    return { success: false };
  }
}
