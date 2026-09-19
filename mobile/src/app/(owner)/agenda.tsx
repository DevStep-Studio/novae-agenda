import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { AppointmentCard } from "@/components/ui/appointment-card";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { colors, typography } from "@/constants/design-tokens";
import { ApiError } from "@/lib/api-client";
import { getAppointments, todayKey, type AppointmentDTO } from "@/lib/appointments";
import { formatBRL } from "@/lib/stats";
import { useSession } from "@/lib/session-context";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

function dateLabel(date: string): string {
  try {
    const d = new Date(`${date}T12:00:00`);
    if (Number.isNaN(d.getTime())) return date;
    return dateFormatter.format(d);
  } catch {
    return date;
  }
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return todayKey();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Mirrors CalendarPage's "day" mode in app-shell.tsx:6617-6752 — header
// (eyebrow/title/subtitle), date nav row (Hoje/←/→/label, in that exact
// order — matches `.calendar-date-controls` justify-content:space-between +
// `.calendar-title-display` flex:1, not a guessed "arrows around a centered
// label" layout), then the appointment list.
//
// Not ported yet (see MOBILE_DESIGN_SYSTEM.md): week/month view switcher,
// employee filter, "Bloquear horário"/"Novo agendamento" (both open a
// creation flow that doesn't exist in mobile), and each card's quick-action
// row (check-in/finish/cancel buttons) — cards are read-only for now.
export default function AgendaScreen() {
  const { session } = useSession();
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [appointments, setAppointments] = useState<AppointmentDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (date: string) => {
    setError(null);
    try {
      const data = await getAppointments({ from: date, to: date });
      setAppointments([...data].sort((a, b) => a.startTime.localeCompare(b.startTime)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar a agenda.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    async function run() {
      await load(selectedDate);
      if (!cancelled) setLoading(false);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, load]);

  async function onRefresh() {
    setRefreshing(true);
    await load(selectedDate);
    setRefreshing(false);
  }

  const { activeCount, projectedRevenue } = useMemo(() => {
    const active = (appointments ?? []).filter((a) => a.status !== "cancelled");
    return {
      activeCount: active.length,
      projectedRevenue: active.reduce((sum, a) => sum + a.total, 0),
    };
  }, [appointments]);

  return (
    <Screen header={<TopBar title="Agenda" company={session?.company.name} />} style={{ paddingTop: 16 }}>
      <View className="gap-4">
        <View>
          <Text style={{ color: colors.primary, ...typography.eyebrow }}>AGENDA DO ESTABELECIMENTO</Text>
          <Text style={{ color: colors.textPrimary, marginTop: 4, ...typography.pageTitle }} numberOfLines={1}>
            {dateLabel(selectedDate)}
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 6, ...typography.pageSubtitle }}>
            {activeCount} {activeCount === 1 ? "atendimento" : "atendimentos"} · {formatBRL(projectedRevenue)} previsto
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
          <Pressable
            className="h-11 items-center justify-center rounded-md border px-3.5"
            style={{ borderColor: colors.border, backgroundColor: colors.surface }}
            onPress={() => setSelectedDate(todayKey())}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 12.5, fontWeight: "600" }}>Hoje</Text>
          </Pressable>
          <Pressable
            className="h-11 w-11 items-center justify-center rounded-md border"
            style={{ borderColor: colors.border, backgroundColor: colors.surface }}
            accessibilityLabel="Dia anterior"
            onPress={() => setSelectedDate((d) => shiftDate(d, -1))}
          >
            <ChevronLeft size={18} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            className="h-11 w-11 items-center justify-center rounded-md border"
            style={{ borderColor: colors.border, backgroundColor: colors.surface }}
            accessibilityLabel="Próximo dia"
            onPress={() => setSelectedDate((d) => shiftDate(d, 1))}
          >
            <ChevronRight size={18} color={colors.textSecondary} />
          </Pressable>
          <Text
            className="flex-1 text-center"
            style={{ color: colors.textSecondary, fontSize: 13.5 }}
            numberOfLines={1}
          >
            {dateLabel(selectedDate)}
          </Text>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-6 gap-3">
          <Text style={{ color: colors.textSecondary, textAlign: "center" }}>{error}</Text>
          <Button label="Tentar novamente" onPress={() => load(selectedDate)} />
        </View>
      ) : appointments && appointments.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-1 py-16">
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}>Nenhum atendimento</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>A agenda está livre neste dia.</Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1 mt-4"
          contentContainerClassName="gap-3 pb-6"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {appointments?.map((appointment) => (
            <AppointmentCard key={appointment.id} appointment={appointment} />
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
