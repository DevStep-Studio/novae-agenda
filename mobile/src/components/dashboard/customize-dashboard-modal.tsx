import { ArrowUpDown, ChevronDown, ChevronUp, X } from "lucide-react-native";
import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";

import { colors, radius, typography } from "@/constants/design-tokens";

export type DashboardSectionKey =
  | "showBanner"
  | "showChecklist"
  | "showKpis"
  | "showSubmetrics"
  | "showNextAppointment"
  | "showDaySummary"
  | "showQuickSlots"
  | "showTodayAppointments";

export interface DashboardPrefs {
  showBanner: boolean;
  showChecklist: boolean;
  showKpis: boolean;
  showSubmetrics: boolean;
  showNextAppointment: boolean;
  showDaySummary: boolean;
  showQuickSlots: boolean;
  showTodayAppointments: boolean;
  order: DashboardSectionKey[];
}

export const DASHBOARD_SECTION_META: Record<
  DashboardSectionKey,
  { label: string; desc: string }
> = {
  showBanner: {
    label: "Banner e Boas-vindas",
    desc: "Cartão de destaque com saudação e imagem de capa da empresa",
  },
  showChecklist: {
    label: "Checklist de Configuração",
    desc: "Passo a passo inicial para ativar seu agendamento e link público",
  },
  showKpis: {
    label: "Indicadores Principais",
    desc: "Métricas de atendimentos e receitas previstas/realizadas do dia",
  },
  showSubmetrics: {
    label: "Atendimentos Pendentes e Cancelamentos",
    desc: "Cards compactos de contagem operacional",
  },
  showNextAppointment: {
    label: "Próximo Atendimento em Destaque",
    desc: "Card hero com dados do próximo cliente e botões rápidos",
  },
  showDaySummary: {
    label: "Resumo do Dia por Status",
    desc: "Contagem de atendimentos confirmados, aguardando e em andamento",
  },
  showQuickSlots: {
    label: "Horários Rápidos de Hoje",
    desc: "Grade de horários livres e ocupados",
  },
  showTodayAppointments: {
    label: "Atendimentos de Hoje",
    desc: "Lista detalhada dos agendamentos programados",
  },
};

export const DEFAULT_DASHBOARD_ORDER: DashboardSectionKey[] = [
  "showBanner",
  "showChecklist",
  "showKpis",
  "showSubmetrics",
  "showNextAppointment",
  "showDaySummary",
  "showQuickSlots",
  "showTodayAppointments",
];

export const DEFAULT_DASHBOARD_PREFS: DashboardPrefs = {
  showBanner: true,
  showChecklist: true,
  showKpis: true,
  showSubmetrics: true,
  showNextAppointment: true,
  showDaySummary: true,
  showQuickSlots: true,
  showTodayAppointments: true,
  order: DEFAULT_DASHBOARD_ORDER,
};

interface CustomizeDashboardModalProps {
  visible: boolean;
  currentPrefs: DashboardPrefs;
  onClose: () => void;
  onSave: (prefs: DashboardPrefs) => Promise<void> | void;
}

