import { CircleDollarSign, Search, Sparkles, Users, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { ClientCard } from "@/components/ui/client-card";
import { MetricCard } from "@/components/ui/metric-card";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { colors, typography } from "@/constants/design-tokens";
import { ApiError } from "@/lib/api-client";
import { getClients, isFrequentOrVip, type ClientDTO } from "@/lib/clients";
import { formatBRL } from "@/lib/stats";
import { useSession } from "@/lib/session-context";

// Mirrors ClientsPage in app-shell.tsx:864-994 — header, the 4-card metrics
// grid (exact same KPI copy/order/icons as the web), search, then the list
// (default-sorted by visits desc, matching the web's default `sortBy`).
//
// Not ported yet (see MOBILE_DESIGN_SYSTEM.md): the 6-way segment tabs
// (Todos/Mensalistas/Frequentes/Novos/Com agendamento/Sem retorno), the sort
// dropdown, and "Novo cliente" (client creation doesn't exist in mobile yet).
export default function ClientesScreen() {
  const { session } = useSession();
  const [clients, setClients] = useState<ClientDTO[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (q: string) => {
    try {
      const data = await getClients(q);
      setClients(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar os clientes.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      await load("");
      if (!cancelled) setLoading(false);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [load]);

  // Debounced server-side search, matching GET /api/clients?q= (app-shell.tsx
  // does this client-side since it already holds the full list in a store;
  // this screen re-fetches instead of holding an unbounded client list).
  useEffect(() => {
    const handle = setTimeout(() => {
      load(query);
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const { totalClients, membershipCount, frequentCount, averageTicket, sorted } = useMemo(() => {
    const list = clients ?? [];
    const totalVisits = list.reduce((sum, c) => sum + (c.visits || 0), 0);
    const totalSpent = list.reduce((sum, c) => sum + (c.spent || 0), 0);
    return {
      totalClients: list.length,
      membershipCount: list.filter((c) => c.isMembershipActive).length,
      frequentCount: list.filter(isFrequentOrVip).length,
      averageTicket: totalVisits > 0 ? Math.round(totalSpent / totalVisits) : 0,
      sorted: [...list].sort((a, b) => (b.visits || 0) - (a.visits || 0)),
    };
  }, [clients]);

  return (
    <Screen header={<TopBar title="Clientes" company={session?.company.name} />} style={{ paddingTop: 16 }}>
      <View>
        <Text style={{ color: colors.primary, ...typography.eyebrow }}>BASE DE RELACIONAMENTO</Text>
        <Text style={{ color: colors.textPrimary, marginTop: 4, ...typography.pageTitle }}>Clientes</Text>
        <Text style={{ color: colors.textMuted, marginTop: 6, ...typography.pageSubtitle }}>
          {totalClients} {totalClients === 1 ? "pessoa já faz" : "pessoas já fazem"} parte da sua história.
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center">
          <Text style={{ color: colors.textSecondary, textAlign: "center" }}>{error}</Text>
        </View>
      ) : (
        <ScrollView className="flex-1 mt-4" contentContainerClassName="gap-4 pb-6">
          <View className="flex-row flex-wrap gap-3">
            <MetricCard icon={Users} label="Total de clientes" value={String(totalClients)} detail="base cadastrada" />
            <MetricCard
              icon={Sparkles}
              label="Clientes mensalistas"
              value={String(membershipCount)}
              detail="planos recorrentes"
            />
            <MetricCard
              icon={Sparkles}
              label="Clientes frequentes"
              value={String(frequentCount)}
              detail={totalClients > 0 ? `${Math.round((frequentCount / totalClients) * 100)}% taxa de retenção` : undefined}
            />
            <MetricCard
              icon={CircleDollarSign}
              label="Ticket médio"
              value={formatBRL(averageTicket)}
              detail="por atendimento"
            />
          </View>

          <View
            className="h-11 flex-row items-center gap-2 rounded-md border px-3"
            style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}
          >
            <Search size={16} color={colors.textMuted} />
            <TextInput
              className="flex-1"
              placeholder="Buscar por nome, telefone ou e-mail..."
              placeholderTextColor={colors.textMuted}
              style={{ color: colors.textPrimary, fontSize: 14 }}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
            />
            {query ? (
              <Pressable hitSlop={8} onPress={() => setQuery("")}>
                <X size={14} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          {sorted.length === 0 ? (
            <View className="items-center gap-1 py-16">
              <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}>
                Nenhum cliente encontrado
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>Tente buscar por outro termo.</Text>
            </View>
          ) : (
            <View className="gap-3">
              {sorted.map((client) => (
                <ClientCard key={client.id} client={client} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
