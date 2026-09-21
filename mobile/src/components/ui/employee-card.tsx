import { Image } from "expo-image";
import { CalendarCheck, CalendarDays, CalendarPlus, Clock, Pencil } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { colors } from "@/constants/design-tokens";
import { resolveImageUrl } from "@/lib/api-client";
import { DEFAULT_COVER_URL, type EmployeeDTO } from "@/lib/employees";
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
  const isCommissionPercent = employee.commissionType === "percentage";
  const isCommissionFixed = employee.commissionType === "fixed";

  const commissionLabel = isCommissionPercent
    ? `${employee.commissionValue}% comissão`
    : isCommissionFixed
      ? `${formatBRL(employee.commissionValue)} fixa`
      : "Sem comissão";

  const visibleServices = employee.services.slice(0, 3);
  const extraServices = employee.services.length - visibleServices.length;
  const coverImage = resolveImageUrl(employee.bannerUrl) || DEFAULT_COVER_URL;

  return (
    <View
      style={{
        overflow: "hidden",
        borderRadius: 16,
        borderWidth: 1,
        backgroundColor: "#111216",
        borderColor: "rgba(255, 255, 255, 0.09)",
        marginBottom: 4,
      }}
    >
      {/* 1. Cover Banner */}
      <View style={{ height: 110, position: "relative" }}>
        <Image
          source={{ uri: coverImage }}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          contentFit="cover"
        />
        <View
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.52)",
          }}
        />

        {/* Top Badges */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: 10,
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
              paddingVertical: 4.5,
              backgroundColor: employee.active ? "rgba(16, 185, 129, 0.22)" : "rgba(113, 113, 122, 0.25)",
              borderWidth: 1,
              borderColor: employee.active ? "rgba(16, 185, 129, 0.45)" : "rgba(113, 113, 122, 0.4)",
            }}
          >
            <View
              style={{
                width: 6.5,
                height: 6.5,
                borderRadius: 4,
                backgroundColor: employee.active ? "#22c55e" : "#a1a1aa",
              }}
            />
            <Text
              style={{
                color: employee.active ? "#4ade80" : "#a1a1aa",
                fontSize: 10.5,
                fontWeight: "800",
                letterSpacing: 0.6,
                textTransform: "uppercase",
              }}
            >
              {employee.active ? "Ativo" : "Inativo"}
            </Text>
          </View>

          {/* Commission Badge */}
          <View
            style={{
              borderRadius: 7,
              paddingHorizontal: 9,
              paddingVertical: 4.5,
              backgroundColor: "rgba(120, 53, 15, 0.65)",
              borderWidth: 1,
              borderColor: "rgba(245, 158, 11, 0.4)",
            }}
          >
            <Text
              style={{
                color: "#fbbf24",
                fontSize: 11,
                fontWeight: "700",
                letterSpacing: 0.2,
              }}
            >
              {commissionLabel}
            </Text>
          </View>
        </View>
      </View>

      {/* 2. Centered Avatar Overlapping Banner */}
      <View style={{ alignItems: "center", marginTop: -38, marginBottom: 8 }}>
        <View
          style={{
            position: "relative",
            borderRadius: 999,
            padding: 3.5,
            backgroundColor: "#111216",
          }}
        >
          <Avatar name={employee.name} photoUrl={employee.photoUrl} size="lg" />
          <View
            style={{
              position: "absolute",
              bottom: 4,
              right: 4,
              width: 14,
              height: 14,
              borderRadius: 7,
              borderWidth: 2.5,
              borderColor: "#111216",
              backgroundColor: employee.active ? "#22c55e" : "#71717a",
            }}
          />
        </View>
      </View>

      {/* 3. Card Body */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 13 }}>
        {/* Name & Role */}
        <View style={{ alignItems: "center", gap: 3 }}>
          <Text
            style={{
              color: "#ffffff",
              fontSize: 17.5,
              fontWeight: "800",
              letterSpacing: -0.3,
              textAlign: "center",
            }}
          >
            {employee.name}
          </Text>
          <Text
            style={{
              color: "#9ca3af",
              fontSize: 13,
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
            paddingHorizontal: 12,
            paddingVertical: 10,
            backgroundColor: "#17181d",
            borderColor: "rgba(255, 255, 255, 0.08)",
          }}
        >
          <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
            <Text style={{ color: "#71717a", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Hoje
            </Text>
            <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "800" }}>
              {metrics.todayCount} atend.
            </Text>
          </View>

          <View style={{ width: 1, height: 24, backgroundColor: "rgba(255, 255, 255, 0.08)" }} />

          <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
            <Text style={{ color: "#71717a", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Este mês
            </Text>
            <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "800" }}>
              {metrics.monthCount} atend.
            </Text>
          </View>

          <View style={{ width: 1, height: 24, backgroundColor: "rgba(255, 255, 255, 0.08)" }} />

          <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
            <Text style={{ color: "#71717a", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Faturamento
            </Text>
            <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "800" }} numberOfLines={1}>
              {formatBRL(metrics.monthRevenue)}
            </Text>
          </View>
        </View>

        {/* 5. Services Chips */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 24 }}>
          {visibleServices.length === 0 ? (
            <Text style={{ color: "#71717a", fontSize: 11.5, fontStyle: "italic" }}>
              Nenhum serviço vinculado
            </Text>
          ) : (
            <>
              {visibleServices.map((service) => (
                <View
                  key={service}
                  style={{
                    borderRadius: 6,
                    paddingHorizontal: 8,
                    paddingVertical: 4.5,
                    backgroundColor: "#1c1d22",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.1)",
                  }}
                >
                  <Text
                    style={{
                      color: "rgba(255, 255, 255, 0.82)",
                      fontSize: 10.5,
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
                    paddingHorizontal: 7,
                    paddingVertical: 4.5,
                    backgroundColor: "#27272a",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.12)",
                  }}
                >
                  <Text
                    style={{
                      color: "#a1a1aa",
                      fontSize: 10.5,
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

        {/* 6. 2x2 Action Buttons */}
        <View style={{ gap: 8, marginTop: 4 }}>
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
                paddingVertical: 9.5,
                borderRadius: 10,
                backgroundColor: pressed ? "#27272a" : "#1c1d22",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.12)",
              })}
            >
              <CalendarPlus size={14} color="#a1a1aa" />
              <Text style={{ color: "#e4e4e7", fontSize: 13, fontWeight: "600" }}>Agendar</Text>
            </Pressable>

            <Pressable
              onPress={() => onOpenSchedule && onOpenSchedule(employee)}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 9.5,
                borderRadius: 10,
                backgroundColor: pressed ? "#27272a" : "#1c1d22",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.12)",
              })}
            >
              <Clock size={14} color="#a1a1aa" />
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
                paddingVertical: 9.5,
                borderRadius: 10,
                backgroundColor: pressed ? "#27272a" : "#1c1d22",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.12)",
              })}
            >
              <CalendarDays size={14} color="#a1a1aa" />
              <Text style={{ color: "#e4e4e7", fontSize: 13, fontWeight: "600" }}>Agenda</Text>
            </Pressable>

            <Pressable
              onPress={() => onEdit && onEdit(employee)}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 9.5,
                borderRadius: 10,
                backgroundColor: pressed ? "#27272a" : "#1c1d22",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.12)",
              })}
            >
              <Pencil size={14} color="#a1a1aa" />
              <Text style={{ color: "#e4e4e7", fontSize: 13, fontWeight: "600" }}>Editar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