export function CustomizeDashboardModal({
  visible,
  currentPrefs,
  onClose,
  onSave,
}: CustomizeDashboardModalProps) {
  const [prefs, setPrefs] = useState<DashboardPrefs>(currentPrefs);
  const [saving, setSaving] = useState(false);

  const toggle = (key: DashboardSectionKey) => {
    setPrefs((cur) => ({ ...cur, [key]: !cur[key] }));
  };

  const moveItem = (key: DashboardSectionKey, direction: "up" | "down") => {
    setPrefs((cur) => {
      const order = [...cur.order];
      const index = order.indexOf(key);
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (index === -1 || targetIndex < 0 || targetIndex >= order.length) return cur;
      [order[index], order[targetIndex]] = [order[targetIndex], order[index]];
      return { ...cur, order };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(prefs);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = () => {
    setPrefs(DEFAULT_DASHBOARD_PREFS);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        className="flex-1 justify-center items-center p-4"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.75)" }}
      >
        <View
          className="w-full rounded-2xl border overflow-hidden"
          style={{
            maxWidth: 480,
            maxHeight: "88%",
            backgroundColor: "#111215",
            borderColor: "rgba(255, 255, 255, 0.12)",
          }}
        >
          {/* Header */}
          <View
            className="p-5 border-b flex-row items-start justify-between"
            style={{ borderBottomColor: "rgba(255, 255, 255, 0.08)" }}
          >
            <View className="flex-1 pr-3">
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: 11,
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                }}
              >
                PERSONALIZAÇÃO
              </Text>
              <Text
                style={{
                  color: "#ffffff",
                  fontSize: 18,
                  fontWeight: "700",
                  marginTop: 2,
                }}
              >
                Personalizar Painel Inicial
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 12.5,
                  marginTop: 4,
                  lineHeight: 17,
                }}
              >
                Selecione quais seções deseja exibir na sua tela inicial para deixar a interface do seu jeito.
              </Text>
            </View>

            <Pressable
              onPress={onClose}
              hitSlop={10}
              className="items-center justify-center rounded-full"
              style={{
                width: 32,
                height: 32,
                backgroundColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <X size={16} color="#ffffff" />
            </Pressable>
          </View>

          {/* Body */}
          <ScrollView
            className="p-4"
            contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
          >
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 11.5,
                marginBottom: 2,
              }}
            >
              Arraste pelo ícone ⇅ para reordenar (ou use as setas no celular).
            </Text>

            {prefs.order.map((key, index) => {
              const item = DASHBOARD_SECTION_META[key];
              const isEnabled = prefs[key];

              return (
                <View
                  key={key}
                  className="flex-row items-center gap-3 p-3.5 rounded-xl border"
                  style={{
                    backgroundColor: "#18191d",
                    borderColor: "rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <ArrowUpDown size={15} color={colors.textMuted} />

                  <View className="flex-1 pr-1">
                    <Text
                      style={{
                        color: "#ffffff",
                        fontSize: 13.5,
                        fontWeight: "600",
                      }}
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={{
                        color: colors.textMuted,
                        fontSize: 11.5,
                        marginTop: 2,
                        lineHeight: 15,
                      }}
                    >
                      {item.desc}
                    </Text>
                  </View>

                  <View className="flex-row items-center gap-1 mr-1">
                    <Pressable
                      onPress={() => moveItem(key, "up")}
                      disabled={index === 0}
                      hitSlop={6}
                      className="p-1 rounded"
                      style={{ opacity: index === 0 ? 0.25 : 0.8 }}
                    >
                      <ChevronUp size={16} color="#ffffff" />
                    </Pressable>
                    <Pressable
                      onPress={() => moveItem(key, "down")}
                      disabled={index === prefs.order.length - 1}
                      hitSlop={6}
                      className="p-1 rounded"
                      style={{ opacity: index === prefs.order.length - 1 ? 0.25 : 0.8 }}
                    >
                      <ChevronDown size={16} color="#ffffff" />
                    </Pressable>
                  </View>

                  <Switch
                    value={isEnabled}
                    onValueChange={() => toggle(key)}
                    trackColor={{ false: "#333338", true: colors.primary }}
                    thumbColor="#ffffff"
                    ios_backgroundColor="#333338"
                  />
                </View>
              );
            })}
          </ScrollView>

          {/* Footer Actions */}
          <View
            className="p-4 border-t gap-2.5"
            style={{
              backgroundColor: "#111215",
              borderTopColor: "rgba(255, 255, 255, 0.08)",
            }}
          >
            <Pressable
              onPress={handleSave}
              disabled={saving}
              className="w-full py-3 rounded-xl items-center justify-center"
              style={{ backgroundColor: "#ffffff" }}
            >
              <Text style={{ color: "#000000", fontSize: 14, fontWeight: "700" }}>
                {saving ? "Salvando..." : "Salvar preferências"}
              </Text>
            </Pressable>

            <Pressable
              onPress={onClose}
              disabled={saving}
              className="w-full py-2.5 rounded-xl items-center justify-center border"
              style={{
                backgroundColor: "transparent",
                borderColor: "rgba(255, 255, 255, 0.15)",
              }}
            >
              <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "600" }}>
                Cancelar
              </Text>
            </Pressable>

            <Pressable
              onPress={handleRestore}
              className="py-1 items-center justify-center"
            >
              <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "500" }}>
                Restaurar padrão
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
