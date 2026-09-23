import { Text, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { useTheme } from "@/hooks/use-theme";
import { formatBRL } from "@/lib/stats";

export interface TeamRankRowData {
  employeeId: string;
  name: string;
  jobTitle: string | null;
  photoUrl?: string | null;
  appointments: number;
  revenue: number;
  commission: number;
}

export function TeamRankRow({
  row,
  rank,
  maxRevenue,
}: {
  row: TeamRankRowData;
  rank: number;
  maxRevenue: number;
}) {
  const { colors, primaryColor } = useTheme();
  const pct = Math.min(Math.round((row.revenue / (maxRevenue || 1)) * 100), 100);
  const isFirst = rank === 1;
  const isSecond = rank === 2;
  const net = Math.max(row.revenue - row.commission, 0);

  return (
    <View
      className="p-3.5 rounded-xl border gap-2.5"
      style={{
        backgroundColor: "#181920",
        borderColor: isFirst ? "rgba(234, 179, 8, 0.2)" : "rgba(255, 255, 255, 0.08)",
      }}
    >
      {/* Top line: Rank + Avatar + Name + Revenue */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2.5 flex-1 pr-2" style={{ flexShrink: 1 }}>
          {/* Rank Badge */}
          <View
            className="w-6 h-6 rounded-lg items-center justify-center border"
            style={{
              backgroundColor: isFirst
                ? "rgba(234, 179, 8, 0.12)"
                : isSecond
                ? "rgba(148, 163, 184, 0.12)"
                : "rgba(255, 255, 255, 0.04)",
              borderColor: isFirst
                ? "rgba(234, 179, 8, 0.28)"
                : isSecond
                ? "rgba(148, 163, 184, 0.2)"
                : "rgba(255, 255, 255, 0.08)",
            }}
          >
            <Text
              style={{
                color: isFirst ? "#eab308" : isSecond ? "#94a3b8" : "#71717a",
                fontSize: 11,
                fontWeight: "800",
              }}
            >
              #{rank}
            </Text>
          </View>

          <Avatar name={row.name} photoUrl={row.photoUrl} size="sm" />

          <View className="flex-1" style={{ flexShrink: 1 }}>
            <Text
              style={{ color: "#ffffff", fontSize: 14, fontWeight: "700" }}
              numberOfLines={1}
            >
              {row.name}
            </Text>
            <Text style={{ color: "#a1a1aa", fontSize: 11.5 }} numberOfLines={1}>
              {row.jobTitle || "Profissional"}
            </Text>
          </View>
        </View>

        <View className="items-end gap-0.5" style={{ flexShrink: 0 }}>
          <Text style={{ color: "#ffffff", fontSize: 14.5, fontWeight: "800", letterSpacing: 0.2 }}>
            {formatBRL(row.revenue)}
          </Text>
          <Text style={{ color: "#a1a1aa", fontSize: 11 }}>
            Líq: {formatBRL(net)}
          </Text>
        </View>
      </View>

      {/* Bottom line: Progress bar in owner's brand color + Metas */}
      <View className="gap-1.5">
        <View
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.06)",
            height: 4,
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              backgroundColor: primaryColor || colors.primary,
              height: "100%",
              borderRadius: 2,
              width: `${Math.max(pct, 4)}%`,
            }}
          />
        </View>

        <View className="flex-row items-center justify-between">
          <Text style={{ color: "#71717a", fontSize: 11 }}>
            {row.appointments} {row.appointments === 1 ? "atendimento" : "atendimentos"}
          </Text>
          <Text style={{ color: "#a1a1aa", fontSize: 11 }}>
            Comissão:{" "}
            <Text style={{ color: row.commission > 0 ? "#34d399" : "#a1a1aa", fontWeight: "600" }}>
              {formatBRL(row.commission)}
            </Text>
          </Text>
        </View>
      </View>
    </View>
  );
}
