import {
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Crown,
  FileText,
  HelpCircle,
  Sparkles,
  Zap,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { colors, fontFamily, radius, typography } from "@/constants/design-tokens";
import { ApiError } from "@/lib/api-client";
import { formatBRL } from "@/lib/stats";
import {
  createCheckoutSession,
  getCompanySubscriptionData,
  type SubscriptionDataResponse,
} from "@/lib/subscriptions";

const PLAN_PRESETS = [
  {
    key: "essencial",
    name: "Essencial",
    monthlyPrice: 59.9,
    yearlyPrice: 49.9,
    description: "Ideal para profissionais autônomos e estúdios individuais.",
    features: [
      "Até 2 profissionais",
      "1 unidade / localização",
      "Agendamentos ilimitados",
      "Lembretes automáticos via WhatsApp",
      "Relatórios básicos de faturamento",
    ],
  },
  {
    key: "profissional",
    name: "Profissional",
    monthlyPrice: 89.9,
    yearlyPrice: 74.9,
    popular: true,
    description: "O mais escolhido por barbearias, clínicas e salões em crescimento.",
    features: [
      "Até 5 profissionais",
      "2 unidades / filiais",
      "Agendamentos ilimitados",
      "Integração WhatsApp Pro com confirmação",
      "Controle de comissões por profissional",
      "Relatórios financeiros e DRE detalhados",
      "Lista de espera inteligente",
    ],
  },
  {
    key: "equipe",
    name: "Equipe & Expansão",
    monthlyPrice: 149.9,
    yearlyPrice: 124.9,
    description: "Para empresas consolidadas com múltiplos profissionais e unidades.",
    features: [
      "Até 15 profissionais",
      "5 unidades",
      "Tudo do Profissional incluso",
      "Clube de assinaturas recorrentes",
      "Página de agendamento 100% personalizada",
      "Suporte prioritário via WhatsApp VIP",
    ],
  },
];

export default function AssinaturaScreen() {
  const [data, setData] = useState<SubscriptionDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [upgradingKey, setUpgradingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getCompanySubscriptionData();
      setData(res);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não foi possível carregar a assinatura."
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

  async function handleSelectPlan(planKey: string) {
    try {
      setUpgradingKey(planKey);
      const chosenKey =
        billingCycle === "yearly" ? "pro_yearly" : "pro_monthly";
      const checkout = await createCheckoutSession(chosenKey, false);

      if (checkout?.initPoint) {
        await Linking.openURL(checkout.initPoint);
      } else {
        Alert.alert(
          "Assinatura Ativada",
          "Seu plano foi atualizado com sucesso no sistema!"
        );
        await load();
      }
    } catch (err) {
      Alert.alert(
        "Erro no checkout",
        err instanceof ApiError
          ? err.message
          : "Não foi possível iniciar o pagamento. Tente novamente."
      );
    } finally {
      setUpgradingKey(null);
    }
  }

  const sub = data?.subscription;
  const isTrial = sub?.status === "trialing" || !sub?.status;
  const isActive = sub?.status === "active";
  const isLifetime =
    sub?.isLifetime || sub?.plan?.toLowerCase().includes("vitalicia");

  return (
    <Screen
      header={<TopBar title="Assinatura & Planos" company="Reservei SaaS" showBack={true} />}
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
          contentContainerStyle={{ paddingBottom: 40, gap: 20 }}
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
            eyebrow="PLANO & PAGAMENTOS"
            title="Minha Assinatura"
            subtitle="Gerencie seu plano SaaS, cobranças e limites de profissionais."
          />

          {/* Card da Assinatura Atual */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderColor: isLifetime
                ? "#f59e0b"
                : isActive
                ? colors.success
                : colors.primary,
              borderWidth: 1.5,
              borderRadius: radius.md,
              padding: 16,
              gap: 12,
            }}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2" style={{ flex: 1, flexShrink: 1, marginRight: 8 }}>
                {isLifetime ? (
                  <Crown size={20} color="#f59e0b" />
                ) : (
                  <Sparkles size={20} color={colors.primary} />
                )}
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: 18,
                    fontFamily: fontFamily.display,
                    flexShrink: 1,
                  }}
                  numberOfLines={1}
                >
                  Plano{" "}
                  {isLifetime
                    ? "Vitalício VIP"
                    : sub?.plan
                    ? sub.plan.toUpperCase()
                    : "TESTE (15 DIAS)"}
                </Text>
              </View>

              <View
                style={{
                  backgroundColor: isLifetime
                    ? "rgba(245, 158, 11, 0.15)"
                    : isActive
                    ? colors.successSoft
                    : colors.primarySoft,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: radius.pill,
                  flexShrink: 0,
                }}
              >
                <Text
                  style={{
                    color: isLifetime
                      ? "#f59e0b"
                      : isActive
                      ? colors.success
                      : colors.primary,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {isLifetime
                    ? "VITALÍCIA"
                    : isActive
                    ? "ATIVA"
                    : isTrial
                    ? "TESTE (15 DIAS)"
                    : sub?.status?.toUpperCase()}
                </Text>
              </View>
            </View>

            <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
              {isLifetime
                ? "Sua conta possui acesso vitalício permanente com todos os recursos e limites liberados."
                : isTrial
                ? "Você está no período de avaliação gratuita de 15 dias com acesso a todas as funcionalidades do sistema."
                : "Sua assinatura está ativa e renova automaticamente ao final do ciclo."}
            </Text>

            {sub?.trialEndsAt && isTrial && (
              <View
                className="flex-row items-center gap-2 rounded-lg p-2.5"
                style={{ backgroundColor: colors.surfaceSecondary }}
              >
                <Clock size={16} color={colors.primary} />
                <Text style={{ color: colors.textPrimary, fontSize: 13 }}>
                  Término do teste:{" "}
                  <Text style={{ fontWeight: "700", color: colors.primary }}>
                    {new Date(sub.trialEndsAt).toLocaleDateString("pt-BR")}
                  </Text>
                </Text>
              </View>
            )}

            {sub?.currentPeriodEnd && isActive && (
              <View
                className="flex-row items-center gap-2 rounded-lg p-2.5"
                style={{ backgroundColor: colors.surfaceSecondary }}
              >
                <CreditCard size={16} color={colors.success} />
                <Text style={{ color: colors.textPrimary, fontSize: 13 }}>
                  Próxima renovação:{" "}
                  <Text style={{ fontWeight: "700", color: colors.textPrimary }}>
                    {new Date(sub.currentPeriodEnd).toLocaleDateString("pt-BR")}
                  </Text>
                </Text>
              </View>
            )}
          </View>

          {/* Toggle Mensal / Anual */}
          <View className="items-center gap-2">
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 16,
                fontFamily: fontFamily.display,
              }}
            >
              Escolha seu plano
            </Text>
            <View
              className="flex-row rounded-full p-1"
              style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }}
            >
              <Pressable
                onPress={() => setBillingCycle("monthly")}
                style={{
                  backgroundColor:
                    billingCycle === "monthly" ? colors.surfaceSecondary : "transparent",
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: radius.pill,
                }}
              >
                <Text
                  style={{
                    color:
                      billingCycle === "monthly" ? colors.textPrimary : colors.textMuted,
                    fontWeight: "600",
                    fontSize: 13,
                  }}
                >
                  Mensal
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setBillingCycle("yearly")}
                style={{
                  backgroundColor:
                    billingCycle === "yearly" ? colors.primary : "transparent",
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: radius.pill,
                }}
              >
                <Text
                  style={{
                    color:
                      billingCycle === "yearly"
                        ? colors.primaryForeground
                        : colors.textMuted,
                    fontWeight: "700",
                    fontSize: 13,
                  }}
                >
                  Anual (Economize 20%)
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Lista de Planos Disponíveis */}
          {PLAN_PRESETS.map((plan) => {
            const price =
              billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;

            return (
              <View
                key={plan.key}
                style={{
                  backgroundColor: colors.surface,
                  borderColor: plan.popular ? colors.primary : colors.border,
                  borderWidth: plan.popular ? 2 : 1,
                  borderRadius: radius.md,
                  padding: 18,
                  gap: 14,
                }}
              >
                {plan.popular && (
                  <View
                    style={{
                      position: "absolute",
                      top: -12,
                      right: 16,
                      backgroundColor: colors.primary,
                      paddingHorizontal: 10,
                      paddingVertical: 3,
                      borderRadius: radius.pill,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.primaryForeground,
                        fontSize: 11,
                        fontWeight: "800",
                        textTransform: "uppercase",
                      }}
                    >
                      Mais Popular
                    </Text>
                  </View>
                )}

                <View className="gap-1">
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontSize: 18,
                      fontFamily: fontFamily.display,
                    }}
                  >
                    {plan.name}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                    {plan.description}
                  </Text>
                </View>

                <View className="flex-row items-baseline gap-1">
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontSize: 26,
                      fontFamily: fontFamily.display,
                    }}
                  >
                    {formatBRL(price)}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>/ mês</Text>
                </View>

                <View style={{ borderTopColor: colors.border, borderTopWidth: 1, paddingTop: 12, gap: 8 }}>
                  {plan.features.map((feat) => (
                    <View key={feat} className="flex-row items-center gap-2">
                      <Check size={16} color={colors.primary} />
                      <Text style={{ color: colors.textSecondary, fontSize: 13, flex: 1 }}>
                        {feat}
                      </Text>
                    </View>
                  ))}
                </View>

                <Button
                  label={
                    upgradingKey === plan.key
                      ? "Processando..."
                      : `Assinar ${plan.name}`
                  }
                  variant={plan.popular ? "primary" : "secondary"}
                  onPress={() => handleSelectPlan(plan.key)}
                  disabled={upgradingKey !== null}
                />
              </View>
            );
          })}

          {/* Histórico de Faturas */}
          {data?.invoices && data.invoices.length > 0 && (
            <View className="mt-4 gap-3">
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: 16,
                  fontFamily: fontFamily.display,
                }}
              >
                Histórico de Faturas
              </Text>

              {data.invoices.map((inv) => (
                <View
                  key={inv.id}
                  className="flex-row items-center justify-between rounded-lg border p-3.5"
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  }}
                >
                  <View className="flex-row items-center gap-3" style={{ flex: 1, flexShrink: 1, marginRight: 8 }}>
                    <FileText size={20} color={colors.textSecondary} />
                    <View className="gap-0.5" style={{ flex: 1, flexShrink: 1 }}>
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontSize: 14,
                          fontWeight: "600",
                        }}
                        numberOfLines={1}
                      >
                        {formatBRL(inv.amount)}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                        {new Date(inv.createdAt).toLocaleDateString("pt-BR")}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{
                      backgroundColor:
                        inv.status === "paid"
                          ? colors.successSoft
                          : colors.warningSoft,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: radius.pill,
                      flexShrink: 0,
                    }}
                  >
                    <Text
                      style={{
                        color:
                          inv.status === "paid"
                            ? colors.success
                            : colors.warning,
                        fontSize: 11,
                        fontWeight: "700",
                      }}
                    >
                      {inv.status === "paid" ? "PAGO" : "PENDENTE"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
