import { Image } from "expo-image";
import { CalendarDays, CalendarPlus, Clock, Pencil } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { useTheme } from "@/hooks/use-theme";
import { resolveImageUrlWithFallback } from "@/lib/api-client";
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
  const { primaryColor, primaryForeground, ownerAvatarUrl, logoUrl } = useTheme();

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
    ownerAvatarUrl ||
    logoUrl ||
    null;

  const avatarUris = resolveImageUrlWithFallback(rawPhoto);
  const activeAvatarUrl = !avatarFailedPrimary
    ? avatarUris.primary
    : !avatarFailedFallback
      ? avatarUris.fallback
      : null;

  const brandAccent = primaryColor || "#ec4899";
  const textAccent = primaryForeground || "#ffffff";

  return (
    <View
      style={{
        backgroundColor: "#121319",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.08)",
        padding: 16,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 3,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Subtle top accent highlight */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2.5,
          backgroundColor: brandAccent,
          opacity: 0.85,
        }}
      />

      {/* 1. Header: Avatar + Identity + Status Pill */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        {/* Avatar */}
        <View style={{ position: "relative" }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              overflow: "hidden",
              backgroundColor: "#1a1b24",
              borderWidth: 1.5,
              borderColor: "rgba(255, 255, 255, 0.1)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {activeAvatarUrl ? (
              <Image
                source={{ uri: activeAvatarUrl }}
                style={{ width: 52, height: 52, borderRadius: 15 }}
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
              <Text
                style={{
                  color: brandAccent,
                  fontSize: 18,
                  fontWeight: "700",
                  letterSpacing: 0.5,
                }}
              >
                {getInitials(employee.name)}
              </Text>
            )}
          </View>

          {/* Active Status Dot */}
          <View
            style={{
              position: "absolute",
              bottom: -1,
              right: -1,
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: employee.active ? "#10b981" : "#71717a",
              borderWidth: 2.5,
              borderColor: "#121319",
            }}
          />
        </View>

        {/* Identity & Subtitle */}
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text
            style={{
              color: "#ffffff",
              fontSize: 16.5,
              fontWeight: "700",
              letterSpacing: -0.2,
            }}
            numberOfLines={1}
          >
            {employee.name}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Text style={{ color: "#9ca3af", fontSize: 12.5, fontWeight: "500" }}>
              {employee.jobTitle || "Profissional"}
            </Text>

            <Text style={{ color: "#4b5563", fontSize: 12 }}>•</Text>

            <View
              style={{
                backgroundColor: "rgba(245, 158, 11, 0.12)",
                paddingHorizontal: 6.5,
                paddingVertical: 2,
                borderRadius: 5,
                borderWidth: 1,
                borderColor: "rgba(245, 158, 11, 0.22)",
              }}
            >
              <Text
                style={{
                  color: "#fbbf24",
                  fontSize: 10.5,
                  fontWeight: "700",
                }}
              >
                {commissionLabel}
              </Text>
            </View>
          </View>
        </View>

        {/* Status Pill */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: employee.active ? "rgba(16, 185, 129, 0.12)" : "rgba(113, 113, 122, 0.15)",
            borderWidth: 1,
            borderColor: employee.active ? "rgba(16, 185, 129, 0.25)" : "rgba(113, 113, 122, 0.2)",
          }}
        >
          <View
            style={{
              width: 5.5,
              height: 5.5,
              borderRadius: 3,
              backgroundColor: employee.active ? "#10b981" : "#a1a1aa",
            }}
          />
          <Text
            style={{
              color: employee.active ? "#34d399" : "#a1a1aa",
              fontSize: 10,
              fontWeight: "700",
              letterSpacing: 0.4,
              textTransform: "uppercase",
            }}
          >
            {employee.active ? "Ativo" : "Inativo"}
          </Text>
        </View>
      </View>

      {/* 2. Services Chips (only if available) */}
      {visibleServices.length > 0 && (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 6,
            marginTop: 12,
          }}
        >
          {visibleServices.map((service) => (
            <View
              key={service}
              style={{
                borderRadius: 6,
                paddingHorizontal: 8,
                paddingVertical: 3,
                backgroundColor: "#181922",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.06)",
              }}
            >
              <Text
                style={{
                  color: "#cbd5e1",
                  fontSize: 10.5,
                  fontWeight: "600",
                }}
              >
                {service}
              </Text>
            </View>
          ))}
          {extraServices > 0 && (
            <View
              style={{
                borderRadius: 6,
                paddingHorizontal: 7,
                paddingVertical: 3,
                backgroundColor: "#222430",
              }}
            >
              <Text style={{ color: "#9ca3af", fontSize: 10.5, fontWeight: "600" }}>
                +{extraServices}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* 3. Sleek Minimalist Metrics Bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "rgba(255, 255, 255, 0.05)",
          backgroundColor: "#161720",
          paddingVertical: 9,
          paddingHorizontal: 12,
          marginTop: 12,
          marginBottom: 14,
        }}
      >
        <View style={{ flex: 1, alignItems: "center", gap: 1 }}>
          <Text style={{ color: "#71717a", fontSize: 9.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Hoje
          </Text>
          <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700" }}>
            {metrics.todayCount} atend.
          </Text>
        </View>

        <View style={{ width: 1, height: 18, backgroundColor: "rgba(255, 255, 255, 0.07)" }} />

        <View style={{ flex: 1, alignItems: "center", gap: 1 }}>
          <Text style={{ color: "#71717a", fontSize: 9.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Este mês
          </Text>
          <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700" }}>
            {metrics.monthCount} atend.
          </Text>
        </View>

        <View style={{ width: 1, height: 18, backgroundColor: "rgba(255, 255, 255, 0.07)" }} />

        <View style={{ flex: 1, alignItems: "center", gap: 1 }}>
          <Text style={{ color: "#71717a", fontSize: 9.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Faturamento
          </Text>
          <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700" }} numberOfLines={1}>
            {formatBRL(metrics.monthRevenue)}
          </Text>
        </View>
      </View>

      {/* 4. Action Buttons */}
      <View style={{ gap: 8 }}>
        {/* Primary CTA: Agendar atendimento */}
        {onNewAppointment && (
          <Pressable
            onPress={() => onNewAppointment(employee)}
            accessibilityRole="button"
            accessibilityLabel="Agendar atendimento com este profissional"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              height: 44,
              borderRadius: 12,
              backgroundColor: brandAccent,
              opacity: pressed ? 0.86 : 1,
              shadowColor: brandAccent,
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.28,
              shadowRadius: 6,
              elevation: 2,
            })}
          >
            <CalendarPlus size={16} color={textAccent} strokeWidth={2.4} />
            <Text
              style={{
                color: textAccent,
                fontSize: 13.5,
                fontWeight: "700",
                letterSpacing: -0.1,
              }}
            >
              Agendar atendimento
            </Text>
          </Pressable>
        )}

        {/* Secondary Quick Actions Row (Horários, Agenda, Editar) */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {onOpenSchedule && (
            <Pressable
              onPress={() => onOpenSchedule(employee)}
              accessibilityRole="button"
              accessibilityLabel="Ver e ajustar horários de trabalho"
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                height: 38,
                borderRadius: 10,
                backgroundColor: pressed ? "#242632" : "#191a22",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.08)",
              })}
            >
              <Clock size={13.5} color="#9ca3af" strokeWidth={2} />
              <Text style={{ color: "#e4e4e7", fontSize: 12, fontWeight: "600" }}>Horários</Text>
            </Pressable>
          )}

          {onGoToAgenda && (
            <Pressable
              onPress={() => onGoToAgenda(employee)}
              accessibilityRole="button"
              accessibilityLabel="Ver agenda do profissional"
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                height: 38,
                borderRadius: 10,
                backgroundColor: pressed ? "#242632" : "#191a22",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.08)",
              })}
            >
              <CalendarDays size={13.5} color="#9ca3af" strokeWidth={2} />
              <Text style={{ color: "#e4e4e7", fontSize: 12, fontWeight: "600" }}>Agenda</Text>
            </Pressable>
          )}

          {onEdit && (
            <Pressable
              onPress={() => onEdit(employee)}
              accessibilityRole="button"
              accessibilityLabel="Editar dados do profissional"
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                height: 38,
                borderRadius: 10,
                backgroundColor: pressed ? "#242632" : "#191a22",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.08)",
              })}
            >
              <Pencil size={13.5} color="#9ca3af" strokeWidth={2} />
              <Text style={{ color: "#e4e4e7", fontSize: 12, fontWeight: "600" }}>Editar</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}
