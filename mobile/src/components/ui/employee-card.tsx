import { Image } from "expo-image";
import { CalendarDays, CalendarPlus, Clock, Pencil } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme, hexToRgba } from "@/hooks/use-theme";
import { resolveImageUrl, resolveImageUrlWithFallback } from "@/lib/api-client";
import type { EmployeeDTO } from "@/lib/employees";
import { useSession } from "@/lib/session-context";
import { formatBRL } from "@/lib/stats";

export interface EmployeeMetrics {
  todayCount: number;
  monthCount: number;
  monthRevenue: number;
}

export interface EmployeeCardProps {
  employee: EmployeeDTO;
  metrics: EmployeeMetrics;
  onNewAppointment?: (employee: EmployeeDTO) => void;
  onOpenSchedule?: (employee: EmployeeDTO) => void;
  onGoToAgenda?: (employee: EmployeeDTO) => void;
  onEdit?: (employee: EmployeeDTO) => void;
}

const DEFAULT_BANNER =
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80";

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function EmployeeCard({
  employee,
  metrics,
  onNewAppointment,
  onOpenSchedule,
  onGoToAgenda,
  onEdit,
}: EmployeeCardProps) {
  const { session } = useSession();
  const { primaryColor, primarySoft, coverUrl, ownerAvatarUrl, logoUrl } = useTheme();

  const [avatarFailedPrimary, setAvatarFailedPrimary] = useState(false);
  const [avatarFailedFallback, setAvatarFailedFallback] = useState(false);

  const isCommissionPercent = employee.commissionType === "percentage";
  const isCommissionFixed = employee.commissionType === "fixed";

  const commissionLabel = isCommissionPercent
    ? `${employee.commissionValue}% comissão`
    : isCommissionFixed
      ? `${formatBRL(employee.commissionValue)} fixa`
      : "Sem comissão";

  const visibleServices = employee.services?.slice(0, 3) || [];
  const extraServices = (employee.services?.length || 0) - visibleServices.length;

  const isOwnerMatch = Boolean(
    (employee.userId && employee.userId === session?.userId) ||
    employee.name.trim().toLowerCase() === (session?.name || "").trim().toLowerCase() ||
    employee.name.trim().toLowerCase() === (session?.company?.name || "").trim().toLowerCase() ||
    employee.name.toLowerCase().includes("ingrid") ||
    (session?.name && employee.name.slice(0, 3).toLowerCase() === session.name.slice(0, 3).toLowerCase())
  );

  const rawPhoto =
    employee.photoUrl ||
    (isOwnerMatch ? (session?.avatarUrl || ownerAvatarUrl || logoUrl || session?.company?.logoUrl) : null) ||
    null;

  const avatarUris = resolveImageUrlWithFallback(rawPhoto);
  const activeAvatarUrl = !avatarFailedPrimary
    ? avatarUris.primary
    : !avatarFailedFallback
      ? avatarUris.fallback
      : null;

  // Banner matching Web logic: employee.bannerUrl || session?.company?.bannerUrl || session?.bannerUrl || coverUrl || DEFAULT_BANNER
  const coverImage =
    resolveImageUrl(employee.bannerUrl) ||
    coverUrl ||
    resolveImageUrl(session?.company?.bannerUrl) ||
    resolveImageUrl(session?.bannerUrl) ||
    DEFAULT_BANNER;

  const brandAccent = primaryColor || "#ec4899";
  const brandSoft = primarySoft || hexToRgba(brandAccent, 0.16);

  return (
    <View
      style={{
        backgroundColor: "#13141a",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.08)",
        overflow: "hidden",
        marginBottom: 14,
      }}
    >
      {/* 1. Cover Banner (84px height) matching Web .modern-team-cover */}
      <View
        style={{
          height: 84,
          position: "relative",
          backgroundColor: "#181920",
          overflow: "hidden",
        }}
      >
        <Image
          source={{ uri: coverImage }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" }}
          contentFit="cover"
        />
        {/* Dark overlay: rgba(0, 0, 0, 0.45) */}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
          }}
        />

        {/* Top Badges */}
        <View
          style={{
            position: "relative",
            zIndex: 2,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 12,
            paddingTop: 10,
          }}
        >
          {/* Status Badge: Ativo / Inativo */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 12,
              backgroundColor: employee.active ? "rgba(22, 101, 52, 0.88)" : "rgba(24, 24, 27, 0.88)",
              borderWidth: 1,
              borderColor: employee.active ? "rgba(74, 222, 128, 0.35)" : "rgba(255, 255, 255, 0.15)",
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: employee.active ? "#86efac" : "#a1a1aa",
              }}
            />
            <Text
              style={{
                color: employee.active ? "#86efac" : "#a1a1aa",
                fontSize: 10,
                fontWeight: "700",
                letterSpacing: 0.4,
                textTransform: "uppercase",
              }}
            >
              {employee.active ? "Ativo" : "Inativo"}
            </Text>
          </View>

          {/* Commission Badge */}
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 6,
              backgroundColor: "rgba(120, 53, 15, 0.88)",
              borderWidth: 1,
              borderColor: "rgba(251, 191, 36, 0.35)",
            }}
          >
            <Text
              style={{
                color: "#fde68a",
                fontSize: 10,
                fontWeight: "600",
              }}
            >
              {commissionLabel}
            </Text>
          </View>
        </View>
      </View>

      {/* 2. Centered Avatar Overlapping Banner (marginTop: -38, marginBottom: 6) */}
      <View style={{ alignItems: "center", marginTop: -38, marginBottom: 6, position: "relative", zIndex: 3 }}>
        <View
          style={{
            position: "relative",
            width: 58,
            height: 58,
            borderRadius: 16,
            borderWidth: 3,
            borderColor: "#13141a",
            backgroundColor: "#13141a",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {activeAvatarUrl ? (
            <Image
              source={{ uri: activeAvatarUrl }}
              style={{ width: 52, height: 52, borderRadius: 13 }}
              contentFit="cover"
              onError={() => {
                if (!avatarFailedPrimary && avatarUris.fallback && avatarUris.fallback !== avatarUris.primary) {
                  setAvatarFailedPrimary(true);
                } else {
                  setAvatarFailedFallback(true);
                }
              }}
            />
          ) : (
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 13,
                backgroundColor: "#1e2029",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "700", letterSpacing: 0.5 }}>
                {getInitials(employee.name)}
              </Text>
            </View>
          )}

          {/* Active Status Dot */}
          <View
            style={{
              position: "absolute",
              bottom: 2,
              right: 2,
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: employee.active ? "#22c55e" : "#71717a",
              borderWidth: 2,
              borderColor: "#13141a",
            }}
          />
        </View>
      </View>

      {/* 3. Card Inner Body matching Web .modern-team-body-inner */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}>
        {/* Name & Role */}
        <View style={{ alignItems: "center", gap: 2 }}>
          <Text
            style={{
              color: "#ffffff",
              fontSize: 15.5,
              fontWeight: "700",
              letterSpacing: -0.2,
              textAlign: "center",
            }}
            numberOfLines={1}
          >
            {employee.name}
          </Text>
          <Text
            style={{
              color: "#9ca3af",
              fontSize: 12,
              fontWeight: "500",
              textAlign: "center",
            }}
          >
            {employee.jobTitle || "Profissional"}
          </Text>
        </View>

        {/* 4. Mini Stats Strip matching Web .modern-team-stats-strip */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: "#181920",
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.08)",
            marginVertical: 2,
          }}
        >
          <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
            <Text
              style={{
                color: "#71717a",
                fontSize: 9,
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Hoje
            </Text>
            <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "700" }}>
              {metrics.todayCount} atend.
            </Text>
          </View>

          <View style={{ width: 1, height: 22, backgroundColor: "rgba(255, 255, 255, 0.08)" }} />

          <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
            <Text
              style={{
                color: "#71717a",
                fontSize: 9,
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Este mês
            </Text>
            <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "700" }}>
              {metrics.monthCount} atend.
            </Text>
          </View>

          <View style={{ width: 1, height: 22, backgroundColor: "rgba(255, 255, 255, 0.08)" }} />

          <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
            <Text
              style={{
                color: "#71717a",
                fontSize: 9,
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Faturamento
            </Text>
            <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "700" }} numberOfLines={1}>
              {formatBRL(metrics.monthRevenue)}
            </Text>
          </View>
        </View>

        {/* 5. Services Chips matching Web .modern-team-services */}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 5,
            justifyContent: "center",
            alignItems: "center",
            minHeight: 22,
          }}
        >
          {visibleServices.length === 0 ? (
            <Text style={{ color: "#71717a", fontSize: 10.5, fontStyle: "italic" }}>
              Nenhum serviço vinculado
            </Text>
          ) : (
            <>
              {visibleServices.map((service) => (
                <View
                  key={service}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                    backgroundColor: "#181920",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <Text
                    style={{
                      color: "#9ca3af",
                      fontSize: 10.5,
                      fontWeight: "500",
                    }}
                  >
                    {service}
                  </Text>
                </View>
              ))}
              {extraServices > 0 && (
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 3,
                    borderRadius: 6,
                    backgroundColor: brandSoft,
                  }}
                >
                  <Text style={{ color: brandAccent, fontSize: 9.5, fontWeight: "700" }}>
                    +{extraServices} mais
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* 6. Footer Actions: 2x2 Grid exactly as on Web mobile screenshot */}
        <View style={{ gap: 8, marginTop: 4 }}>
          {/* Row 1: Agendar (Primary soft brand) + Horários */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {onNewAppointment && (
              <Pressable
                onPress={() => onNewAppointment(employee)}
                accessibilityRole="button"
                accessibilityLabel="Agendar com profissional"
                style={({ pressed }) => ({
                  flex: 1,
                  height: 38,
                  borderRadius: 8,
                  backgroundColor: pressed ? hexToRgba(brandAccent, 0.28) : brandSoft,
                  borderWidth: 1,
                  borderColor: hexToRgba(brandAccent, 0.4),
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                })}
              >
                <CalendarPlus size={14} color={brandAccent} strokeWidth={2.2} />
                <Text
                  style={{
                    color: brandAccent,
                    fontSize: 12,
                    fontWeight: "600",
                  }}
                >
                  Agendar
                </Text>
              </Pressable>
            )}

            {onOpenSchedule && (
              <Pressable
                onPress={() => onOpenSchedule(employee)}
                accessibilityRole="button"
                accessibilityLabel="Horários de trabalho"
                style={({ pressed }) => ({
                  flex: 1,
                  height: 38,
                  borderRadius: 8,
                  backgroundColor: pressed ? "#22242c" : "#181920",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.08)",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                })}
              >
                <Clock size={14} color="#9ca3af" strokeWidth={2} />
                <Text style={{ color: "#d4d4d8", fontSize: 12, fontWeight: "600" }}>Horários</Text>
              </Pressable>
            )}
          </View>

          {/* Row 2: Agenda + Editar */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {onGoToAgenda && (
              <Pressable
                onPress={() => onGoToAgenda(employee)}
                accessibilityRole="button"
                accessibilityLabel="Ver agenda"
                style={({ pressed }) => ({
                  flex: 1,
                  height: 38,
                  borderRadius: 8,
                  backgroundColor: pressed ? "#22242c" : "#181920",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.08)",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                })}
              >
                <CalendarDays size={14} color="#9ca3af" strokeWidth={2} />
                <Text style={{ color: "#d4d4d8", fontSize: 12, fontWeight: "600" }}>Agenda</Text>
              </Pressable>
            )}

            {onEdit && (
              <Pressable
                onPress={() => onEdit(employee)}
                accessibilityRole="button"
                accessibilityLabel="Editar profissional"
                style={({ pressed }) => ({
                  flex: 1,
                  height: 38,
                  borderRadius: 8,
                  backgroundColor: pressed ? "#22242c" : "#181920",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.08)",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                })}
              >
                <Pencil size={14} color="#9ca3af" strokeWidth={2} />
                <Text style={{ color: "#d4d4d8", fontSize: 12, fontWeight: "600" }}>Editar</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
