import { Image } from "expo-image";
import { Clock3, Edit2, Loader2, Pencil, Tag, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { useTheme } from "@/hooks/use-theme";
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
  const { colors, primaryColor } = useTheme();
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
        overflow: "hidden",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
        backgroundColor: "#121316",
        opacity: service.active ? 1 : 0.65,
        minHeight: 220,
      }}
    >
      {/* Background Image with Dark Minimalist Overlay (no loud gradient) */}
      <Image
        source={{ uri: getServiceImage(service) }}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        contentFit="cover"
      />
      <View
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.72)",
        }}
      />

      <View style={{ padding: 18, minHeight: 220, justifyContent: "space-between" }}>
        {/* Top Header Bar: [ Editar ] [ Excluir ] on left, [ Sem categoria ] on right */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {onEdit && (
              <Pressable
                onPress={() => onEdit(service)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: "rgba(20, 20, 25, 0.8)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.15)",
                }}
              >
                <Pencil size={12} color="#ffffff" />
                <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "600" }}>Editar</Text>
              </Pressable>
            )}

            {onDelete && (
              <Pressable
                onPress={() => onDelete(service)}
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: "rgba(239, 68, 68, 0.18)",
                  borderWidth: 1,
                  borderColor: "rgba(239, 68, 68, 0.4)",
                }}
              >
                <Trash2 size={13} color="#ef4444" />
              </Pressable>
            )}
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: "rgba(20, 20, 25, 0.8)",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.15)",
            }}
          >
            <Tag size={12} color="#9ca3af" />
            <Text style={{ color: "#d1d5db", fontSize: 12, fontWeight: "500" }}>
              {service.categoryName ?? "Sem categoria"}
            </Text>
          </View>
        </View>

        {/* Middle Body: Service Title and Smart Description */}
        <Pressable
          onPress={() => onEdit && onEdit(service)}
          style={{ marginTop: 20, marginBottom: 12 }}
        >
          <Text
            style={{
              color: "#ffffff",
              fontSize: 18,
              fontWeight: "800",
              letterSpacing: -0.2,
              textTransform: "uppercase",
            }}
          >
            {service.name}
          </Text>
          <Text
            numberOfLines={2}
            style={{
              marginTop: 6,
              color: "#d1d5db",
              fontSize: 13,
              lineHeight: 18.5,
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
            borderTopColor: "rgba(255, 255, 255, 0.1)",
            paddingTop: 14,
          }}
        >
          <View style={{ gap: 2 }}>
            {isQuote ? (
              <Text style={{ color: "#38bdf8", fontSize: 15, fontWeight: "800" }}>Sob consulta</Text>
            ) : (
              <Text style={{ color: "#ffffff", fontSize: 20, fontWeight: "800", letterSpacing: -0.5 }}>
                {formatBRL(numericPrice)}
              </Text>
            )}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Clock3 size={12} color="#9ca3af" />
              <Text style={{ color: "#9ca3af", fontSize: 12, fontWeight: "600" }}>
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
              backgroundColor: service.active ? primaryColor : "#27272a",
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
