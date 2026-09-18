import { Text, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { colors, rankRow, typography } from "@/constants/design-tokens";
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

// .team-rank-item and children, globals.css:11239-11443; JSX structure
// mirrors app-shell.tsx:2866-2901.
export function TeamRankRow({ row, rank, maxRevenue }: { row: TeamRankRowData; rank: number; maxRevenue: number }) {
  const pct = Math.min(Math.round((row.revenue / (maxRevenue || 1)) * 100), 100);
  const podiumTone = rank === 1 ? rankRow.podiumFirst : rankRow.podium;
  const net = Math.max(row.revenue - row.commission, 0);

  return (
    <View
      className="flex-row items-center gap-3.5 rounded-md border px-4 py-3.5"
      style={{ backgroundColor: rankRow.background, borderColor: rankRow.border, minHeight: 60 }}
    >
      <View
        className="items-center justify-center rounded-sm"
        style={{ width: 28, height: 28, backgroundColor: podiumTone.background, borderWidth: 1, borderColor: podiumTone.border }}
      >
        <Text style={{ color: podiumTone.color, ...typography.rankPodium }}>#{rank}</Text>
      </View>
      <Avatar name={row.name} photoUrl={row.photoUrl} size="sm" />
      <View className="gap-0.5" style={{ width: 78 }}>
        <Text style={{ color: colors.textPrimary, ...typography.rankName }} numberOfLines={1}>
          {row.name}
        </Text>
        <Text style={{ color: colors.textSecondary, ...typography.rankSub }} numberOfLines={1}>
          {row.jobTitle ?? "Profissional"}
        </Text>
      </View>

      <View className="flex-1 gap-1.5">
        <View className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: rankRow.barTrack }}>
          <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: rankRow.barFill }} />
        </View>
        <Text style={{ color: colors.textSecondary, ...typography.rankMeta }} numberOfLines={1}>
          {row.appointments} {row.appointments === 1 ? "atendimento" : "atendimentos"} ·{" "}
          <Text style={{ color: rankRow.commissionText, fontWeight: "600" }}>Comissão: {formatBRL(row.commission)}</Text>
        </Text>
      </View>

      <View className="items-end gap-0.5">
        <Text style={{ color: colors.textPrimary, ...typography.rankRevenue }}>{formatBRL(row.revenue)}</Text>
        <Text style={{ color: colors.textMuted, ...typography.rankNet }}>Líq: {formatBRL(net)}</Text>
      </View>
    </View>
  );
}
