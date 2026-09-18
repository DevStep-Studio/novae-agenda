import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Clock3, Tag } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { colors, serviceCard, typography } from "@/constants/design-tokens";
import {
  formatDuration,
  getServiceDescription,
  getServiceImage,
  setServiceActive,
  type ServiceDTO,
} from "@/lib/services";
import { formatBRL } from "@/lib/stats";

// .service-card and children, globals.css:4452-4700; JSX structure mirrors
// app-shell.tsx:1996-2080. Simplification: an inactive service also
// grayscales its photo on web (`.service-card.inactive .service-card-bg`);
// RN has no CSS-filter equivalent for a remote image without a shader/
// canvas library, so this only ports the card-level `opacity: 0.65` dimming.
// "Editar"/"Excluir" pills are not ported (they open a full edit form / a
// destructive confirm dialog, neither exists in mobile yet — see
// MOBILE_DESIGN_SYSTEM.md). The active/inactive toggle IS real:
// `PATCH /api/services/[id]` already accepts a bare `{ active }`
// partial update, so this calls it directly rather than faking the switch.
export function ServiceCard({ service, onToggled }: { service: ServiceDTO; onToggled: (next: ServiceDTO) => void }) {
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
      // Silently keep current state — the toggle simply won't move, which
      // is enough feedback at this list-level (no toast system in mobile yet).
    } finally {
      setToggling(false);
    }
  }

  return (
    <View
      className="overflow-hidden rounded-lg border"
      style={{
        minHeight: serviceCard.minHeight,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        opacity: service.active ? 1 : 0.65,
        flexBasis: "100%",
      }}
    >
      <Image
        source={{ uri: getServiceImage(service) }}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        contentFit="cover"
      />
      <LinearGradient
        colors={serviceCard.gradient.colors}
        locations={serviceCard.gradient.locations}
        style={{ position: "absolute", inset: 0 }}
      />

      <View className="gap-0" style={{ padding: 18, minHeight: serviceCard.minHeight }}>
        <View className="flex-row items-center justify-between gap-2.5">
          <View
            className="flex-row items-center gap-1.5 self-start rounded-full px-3 py-1"
            style={{ backgroundColor: serviceCard.categoryBadge.background, borderWidth: 1, borderColor: serviceCard.categoryBadge.border }}
          >
            <Tag size={12} color={serviceCard.categoryBadge.color} />
            <Text style={{ color: serviceCard.categoryBadge.color, ...typography.serviceCategoryBadge }}>
              {service.categoryName ?? "Sem categoria"}
            </Text>
          </View>
        </View>

        <View className="flex-1 justify-end" style={{ marginTop: 22, marginBottom: 14 }}>
          <Text
            style={{
              color: "#ffffff",
              textShadowColor: "rgba(0,0,0,0.8)",
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 3,
              ...typography.serviceCardTitle,
            }}
          >
            {service.name}
          </Text>
          <Text
            className="mt-1.5"
            numberOfLines={2}
            style={{
              color: serviceCard.descriptionColor,
              textShadowColor: "rgba(0,0,0,0.85)",
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 3,
              ...typography.serviceCardDesc,
            }}
          >
            {getServiceDescription(service)}
          </Text>
        </View>

        <View
          className="flex-row items-end justify-between border-t pt-3.5"
          style={{ borderTopColor: serviceCard.footerBorder }}
        >
          <View>
            {isQuote ? (
              <Text style={{ color: "#38bdf8", fontSize: 13, fontWeight: "700" }}>Sob consulta</Text>
            ) : (
              <Text style={{ color: "#ffffff", ...typography.servicePrice }}>{formatBRL(numericPrice)}</Text>
            )}
            <View className="mt-0.5 flex-row items-center gap-1">
              <Clock3 size={13} color={colors.primary} />
              <Text style={{ color: colors.primary, ...typography.serviceDuration }}>
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
              width: serviceCard.toggle.trackWidth,
              height: serviceCard.toggle.trackHeight,
              borderRadius: serviceCard.toggle.trackHeight / 2,
              backgroundColor: service.active ? colors.primary : serviceCard.toggle.offColor,
              justifyContent: "center",
              opacity: toggling ? 0.6 : 1,
            }}
          >
            {toggling ? (
              <ActivityIndicator size="small" color="#ffffff" style={{ position: "absolute", alignSelf: "center" }} />
            ) : (
              <View
                style={{
                  position: "absolute",
                  top: serviceCard.toggle.thumbInset,
                  left: service.active
                    ? serviceCard.toggle.trackWidth - serviceCard.toggle.thumbSize - serviceCard.toggle.thumbInset
                    : serviceCard.toggle.thumbInset,
                  width: serviceCard.toggle.thumbSize,
                  height: serviceCard.toggle.thumbSize,
                  borderRadius: serviceCard.toggle.thumbSize / 2,
                  backgroundColor: "#ffffff",
                }}
              />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
