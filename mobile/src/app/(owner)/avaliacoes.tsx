import { MessageSquare, Star, User } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { ResponsiveTabs } from "@/components/ui/responsive-tabs";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { radius, typography } from "@/constants/design-tokens";
import { useResponsive } from "@/hooks/use-responsive";
import { useTheme } from "@/hooks/use-theme";
import { ApiError } from "@/lib/api-client";
import { scaleFont } from "@/lib/responsive";
import { getCompanyReviews, type ReviewDTO, type ReviewsResponse } from "@/lib/reviews";

export default function AvaliacoesScreen() {
  const { colors, primaryColor, primarySoft, primaryForeground, isDark } = useTheme();
  const [data, setData] = useState<ReviewsResponse | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | "all">("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getCompanyReviews();
      setData(res);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar as avaliações."
      );
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

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const filteredReviews = useMemo(() => {
    if (!data?.reviews) return [];
    if (selectedRating === "all") return data.reviews;
    return data.reviews.filter((r) => r.rating === selectedRating);
  }, [data, selectedRating]);

  const fiveStarPercentage = useMemo(() => {
    if (!data?.reviews?.length) return 100;
    const fiveStars = data.reviews.filter((r) => r.rating === 5).length;
    return Math.round((fiveStars / data.reviews.length) * 100);
  }, [data]);

  return (
    <Screen
      header={<TopBar title="Avaliações dos Clientes" company="Feedbacks e notas" showBack={true} />}
      style={{ paddingTop: 16 }}
    >
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-6 text-center">
          <Text style={{ color: colors.danger, textAlign: "center", marginBottom: 12 }}>
            {error}
          </Text>
          <Button label="Tentar novamente" onPress={load} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40, gap: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {/* Header da Página */}
          <PageHeader
            eyebrow="FEEDBACK DOS CLIENTES"
            title="Avaliações"
            subtitle="Monitore o índice de satisfação e comentários deixados pelos seus clientes."
          />

          {/* Métricas Principais */}
          {/* Métricas Principais */}
          <View className="flex-row gap-2.5">
            <View className="flex-1">
              <MetricCard
                label="Nota Média"
                value={data?.averageRating ? Number(data.averageRating).toFixed(1) : "5.0"}
                detail="De 5.0 estrelas"
                icon={Star}
                variant="amber"
              />
            </View>
            <View className="flex-1">
              <MetricCard
                label="Total de Avaliações"
                value={String(data?.total ?? 0)}
                detail={`${fiveStarPercentage}% 5 estrelas`}
                icon={MessageSquare}
                variant="teal"
              />
            </View>
          </View>

          {/* Filtro por Estrelas Responsivo */}
          <ResponsiveTabs
            tabs={[
              { id: "all", label: "Todas as Notas" },
              { id: "5", label: "5 Estrelas", icon: <Star size={12} color="#f59e0b" fill="#f59e0b" /> },
              { id: "4", label: "4 Estrelas", icon: <Star size={12} color="#f59e0b" fill="#f59e0b" /> },
              { id: "3", label: "3 Estrelas", icon: <Star size={12} color="#f59e0b" fill="#f59e0b" /> },
              { id: "2", label: "2 Estrelas", icon: <Star size={12} color="#f59e0b" fill="#f59e0b" /> },
              { id: "1", label: "1 Estrela", icon: <Star size={12} color="#f59e0b" fill="#f59e0b" /> },
            ]}
            activeTab={String(selectedRating)}
            onTabChange={(id) => setSelectedRating(id === "all" ? "all" : Number(id))}
            variant="pill"
          />

          {/* Lista de Avaliações */}
          {filteredReviews.length === 0 ? (
            <View
              className="items-center justify-center rounded-xl border p-8"
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            >
              <MessageSquare size={36} color={colors.textMuted} />
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: 16,
                  fontWeight: "600",
                  marginTop: 12,
                }}
              >
                Nenhuma avaliação encontrada
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 13,
                  textAlign: "center",
                  marginTop: 4,
                }}
              >
                Quando seus clientes finalizarem atendimentos e avaliarem, as notas e comentários aparecerão aqui.
              </Text>
            </View>
          ) : (
            filteredReviews.map((item) => (
              <View
                key={item.id}
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  padding: 16,
                  gap: 12,
                }}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3" style={{ flex: 1, flexShrink: 1, marginRight: 8 }}>
                    <Avatar name={item.clientName} size="md" />
                    <View className="gap-0.5" style={{ flex: 1, flexShrink: 1 }}>
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontSize: 15,
                          fontWeight: "600",
                          flexShrink: 1,
                        }}
                        numberOfLines={1}
                      >
                        {item.clientName}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                        {new Date(item.createdAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </Text>
                    </View>
                  </View>

                  {/* Estrelas */}
                  <View className="flex-row gap-0.5" style={{ flexShrink: 0 }}>
                    {Array.from({ length: 5 }, (_, idx) => (
                      <Star
                        key={idx}
                        size={15}
                        color={idx < item.rating ? "#f59e0b" : colors.borderStrong}
                        fill={idx < item.rating ? "#f59e0b" : "transparent"}
                      />
                    ))}
                  </View>
                </View>

                {item.comment && (
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 14,
                      lineHeight: 20,
                    }}
                  >
                    "{item.comment}"
                  </Text>
                )}

                {/* Tags de Serviço e Profissional */}
                <View className="flex-row flex-wrap gap-2 pt-1">
                  <View
                    style={{
                      backgroundColor: colors.surfaceSecondary,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: radius.sm,
                    }}
                  >
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                      Serviço:{" "}
                      <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>
                        {item.serviceName}
                      </Text>
                    </Text>
                  </View>

                  <View
                    style={{
                      backgroundColor: colors.surfaceSecondary,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: radius.sm,
                    }}
                  >
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                      Atendido por:{" "}
                      <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>
                        {item.employeeName}
                      </Text>
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
