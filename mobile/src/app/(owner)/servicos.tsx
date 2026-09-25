import {
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Coins,
  Crown,
  FileText,
  FolderPlus,
  Image as ImageIcon,
  ImagePlus,
  Layers,
  Link2,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  Users,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";

import { Button } from "@/components/ui/button";
import { MembershipPlanEditorModal } from "@/components/membership/membership-plan-editor-modal";
import { PageHeader } from "@/components/ui/page-header";
import { Screen } from "@/components/ui/screen";
import { ServiceCard } from "@/components/ui/service-card";
import { TopBar } from "@/components/ui/top-bar";
import { colors, radius, typography } from "@/constants/design-tokens";
import { useTheme, hexToRgba } from "@/hooks/use-theme";
import { ResponsiveTabs } from "@/components/ui/responsive-tabs";
import { useResponsive } from "@/hooks/use-responsive";
import { scaleFont } from "@/lib/responsive";
import { ApiError, api } from "@/lib/api-client";
import { getEmployees, type EmployeeDTO } from "@/lib/employees";
import {
  deleteMembershipPlan,
  getMembershipPlans,
  type MembershipPlanDTO,
} from "@/lib/memberships";
import {
  deleteService,
  getServices,
  type ServiceDTO,
} from "@/lib/services";
import { getServiceDescription } from "@/lib/service-utils";
import { useSession } from "@/lib/session-context";
import { formatBRL } from "@/lib/stats";

type SubTab = "services" | "memberships";
type Filter = "Todos" | "Ativos" | "Inativos";
const FILTERS: Filter[] = ["Todos", "Ativos", "Inativos"];

interface CategoryItem {
  id: string;
  name: string;
  count?: number;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface ServiceEditorModalProps {
  visible: boolean;
  service: ServiceDTO | null;
  categories: CategoryItem[];
  employees: EmployeeDTO[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onCategoriesUpdated: () => Promise<void>;
  onDeleteService?: (service: ServiceDTO) => Promise<void>;
}

function ServiceEditorModal({
  visible,
  service,
  categories,
  employees,
  onClose,
  onSaved,
  onCategoriesUpdated,
  onDeleteService,
}: ServiceEditorModalProps) {
  const { isDark, primaryColor, primaryForeground } = useTheme();

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [isQuote, setIsQuote] = useState(false);
  const [price, setPrice] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [durationUnit, setDurationUnit] = useState<"min" | "hora">("min");
  const [durationInput, setDurationInput] = useState("60");
  const [bufferMinutes, setBufferMinutes] = useState("0");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [deliveryMode, setDeliveryMode] = useState<"IN_PERSON" | "ONLINE">("IN_PERSON");
  const [paymentType, setPaymentType] = useState<"PAY_LATER" | "QUOTE" | "FULL_PAYMENT" | "DEPOSIT">("PAY_LATER");
  const [depositAmount, setDepositAmount] = useState("0");
  const [cancellationPolicy, setCancellationPolicy] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Quick category management state
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showEditCategory, setShowEditCategory] = useState(false);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);

  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reset form when modal opens or service changes
  useEffect(() => {
    if (!visible) return;

    if (service) {
      setName(service.name || "");
      setCategoryId(service.categoryId || "");
      const isQuoteMode = service.paymentType === "QUOTE" || Number(service.price) === 0;
      setIsQuote(isQuoteMode);
      setPrice(service.price != null && !isQuoteMode ? String(service.price) : "");
      const dur = service.durationMinutes || 60;
      setDurationMinutes(dur);
      setDurationUnit("min");
      setDurationInput(String(dur));
      setBufferMinutes(String(service.bufferMinutes ?? 0));
      setDescription(service.description || "");
      setImageUrl(service.imageUrl || "");
      setShowUrlInput(false);
      setDeliveryMode((service.deliveryMode as "IN_PERSON" | "ONLINE") || "IN_PERSON");
      setPaymentType((service.paymentType as any) || "PAY_LATER");
      setDepositAmount(service.depositAmount != null ? String(service.depositAmount) : "0");
      setCancellationPolicy(service.cancellationPolicy || "");
      setShowAdvanced(
        Boolean(
          service.cancellationPolicy ||
            (service.paymentType && service.paymentType !== "PAY_LATER") ||
            (service.deliveryMode && service.deliveryMode !== "IN_PERSON")
        )
      );

      const linked = employees
        .filter((e) => e.serviceIds?.includes(service.id) || e.services?.includes(service.name))
        .map((e) => e.id);
      setSelectedEmployeeIds(linked);
    } else {
      setName("");
      setCategoryId("");
      setIsQuote(false);
      setPrice("");
      setDurationMinutes(60);
      setDurationUnit("min");
      setDurationInput("60");
      setBufferMinutes("0");
      setDescription("");
      setImageUrl("");
      setShowUrlInput(false);
      setDeliveryMode("IN_PERSON");
      setPaymentType("PAY_LATER");
      setDepositAmount("0");
      setCancellationPolicy("");
      setShowAdvanced(false);

      const activeIds = employees.filter((e) => e.active).map((e) => e.id);
      setSelectedEmployeeIds(activeIds);
    }

    setShowNewCategory(false);
    setNewCategoryName("");
    setShowEditCategory(false);
    setEditingCategoryName("");
    setShowCategoryDropdown(false);
    setShowUnitDropdown(false);
  }, [visible, service, employees]);

  const activeEmployees = useMemo(() => employees.filter((e) => e.active), [employees]);
  const currentCategory = useMemo(() => categories.find((c) => c.id === categoryId), [categories, categoryId]);

  const handlePickImage = async () => {
    setUploadingImage(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        base64: true,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const dataUrl = asset.base64
          ? `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`
          : asset.uri;
        setImageUrl(dataUrl);
      }
    } catch {
      Alert.alert("Erro", "Não foi possível carregar a foto do dispositivo.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSuggestDescription = () => {
    const suggested = getServiceDescription({
      name: name.trim() || service?.name || "",
      categoryName: currentCategory?.name || null,
    });
    setDescription(suggested);
  };

  const handleAddCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (trimmed.length < 2 || savingCategory) return;
    setSavingCategory(true);
    try {
      const res = await api<{ id: string; name: string }>("/api/categories", {
        method: "POST",
        body: JSON.stringify({ name: trimmed }),
      });
      await onCategoriesUpdated();
      setCategoryId(res.id);
      setNewCategoryName("");
      setShowNewCategory(false);
      Alert.alert("Sucesso", `Categoria "${res.name}" criada com sucesso!`);
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Não foi possível criar a categoria.");
    } finally {
      setSavingCategory(false);
    }
  };

  const handleUpdateCategory = async () => {
    const trimmed = editingCategoryName.trim();
    if (!categoryId || trimmed.length < 2 || savingCategory) return;
    setSavingCategory(true);
    try {
      await api(`/api/categories/${categoryId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: trimmed }),
      });
      await onCategoriesUpdated();
      setShowEditCategory(false);
      Alert.alert("Sucesso", `Categoria alterada para "${trimmed}".`);
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Não foi possível alterar a categoria.");
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!categoryId || savingCategory) return;
    const catName = currentCategory?.name || "esta categoria";
    Alert.alert(
      "Excluir categoria",
      `Deseja realmente excluir a categoria "${catName}"? Os serviços vinculados serão mantidos em "Outros (Geral)".`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir categoria",
          style: "destructive",
          onPress: async () => {
            setSavingCategory(true);
            try {
              await api(`/api/categories/${categoryId}`, { method: "DELETE" });
              await onCategoriesUpdated();
              setCategoryId("");
              setShowEditCategory(false);
              Alert.alert("Sucesso", `Categoria "${catName}" excluída.`);
            } catch (e: any) {
              Alert.alert("Erro", e?.message || "Não foi possível excluir a categoria.");
            } finally {
              setSavingCategory(false);
            }
          },
        },
      ]
    );
  };

  const handleSelectPreset = (mins: number) => {
    setDurationMinutes(mins);
    if (durationUnit === "hora") {
      const hrs = mins / 60;
      setDurationInput(hrs % 1 === 0 ? hrs.toString() : hrs.toFixed(1));
    } else {
      setDurationInput(mins.toString());
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Erro", "O nome do serviço é obrigatório.");
      return;
    }

    const parsedDuration =
      durationUnit === "hora"
        ? Math.max(5, Math.round(Number(durationInput) * 60))
        : Math.max(5, Number(durationInput || durationMinutes || 60));

    const parsedPrice = isQuote ? 0 : parseFloat(price.replace(",", ".")) || 0;
    const parsedPaymentType = isQuote ? "QUOTE" : paymentType;
    const parsedDeposit = paymentType === "DEPOSIT" ? parseFloat(depositAmount.replace(",", ".")) || 0 : 0;
    const parsedBuffer = parseInt(bufferMinutes, 10) || 0;

    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        price: parsedPrice,
        durationMinutes: parsedDuration,
        description: description.trim() || undefined,
        categoryId: categoryId || null,
        employeeIds: selectedEmployeeIds,
        bufferMinutes: parsedBuffer,
        imageUrl: imageUrl.trim() || null,
        deliveryMode,
        paymentType: parsedPaymentType,
        depositAmount: parsedDeposit,
        cancellationPolicy: cancellationPolicy.trim() || "",
        active: service ? service.active : true,
      };

      if (service) {
        await api(`/api/services/${service.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        Alert.alert("Sucesso", "Serviço atualizado com sucesso!");
      } else {
        await api("/api/services", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        Alert.alert("Sucesso", "Serviço cadastrado com sucesso!");
      }

      await onSaved();
      onClose();
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível salvar o serviço.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!service || busy || deleting || !onDeleteService) return;
    setDeleting(true);
    try {
      await onDeleteService(service);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0, 0, 0, 0.82)" }}>
        <View
          className="w-full rounded-t-3xl border-t overflow-hidden"
          style={{
            maxHeight: "94%",
            backgroundColor: "#111215",
            borderColor: "rgba(255, 255, 255, 0.12)",
          }}
        >
          {/* 1. Modal Header */}
          <View
            className="flex-row items-center justify-between px-5 pt-4 pb-3.5 border-b"
            style={{ borderBottomColor: "rgba(255, 255, 255, 0.08)" }}
          >
            <Text style={{ color: "#ffffff", fontSize: 19, fontWeight: "800", letterSpacing: -0.3 }}>
              {service ? "Editar serviço" : "Novo serviço"}
            </Text>
            <Pressable
              onPress={onClose}
              className="items-center justify-center rounded-full"
              style={{
                width: 36,
                height: 36,
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <X size={18} color="#9ca3af" strokeWidth={2.5} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 30, gap: 20 }}
          >
            {/* 1. DADOS PRINCIPAIS */}
            <View className="gap-3">
              <View className="flex-row items-center gap-1.5">
                <Sparkles size={13} color={primaryColor} />
                <Text
                  style={{
                    color: "#9ca3af",
                    fontSize: 11,
                    fontWeight: "700",
                    letterSpacing: 0.8,
                    textTransform: "uppercase",
                  }}
                >
                  DADOS PRINCIPAIS
                </Text>
              </View>

              {/* Nome do serviço */}
              <View className="gap-1.5">
                <Text style={{ color: "#d1d5db", fontSize: 12, fontWeight: "600" }}>Nome do serviço</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Ex.: Corte & Barba Terapia, Manicure Completa..."
                  placeholderTextColor="#6b7280"
                  style={{
                    backgroundColor: "#16171c",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    height: 44,
                    color: "#ffffff",
                    fontSize: 13.5,
                  }}
                />
              </View>

              {/* Categoria */}
              <View className="gap-1.5">
                <View className="flex-row items-center justify-between">
                  <Text style={{ color: "#d1d5db", fontSize: 12, fontWeight: "600" }}>Categoria</Text>
                  <View className="flex-row items-center gap-2">
                    {Boolean(categoryId && currentCategory) && (
                      <Pressable
                        onPress={() => {
                          if (!showEditCategory) {
                            setEditingCategoryName(currentCategory?.name ?? "");
                            setShowEditCategory(true);
                            setShowNewCategory(false);
                          } else {
                            setShowEditCategory(false);
                          }
                        }}
                        className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg border"
                        style={{
                          backgroundColor: "#1c1d24",
                          borderColor: "rgba(255, 255, 255, 0.12)",
                          height: 28,
                        }}
                      >
                        <Pencil size={11} color="#9ca3af" />
                        <Text style={{ color: "#d1d5db", fontSize: 11, fontWeight: "600" }}>
                          {showEditCategory ? "Fechar" : "Editar categoria"}
                        </Text>
                      </Pressable>
                    )}

                    <Pressable
                      onPress={() => {
                        setShowNewCategory(!showNewCategory);
                        setShowEditCategory(false);
                      }}
                      className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg border"
                      style={{
                        backgroundColor: "#1c1d24",
                        borderColor: "rgba(255, 255, 255, 0.15)",
                        borderStyle: "dashed",
                        height: 28,
                      }}
                    >
                      <FolderPlus size={12} color="#9ca3af" />
                      <Text style={{ color: "#d1d5db", fontSize: 11, fontWeight: "600" }}>
                        {showNewCategory ? "Fechar" : "+ Nova categoria"}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Category Select Box */}
                <Pressable
                  onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  className="flex-row items-center justify-between px-3.5 rounded-xl border"
                  style={{
                    backgroundColor: "#16171c",
                    borderColor: showCategoryDropdown ? primaryColor : "rgba(255, 255, 255, 0.1)",
                    height: 44,
                  }}
                >
                  <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "500" }}>
                    {currentCategory ? currentCategory.name : "Outros (Geral)"}
                  </Text>
                  <ChevronDown
                    size={16}
                    color="#9ca3af"
                    style={{
                      transform: [{ rotate: showCategoryDropdown ? "180deg" : "0deg" }],
                    }}
                  />
                </Pressable>

                {/* Category Dropdown List */}
                {showCategoryDropdown && (
                  <View
                    className="p-1.5 rounded-xl border gap-1"
                    style={{
                      backgroundColor: "#181920",
                      borderColor: "rgba(255, 255, 255, 0.12)",
                    }}
                  >
                    <Pressable
                      onPress={() => {
                        setCategoryId("");
                        setShowCategoryDropdown(false);
                        setShowEditCategory(false);
                      }}
                      className="flex-row items-center justify-between px-3 py-2.5 rounded-lg"
                      style={{
                        backgroundColor: categoryId === "" ? hexToRgba(primaryColor, 0.15) : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          color: categoryId === "" ? primaryColor : "#ffffff",
                          fontSize: 13,
                          fontWeight: categoryId === "" ? "700" : "500",
                        }}
                      >
                        Outros (Geral)
                      </Text>
                      {categoryId === "" && <Check size={14} color={primaryColor} />}
                    </Pressable>

                    {categories.map((c) => {
                      const isSelected = categoryId === c.id;
                      return (
                        <Pressable
                          key={c.id}
                          onPress={() => {
                            setCategoryId(c.id);
                            setShowCategoryDropdown(false);
                            setShowEditCategory(false);
                          }}
                          className="flex-row items-center justify-between px-3 py-2.5 rounded-lg"
                          style={{
                            backgroundColor: isSelected ? hexToRgba(primaryColor, 0.15) : "transparent",
                          }}
                        >
                          <Text
                            style={{
                              color: isSelected ? primaryColor : "#ffffff",
                              fontSize: 13,
                              fontWeight: isSelected ? "700" : "500",
                            }}
                          >
                            {c.name}
                          </Text>
                          {isSelected && <Check size={14} color={primaryColor} />}
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {/* Edit Category Box */}
                {showEditCategory && currentCategory && (
                  <View
                    className="flex-row items-center gap-2 p-2.5 rounded-xl border mt-1"
                    style={{
                      backgroundColor: "#181920",
                      borderColor: "rgba(255, 255, 255, 0.12)",
                    }}
                  >
                    <TextInput
                      value={editingCategoryName}
                      onChangeText={setEditingCategoryName}
                      placeholder="Nome da categoria"
                      placeholderTextColor="#6b7280"
                      className="flex-1 px-3 rounded-lg border text-white text-xs"
                      style={{
                        backgroundColor: "#121316",
                        borderColor: "rgba(255, 255, 255, 0.1)",
                        height: 36,
                      }}
                    />
                    <Pressable
                      onPress={handleUpdateCategory}
                      disabled={editingCategoryName.trim().length < 2 || savingCategory}
                      className="px-3 rounded-lg items-center justify-center"
                      style={{
                        backgroundColor: primaryColor,
                        height: 36,
                        opacity: editingCategoryName.trim().length < 2 || savingCategory ? 0.5 : 1,
                      }}
                    >
                      <Text style={{ color: primaryForeground, fontSize: 12, fontWeight: "700" }}>Salvar</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleDeleteCategory}
                      disabled={savingCategory}
                      className="items-center justify-center px-2.5 rounded-lg border"
                      style={{
                        backgroundColor: "rgba(239, 68, 68, 0.12)",
                        borderColor: "rgba(239, 68, 68, 0.35)",
                        height: 36,
                      }}
                    >
                      <Trash2 size={14} color="#ef4444" />
                    </Pressable>
                  </View>
                )}

                {/* Add Category Box */}
                {showNewCategory && (
                  <View
                    className="flex-row items-center gap-2 p-2.5 rounded-xl border mt-1"
                    style={{
                      backgroundColor: "#181920",
                      borderColor: "rgba(255, 255, 255, 0.12)",
                    }}
                  >
                    <TextInput
                      value={newCategoryName}
                      onChangeText={setNewCategoryName}
                      placeholder="Criar categoria"
                      placeholderTextColor="#6b7280"
                      className="flex-1 px-3 rounded-lg border text-white text-xs"
                      style={{
                        backgroundColor: "#121316",
                        borderColor: "rgba(255, 255, 255, 0.1)",
                        height: 36,
                      }}
                    />
                    <Pressable
                      onPress={handleAddCategory}
                      disabled={newCategoryName.trim().length < 2 || savingCategory}
                      className="px-3 rounded-lg items-center justify-center"
                      style={{
                        backgroundColor: primaryColor,
                        height: 36,
                        opacity: newCategoryName.trim().length < 2 || savingCategory ? 0.5 : 1,
                      }}
                    >
                      <Text style={{ color: primaryForeground, fontSize: 12, fontWeight: "700" }}>Adicionar</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>

            {/* 2. VALORES & TEMPO */}
            <View className="gap-3">
              <View className="flex-row items-center gap-1.5">
                <Coins size={13} color={primaryColor} />
                <Text
                  style={{
                    color: "#9ca3af",
                    fontSize: 11,
                    fontWeight: "700",
                    letterSpacing: 0.8,
                    textTransform: "uppercase",
                  }}
                >
                  VALORES & TEMPO
                </Text>
              </View>

              {/* Pricing Segmented Control */}
              <View
                className="p-1 rounded-xl border gap-1"
                style={{
                  backgroundColor: "#16171c",
                  borderColor: "rgba(255, 255, 255, 0.08)",
                }}
              >
                <Pressable
                  onPress={() => setIsQuote(false)}
                  className="flex-row items-center justify-center gap-2 py-2.5 px-3 rounded-lg"
                  style={{
                    backgroundColor: !isQuote ? "#52525b" : "transparent",
                  }}
                >
                  <Coins size={13} color={!isQuote ? "#ffffff" : "#9ca3af"} />
                  <Text
                    style={{
                      color: !isQuote ? "#ffffff" : "#9ca3af",
                      fontSize: 12.5,
                      fontWeight: !isQuote ? "700" : "600",
                    }}
                  >
                    Preço fixo
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setIsQuote(true)}
                  className="flex-row items-center justify-center gap-2 py-2.5 px-3 rounded-lg"
                  style={{
                    backgroundColor: isQuote ? "#52525b" : "transparent",
                  }}
                >
                  <FileText size={13} color={isQuote ? "#ffffff" : "#9ca3af"} />
                  <Text
                    style={{
                      color: isQuote ? "#ffffff" : "#9ca3af",
                      fontSize: 12.5,
                      fontWeight: isQuote ? "700" : "600",
                    }}
                  >
                    Orçamento direto (Sob consulta)
                  </Text>
                </Pressable>
              </View>

              {/* Price input or Quote Box */}
              {isQuote ? (
                <View
                  className="p-3.5 rounded-xl border gap-1.5"
                  style={{
                    backgroundColor: "rgba(59, 130, 246, 0.08)",
                    borderColor: "rgba(59, 130, 246, 0.35)",
                    borderStyle: "dashed",
                  }}
                >
                  <View className="flex-row items-center gap-1.5">
                    <Sparkles size={14} color="#3b82f6" />
                    <Text style={{ color: "#3b82f6", fontSize: 12, fontWeight: "700" }}>
                      Sob consulta / Orçamento direto
                    </Text>
                  </View>
                  <Text style={{ color: "#9ca3af", fontSize: 11.5, lineHeight: 16 }}>
                    Sem valor fixo. O cliente poderá solicitar orçamento direto pelo WhatsApp com o proprietário ou
                    funcionário selecionado.
                  </Text>
                </View>
              ) : (
                <View className="gap-1.5">
                  <Text style={{ color: "#d1d5db", fontSize: 12, fontWeight: "600" }}>Preço (R$)</Text>
                  <View
                    className="flex-row items-center px-3.5 rounded-xl border"
                    style={{
                      backgroundColor: "#16171c",
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      height: 44,
                    }}
                  >
                    <Text style={{ color: "#71717a", fontSize: 13, fontWeight: "600", marginRight: 8 }}>R$</Text>
                    <TextInput
                      value={price}
                      onChangeText={setPrice}
                      placeholder="0,00"
                      placeholderTextColor="#6b7280"
                      keyboardType="decimal-pad"
                      className="flex-1 text-white text-sm"
                      style={{ height: 44 }}
                    />
                  </View>
                </View>
              )}

              {/* Duração */}
              <View className="gap-1.5">
                <View className="flex-row items-center justify-between">
                  <Text style={{ color: "#d1d5db", fontSize: 12, fontWeight: "600" }}>Duração</Text>
                  <Text style={{ color: "#9ca3af", fontSize: 11 }}>
                    {durationUnit === "hora"
                      ? `${durationMinutes} min no total`
                      : durationMinutes >= 60
                      ? `${(durationMinutes / 60).toFixed(1).replace(".0", "")}h`
                      : ""}
                  </Text>
                </View>

                <View className="flex-row items-center gap-2">
                  <TextInput
                    value={durationInput}
                    onChangeText={(val) => {
                      setDurationInput(val);
                      const num = Number(val);
                      if (!isNaN(num) && num > 0) {
                        setDurationMinutes(durationUnit === "hora" ? Math.round(num * 60) : num);
                      }
                    }}
                    placeholder="60"
                    placeholderTextColor="#6b7280"
                    keyboardType="numeric"
                    className="flex-1 px-3.5 rounded-xl border text-white text-sm font-semibold"
                    style={{
                      backgroundColor: "#16171c",
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      height: 44,
                    }}
                  />

                  {/* Unit Picker Trigger */}
                  <Pressable
                    onPress={() => setShowUnitDropdown(!showUnitDropdown)}
                    className="flex-row items-center justify-between px-3.5 rounded-xl border"
                    style={{
                      backgroundColor: "#1c1d24",
                      borderColor: "rgba(255, 255, 255, 0.12)",
                      height: 44,
                      width: 90,
                    }}
                  >
                    <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "700" }}>
                      {durationUnit === "min" ? "min" : "hora(s)"}
                    </Text>
                    <ChevronDown size={14} color="#9ca3af" />
                  </Pressable>
                </View>

                {showUnitDropdown && (
                  <View
                    className="p-1 rounded-xl border self-end gap-1"
                    style={{
                      backgroundColor: "#1c1d24",
                      borderColor: "rgba(255, 255, 255, 0.12)",
                      width: 120,
                    }}
                  >
                    <Pressable
                      onPress={() => {
                        if (durationUnit === "hora") {
                          setDurationInput(String(durationMinutes));
                        }
                        setDurationUnit("min");
                        setShowUnitDropdown(false);
                      }}
                      className="px-3 py-2 rounded-lg"
                      style={{
                        backgroundColor: durationUnit === "min" ? hexToRgba(primaryColor, 0.15) : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          color: durationUnit === "min" ? primaryColor : "#ffffff",
                          fontSize: 12,
                          fontWeight: durationUnit === "min" ? "700" : "500",
                        }}
                      >
                        minutos (min)
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        if (durationUnit === "min") {
                          const hrs = durationMinutes / 60;
                          setDurationInput(hrs % 1 === 0 ? hrs.toString() : hrs.toFixed(1));
                        }
                        setDurationUnit("hora");
                        setShowUnitDropdown(false);
                      }}
                      className="px-3 py-2 rounded-lg"
                      style={{
                        backgroundColor: durationUnit === "hora" ? hexToRgba(primaryColor, 0.15) : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          color: durationUnit === "hora" ? primaryColor : "#ffffff",
                          fontSize: 12,
                          fontWeight: durationUnit === "hora" ? "700" : "500",
                        }}
                      >
                        horas
                      </Text>
                    </Pressable>
                  </View>
                )}

                {/* Preset Chips */}
                <View className="flex-row flex-wrap gap-1.5 mt-1">
                  {[
                    { label: "15m", mins: 15 },
                    { label: "30m", mins: 30 },
                    { label: "45m", mins: 45 },
                    { label: "1h", mins: 60 },
                    { label: "1h30", mins: 90 },
                    { label: "2h", mins: 120 },
                  ].map((preset) => {
                    const isActive = durationMinutes === preset.mins;
                    return (
                      <Pressable
                        key={preset.label}
                        onPress={() => handleSelectPreset(preset.mins)}
                        className="px-3 py-1.5 rounded-lg border"
                        style={{
                          backgroundColor: isActive ? hexToRgba(primaryColor, 0.15) : "#16171c",
                          borderColor: isActive ? primaryColor : "rgba(255, 255, 255, 0.08)",
                        }}
                      >
                        <Text
                          style={{
                            color: isActive ? primaryColor : "#9ca3af",
                            fontSize: 11.5,
                            fontWeight: isActive ? "700" : "600",
                          }}
                        >
                          {preset.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Intervalo após atendimento */}
              <View className="gap-1.5">
                <Text style={{ color: "#d1d5db", fontSize: 12, fontWeight: "600" }}>
                  Intervalo após atendimento (min)
                </Text>
                <View
                  className="flex-row items-center px-3.5 rounded-xl border"
                  style={{
                    backgroundColor: "#16171c",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    height: 44,
                  }}
                >
                  <TextInput
                    value={bufferMinutes}
                    onChangeText={setBufferMinutes}
                    placeholder="0"
                    placeholderTextColor="#6b7280"
                    keyboardType="numeric"
                    className="flex-1 text-white text-sm"
                    style={{ height: 44 }}
                  />
                  <Text style={{ color: "#71717a", fontSize: 12, fontWeight: "600" }}>min</Text>
                </View>
              </View>
            </View>

            {/* 3. APRESENTAÇÃO */}
            <View className="gap-3">
              <View className="flex-row items-center gap-1.5">
                <FileText size={13} color={primaryColor} />
                <Text
                  style={{
                    color: "#9ca3af",
                    fontSize: 11,
                    fontWeight: "700",
                    letterSpacing: 0.8,
                    textTransform: "uppercase",
                  }}
                >
                  APRESENTAÇÃO
                </Text>
              </View>

              {/* Descrição */}
              <View className="gap-1.5">
                <View className="flex-row items-center justify-between">
                  <Text style={{ color: "#d1d5db", fontSize: 12, fontWeight: "600" }}>Descrição</Text>
                  <View className="flex-row items-center gap-2">
                    <Pressable
                      onPress={handleSuggestDescription}
                      className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg border"
                      style={{
                        backgroundColor: "rgba(56, 189, 248, 0.08)",
                        borderColor: "rgba(56, 189, 248, 0.35)",
                        height: 26,
                      }}
                    >
                      <Sparkles size={12} color="#38bdf8" />
                      <Text style={{ color: "#38bdf8", fontSize: 11, fontWeight: "600" }}>Sugerir descrição</Text>
                    </Pressable>
                    <Text style={{ color: "#6b7280", fontSize: 11 }}>Opcional</Text>
                  </View>
                </View>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Descreva o que está incluso no atendimento, benefícios e orientações para o cliente..."
                  placeholderTextColor="#6b7280"
                  multiline
                  numberOfLines={3}
                  style={{
                    backgroundColor: "#16171c",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: 10,
                    padding: 12,
                    minHeight: 84,
                    color: "#ffffff",
                    fontSize: 13,
                    textAlignVertical: "top",
                  }}
                />
              </View>

              {/* Foto do serviço */}
              <View className="gap-1.5">
                <View className="flex-row items-center justify-between">
                  <Text style={{ color: "#d1d5db", fontSize: 12, fontWeight: "600" }}>Foto do serviço</Text>
                  <Text style={{ color: "#6b7280", fontSize: 11 }}>Galeria do dispositivo</Text>
                </View>

                {!imageUrl ? (
                  <Pressable
                    onPress={handlePickImage}
                    disabled={uploadingImage}
                    className="flex-row items-center gap-3.5 p-3.5 rounded-xl border"
                    style={{
                      backgroundColor: "#16171c",
                      borderColor: "rgba(255, 255, 255, 0.18)",
                      borderStyle: "dashed",
                    }}
                  >
                    <View
                      className="items-center justify-center rounded-xl border"
                      style={{
                        width: 44,
                        height: 44,
                        backgroundColor: "#1e1f26",
                        borderColor: "rgba(255, 255, 255, 0.08)",
                      }}
                    >
                      {uploadingImage ? (
                        <ActivityIndicator size="small" color={primaryColor} />
                      ) : (
                        <ImagePlus size={22} color={primaryColor} />
                      )}
                    </View>
                    <View className="flex-1 gap-0.5">
                      <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700" }}>
                        {uploadingImage ? "Processando foto..." : "Escolher foto da galeria"}
                      </Text>
                      <Text style={{ color: "#9ca3af", fontSize: 11 }}>
                        Clique ou arraste uma imagem do seu dispositivo (PNG, JPG, WebP)
                      </Text>
                    </View>
                  </Pressable>
                ) : (
                  <View
                    className="flex-row items-center gap-3.5 p-3.5 rounded-xl border"
                    style={{
                      backgroundColor: "#16171c",
                      borderColor: "rgba(255, 255, 255, 0.1)",
                    }}
                  >
                    <Image
                      source={{ uri: imageUrl }}
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: "rgba(255, 255, 255, 0.15)",
                      }}
                      contentFit="cover"
                    />
                    <View className="flex-1 gap-1">
                      <View className="flex-row items-center gap-1.5">
                        <Check size={14} color={primaryColor} strokeWidth={3} />
                        <Text style={{ color: primaryColor, fontSize: 11.5, fontWeight: "700" }}>
                          Foto selecionada
                        </Text>
                      </View>
                      <Text style={{ color: "#9ca3af", fontSize: 11 }}>
                        A foto será exibida no cartão de agendamento online.
                      </Text>
                      <View className="flex-row items-center gap-2 mt-1">
                        <Pressable
                          onPress={handlePickImage}
                          className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-md border"
                          style={{
                            backgroundColor: "#20222a",
                            borderColor: "rgba(255, 255, 255, 0.1)",
                          }}
                        >
                          <RefreshCw size={11} color="#d1d5db" />
                          <Text style={{ color: "#d1d5db", fontSize: 11, fontWeight: "600" }}>Trocar foto</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setImageUrl("")}
                          className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-md border"
                          style={{
                            backgroundColor: "rgba(239, 68, 68, 0.1)",
                            borderColor: "rgba(239, 68, 68, 0.3)",
                          }}
                        >
                          <Trash2 size={11} color="#ef4444" />
                          <Text style={{ color: "#ef4444", fontSize: 11, fontWeight: "600" }}>Remover</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                )}

                {/* Manual URL Link toggle */}
                <View className="mt-1">
                  <Pressable
                    onPress={() => setShowUrlInput(!showUrlInput)}
                    className="flex-row items-center gap-1 py-1"
                  >
                    <Link2 size={12} color="#9ca3af" />
                    <Text style={{ color: "#9ca3af", fontSize: 11, fontWeight: "600" }}>
                      {showUrlInput ? "Ocultar link manual" : "Ou inserir por link (URL)"}
                    </Text>
                  </Pressable>

                  {showUrlInput && (
                    <View
                      className="flex-row items-center px-3 rounded-xl border mt-1.5"
                      style={{
                        backgroundColor: "#16171c",
                        borderColor: "rgba(255, 255, 255, 0.1)",
                        height: 42,
                      }}
                    >
                      <ImageIcon size={15} color="#9ca3af" style={{ marginRight: 8 }} />
                      <TextInput
                        value={imageUrl}
                        onChangeText={setImageUrl}
                        placeholder="https://exemplo.com/foto-do-servico.jpg"
                        placeholderTextColor="#6b7280"
                        className="flex-1 text-white text-xs"
                        style={{ height: 42 }}
                      />
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* 4. PROFISSIONAIS QUE REALIZAM */}
            <View
              className="p-3.5 rounded-xl border gap-3"
              style={{
                backgroundColor: "#16171c",
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <Users size={13} color={primaryColor} />
                  <Text
                    style={{
                      color: "#9ca3af",
                      fontSize: 11,
                      fontWeight: "700",
                      letterSpacing: 0.8,
                      textTransform: "uppercase",
                    }}
                  >
                    PROFISSIONAIS QUE REALIZAM
                  </Text>
                  {selectedEmployeeIds.length > 0 && (
                    <Text style={{ color: "#6b7280", fontSize: 11 }}>
                      ({selectedEmployeeIds.length})
                    </Text>
                  )}
                </View>

                {activeEmployees.length > 0 && (
                  <Pressable
                    onPress={() => {
                      if (selectedEmployeeIds.length === activeEmployees.length) {
                        setSelectedEmployeeIds([]);
                      } else {
                        setSelectedEmployeeIds(activeEmployees.map((e) => e.id));
                      }
                    }}
                  >
                    <Text style={{ color: primaryColor, fontSize: 11.5, fontWeight: "600" }}>
                      {selectedEmployeeIds.length === activeEmployees.length ? "Desmarcar todos" : "Selecionar todos"}
                    </Text>
                  </Pressable>
                )}
              </View>

              {activeEmployees.length > 0 ? (
                <View className="flex-row flex-wrap gap-2">
                  {activeEmployees.map((emp) => {
                    const isSelected = selectedEmployeeIds.includes(emp.id);
                    return (
                      <Pressable
                        key={emp.id}
                        onPress={() => {
                          if (isSelected) {
                            setSelectedEmployeeIds((prev) => prev.filter((id) => id !== emp.id));
                          } else {
                            setSelectedEmployeeIds((prev) => [...prev, emp.id]);
                          }
                        }}
                        className="flex-row items-center px-2.5 py-2 rounded-xl border"
                        style={{
                          width: "48.5%",
                          backgroundColor: isSelected ? hexToRgba(primaryColor, 0.12) : "#1c1d24",
                          borderColor: isSelected ? primaryColor : "rgba(255, 255, 255, 0.08)",
                        }}
                      >
                        <View
                          className="items-center justify-center rounded-lg"
                          style={{
                            width: 28,
                            height: 28,
                            backgroundColor: isSelected ? primaryColor : "#252731",
                          }}
                        >
                          <Text
                            style={{
                              color: isSelected ? primaryForeground : "#d1d5db",
                              fontSize: 11,
                              fontWeight: "700",
                            }}
                          >
                            {getInitials(emp.name)}
                          </Text>
                        </View>

                        <Text
                          numberOfLines={1}
                          className="flex-1 mx-2"
                          style={{
                            color: "#ffffff",
                            fontSize: 12,
                            fontWeight: "600",
                          }}
                        >
                          {emp.name}
                        </Text>

                        <View
                          className="items-center justify-center rounded-full border"
                          style={{
                            width: 18,
                            height: 18,
                            borderColor: isSelected ? primaryColor : "rgba(255, 255, 255, 0.25)",
                            backgroundColor: isSelected ? primaryColor : "transparent",
                          }}
                        >
                          {isSelected && <Check size={11} color={primaryForeground} strokeWidth={3} />}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={{ color: "#6b7280", fontSize: 12, textAlign: "center", paddingVertical: 8 }}>
                  Nenhum profissional cadastrado na equipe.
                </Text>
              )}
            </View>

            {/* 5. OPÇÕES AVANÇADAS */}
            <View className="gap-2">
              <Pressable
                onPress={() => setShowAdvanced(!showAdvanced)}
                className="flex-row items-center justify-between p-3 rounded-xl border"
                style={{
                  backgroundColor: "#16171c",
                  borderColor: "rgba(255, 255, 255, 0.08)",
                }}
              >
                <View className="flex-row items-center gap-2">
                  <SlidersHorizontal size={14} color="#9ca3af" />
                  <Text style={{ color: "#d1d5db", fontSize: 12, fontWeight: "600" }}>
                    Opções avançadas (Modalidade, Pagamento & Políticas)
                  </Text>
                </View>
                <ChevronDown
                  size={15}
                  color="#9ca3af"
                  style={{
                    transform: [{ rotate: showAdvanced ? "180deg" : "0deg" }],
                  }}
                />
              </Pressable>

              {showAdvanced && (
                <View
                  className="p-3.5 rounded-xl border gap-3"
                  style={{
                    backgroundColor: "#16171c",
                    borderColor: "rgba(255, 255, 255, 0.08)",
                  }}
                >
                  {/* Modalidade de atendimento */}
                  <View className="gap-1.5">
                    <Text style={{ color: "#d1d5db", fontSize: 12, fontWeight: "600" }}>Atendimento</Text>
                    <View className="flex-row gap-2">
                      {[
                        { id: "IN_PERSON" as const, label: "Presencial" },
                        { id: "ONLINE" as const, label: "Online" },
                      ].map((item) => {
                        const isSelected = deliveryMode === item.id;
                        return (
                          <Pressable
                            key={item.id}
                            onPress={() => setDeliveryMode(item.id)}
                            className="flex-1 py-2 px-3 rounded-lg border items-center justify-center"
                            style={{
                              backgroundColor: isSelected ? hexToRgba(primaryColor, 0.15) : "#1c1d24",
                              borderColor: isSelected ? primaryColor : "rgba(255, 255, 255, 0.08)",
                            }}
                          >
                            <Text
                              style={{
                                color: isSelected ? primaryColor : "#d1d5db",
                                fontSize: 12,
                                fontWeight: isSelected ? "700" : "500",
                              }}
                            >
                              {item.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  {/* Forma de pagamento */}
                  <View className="gap-1.5">
                    <Text style={{ color: "#d1d5db", fontSize: 12, fontWeight: "600" }}>Pagamento</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {[
                        { id: "PAY_LATER" as const, label: "No atendimento" },
                        { id: "FULL_PAYMENT" as const, label: "Antecipado" },
                        { id: "DEPOSIT" as const, label: "Sinal" },
                      ].map((item) => {
                        const isSelected = paymentType === item.id;
                        return (
                          <Pressable
                            key={item.id}
                            onPress={() => setPaymentType(item.id)}
                            className="flex-1 min-w-[100px] py-2 px-2.5 rounded-lg border items-center justify-center"
                            style={{
                              backgroundColor: isSelected ? hexToRgba(primaryColor, 0.15) : "#1c1d24",
                              borderColor: isSelected ? primaryColor : "rgba(255, 255, 255, 0.08)",
                            }}
                          >
                            <Text
                              style={{
                                color: isSelected ? primaryColor : "#d1d5db",
                                fontSize: 11.5,
                                fontWeight: isSelected ? "700" : "500",
                              }}
                            >
                              {item.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  {paymentType === "DEPOSIT" && (
                    <View className="gap-1.5">
                      <Text style={{ color: "#d1d5db", fontSize: 12, fontWeight: "600" }}>Valor do sinal (R$)</Text>
                      <View
                        className="flex-row items-center px-3 rounded-xl border"
                        style={{
                          backgroundColor: "#121316",
                          borderColor: "rgba(255, 255, 255, 0.1)",
                          height: 42,
                        }}
                      >
                        <Text style={{ color: "#71717a", fontSize: 13, fontWeight: "600", marginRight: 6 }}>R$</Text>
                        <TextInput
                          value={depositAmount}
                          onChangeText={setDepositAmount}
                          placeholder="0,00"
                          placeholderTextColor="#6b7280"
                          keyboardType="decimal-pad"
                          className="flex-1 text-white text-xs"
                          style={{ height: 42 }}
                        />
                      </View>
                    </View>
                  )}

                  {/* Informações de cancelamento */}
                  <View className="gap-1.5">
                    <View className="flex-row items-center justify-between">
                      <Text style={{ color: "#d1d5db", fontSize: 12, fontWeight: "600" }}>
                        Informações de cancelamento
                      </Text>
                      <Text style={{ color: "#6b7280", fontSize: 11 }}>Opcional</Text>
                    </View>
                    <TextInput
                      value={cancellationPolicy}
                      onChangeText={setCancellationPolicy}
                      placeholder="Ex.: Reagendamentos ou cancelamentos permitidos com até 24h de antecedência..."
                      placeholderTextColor="#6b7280"
                      multiline
                      numberOfLines={2}
                      style={{
                        backgroundColor: "#121316",
                        borderColor: "rgba(255, 255, 255, 0.1)",
                        borderWidth: 1,
                        borderRadius: 10,
                        padding: 10,
                        minHeight: 64,
                        color: "#ffffff",
                        fontSize: 12,
                        textAlignVertical: "top",
                      }}
                    />
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {/* 6. Sticky Footer Actions */}
          <View
            className="px-5 pt-3.5 pb-6 border-t gap-2.5"
            style={{
              backgroundColor: "#111215",
              borderTopColor: "rgba(255, 255, 255, 0.08)",
            }}
          >
            {Boolean(service) && (
              <Pressable
                onPress={handleDelete}
                disabled={busy || deleting}
                className="flex-row items-center justify-center gap-2 rounded-xl border"
                style={{
                  height: 44,
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  borderColor: "rgba(239, 68, 68, 0.35)",
                }}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#ef4444" />
                ) : (
                  <>
                    <Trash2 size={16} color="#ef4444" />
                    <Text style={{ color: "#ef4444", fontSize: 13, fontWeight: "600" }}>Excluir serviço</Text>
                  </>
                )}
              </Pressable>
            )}

            <Pressable
              onPress={handleSave}
              disabled={busy || deleting}
              className="flex-row items-center justify-center gap-2 rounded-xl"
              style={{
                height: 46,
                backgroundColor: "#52525b",
                opacity: busy || deleting ? 0.7 : 1,
              }}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Check size={16} color="#ffffff" strokeWidth={2.5} />
                  <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "700" }}>Salvar serviço</Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={onClose}
              disabled={busy || deleting}
              className="items-center justify-center rounded-xl border"
              style={{
                height: 44,
                backgroundColor: "#16171c",
                borderColor: "rgba(255, 255, 255, 0.12)",
              }}
            >
              <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "600" }}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function ServicosScreen() {
  const { session } = useSession();
  const { isDark, primaryColor, primaryForeground } = useTheme();
  const { isCompact, isTablet } = useResponsive();

  const [subTab, setSubTab] = useState<SubTab>("services");
  const [services, setServices] = useState<ServiceDTO[] | null>(null);
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlanDTO[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeDTO[]>([]);
  const [filter, setFilter] = useState<Filter>("Todos");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Service Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceDTO | null>(null);

  // Membership Plan Modal state
  const [membershipModalVisible, setMembershipModalVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlanDTO | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      const res = await api<CategoryItem[]>("/api/categories");
      setCategories(Array.isArray(res) ? res : []);
    } catch {
      // ignore
    }
  }, []);

  const loadEmployees = useCallback(async () => {
    try {
      const res = await getEmployees();
      setEmployees(Array.isArray(res) ? res : []);
    } catch {
      // ignore
    }
  }, []);

  const loadServices = useCallback(async () => {
    try {
      setServices(await getServices());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar os serviços.");
    }
  }, []);

  const loadMembershipPlans = useCallback(async () => {
    try {
      const res = await getMembershipPlans(true);
      setMembershipPlans(Array.isArray(res) ? res : []);
    } catch {
      // ignore
    }
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([loadServices(), loadCategories(), loadEmployees(), loadMembershipPlans()]);
  }, [loadServices, loadCategories, loadEmployees, loadMembershipPlans]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      await loadAll();
      if (!cancelled) setLoading(false);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [loadAll]);

  async function onRefresh() {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }

  function handleToggled(updated: ServiceDTO) {
    setServices((prev) => prev?.map((s) => (s.id === updated.id ? updated : s)) ?? prev);
  }

  const handleOpenCreateService = () => {
    setSelectedService(null);
    setModalVisible(true);
  };

  const handleOpenEditService = (service: ServiceDTO) => {
    setSelectedService(service);
    setModalVisible(true);
  };

  const handleOpenCreatePlan = () => {
    setSelectedPlan(null);
    setMembershipModalVisible(true);
  };

  const handleOpenEditPlan = (plan: MembershipPlanDTO) => {
    setSelectedPlan(plan);
    setMembershipModalVisible(true);
  };

  const handleDeleteService = async (service: ServiceDTO) => {
    return new Promise<void>((resolve, reject) => {
      Alert.alert(
        "Excluir serviço",
        `Tem certeza que deseja excluir permanentemente o serviço "${service.name}"? Esta ação não pode ser desfeita.`,
        [
          {
            text: "Cancelar",
            style: "cancel",
            onPress: () => resolve(),
          },
          {
            text: "Excluir serviço",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteService(service.id);
                await loadAll();
                Alert.alert("Sucesso", `Serviço "${service.name}" excluído.`);
                resolve();
              } catch (err: any) {
                Alert.alert("Erro", err?.message || "Não foi possível excluir o serviço.");
                reject(err);
              }
            },
          },
        ]
      );
    });
  };

  const handleDeletePlan = async (plan: MembershipPlanDTO) => {
    return new Promise<void>((resolve, reject) => {
      Alert.alert(
        "Desativar plano",
        `Deseja realmente desativar o plano "${plan.name}"? Assinantes existentes continuarão ativos, mas novos clientes não poderão aderir.`,
        [
          { text: "Cancelar", style: "cancel", onPress: () => resolve() },
          {
            text: "Desativar plano",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteMembershipPlan(plan.id);
                await loadAll();
                Alert.alert("Sucesso", `Plano "${plan.name}" desativado.`);
                resolve();
              } catch (err: any) {
                Alert.alert("Erro", err?.message || "Não foi possível desativar o plano.");
                reject(err);
              }
            },
          },
        ]
      );
    });
  };

  const counts = useMemo(() => {
    const list = services ?? [];
    return {
      all: list.length,
      active: list.filter((s) => s.active).length,
      inactive: list.filter((s) => !s.active).length,
    };
  }, [services]);

  const visibleServices = useMemo(() => {
    const list = services ?? [];
    if (filter === "Todos") return list;
    return list.filter((s) => s.active === (filter === "Ativos"));
  }, [services, filter]);

  return (
    <Screen
      header={<TopBar title="Serviços" company={session?.company.name} showBack={true} />}
      style={{ paddingTop: 14 }}
    >
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 16, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />}
      >
        {/* 1. Header Section */}
        <PageHeader
          eyebrow={subTab === "services" ? "CATÁLOGO DE SERVIÇOS" : "RECORRÊNCIA & MENSALISTAS"}
          title={subTab === "services" ? "Serviços" : "Planos Mensais"}
          subtitle={
            subTab === "services"
              ? `${services?.length ?? 0} ${services?.length === 1 ? "serviço cadastrado" : "serviços cadastrados"} no seu catálogo.`
              : `${membershipPlans.length} ${membershipPlans.length === 1 ? "plano mensal configurado" : "planos mensais configurados"}.`
          }
          action={
            <Pressable
              onPress={subTab === "services" ? handleOpenCreateService : handleOpenCreatePlan}
              className="flex-row items-center gap-2 px-4 rounded-xl self-start"
              style={{
                backgroundColor: primaryColor,
                height: 40,
              }}
            >
              <Plus size={16} color={primaryForeground} strokeWidth={2.5} />
              <Text style={{ color: primaryForeground, fontSize: 13.5, fontWeight: "700" }}>
                {subTab === "services" ? "Novo serviço" : "Novo plano mensal"}
              </Text>
            </Pressable>
          }
        />

        {/* 2. Top Segmented Navigation: Serviços Avulsos | Planos Mensais */}
        <View
          className="flex-row p-1 rounded-2xl border"
          style={{
            backgroundColor: isDark ? "#121318" : "#f4f4f5",
            borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
          }}
        >
          <Pressable
            onPress={() => setSubTab("services")}
            className="flex-1 py-2.5 px-3 rounded-xl flex-row items-center justify-center gap-2"
            style={{
              backgroundColor:
                subTab === "services"
                  ? isDark
                    ? "#20222a"
                    : "#ffffff"
                  : "transparent",
              borderWidth: 1,
              borderColor:
                subTab === "services"
                  ? isDark
                    ? "rgba(255, 255, 255, 0.12)"
                    : "rgba(0, 0, 0, 0.08)"
                  : "transparent",
            }}
          >
            <Tag size={15} color={subTab === "services" ? primaryColor : "#71717a"} />
            <Text
              style={{
                color:
                  subTab === "services"
                    ? isDark
                      ? "#ffffff"
                      : "#18181b"
                    : "#71717a",
                fontSize: 13,
                fontWeight: subTab === "services" ? "700" : "500",
              }}
            >
              Serviços Avulsos
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setSubTab("memberships")}
            className="flex-1 py-2.5 px-3 rounded-xl flex-row items-center justify-center gap-2"
            style={{
              backgroundColor:
                subTab === "memberships"
                  ? isDark
                    ? "#20222a"
                    : "#ffffff"
                  : "transparent",
              borderWidth: 1,
              borderColor:
                subTab === "memberships"
                  ? isDark
                    ? "rgba(255, 255, 255, 0.12)"
                    : "rgba(0, 0, 0, 0.08)"
                  : "transparent",
            }}
          >
            <Layers size={15} color={subTab === "memberships" ? primaryColor : "#71717a"} />
            <Text
              style={{
                color:
                  subTab === "memberships"
                    ? isDark
                      ? "#ffffff"
                      : "#18181b"
                    : "#71717a",
                fontSize: 13,
                fontWeight: subTab === "memberships" ? "700" : "500",
              }}
            >
              Planos Mensais
            </Text>
          </Pressable>
        </View>

        {subTab === "memberships" ? (
          /* View: Planos Mensais */
          membershipPlans.length === 0 ? (
            <View
              className="p-6 rounded-2xl border items-center text-center gap-3"
              style={{ backgroundColor: "#121318", borderColor: "rgba(255, 255, 255, 0.08)" }}
            >
              <Layers size={36} color={primaryColor} />
              <Text style={{ color: "#ffffff", fontSize: 17, fontWeight: "700", textAlign: "center" }}>
                Nenhum plano mensal cadastrado
              </Text>
              <Text style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", lineHeight: 18 }}>
                Crie planos recorrentes para fidelizar seus clientes com agendamentos automáticos e receita previsível.
              </Text>
              <Pressable
                onPress={handleOpenCreatePlan}
                className="mt-2 px-4 py-2.5 rounded-xl border flex-row items-center gap-2"
                style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
              >
                <Plus size={16} color={primaryForeground} strokeWidth={2.5} />
                <Text style={{ color: primaryForeground, fontSize: 13, fontWeight: "700" }}>
                  Cadastrar Primeiro Plano
                </Text>
              </Pressable>
            </View>
          ) : (
            <View className="gap-3">
              {membershipPlans.map((plan) => {
                const freqLabel =
                  plan.frequencyType === "WEEKLY_CALENDAR_BASED"
                    ? plan.weeklyFrequency === 1
                      ? "Semanal (4 a 5 sessões/mês)"
                      : `${plan.weeklyFrequency}x por semana`
                    : `${plan.sessionsPerPeriod} sessões/mês (fixo)`;

                return (
                  <View
                    key={plan.id}
                    className="p-4 rounded-2xl border gap-3"
                    style={{
                      backgroundColor: "#16171c",
                      borderColor: "rgba(255, 255, 255, 0.08)",
                      opacity: plan.active ? 1 : 0.65,
                    }}
                  >
                    {/* Top row: Frequency Badge + Edit action */}
                    <View className="flex-row items-center justify-between">
                      <View
                        className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full border"
                        style={{
                          backgroundColor: "#1c1d24",
                          borderColor: plan.badgeColor ? hexToRgba(plan.badgeColor, 0.4) : "rgba(255, 255, 255, 0.12)",
                        }}
                      >
                        <Calendar size={11} color={plan.badgeColor || primaryColor} />
                        <Text
                          style={{
                            color: plan.badgeColor || primaryColor,
                            fontSize: 11,
                            fontWeight: "700",
                          }}
                        >
                          {freqLabel}
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => handleOpenEditPlan(plan)}
                        className="p-1.5 rounded-lg border"
                        style={{
                          backgroundColor: "#20222a",
                          borderColor: "rgba(255, 255, 255, 0.12)",
                        }}
                      >
                        <Pencil size={13} color="#ffffff" />
                      </Pressable>
                    </View>

                    {/* Title + Description */}
                    <View className="gap-0.5">
                      <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "700" }}>{plan.name}</Text>
                      {Boolean(plan.description) && (
                        <Text style={{ color: "#9ca3af", fontSize: 12.5, lineHeight: 17 }}>
                          {plan.description}
                        </Text>
                      )}
                    </View>

                    {/* Price Block */}
                    <View
                      className="flex-row items-center justify-between p-3 rounded-xl border"
                      style={{
                        backgroundColor: "#111215",
                        borderColor: "rgba(255, 255, 255, 0.06)",
                      }}
                    >
                      <View>
                        <Text style={{ color: "#71717a", fontSize: 11, fontWeight: "600" }}>Mensalidade</Text>
                        <View className="flex-row items-baseline gap-1">
                          <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "800" }}>
                            {formatBRL(plan.price)}
                          </Text>
                          <Text style={{ color: "#9ca3af", fontSize: 11 }}>/mês</Text>
                        </View>
                      </View>

                      <View className="items-end">
                        <Text style={{ color: "#71717a", fontSize: 11, fontWeight: "600" }}>Cobrança</Text>
                        <Text style={{ color: "#d1d5db", fontSize: 12.5, fontWeight: "700" }}>Presencial</Text>
                      </View>
                    </View>

                    {/* Services Included List */}
                    {Boolean(plan.services && plan.services.length > 0) && (
                      <View className="gap-1.5 pt-1">
                        <Text style={{ color: "#9ca3af", fontSize: 11, fontWeight: "700", textTransform: "uppercase" }}>
                          Serviços Incluídos
                        </Text>
                        <View className="gap-1">
                          {plan.services?.map((s) => (
                            <View key={s.id} className="flex-row items-center justify-between py-0.5">
                              <View className="flex-row items-center gap-1.5 flex-1 mr-2">
                                <CheckCircle2 size={12} color={primaryColor} />
                                <Text numberOfLines={1} style={{ color: "#ffffff", fontSize: 12, fontWeight: "500" }}>
                                  {s.name}
                                </Text>
                              </View>
                              <Text style={{ color: "#71717a", fontSize: 11 }}>
                                {s.price != null ? formatBRL(s.price) : ""}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )
        ) : (
          /* View: Serviços Avulsos */
          <>
            {/* 3. Filter Tabs / Chips: Todos | Ativos | Inativos */}
            <ResponsiveTabs
              tabs={[
                { id: "Todos", label: "Todos", count: counts.all },
                { id: "Ativos", label: "Ativos", count: counts.active },
                { id: "Inativos", label: "Inativos", count: counts.inactive },
              ]}
              activeTab={filter}
              onChange={(id) => setFilter(id as Filter)}
            />

            {/* 4. Service Cards Grid */}
            {loading ? (
              <View className="py-16 items-center justify-center">
                <ActivityIndicator color={primaryColor} />
              </View>
            ) : error ? (
              <View className="py-12 items-center justify-center p-6 gap-3">
                <Text style={{ color: colors.textSecondary, textAlign: "center" }}>{error}</Text>
                <Button label="Tentar novamente" onPress={loadAll} />
              </View>
            ) : visibleServices.length === 0 ? (
              <View className="items-center gap-2 py-16">
                <Tag size={32} color={colors.textMuted} />
                <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "600" }}>Nenhum serviço encontrado</Text>
                <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: "center" }}>
                  Cadastre serviços avulsos para exibir na sua página e agenda.
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                {visibleServices.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    onToggled={handleToggled}
                    onEdit={handleOpenEditService}
                    onDelete={handleDeleteService}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Complete Redesigned Service Editor Modal */}
      <ServiceEditorModal
        visible={modalVisible}
        service={selectedService}
        categories={categories}
        employees={employees}
        onClose={() => {
          setModalVisible(false);
          setSelectedService(null);
        }}
        onSaved={loadAll}
        onCategoriesUpdated={loadCategories}
        onDeleteService={handleDeleteService}
      />

      {/* Complete Redesigned Membership Plan Editor Modal */}
      <MembershipPlanEditorModal
        visible={membershipModalVisible}
        plan={selectedPlan}
        services={services || []}
        employees={employees}
        onClose={() => {
          setMembershipModalVisible(false);
          setSelectedPlan(null);
        }}
        onSaved={loadAll}
        onDeletePlan={handleDeletePlan}
      />
    </Screen>
  );
}
