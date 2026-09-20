import { Image } from "expo-image";
import { Text, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { colors, teamCard, typography } from "@/constants/design-tokens";
import { resolveImageUrl } from "@/lib/api-client";
import { DEFAULT_COVER_URL, type EmployeeDTO } from "@/lib/employees";
import { formatBRL } from "@/lib/stats";

export interface EmployeeMetrics {
  todayCount: number;
  monthCount: number;
  monthRevenue: number;
}

// .modern-team-card and children, globals.css:11581-11816 (see the citation
// on `teamCard` in design-tokens.ts). Footer actions (Agendar/Horários/
// Agenda/Editar) are not ported — each opens a flow that doesn't exist in
// mobile yet (appointment creation, schedule editor, employee edit form, an
// employee-filtered agenda view) — see MOBILE_DESIGN_SYSTEM.md.
export function EmployeeCard({ employee, metrics }: { employee: EmployeeDTO; metrics: EmployeeMetrics }) {
  const commissionLabel =
    employee.commissionType === "percentage"
      ? `${employee.commissionValue}% comissão`
      : employee.commissionType === "fixed"
        ? `${formatBRL(employee.commissionValue)} fixa`
        : "Sem comissão";

  const statusTone = employee.active ? teamCard.statusBadge.active : teamCard.statusBadge.inactive;
  const visibleServices = employee.services.slice(0, 3);
  const extraServices = employee.services.length - visibleServices.length;

  return (
    <View
      style={{
        overflow: "hidden",
        borderRadius: 12,
        borderWidth: 1,
        backgroundColor: colors.surface,
        borderColor: colors.border,
        flexBasis: "100%",
      }}
    >
      <View style={{ height: teamCard.coverHeight }}>
        <Image
          source={{ uri: resolveImageUrl(employee.bannerUrl) || DEFAULT_COVER_URL }}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          contentFit="cover"
        />
        <View style={{ position: "absolute", inset: 0, backgroundColor: teamCard.coverOverlay }} />
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 10 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              alignSelf: "flex-start",
              borderRadius: 999,
              paddingHorizontal: 8,
              paddingVertical: 4,
              backgroundColor: statusTone.background,
              borderWidth: 1,
              borderColor: statusTone.border,
            }}
          >
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusTone.color }} />
            <Text style={{ color: statusTone.color, textTransform: "uppercase", ...typography.teamStatusBadge }}>
              {employee.active ? "Ativo" : "Inativo"}
            </Text>
          </View>
          <View
            style={{
              alignSelf: "flex-start",
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 4,
              backgroundColor: teamCard.commissionBadge.background,
              borderWidth: 1,
              borderColor: teamCard.commissionBadge.border,
            }}
          >
            <Text style={{ color: teamCard.commissionBadge.color, ...typography.teamCommissionBadge }}>
              {commissionLabel}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ alignItems: "center", marginTop: -38, marginBottom: 6 }}>
        <View style={{ borderRadius: 999, padding: 3, backgroundColor: teamCard.avatarRingColor }}>
          <Avatar name={employee.name} photoUrl={employee.photoUrl} size="lg" />
          <View
            style={{
              position: "absolute",
              bottom: 2,
              right: 2,
              width: 12,
              height: 12,
              borderRadius: 6,
              borderWidth: 2,
              borderColor: teamCard.avatarRingColor,
              backgroundColor: employee.active ? teamCard.activeDot.online : teamCard.activeDot.offline,
            }}
          />
        </View>
      </View>

      <View style={{ gap: 10, paddingHorizontal: 16, paddingBottom: 16 }}>
        <View style={{ alignItems: "center", gap: 2 }}>
          <Text style={{ color: colors.textPrimary, ...typography.teamName }}>{employee.name}</Text>
          <Text style={{ color: colors.textSecondary, ...typography.teamRole }}>
            {employee.jobTitle ?? "Profissional"}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: 10,
            borderWidth: 1,
            paddingHorizontal: 14,
            paddingVertical: 10,
            backgroundColor: teamCard.statsStrip.background,
            borderColor: teamCard.statsStrip.border,
          }}
        >
          <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
            <Text style={{ color: colors.textMuted, textTransform: "uppercase", ...typography.teamStatLabel }}>
              Hoje
            </Text>
            <Text style={{ color: colors.textPrimary, ...typography.teamStatValue }}>{metrics.todayCount} atend.</Text>
          </View>
          <View style={{ width: 1, height: 22, backgroundColor: teamCard.statsStrip.border }} />
          <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
            <Text style={{ color: colors.textMuted, textTransform: "uppercase", ...typography.teamStatLabel }}>
              Este mês
            </Text>
            <Text style={{ color: colors.textPrimary, ...typography.teamStatValue }}>{metrics.monthCount} atend.</Text>
          </View>
          <View style={{ width: 1, height: 22, backgroundColor: teamCard.statsStrip.border }} />
          <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
            <Text style={{ color: colors.textMuted, textTransform: "uppercase", ...typography.teamStatLabel }}>
              Faturamento
            </Text>
            <Text style={{ color: colors.textPrimary, ...typography.teamStatValue }} numberOfLines={1}>
              {formatBRL(metrics.monthRevenue)}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 24 }}>
          {visibleServices.length === 0 ? (
            <Text style={{ color: colors.textMuted, fontSize: 10.5, fontStyle: "italic" }}>
              Nenhum serviço vinculado
            </Text>
          ) : (
            <>
              {visibleServices.map((service) => (
                <View
                  key={service}
                  style={{
                    borderRadius: 4,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    backgroundColor: teamCard.serviceChip.background,
                    borderWidth: 1,
                    borderColor: teamCard.serviceChip.border,
                  }}
                >
                  <Text style={{ color: teamCard.serviceChip.color, ...typography.serviceChip }}>{service}</Text>
                </View>
              ))}
              {extraServices > 0 ? (
                <View style={{ borderRadius: 4, paddingHorizontal: 6, paddingVertical: 4, backgroundColor: teamCard.serviceMore.background }}>
                  <Text style={{ color: teamCard.serviceMore.color, ...typography.serviceMore }}>
                    +{extraServices} mais
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </View>
      </View>
    </View>
  );
}
