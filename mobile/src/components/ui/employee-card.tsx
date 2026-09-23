import { Image } from "expo-image";
import { CalendarDays, CalendarPlus, Clock, Pencil, Sparkles } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { useTheme } from "@/hooks/use-theme";
import { resolveImageUrl } from "@/lib/api-client";
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

export function EmployeeCard({
  employee,
  metrics,
  onNewAppointment,
  onOpenSchedule,
  onGoToAgenda,
  onEdit,
}: EmployeeCardProps) {
  const { session } = useSession();
  const { primaryColor, primaryForeground, coverUrl, ownerAvatarUrl } = useTheme();

  const isCommissionPercent = employee.commissionType === "percentage";
  const isCommissionFixed = employee.commissionType === "fixed";

  const commissionLabel = isCommissionPercent
    ? `${employee.commissionValue}% comissão`
    : isCommissionFixed
      ? `${formatBRL(employee.commissionValue)} fixa`
      : "Sem comissão";

  const visibleServices = employee.services?.slice(0, 3) || [];
  const extraServices = (employee.services?.length || 0) - visibleServices.length;

  const isOwnerMatch =
    employee.name.trim().toLowerCase() === (session?.name || "").trim().toLowerCase();

  const resolvedAvatar =
    employee.photoUrl ||
    (isOwnerMatch ? (session?.avatarUrl || ownerAvatarUrl || session?.company?.logoUrl) : null);

  const resolvedBanner =
    resolveImageUrl(employee.bannerUrl) ||
    coverUrl ||
    resolveImageUrl(session?.company?.bannerUrl) ||
    null;

  const brandAccent = primaryColor || "#ec4899";
  const textAccent = primaryForeground || "#ffffff";

  return (
    <View
      style={{
        overflow: "hidden",
        borderRadius: 22,
        borderWidth: 1,
        backgroundColor: "#101116",
        borderColor: "rgba(255, 255, 255, 0.08)",
        marginBottom: 14,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      {/* 1. Header Banner */}
      <View style={{ height: 82, position: "relative", backgroundColor: "#15161e" }}>
        {resolvedBanner ? (
          <Image
            source={{ uri: resolvedBanner }}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            contentFit="cover"
          />
        ) : (
          <View
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: brandAccent,
              opacity: 0.08,
            }}
          />
        )}
        {/* Dark overlay for perfect contrast */}
        <View
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(8, 9, 12, 0.58)",
          }}
        />

        {/* Top Badges */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 14,
            paddingTop: 10,
          }}
        >
          {/* Status Badge */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              borderRadius: 999,
              paddingHorizontal: 9,
              paddingVertical: 4,
              backgroundColor: employee.active ? "rgba(34, 197, 94, 0.16)" : "rgba(113, 113, 122, 0.2)",
              borderWidth: 1,
              borderColor: employee.active ? "rgba(34, 197, 94, 0.3)" : "rgba(113, 113, 122, 0.25)",
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: employee.active ? "#22c55e" : "#a1a1aa",
              }}
            />
            <Text
              style={{
                color: employee.active ? "#4ade80" : "#a1a1aa",
                fontSize: 10.5,
                fontWeight: "800",
                letterSpacing: 0.5,
                textTransform: "uppercase",
              }}
            >
              {employee.active ? "Ativo" : "Inativo"}
            </Text>
          </View>

          {/* Commission Badge */}
          <View
            style={{
              borderRadius: 999,
              paddingHorizontal: 9,
              paddingVertical: 4,
              backgroundColor: "rgba(245, 158, 11, 0.14)",
              borderWidth: 1,
              borderColor: "rgba(245, 158, 11, 0.28)",
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

      {/* 2. Avatar Overlapping Banner */}
      <View style={{ alignItems: "center", marginTop: -32, marginBottom: 6 }}>
        <View
          style={{
            position: "relative",
            borderRadius: 24,
            padding: 3.5,
            backgroundColor: "#101116",
          }}
        >
          <Avatar name={employee.name} photoUrl={resolvedAvatar} size="lg" />
          <View
            style={{
              position: "absolute",
              bottom: 3,
              right: 3,
              width: 13,
              height: 13,
              borderRadius: 6.5,
              borderWidth: 2.5,
              borderColor: "#101116",
              backgroundColor: employee.active ? "#22c55e" : "#71717a",
            }}
          />
        </View>
      </View>

      {/* 3. Card Body */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}>
        {/* Name & Job Title */}
        <View style={{ alignItems: "center", gap: 2 }}>
          <Text
            style={{
              color: "#ffffff",
              fontSize: 17.5,
              fontWeight: "800",
              letterSpacing: -0.3,
              textAlign: "center",
            }}
            numberOfLines={1}
          >
            {employee.name}
          </Text>
          <Text
            style={{
              color: "#9ca3af",
              fontSize: 12.5,
              fontWeight: "500",
              textAlign: "center",
            }}
          >
            {employee.jobTitle ?? "Profissional"}
          </Text>
        </View>

        {/* 4. Mini Stats Strip */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: 14,
            borderWidth: 1,
            paddingHorizontal: 10,
            paddingVertical: 10,
            backgroundColor: "#161720",
            borderColor: "rgba(255, 255, 255, 0.06)",
          }}
        >
          <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
            <Text style={{ color: "#71717a", fontSize: 9.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Hoje
            </Text>
            <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "800" }}>
              {metrics.todayCount} atend.
            </Text>
          </View>

          <View style={{ width: 1, height: 22, backgroundColor: "rgba(255, 255, 255, 0.07)" }} />

          <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
            <Text style={{ color: "#71717a", fontSize: 9.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Este mês
            </Text>
            <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "800" }}>
              {metrics.monthCount} atend.
            </Text>
          </View>

          <View style={{ width: 1, height: 22, backgroundColor: "rgba(255, 255, 255, 0.07)" }} />

          <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
            <Text style={{ color: "#71717a", fontSize: 9.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Faturamento
            </Text>
            <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "800" }} numberOfLines={1}>
              {formatBRL(metrics.monthRevenue)}
            </Text>
          </View>
        </View>

        {/* 5. Services Chips */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 20 }}>
          {visibleServices.length === 0 ? (
            <Text style={{ color: "#71717a", fontSize: 11.5, fontWeight: "500" }}>
              Nenhum serviço vinculado
            </Text>
          ) : (
            <>
              {visibleServices.map((service) => (
                <View
                  key={service}
                  style={{
                    borderRadius: 7,
                    paddingHorizontal: 8,
                    paddingVertical: 3.5,
                    backgroundColor: "#1b1c24",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <Text
                    style={{
                      color: "rgba(255, 255, 255, 0.82)",
                      fontSize: 10,
                      fontWeight: "700",
                      textTransform: "uppercase",
                    }}
                  >
                    {service}
                  </Text>
                </View>
              ))}
              {extraServices > 0 && (
                <View
                  style={{
                    borderRadius: 7,
                    paddingHorizontal: 7,
                    paddingVertical: 3.5,
                    backgroundColor: "#262730",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.1)",
                  }}
                >
                  <Text
                    style={{
                      color: "#a1a1aa",
                      fontSize: 10,
                      fontWeight: "700",
                    }}
                  >
                    +{extraServices} mais
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* 6. Action Buttons */}
        <View style={{ gap: 8, marginTop: 4 }}>
          {/* Primary CTA: Agendar atendimento */}
          {onNewAppointment && (
            <Pressable
              onPress={() => onNewAppointment(employee)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                height: 44,
                borderRadius: 13,
                backgroundColor: brandAccent,
                opacity: pressed ? 0.85 : 1,
                shadowColor: brandAccent,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 4,
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
                style={({ pressed }) => ({
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: pressed ? "#232530" : "#171821",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.09)",
                })}
              >
                <Clock size={14} color="#a1a1aa" />
                <Text style={{ color: "#e4e4e7", fontSize: 12.5, fontWeight: "600" }}>Horários</Text>
              </Pressable>
            )}

            {onGoToAgenda && (
              <Pressable
                onPress={() => onGoToAgenda(employee)}
                style={({ pressed }) => ({
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: pressed ? "#232530" : "#171821",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.09)",
                })}
              >
                <CalendarDays size={14} color="#a1a1aa" />
                <Text style={{ color: "#e4e4e7", fontSize: 12.5, fontWeight: "600" }}>Agenda</Text>
              </Pressable>
            )}

            {onEdit && (
              <Pressable
                onPress={() => onEdit(employee)}
                style={({ pressed }) => ({
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: pressed ? "#232530" : "#171821",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.09)",
                })}
              >
                <Pencil size={14} color="#a1a1aa" />
                <Text style={{ color: "#e4e4e7", fontSize: 12.5, fontWeight: "600" }}>Editar</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
