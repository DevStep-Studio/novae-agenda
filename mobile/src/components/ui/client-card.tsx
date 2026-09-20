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

// Adaptation, not a citation: the web's client list is a `<table>`
// (`.client-data-table`) that on mobile stays a real HTML table and just
// scrolls horizontally (`.data-table { min-width: 680px }`,
// `.data-table-wrap { overflow-x: auto }`) — RN has no table primitive and
// a sideways-scrolling table isn't a pattern worth reproducing natively.
// This card recomposes the same real sub-styles the table cells use
// (`.client-name-text`, `.client-badge`, `.client-whatsapp-btn`,
// `.client-visits-num`/`-unit`, `.client-total-spent`/`-spending-detail` —
// see design-tokens.ts citations) into a vertical layout, matching
// AppointmentCard's card shell for consistency with the rest of the app.
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
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        backgroundColor: colors.surfaceSecondary,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Avatar name={client.name} photoUrl={client.photoUrl} />
        <View style={{ flex: 1, flexShrink: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Text style={{ color: colors.textPrimary, ...typography.clientCardName, flexShrink: 1 }} numberOfLines={1}>
              {client.name}
            </Text>
            <ClientBadge tier={tier} />
          </View>
          <Text style={{ color: colors.textMuted, ...typography.clientCardSub }} numberOfLines={1}>
            {client.email || (client.phone ? "Cliente verificado" : "Sem e-mail")}
          </Text>
        </View>
      </View>

      {client.phone ? (
        <Pressable
          style={{
            height: 28,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            alignSelf: "flex-start",
            borderRadius: 6,
            paddingHorizontal: 8,
            backgroundColor: "rgba(34, 197, 94, 0.08)",
            borderWidth: 1,
            borderColor: "rgba(34, 197, 94, 0.2)",
          }}
          onPress={openWhatsApp}
        >
          <WhatsAppIcon size={13} />
          <Text style={{ color: "#22c55e", ...typography.whatsappPill }}>{client.phone}</Text>
        </Pressable>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingTop: 10,
        }}
      >
        <View>
          {client.visits > 0 ? (
            <Text>
              <Text style={{ color: colors.textPrimary, ...typography.clientVisitsNum }}>{client.visits}</Text>
              <Text style={{ color: colors.textMuted, ...typography.clientVisitsUnit }}>
                {" "}
                {client.visits === 1 ? "visita" : "visitas"}
              </Text>
            </Text>
          ) : (
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>—</Text>
          )}
          {client.lastVisit ? (
            <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 1 }}>
              última em {shortDate(client.lastVisit)}
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: colors.textPrimary, ...typography.clientTotalSpent }}>{formatBRL(client.spent)}</Text>
          {client.visits > 0 ? (
            <Text style={{ color: colors.textMuted, ...typography.clientSpendingDetail }}>
              méd. {formatBRL(Math.round(client.spent / client.visits))}/atend.
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
