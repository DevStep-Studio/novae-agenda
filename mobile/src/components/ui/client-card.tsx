import { Linking, Pressable, Text, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { ClientBadge } from "@/components/ui/client-badge";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { colors, typography } from "@/constants/design-tokens";
import { clientTier, type ClientDTO } from "@/lib/clients";
import { formatPhoneForWhatsApp } from "@/lib/api-client";
import { formatBRL } from "@/lib/stats";

function shortDate(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function ClientCard({ client }: { client: ClientDTO }) {
  const tier = clientTier(client);

  function openWhatsApp() {
    const digits = formatPhoneForWhatsApp(client.phone);
    if (!digits) return;
    const message = `Olá, ${client.name}! Tudo bem?`;
    Linking.openURL(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`);
  }

  return (
    <View
      style={{
        gap: 12,
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        backgroundColor: "#111216",
        borderColor: "rgba(255, 255, 255, 0.08)",
      }}
    >
      {/* 1. Header: Avatar + Name/Badge + Subtitle */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Avatar name={client.name} photoUrl={client.photoUrl} size="md" />
        <View style={{ flex: 1, flexShrink: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Text
              style={{
                color: "#ffffff",
                fontSize: 15.5,
                fontWeight: "700",
                letterSpacing: -0.2,
                flexShrink: 1,
              }}
              numberOfLines={1}
            >
              {client.name}
            </Text>
            <ClientBadge tier={tier} />
          </View>
          <Text
            style={{
              color: "#71717a",
              fontSize: 12,
              fontWeight: "500",
            }}
            numberOfLines={1}
          >
            {client.email || (client.phone ? client.phone : "Sem telefone")}
          </Text>
        </View>
      </View>

      {/* 2. Stats Row (Minimalist Flat Metrics) */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 9,
          paddingHorizontal: 12,
          borderRadius: 12,
          backgroundColor: "#16171d",
          borderWidth: 1,
          borderColor: "rgba(255, 255, 255, 0.04)",
        }}
      >
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={{ color: "#71717a", fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Última Visita
          </Text>
          <Text style={{ color: "#e4e4e7", fontSize: 12.5, fontWeight: "700", marginTop: 2 }}>
            {client.lastVisit ? shortDate(client.lastVisit) : "—"}
          </Text>
        </View>

        <View style={{ width: 1, height: 20, backgroundColor: "rgba(255, 255, 255, 0.06)" }} />

        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={{ color: "#71717a", fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Atendimentos
          </Text>
          <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "700", marginTop: 2 }}>
            {client.visits || 0} {client.visits === 1 ? "visita" : "visitas"}
          </Text>
        </View>

        <View style={{ width: 1, height: 20, backgroundColor: "rgba(255, 255, 255, 0.06)" }} />

        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={{ color: "#71717a", fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Total Gasto
          </Text>
          <Text style={{ color: "#10b981", fontSize: 12.5, fontWeight: "700", marginTop: 2 }}>
            {formatBRL(client.spent)}
          </Text>
        </View>
      </View>

      {/* 3. Action Button (Contato via WhatsApp) */}
      {client.phone ? (
        <Pressable
          style={{
            height: 36,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            alignSelf: "flex-start",
            borderRadius: 10,
            paddingHorizontal: 14,
            backgroundColor: "rgba(34, 197, 94, 0.08)",
            borderWidth: 1,
            borderColor: "rgba(34, 197, 94, 0.22)",
          }}
          onPress={openWhatsApp}
        >
          <WhatsAppIcon size={14} />
          <Text style={{ color: "#22c55e", fontSize: 12.5, fontWeight: "700", letterSpacing: 0.2 }}>
            Contato
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
