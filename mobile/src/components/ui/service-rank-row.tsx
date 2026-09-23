import { Text, View } from "react-native";

import { useTheme } from "@/hooks/use-theme";
import { formatBRL } from "@/lib/stats";

export interface ServiceRankRowData {
  name: string;
  count: number;
  revenue: number;
}

export function ServiceRankRow({
  row,
  rank,
  maxCount,
}: {
  row: ServiceRankRowData;
  rank: number;
  maxCount: number;
}) {
  const { colors, primaryColor } = useTheme();
  const pct = Math.min(Math.round((row.count / (maxCount || 1)) * 100), 100);
  const isFirst = rank === 1;
  const isSecond = rank === 2;

  return (
    <View
      className="p-3.5 rounded-xl border gap-2.5"
      style={{
        backgroundColor: "#181920",
        borderColor: isFirst ? "rgba(234, 179, 8, 0.2)" : "rgba(255, 255, 255, 0.08)",
      }}
    >
      {/* Top line: Rank + Service Name + Revenue */}
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

          <View className="flex-1" style={{ flexShrink: 1 }}>
            <Text
              style={{ color: "#ffffff", fontSize: 14, fontWeight: "700" }}
              numberOfLines={1}
            >
              {row.name}
            </Text>
            <Text style={{ color: "#a1a1aa", fontSize: 11.5 }}>
              {row.count} {row.count === 1 ? "atendimento" : "atendimentos"}
            </Text>
          </View>
        </View>

        <Text style={{ color: "#ffffff", fontSize: 14.5, fontWeight: "800", letterSpacing: 0.2 }}>
          {formatBRL(row.revenue)}
        </Text>
      </View>

      {/* Bottom line: Progress bar in owner's brand color */}
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
    </View>
  );
}
