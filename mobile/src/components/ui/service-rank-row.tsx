import { Text, View } from "react-native";

import { colors, rankRow, typography } from "@/constants/design-tokens";
import { formatBRL } from "@/lib/stats";

export interface ServiceRankRowData {
  name: string;
  count: number;
  revenue: number;
}

// .service-rank-item and children, globals.css:11256-11447; JSX structure
// mirrors app-shell.tsx:2930-2960. Sibling of TeamRankRow — same card shell,
// no avatar/commission, numbered instead of a podium tone.
export function ServiceRankRow({ row, rank, maxCount }: { row: ServiceRankRowData; rank: number; maxCount: number }) {
  const pct = Math.min(Math.round((row.count / (maxCount || 1)) * 100), 100);
  const isFirst = rank === 1;

  return (
    <View
      className="flex-row items-center gap-3.5 rounded-md border px-4 py-3.5"
      style={{ backgroundColor: rankRow.background, borderColor: rankRow.border, minHeight: 60 }}
    >
      <View
        className="items-center justify-center rounded-sm"
        style={{
          width: 28,
          height: 28,
          backgroundColor: isFirst ? rankRow.podiumFirst.background : rankRow.podium.background,
          borderWidth: 1,
          borderColor: isFirst ? rankRow.podiumFirst.border : rankRow.podium.border,
        }}
      >
        <Text style={{ color: isFirst ? rankRow.podiumFirst.color : rankRow.podium.color, ...typography.rankPodium }}>
          #{rank}
        </Text>
      </View>

      <View className="gap-0.5" style={{ width: 90 }}>
        <Text style={{ color: colors.textPrimary, ...typography.rankName }} numberOfLines={1}>
          {row.name}
        </Text>
        <Text style={{ color: colors.textSecondary, ...typography.rankSub }} numberOfLines={1}>
          {row.count} {row.count === 1 ? "atendimento" : "atendimentos"}
        </Text>
      </View>

      <View className="flex-1 gap-1.5">
        <View className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: rankRow.barTrack }}>
          <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: rankRow.barFill }} />
        </View>
      </View>

      <Text style={{ color: colors.textPrimary, ...typography.rankRevenue }}>{formatBRL(row.revenue)}</Text>
    </View>
  );
}
