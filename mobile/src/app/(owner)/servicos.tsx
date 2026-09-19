import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { ServiceCard } from "@/components/ui/service-card";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { colors, typography } from "@/constants/design-tokens";
import { ApiError } from "@/lib/api-client";
import { getServices, type ServiceDTO } from "@/lib/services";
import { useSession } from "@/lib/session-context";

type Filter = "Todos" | "Ativos" | "Inativos";
const FILTERS: Filter[] = ["Todos", "Ativos", "Inativos"];

// Mirrors the "Serviços Avulsos" sub-tab of ServicesPage (app-shell.tsx:
// 1914-2096) — header, the Todos/Ativos/Inativos filter (`.category-tabs`,
// underline-active style), then the real image-card grid. "Planos Mensais"
// (the other sub-tab, a membership-plans feature) is a distinct data model
// and isn't ported — see MOBILE_DESIGN_SYSTEM.md.
export default function ServicosScreen() {
  const { session } = useSession();
  const [services, setServices] = useState<ServiceDTO[] | null>(null);
  const [filter, setFilter] = useState<Filter>("Todos");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setServices(await getServices());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar os serviços.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      await load();
      if (!cancelled) setLoading(false);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [load]);

  function handleToggled(updated: ServiceDTO) {
    setServices((prev) => prev?.map((s) => (s.id === updated.id ? updated : s)) ?? prev);
  }

  const visible = useMemo(() => {
    const list = services ?? [];
    if (filter === "Todos") return list;
    return list.filter((s) => s.active === (filter === "Ativos"));
  }, [services, filter]);

  return (
    <Screen header={<TopBar title="Serviços" company={session?.company.name} showBack={true} />} style={{ paddingTop: 16 }}>
      <View>
        <Text style={{ color: colors.primary, ...typography.eyebrow }}>CATÁLOGO DE SERVIÇOS</Text>
        <Text style={{ color: colors.textPrimary, marginTop: 4, ...typography.pageTitle }}>Serviços Avulsos</Text>
        <Text style={{ color: colors.textMuted, marginTop: 6, ...typography.pageSubtitle }}>
          Crie experiências claras para seus clientes e sua equipe.
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-6 gap-3">
          <Text style={{ color: colors.textSecondary, textAlign: "center" }}>{error}</Text>
          <Button label="Tentar novamente" onPress={load} />
        </View>
      ) : (
        <ScrollView className="flex-1 mt-4" contentContainerClassName="gap-4 pb-6">
          <View className="flex-row gap-4 border-b" style={{ borderBottomColor: colors.border }}>
            {FILTERS.map((f) => {
              const active = filter === f;
              return (
                <Pressable key={f} className="pb-2.5" onPress={() => setFilter(f)}>
                  <Text style={{ color: active ? colors.primary : colors.textSecondary, fontSize: 12, fontWeight: active ? "600" : "400" }}>
                    {f}
                  </Text>
                  {active ? (
                    <View
                      className="mt-2 self-stretch rounded-full"
                      style={{ height: 2, backgroundColor: colors.primary, marginBottom: -2 }}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          {visible.length === 0 ? (
            <View className="items-center gap-1 py-16">
              <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}>Nenhum serviço</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>Cadastre serviços para começar a agendar.</Text>
            </View>
          ) : (
            <View className="gap-3">
              {visible.map((service) => (
                <ServiceCard key={service.id} service={service} onToggled={handleToggled} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
