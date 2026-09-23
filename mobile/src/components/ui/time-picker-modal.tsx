import { Check, Clock, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useTheme } from "@/hooks/use-theme";

export interface TimePickerModalProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  value?: string | null;
  onSelect: (time: string) => void;
  onClose: () => void;
  allowClear?: boolean;
  onClear?: () => void;
}

const COMMON_TIMES: string[] = [
  "06:00",
  "06:30",
  "07:00",
  "07:30",
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
  "22:00",
  "22:30",
  "23:00",
  "23:30",
];

export function TimePickerModal({
  visible,
  title = "Selecionar Horário",
  subtitle,
  value,
  onSelect,
  onClose,
  allowClear = false,
  onClear,
}: TimePickerModalProps) {
  const { isDark, primaryColor, primarySoft, primaryForeground } = useTheme();

  const formattedValue = useMemo(() => {
    if (!value) return "";
    return value.length > 5 ? value.slice(0, 5) : value;
  }, [value]);

  const cardBg = isDark ? "#111215" : "#ffffff";
  const cardBorder = isDark ? "rgba(255, 255, 255, 0.1)" : "#e2e8f0";
  const textTitle = isDark ? "#ffffff" : "#0f172a";
  const textMuted = isDark ? "#9ca3af" : "#64748b";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
      >
        <Pressable
          style={[
            styles.card,
            {
              backgroundColor: cardBg,
              borderColor: cardBorder,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ gap: 2, flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Clock size={16} color={primaryColor} />
                <Text style={[styles.title, { color: textTitle }]}>
                  {title}
                </Text>
              </View>
              {subtitle ? (
                <Text style={{ color: textMuted, fontSize: 12 }}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#f1f5f9",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={16} color={textMuted} />
            </Pressable>
          </View>

          {/* Time Slots Grid */}
          <ScrollView
            style={{ maxHeight: 320 }}
            contentContainerStyle={styles.gridContainer}
            showsVerticalScrollIndicator={false}
          >
            {COMMON_TIMES.map((time) => {
              const isSelected = time === formattedValue;
              return (
                <Pressable
                  key={time}
                  onPress={() => {
                    onSelect(time);
                    onClose();
                  }}
                  style={[
                    styles.timeButton,
                    {
                      backgroundColor: isSelected
                        ? primaryColor
                        : isDark
                        ? "#181920"
                        : "#f8fafc",
                      borderColor: isSelected
                        ? primaryColor
                        : isDark
                        ? "rgba(255, 255, 255, 0.08)"
                        : "#e2e8f0",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.timeText,
                      {
                        color: isSelected
                          ? primaryForeground
                          : isDark
                          ? "#ffffff"
                          : "#1e293b",
                        fontWeight: isSelected ? "700" : "500",
                      },
                    ]}
                  >
                    {time}
                  </Text>
                  {isSelected ? (
                    <Check size={14} color={primaryForeground} strokeWidth={3} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Footer with Clear Option if allowed */}
          {allowClear && onClear ? (
            <View style={{ paddingTop: 10, borderTopWidth: 1, borderTopColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#e2e8f0" }}>
              <Pressable
                onPress={() => {
                  onClear();
                  onClose();
                }}
                style={{
                  paddingVertical: 10,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 10,
                  backgroundColor: isDark ? "rgba(239, 68, 68, 0.12)" : "#fef2f2",
                }}
              >
                <Text style={{ color: "#ef4444", fontSize: 13, fontWeight: "600" }}>
                  Remover / Sem horário
                </Text>
              </Pressable>
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingVertical: 4,
  },
  timeButton: {
    width: "31%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  timeText: {
    fontSize: 13.5,
  },
});
