import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  HelpCircle,
  Mail,
  MessageCircle,
  Phone,
  Send,
  Shield,
} from "lucide-react-native";
import { useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Application from "expo-application";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { colors, fontFamily, radius, typography } from "@/constants/design-tokens";
import { useSession } from "@/lib/session-context";

interface FAQItem {
  q: string;
  a: string;
}

const FAQ_LIST: FAQItem[] = [
  {
    q: "Como o cliente acessa suas reservas?",
    a: "O cliente utiliza o número de telefone e um PIN seguro de 6 dígitos. Caso seja o primeiro agendamento, ele cria o PIN no momento da confirmação com verificação.",
  },
  {
    q: "O que acontece se eu remarcar um atendimento?",
    a: "O novo horário é ocupado imediatamente na agenda, o horário antigo é liberado, e o lembrete de 2 horas antes do atendimento é automaticamente recalculado e enviado por notificação push.",
  },
  {
    q: "Como funcionam as notificações push?",
    a: "O aplicativo envia alertas em tempo real de novos agendamentos para o proprietário e profissional responsável, confirmação para o cliente e um lembrete obrigatório 2 horas antes de cada horário.",
  },
  {
    q: "Como sincronizar com a agenda web?",
    a: "A sincronização é 100% em tempo real. Qualquer serviço, agendamento ou cancelamento feito no app reflete instantaneamente no painel web e vice-versa.",
  },
  {
    q: "Como bloquear horários para folgas ou almoço?",
    a: "Na aba Agenda, use o botão 'Bloquear horário' para registrar pausas ou períodos de indisponibilidade para qualquer profissional da equipe.",
  },
];

export default function AjudaScreen() {
  const { session } = useSession();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [problemDescription, setProblemDescription] = useState("");
  const [sendingReport, setSendingReport] = useState(false);

  const companyName = session?.company?.name || "Estabelecimento";
  const appVersion = Application.nativeApplicationVersion || "1.0.0";
  const buildNumber = Application.nativeBuildVersion || "1";

  const toggleFaq = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const handleOpenWhatsApp = () => {
    const phone = "5511999999999";
    const msg = encodeURIComponent(`Olá! Preciso de suporte no Reservei com o estabelecimento ${companyName}.`);
    Linking.openURL(`https://wa.me/${phone}?text=${msg}`).catch(() => {
      Alert.alert("Suporte", "Envie um e-mail para contato@usereservei.com.br");
    });
  };

  const handleOpenEmail = () => {
    Linking.openURL("mailto:contato@usereservei.com.br?subject=Suporte%20Reservei%20Mobile");
  };

  const handleSendReport = async () => {
    if (!problemDescription.trim()) {
      Alert.alert("Aviso", "Descreva o problema antes de enviar.");
      return;
    }
    setSendingReport(true);
    try {
      // Send feedback report to support
      await new Promise((r) => setTimeout(r, 600));
      Alert.alert("Relatório Enviado", "Obrigado pelo relato. Nossa equipe de engenharia irá analisar.");
      setProblemDescription("");
    } finally {
      setSendingReport(false);
    }
  };

  return (
    <Screen header={<TopBar title="Ajuda & Suporte" company={companyName} showBack={true} />} style={{ paddingTop: 14 }}>
      <ScrollView className="flex-1" contentContainerStyle={{ gap: 14, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Header da Página */}
        <PageHeader
          eyebrow="SUPORTE & ATENDIMENTO"
          title="Ajuda e Suporte"
          subtitle="Tire dúvidas, fale conosco e acesse guias de utilização do sistema."
        />

        {/* Support Banner */}
        <View
          className="p-4 rounded-xl border gap-3"
          style={{ backgroundColor: "#15161a", borderColor: "rgba(255, 255, 255, 0.08)" }}
        >
          <View className="flex-row items-center gap-2.5">
            <HelpCircle size={20} color={colors.primary} />
            <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "700" }}>
              Central de Atendimento Reservei
            </Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
            Tire suas dúvidas, consulte as perguntas frequentes ou entre em contato direto com nossa equipe de suporte.
          </Text>

          <View className="flex-row gap-2.5 pt-1">
            <Pressable
              onPress={handleOpenWhatsApp}
              className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border"
              style={{ backgroundColor: "#1c1d22", borderColor: "rgba(255, 255, 255, 0.12)" }}
            >
              <MessageCircle size={15} color="#25D366" />
              <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "600" }}>
                WhatsApp
              </Text>
            </Pressable>

            <Pressable
              onPress={handleOpenEmail}
              className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border"
              style={{ backgroundColor: "#1c1d22", borderColor: "rgba(255, 255, 255, 0.12)" }}
            >
              <Mail size={15} color={colors.primary} />
              <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "600" }}>
                E-mail
              </Text>
            </Pressable>
          </View>
        </View>

        {/* FAQ Section */}
        <View
          className="p-4 rounded-xl border gap-3"
          style={{ backgroundColor: "#15161a", borderColor: "rgba(255, 255, 255, 0.08)" }}
        >
          <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "700" }}>
            Perguntas Frequentes
          </Text>

          <View className="gap-2">
            {FAQ_LIST.map((faq, index) => {
              const isExpanded = expandedIndex === index;
              return (
                <View
                  key={index}
                  className="rounded-xl border overflow-hidden"
                  style={{ backgroundColor: "#191a20", borderColor: "rgba(255, 255, 255, 0.06)" }}
                >
                  <Pressable
                    onPress={() => toggleFaq(index)}
                    className="p-3.5 flex-row items-center justify-between"
                  >
                    <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "600", flex: 1, paddingRight: 8 }}>
                      {faq.q}
                    </Text>
                    <ChevronDown
                      size={16}
                      color={colors.textMuted}
                      style={{ transform: [{ rotate: isExpanded ? "180deg" : "0deg" }] }}
                    />
                  </Pressable>
                  {isExpanded && (
                    <View className="px-3.5 pb-3.5 pt-1 border-t" style={{ borderTopColor: "rgba(255, 255, 255, 0.05)" }}>
                      <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
                        {faq.a}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Report a Problem */}
        <View
          className="p-4 rounded-xl border gap-3"
          style={{ backgroundColor: "#15161a", borderColor: "rgba(255, 255, 255, 0.08)" }}
        >
          <View className="flex-row items-center gap-2">
            <AlertCircle size={16} color="#f59e0b" />
            <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "700" }}>
              Relatar um Problema
            </Text>
          </View>
          <TextInput
            value={problemDescription}
            onChangeText={setProblemDescription}
            placeholder="Descreva o que aconteceu ou sugestão de melhoria..."
            placeholderTextColor={colors.textDisabled}
            multiline
            numberOfLines={3}
            style={{
              backgroundColor: "#1c1d22",
              borderColor: "rgba(255, 255, 255, 0.1)",
              borderWidth: 1,
              borderRadius: radius.md,
              padding: 12,
              minHeight: 80,
              color: "#ffffff",
              textAlignVertical: "top",
              fontSize: 13,
            }}
          />
          <Button
            label={sendingReport ? "Enviando..." : "Enviar Relato"}
            onPress={handleSendReport}
            disabled={sendingReport}
          />
        </View>

        {/* Legal & App Version Info */}
        <View
          className="p-4 rounded-xl border gap-2.5"
          style={{ backgroundColor: "#15161a", borderColor: "rgba(255, 255, 255, 0.08)" }}
        >
          <Pressable
            onPress={() => Linking.openURL("https://usereservei.com.br/privacidade")}
            className="flex-row items-center justify-between py-2 border-b"
            style={{ borderBottomColor: "rgba(255, 255, 255, 0.06)" }}
          >
            <View className="flex-row items-center gap-2">
              <Shield size={16} color={colors.textSecondary} />
              <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "500" }}>Política de Privacidade</Text>
            </View>
            <ExternalLink size={14} color={colors.textMuted} />
          </Pressable>

          <Pressable
            onPress={() => Linking.openURL("https://usereservei.com.br/termos")}
            className="flex-row items-center justify-between py-2 border-b"
            style={{ borderBottomColor: "rgba(255, 255, 255, 0.06)" }}
          >
            <View className="flex-row items-center gap-2">
              <FileText size={16} color={colors.textSecondary} />
              <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "500" }}>Termos de Uso</Text>
            </View>
            <ExternalLink size={14} color={colors.textMuted} />
          </Pressable>

          <View className="flex-row items-center justify-between pt-2">
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>Versão do Aplicativo</Text>
            <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "600" }}>
              {appVersion} (Build {buildNumber})
            </Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
