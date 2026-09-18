import { Text, View } from "react-native";

import { clientBadge, typography } from "@/constants/design-tokens";
import type { ClientTier } from "@/lib/clients";

// .client-badge base + .badge-{vip,frequent,new}, globals.css:3455-3492.
export function ClientBadge({ tier }: { tier: ClientTier }) {
  const tone = clientBadge[tier];

  return (
    <View
      className="rounded self-start border px-1.5 py-px"
      style={{ backgroundColor: tone.background, borderColor: tone.border }}
    >
      <Text style={{ color: tone.color, textTransform: "uppercase", ...typography.clientBadgeLabel }}>
        {tone.label}
      </Text>
    </View>
  );
}
