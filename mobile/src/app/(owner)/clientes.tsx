import { CircleDollarSign, Search, Sparkles, Users, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";

import { Button } from "@/components/ui/button";
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
type SegmentFilter = "all" | "members" | "frequent" | "new" | "has_booking" | "inactive";

const SEGMENTS: { key: SegmentFilter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "members", label: "Mensalistas" },
  { key: "frequent", label: "Frequentes" },
  { key: "new", label: "Novos" },
  { key: "has_booking", label: "Com agendamento" },
  { key: "inactive", label: "Sem retorno" },
];

export default function ClientesScreen() {
  const { session } = useSession();
  const [clients, setClients] = useState<ClientDTO[] | null>(null);
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<SegmentFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (q: string) => {
    try {
      const data = await getClients(q);
      setClients(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar os clientes.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      async function run() {
        await load(query);
        if (!cancelled) setLoading(false);
      }
      run();
      return () => {
        cancelled = true;
      };
    }, [load, query])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load(query);
    setRefreshing(false);
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      load(query);
    }, 300);
    return () => clearTimeout(handle);
  }, [query, load]);

  const { totalClients, membershipCount, frequentCount, averageTicket, filteredList } = useMemo(() => {
    const list = clients ?? [];
    const totalVisits = list.reduce((sum, c) => sum + (c.visits || 0), 0);
    const totalSpent = list.reduce((sum, c) => sum + (c.spent || 0), 0);
    
    let filtered = [...list];
    if (segment === "members") {
      filtered = filtered.filter((c) => c.isMembershipActive);
    } else if (segment === "frequent") {
      filtered = filtered.filter(isFrequentOrVip);
    } else if (segment === "new") {
      filtered = filtered.filter((c) => (c.visits || 0) <= 1);
    } else if (segment === "inactive") {
      filtered = filtered.filter((c) => (c.visits || 0) === 0);
    }

    return {
      totalClients: list.length,
      membershipCount: list.filter((c) => c.isMembershipActive).length,
      frequentCount: list.filter(isFrequentOrVip).length,
      averageTicket: totalVisits > 0 ? Math.round(totalSpent / totalVisits) : 0,
      filteredList: filtered.sort((a, b) => (b.visits || 0) - (a.visits || 0)),
    };
  }, [clients, segment]);

  return (
    <Screen header={<TopBar title="Clientes" company={session?.company.name} />} style={{ paddingTop: 16 }}>
      <View className="gap-3.5">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-2">
            <Text style={{ color: colors.primary, ...typography.eyebrow }}>BASE DE RELACIONAMENTO</Text>
            <Text style={{ color: colors.textPrimary, marginTop: 4, ...typography.pageTitle }}>Clientes</Text>
            <Text style={{ color: colors.textMuted, marginTop: 6, ...typography.pageSubtitle }}>
              {totalClients} {totalClients === 1 ? "pessoa já faz" : "pessoas já fazem"} parte da sua história.
            </Text>
          </View>
        </View>

        {/* Action button */}
        <Pressable
          className="h-10 flex-row items-center justify-center gap-1.5 rounded-lg px-3"
          style={{ backgroundColor: colors.primaryForeground }}
        >
          <Text style={{ color: colors.background, fontSize: 12.5, fontWeight: "700" }}>+ Novo cliente</Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-6 gap-3">
          <Text style={{ color: colors.textSecondary, textAlign: "center" }}>{error}</Text>
          <Button label="Tentar novamente" onPress={() => load(query)} />
        </View>
      ) : (
        <ScrollView
          className="flex-1 mt-4"
          contentContainerClassName="gap-4 pb-6"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {/* 2x2 Metrics Grid */}
          <View className="gap-2.5">
            <View className="flex-row gap-2.5">
              <View className="flex-1">
                <MetricCard icon={Users} label="Total de clientes" value={String(totalClients)} detail="base cadastrada" />
              </View>
              <View className="flex-1">
                <MetricCard
                  icon={Sparkles}
                  label="Clientes mensalistas"
                  value={String(membershipCount)}
                  detail="planos recorrentes"
                />
              </View>
            </View>
            <View className="flex-row gap-2.5">
              <View className="flex-1">
                <MetricCard
                  icon={Sparkles}
                  label="Clientes frequentes"
                  value={String(frequentCount)}
                  detail={totalClients > 0 ? `${Math.round((frequentCount / totalClients) * 100)}% retenção` : undefined}
                />
              </View>
              <View className="flex-1">
                <MetricCard
                  icon={CircleDollarSign}
                  label="Ticket médio"
                  value={formatBRL(averageTicket)}
                  detail="por atendimento"
                />
              </View>
            </View>
          </View>

          {/* Search Box */}
          <View
            className="h-11 flex-row items-center gap-2 rounded-lg border px-3"
            style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}
          >
            <Search size={16} color={colors.textMuted} />
            <TextInput
              className="flex-1"
              placeholder="Buscar por nome, telefone ou e-mail..."
              placeholderTextColor={colors.textMuted}
              style={{ color: colors.textPrimary, fontSize: 13.5 }}
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

          {/* Segment Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            {SEGMENTS.map((s) => {
              const active = segment === s.key;
              return (
                <Pressable
                  key={s.key}
                  onPress={() => setSegment(s.key)}
                  className="px-3 py-1.5 rounded-full border"
                  style={{
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: active ? colors.primaryForeground : colors.textSecondary,
                      fontSize: 12,
                      fontWeight: active ? "700" : "500",
                    }}
                  >
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Results counter */}
          <View className="flex-row items-center justify-between">
            <Text style={{ color: colors.textMuted, fontSize: 11.5, fontWeight: "600" }}>
              {filteredList.length} {filteredList.length === 1 ? "cliente encontrado" : "clientes encontrados"}
            </Text>
          </View>

          {filteredList.length === 0 ? (
            <View className="items-center gap-1 py-16">
              <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}>
                Nenhum cliente encontrado
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>Tente buscar por outro termo ou filtro.</Text>
            </View>
          ) : (
            <View className="gap-3">
              {filteredList.map((client) => (
                <ClientCard key={client.id} client={client} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
