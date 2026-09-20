import { Text, View } from "react-native";

import { statusColors, typography } from "@/constants/design-tokens";
import type { AppointmentStatus } from "@/lib/appointments";
import { statusLabel } from "@/lib/appointments";

// .status-badge / .status-dot, globals.css:1673-1681.
export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const tone = statusColors[status];

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        alignSelf: "flex-start",
        borderRadius: 5,
        paddingHorizontal: 7,
        paddingVertical: 4,
        backgroundColor: tone.background,
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone.color }} />
      <Text style={{ color: tone.color, ...typography.statusBadge }}>{statusLabel(status)}</Text>
    </View>
  );
}
