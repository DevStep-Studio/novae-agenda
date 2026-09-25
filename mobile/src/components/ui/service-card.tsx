import { Image } from "expo-image";
import { Clock3, Pencil, Tag, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { useTheme } from "@/hooks/use-theme";
import { useResponsive } from "@/hooks/use-responsive";
import { scaleFont } from "@/lib/responsive";
import {
  formatDuration,
  getServiceDescription,
  getServiceImage,
  setServiceActive,
  type ServiceDTO,
} from "@/lib/services";
import { formatBRL } from "@/lib/stats";

export interface ServiceCardProps {
  service: ServiceDTO;
  onToggled: (next: ServiceDTO) => void;
  onEdit?: (service: ServiceDTO) => void;
  onDelete?: (service: ServiceDTO) => void;
}

export function ServiceCard({ service, onToggled, onEdit, onDelete }: ServiceCardProps) {
  const { primaryColor } = useTheme();
  const { isCompact } = useResponsive();
  const [toggling, setToggling] = useState(false);
  const numericPrice = Number(service.price) || 0;
  const isQuote = service.paymentType === "QUOTE" || numericPrice === 0;

  async function handleToggle() {
    if (toggling) return;
    setToggling(true);
    try {
      const updated = await setServiceActive(service.id, !service.active);
      onToggled(updated);
    } catch {
      // keep current state
    } finally {
      setToggling(false);
    }
  }

  return (
    <View
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
        backgroundColor: "#0d0e12",
        opacity: service.active ? 1 : 0.65,
        minHeight: 240,
      }}
    >
      {/* Background Image with Dark Minimalist Overlay */}
      <Image
        source={{ uri: getServiceImage(service) }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" }}
        contentFit="cover"
      />
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(8, 8, 12, 0.72)",
        }}
      />

      <View style={{ padding: isCompact ? 14 : 18, minHeight: 240, justifyContent: "space-between" }}>
        {/* Top Header Bar: [ Editar ] [ Excluir ] on left, [ Sem categoria ] on right */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, flexWrap: "wrap" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {onEdit && (
              <Pressable
                onPress={() => onEdit(service)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  paddingHorizontal: isCompact ? 10 : 12,
                  paddingVertical: 5,
                  borderRadius: 999,
                  backgroundColor: "rgba(18, 18, 22, 0.8)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.2)",
                  minHeight: 32,
                }}
              >
                <Pencil size={12} color="#ffffff" />
                <Text style={{ color: "#ffffff", fontSize: scaleFont(12, { min: 11, max: 13 }), fontWeight: "600" }}>Editar</Text>
              </Pressable>
            )}

            {onDelete && (
              <Pressable
                onPress={() => onDelete(service)}
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: "rgba(239, 68, 68, 0.2)",
                  borderWidth: 1,
                  borderColor: "rgba(239, 68, 68, 0.4)",
                }}
              >
                <Trash2 size={13} color="#ff6b6b" />
              </Pressable>
            )}
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: isCompact ? 8 : 12,
              paddingVertical: 5,
              borderRadius: 999,
              backgroundColor: "rgba(0, 0, 0, 0.55)",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.16)",
              maxWidth: "60%",
            }}
          >
            <Tag size={11} color="rgba(255, 255, 255, 0.85)" />
            <Text
              numberOfLines={1}
              style={{
                color: "rgba(255, 255, 255, 0.85)",
                fontSize: scaleFont(11.5, { min: 10, max: 12 }),
                fontWeight: "500",
              }}
            >
              {service.categoryName ?? "Sem categoria"}
            </Text>
          </View>
        </View>

        {/* Middle Body: Service Title and Smart Description */}
        <Pressable
          onPress={() => onEdit && onEdit(service)}
          style={{ marginTop: 16, marginBottom: 10 }}
        >
          <Text
            style={{
              color: "#ffffff",
              fontSize: scaleFont(19, { min: 16, max: 20 }),
              fontWeight: "800",
              letterSpacing: -0.25,
              textTransform: "uppercase",
            }}
          >
            {service.name}
          </Text>
          <Text
            numberOfLines={2}
            style={{
              marginTop: 6,
              color: "rgba(255, 255, 255, 0.88)",
              fontSize: scaleFont(12.5, { min: 11, max: 13.5 }),
              lineHeight: 18,
              fontWeight: "400",
            }}
          >
            {getServiceDescription(service)}
          </Text>
        </Pressable>

        {/* Bottom Footer: Price, Duration & Active Toggle Switch */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderTopWidth: 1,
            borderTopColor: "rgba(255, 255, 255, 0.14)",
            paddingTop: 14,
          }}
        >
          <View style={{ gap: 2 }}>
            {isQuote ? (
              <Text style={{ color: "#38bdf8", fontSize: scaleFont(15, { min: 13, max: 16 }), fontWeight: "800" }}>Sob consulta</Text>
            ) : (
              <Text style={{ color: "#ffffff", fontSize: scaleFont(21, { min: 17, max: 22 }), fontWeight: "800", letterSpacing: -0.5 }}>
                {formatBRL(numericPrice)}
              </Text>
            )}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 }}>
              <Clock3 size={12} color="#a1a1aa" />
              <Text style={{ color: "#a1a1aa", fontSize: scaleFont(12, { min: 10.5, max: 13 }), fontWeight: "500" }}>
                {formatDuration(Number(service.durationMinutes) || 0)}
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: service.active }}
            disabled={toggling}
            onPress={handleToggle}
            style={{
              width: 50,
              height: 28,
              borderRadius: 14,
              backgroundColor: service.active ? (primaryColor || "#ffffff") : "#27272a",
              justifyContent: "center",
              padding: 3,
              opacity: toggling ? 0.6 : 1,
            }}
          >
            {toggling ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <View
                style={{
                  alignSelf: service.active ? "flex-end" : "flex-start",
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: "#ffffff",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 3,
                  elevation: 3,
                }}
              />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
