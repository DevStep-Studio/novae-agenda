import { Text, View } from "react-native";

import { statusColors, typography } from "@/constants/design-tokens";
import type { AppointmentStatus } from "@/lib/appointments";
import { statusLabel } from "@/lib/appointments";

// .status-badge / .status-dot, globals.css:1673-1681.
export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const tone = statusColors[status];

  return (
    <View
      className="flex-row items-center gap-1.5 self-start rounded-[5px] px-[7px] py-1"
      style={{ backgroundColor: tone.background }}
    >
      <View className="h-[5px] w-[5px] rounded-full" style={{ backgroundColor: tone.color }} />
      <Text style={{ color: tone.color, ...typography.statusBadge }}>{statusLabel(status)}</Text>
    </View>
  );
}
