import { Clock3, UserRound } from "lucide-react-native";
import { Text, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { colors, typography } from "@/constants/design-tokens";
import type { AppointmentDTO } from "@/lib/appointments";
import { formatBRL } from "@/lib/stats";

function normalizeTime(time: string): string {
  if (!time) return "00:00";
  return time.length > 5 ? time.slice(0, 5) : time;
}

// .appointment-card / -body / -top / -main / -client / -meta,
// globals.css:1721-1833; JSX structure mirrors AppointmentCard in
// app-shell.tsx:813-859. The web also has a quick-actions row here
// (check-in/finish/cancel) — not ported yet, see MOBILE_DESIGN_SYSTEM.md.
export function AppointmentCard({ appointment }: { appointment: AppointmentDTO }) {
  return (
    <View
      className="gap-3 rounded-md border p-4"
      style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}
    >
      <View className="flex-row items-center justify-between">
        <Text style={{ color: colors.textPrimary, ...typography.appointmentTime }}>
          {normalizeTime(appointment.startTime)}
        </Text>
        <StatusBadge status={appointment.status} />
      </View>

      <View className="flex-row items-center gap-3">
        <Avatar name={appointment.clientName} photoUrl={appointment.clientPhotoUrl} />
        <View className="shrink gap-0.5">
          <Text style={{ color: colors.textPrimary, ...typography.clientName }} numberOfLines={1}>
            {appointment.clientName}
          </Text>
          <Text style={{ color: colors.textSecondary, ...typography.clientMeta }} numberOfLines={1}>
            {appointment.serviceName}
          </Text>
        </View>
      </View>

      <View
        className="flex-row items-center gap-3 border-t pt-2.5"
        style={{ borderTopColor: colors.border }}
      >
        <View className="flex-row items-center gap-1">
          <Clock3 size={13} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, ...typography.appointmentMetaText }}>
            {appointment.durationMinutes} min
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <UserRound size={13} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, ...typography.appointmentMetaText }} numberOfLines={1}>
            {appointment.employeeName}
          </Text>
        </View>
        <Text style={{ color: colors.textPrimary, marginLeft: "auto", ...typography.appointmentPrice }}>
          {formatBRL(appointment.total)}
        </Text>
      </View>
    </View>
  );
}
