import { Image } from "expo-image";
import { CalendarDays, CalendarPlus, Clock, Pencil } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { useTheme } from "@/hooks/use-theme";
import { resolveImageUrl } from "@/lib/api-client";
import { DEFAULT_COVER_URL, type EmployeeDTO } from "@/lib/employees";
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
  const { primaryColor, coverUrl, ownerAvatarUrl, colors } = useTheme();

  const isCommissionPercent = employee.commissionType === "percentage";
  const isCommissionFixed = employee.commissionType === "fixed";

  const commissionLabel = isCommissionPercent
    ? `${employee.commissionValue}% comissão`
    : isCommissionFixed
      ? `${formatBRL(employee.commissionValue)} fixa`
      : "Sem comissão";

  const visibleServices = employee.services.slice(0, 3);
  const extraServices = employee.services.length - visibleServices.length;

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

  return (
    <View
      style={{
        overflow: "hidden",
        borderRadius: 18,
        borderWidth: 1,
        backgroundColor: "#111216",
        borderColor: "rgba(255, 255, 255, 0.08)",
        marginBottom: 8,
      }}
    >
      {/* 1. Cover Banner */}
      <View style={{ height: 80, position: "relative", backgroundColor: "#17181f" }}>
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
              backgroundColor: primaryColor,
              opacity: 0.15,
            }}
          />
        )}
        <View
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.58)",
          }}
        />

        {/* Top Badges */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 12,
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
              paddingHorizontal: 8,
              paddingVertical: 3.5,
              backgroundColor: employee.active ? "rgba(16, 185, 129, 0.18)" : "rgba(113, 113, 122, 0.2)",
              borderWidth: 1,
              borderColor: employee.active ? "rgba(16, 185, 129, 0.35)" : "rgba(113, 113, 122, 0.3)",
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
                fontSize: 10,
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
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 3.5,
              backgroundColor: "rgba(245, 158, 11, 0.15)",
              borderWidth: 1,
              borderColor: "rgba(245, 158, 11, 0.3)",
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

      {/* 2. Centered Avatar Overlapping Banner */}
      <View style={{ alignItems: "center", marginTop: -34, marginBottom: 8 }}>
        <View
          style={{
            position: "relative",
            borderRadius: 16,
            padding: 3,
            backgroundColor: "#111216",
          }}
        >
          <Avatar name={employee.name} photoUrl={resolvedAvatar} size="lg" />
          <View
            style={{
              position: "absolute",
              bottom: 2,
              right: 2,
              width: 12,
              height: 12,
              borderRadius: 6,
              borderWidth: 2,
              borderColor: "#111216",
              backgroundColor: employee.active ? "#22c55e" : "#71717a",
            }}
          />
        </View>
      </View>

      {/* 3. Card Body */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}>
        {/* Name & Role */}
        <View style={{ alignItems: "center", gap: 2 }}>
          <Text
            style={{
              color: "#ffffff",
              fontSize: 16.5,
              fontWeight: "800",
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
            borderRadius: 12,
            borderWidth: 1,
            paddingHorizontal: 10,
            paddingVertical: 9,
            backgroundColor: "#181920",
            borderColor: "rgba(255, 255, 255, 0.07)",
          }}
        >
          <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
            <Text style={{ color: "#71717a", fontSize: 9.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Hoje
            </Text>
            <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "800" }}>
              {metrics.todayCount} atend.
            </Text>
          </View>

          <View style={{ width: 1, height: 22, backgroundColor: "rgba(255, 255, 255, 0.08)" }} />

          <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
            <Text style={{ color: "#71717a", fontSize: 9.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Este mês
            </Text>
            <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "800" }}>
              {metrics.monthCount} atend.
            </Text>
          </View>

          <View style={{ width: 1, height: 22, backgroundColor: "rgba(255, 255, 255, 0.08)" }} />

          <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
            <Text style={{ color: "#71717a", fontSize: 9.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Faturamento
            </Text>
            <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "800" }} numberOfLines={1}>
              {formatBRL(metrics.monthRevenue)}
            </Text>
          </View>
        </View>

        {/* 5. Services Chips */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 5, minHeight: 20 }}>
          {visibleServices.length === 0 ? (
            <Text style={{ color: "#71717a", fontSize: 11, fontStyle: "italic" }}>
              Nenhum serviço vinculado
            </Text>
          ) : (
            <>
              {visibleServices.map((service) => (
                <View
                  key={service}
                  style={{
                    borderRadius: 6,
                    paddingHorizontal: 7,
                    paddingVertical: 3.5,
                    backgroundColor: "#1c1d22",
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
                    borderRadius: 6,
                    paddingHorizontal: 6,
                    paddingVertical: 3.5,
                    backgroundColor: "#27272a",
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

        {/* 6. Action Buttons Grid */}
        <View style={{ gap: 8, marginTop: 2 }}>
          {/* Row 1: Agendar & Horários */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => onNewAppointment && onNewAppointment(employee)}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                height: 42,
                borderRadius: 12,
                backgroundColor: pressed ? "#27272a" : "#1c1d24",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.12)",
              })}
            >
              <CalendarPlus size={15} color={primaryColor || "#ffffff"} />
              <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700" }}>Agendar</Text>
            </Pressable>

            <Pressable
              onPress={() => onOpenSchedule && onOpenSchedule(employee)}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                height: 42,
                borderRadius: 12,
                backgroundColor: pressed ? "#27272a" : "#1c1d24",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.12)",
              })}
            >
              <Clock size={15} color="#a1a1aa" />
              <Text style={{ color: "#e4e4e7", fontSize: 13, fontWeight: "600" }}>Horários</Text>
            </Pressable>
          </View>

          {/* Row 2: Agenda & Editar */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => onGoToAgenda && onGoToAgenda(employee)}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                height: 42,
                borderRadius: 12,
                backgroundColor: pressed ? "#27272a" : "#181920",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.09)",
              })}
            >
              <CalendarDays size={15} color="#a1a1aa" />
              <Text style={{ color: "#d4d4d8", fontSize: 13, fontWeight: "600" }}>Agenda</Text>
            </Pressable>

            <Pressable
              onPress={() => onEdit && onEdit(employee)}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                height: 42,
                borderRadius: 12,
                backgroundColor: pressed ? "#27272a" : "#181920",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.09)",
              })}
            >
              <Pencil size={15} color="#a1a1aa" />
              <Text style={{ color: "#d4d4d8", fontSize: 13, fontWeight: "600" }}>Editar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
