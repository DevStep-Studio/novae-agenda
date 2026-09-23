import {
  Briefcase,
  Check,
  ImagePlus,
  Lock,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Scissors,
  ShieldCheck,
  Trash2,
  Upload,
  User,
  UserPlus,
  X,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";

import { useTheme, hexToRgba } from "@/hooks/use-theme";
import { api } from "@/lib/api-client";
import type { EmployeeDTO } from "@/lib/employees";
import type { ServiceDTO } from "@/lib/services";

export const BANNER_PRESETS = [
  {
    id: "dark-minimal",
    name: "Minimal Escuro",
    url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "studio-noir",
    name: "Studio Noir",
    url: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "slate-flat",
    name: "Ardósia Flat",
    url: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "abstract-grid",
    name: "Linhas Modernas",
    url: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1200&q=80",
  },
];

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 11) {
    const isNineDigit = digits.length > 10;
    const splitIndex = isNineDigit ? 7 : 6;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, splitIndex)}-${digits.slice(splitIndex, 11)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

function getInitialLetter(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "P";
  return trimmed[0].toUpperCase();
}

export interface EmployeeEditorModalProps {
  visible: boolean;
  employee: EmployeeDTO | null;
  services: ServiceDTO[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDeleteEmployee?: (employee: EmployeeDTO) => Promise<void>;
}

export function EmployeeEditorModal({
  visible,
  employee,
  services,
  onClose,
  onSaved,
  onDeleteEmployee,
}: EmployeeEditorModalProps) {
  const { primaryColor, primaryForeground } = useTheme();

  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("Profissional");
  const [phone, setPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState(BANNER_PRESETS[0].url);
  const [serviceIds, setServiceIds] = useState<string[]>([]);

  // System access
  const [grantAccess, setGrantAccess] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!visible) return;

    if (employee) {
      setName(employee.name || "");
      setJobTitle(employee.jobTitle || "Profissional");
      setPhone(employee.phone ? maskPhone(employee.phone) : "");
      setPhotoUrl(employee.photoUrl || null);
      setBannerUrl(employee.bannerUrl || BANNER_PRESETS[0].url);

      const sIds =
        employee.serviceIds && employee.serviceIds.length > 0
          ? employee.serviceIds
          : services.filter((s) => employee.services?.includes(s.name)).map((s) => s.id);
      setServiceIds(sIds);

      setGrantAccess(Boolean(employee.hasLogin || employee.email));
      setEmail(employee.email || "");
      setPassword("");
    } else {
      setName("");
      setJobTitle("Profissional");
      setPhone("");
      setPhotoUrl(null);
      setBannerUrl(BANNER_PRESETS[0].url);
      setServiceIds(services.map((s) => s.id));
      setGrantAccess(false);
      setEmail("");
      setPassword("");
    }
  }, [visible, employee, services]);

  const handlePickPhoto = async () => {
    setUploadingPhoto(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        base64: true,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const dataUrl = asset.base64
          ? `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`
          : asset.uri;
        setPhotoUrl(dataUrl);
      }
    } catch {
      Alert.alert("Erro", "Não foi possível carregar a foto.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePickBanner = async () => {
    setUploadingBanner(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [16, 9],
        base64: true,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const dataUrl = asset.base64
          ? `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`
          : asset.uri;
        setBannerUrl(dataUrl);
      }
    } catch {
      Alert.alert("Erro", "Não foi possível carregar a imagem do banner.");
    } finally {
      setUploadingBanner(false);
    }
  };

  const toggleService = (id: string) => {
    setServiceIds((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Erro", "O nome do profissional é obrigatório.");
      return;
    }

    if (grantAccess && !email.trim()) {
      Alert.alert("Erro", "Informe o e-mail para acesso ao sistema.");
      return;
    }

    if (grantAccess && !employee && password.length < 6) {
      Alert.alert("Erro", "A senha inicial deve ter no mínimo 6 caracteres.");
      return;
    }

    setBusy(true);
    try {
      const payload: any = {
        name: name.trim(),
        jobTitle: jobTitle.trim() || "Profissional",
        phone: phone.trim() || undefined,
        serviceIds,
        photoUrl: photoUrl || null,
        bannerUrl: bannerUrl.trim() || BANNER_PRESETS[0].url,
        grantAccess,
        email: grantAccess ? email.trim() : undefined,
      };

      if (grantAccess && password.trim()) {
        payload.password = password.trim();
      }

      if (employee) {
        await api(`/api/employees/${employee.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        Alert.alert("Sucesso", "Profissional atualizado com sucesso!");
      } else {
        await api("/api/employees", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        Alert.alert("Sucesso", "Profissional adicionado com sucesso!");
      }

      await onSaved();
      onClose();
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível salvar o profissional.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!employee || busy || deleting || !onDeleteEmployee) return;
    setDeleting(true);
    try {
      await onDeleteEmployee(employee);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-end"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.82)" }}
      >
        <View
          className="w-full rounded-t-3xl border-t overflow-hidden"
          style={{
            maxHeight: "94%",
            backgroundColor: "#111215",
            borderColor: "rgba(255, 255, 255, 0.12)",
          }}
        >
          {/* 1. Header */}
          <View
            className="flex-row items-center justify-between px-5 pt-4 pb-3.5 border-b"
            style={{ borderBottomColor: "rgba(255, 255, 255, 0.08)" }}
          >
            <View className="flex-row items-center gap-2">
              <UserPlus size={18} color={primaryColor} />
              <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "800", letterSpacing: -0.3 }}>
                {employee ? "Editar profissional" : "Adicionar profissional"}
              </Text>
            </View>
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
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 30, gap: 16 }}
          >
            {/* 1. Foto do profissional Card */}
            <View
              className="flex-row items-center gap-4 p-4 rounded-2xl border"
              style={{
                backgroundColor: "#16171c",
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              {photoUrl ? (
                <Image
                  source={{ uri: photoUrl }}
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 30,
                    borderWidth: 1.5,
                    borderColor: "rgba(255, 255, 255, 0.15)",
                  }}
                  contentFit="cover"
                />
              ) : (
                <View
                  className="items-center justify-center rounded-full border"
                  style={{
                    width: 60,
                    height: 60,
                    backgroundColor: "#1c1d24",
                    borderColor: "rgba(255, 255, 255, 0.12)",
                  }}
                >
                  <Text style={{ color: primaryColor, fontSize: 22, fontWeight: "800" }}>
                    {getInitialLetter(name)}
                  </Text>
                </View>
              )}

              <View className="flex-1 gap-1">
                <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "700" }}>
                  Foto do profissional
                </Text>
                <Text style={{ color: "#9ca3af", fontSize: 11 }}>
                  JPG, JPEG, PNG ou WEBP · até 5MB
                </Text>
                <View className="flex-row items-center gap-2 mt-1">
                  <Pressable
                    onPress={handlePickPhoto}
                    disabled={uploadingPhoto}
                    className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg border"
                    style={{
                      backgroundColor: "#1c1d24",
                      borderColor: "rgba(255, 255, 255, 0.12)",
                    }}
                  >
                    {uploadingPhoto ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <ImagePlus size={13} color="#ffffff" />
                        <Text style={{ color: "#ffffff", fontSize: 11.5, fontWeight: "600" }}>
                          {photoUrl ? "Alterar foto" : "Adicionar foto"}
                        </Text>
                      </>
                    )}
                  </Pressable>

                  {Boolean(photoUrl) && (
                    <Pressable
                      onPress={() => setPhotoUrl(null)}
                      className="flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-lg border"
                      style={{
                        backgroundColor: "rgba(239, 68, 68, 0.1)",
                        borderColor: "rgba(239, 68, 68, 0.3)",
                      }}
                    >
                      <Trash2 size={12} color="#ef4444" />
                      <Text style={{ color: "#ef4444", fontSize: 11, fontWeight: "600" }}>Remover</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>

            {/* 2. Nome completo */}
            <View className="gap-1.5">
              <View className="flex-row items-center gap-1.5">
                <User size={13} color={primaryColor} />
                <Text style={{ color: "#d1d5db", fontSize: 12, fontWeight: "600" }}>
                  Nome completo
                </Text>
              </View>
              <View
                className="flex-row items-center px-3.5 rounded-xl border"
                style={{
                  backgroundColor: "#16171c",
                  borderColor: "rgba(255, 255, 255, 0.1)",
                  height: 44,
                }}
              >
                <User size={15} color="#6b7280" style={{ marginRight: 8 }} />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Ex.: Beatriz Ramos"
                  placeholderTextColor="#6b7280"
                  className="flex-1 text-white text-sm"
                  style={{ height: 44 }}
                />
              </View>
            </View>

            {/* 3. Cargo ou especialidade */}
            <View className="gap-1.5">
              <View className="flex-row items-center gap-1.5">
                <Briefcase size={13} color={primaryColor} />
                <Text style={{ color: "#d1d5db", fontSize: 12, fontWeight: "600" }}>
                  Cargo ou especialidade
                </Text>
              </View>
              <View
                className="flex-row items-center px-3.5 rounded-xl border"
                style={{
                  backgroundColor: "#16171c",
                  borderColor: "rgba(255, 255, 255, 0.1)",
                  height: 44,
                }}
              >
                <Briefcase size={15} color="#6b7280" style={{ marginRight: 8 }} />
                <TextInput
                  value={jobTitle}
                  onChangeText={setJobTitle}
                  placeholder="Profissional"
                  placeholderTextColor="#6b7280"
                  className="flex-1 text-white text-sm"
                  style={{ height: 44 }}
                />
              </View>
            </View>

            {/* 4. Telefone / WhatsApp */}
            <View className="gap-1.5">
              <View className="flex-row items-center gap-1.5">
                <Phone size={13} color={primaryColor} />
                <Text style={{ color: "#d1d5db", fontSize: 12, fontWeight: "600" }}>
                  Telefone / WhatsApp
                </Text>
              </View>
              <View
                className="flex-row items-center px-3.5 rounded-xl border"
                style={{
                  backgroundColor: "#16171c",
                  borderColor: "rgba(255, 255, 255, 0.1)",
                  height: 44,
                }}
              >
                <Phone size={15} color="#6b7280" style={{ marginRight: 8 }} />
                <TextInput
                  value={phone}
                  onChangeText={(val) => setPhone(maskPhone(val))}
                  placeholder="(11) 99999-9999"
                  placeholderTextColor="#6b7280"
                  keyboardType="phone-pad"
                  maxLength={15}
                  className="flex-1 text-white text-sm"
                  style={{ height: 44 }}
                />
              </View>
            </View>

            {/* 5. Serviços que realiza */}
            <View className="gap-2">
              <View className="flex-row items-center gap-1.5">
                <Scissors size={13} color={primaryColor} />
                <Text style={{ color: "#d1d5db", fontSize: 12, fontWeight: "600" }}>
                  Serviços que realiza
                </Text>
              </View>

              {services.length > 0 ? (
                <View className="flex-row flex-wrap gap-2">
                  {services.map((svc) => {
                    const isSelected = serviceIds.includes(svc.id);
                    return (
                      <Pressable
                        key={svc.id}
                        onPress={() => toggleService(svc.id)}
                        className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl border"
                        style={{
                          backgroundColor: isSelected ? hexToRgba(primaryColor, 0.15) : "#16171c",
                          borderColor: isSelected ? primaryColor : "rgba(255, 255, 255, 0.08)",
                        }}
                      >
                        <Text
                          style={{
                            color: isSelected ? primaryColor : "#d1d5db",
                            fontSize: 12.5,
                            fontWeight: isSelected ? "700" : "500",
                          }}
                        >
                          {svc.name}
                        </Text>
                        {isSelected && <Check size={12} color={primaryColor} strokeWidth={2.5} />}
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={{ color: "#6b7280", fontSize: 12 }}>
                  Nenhum serviço cadastrado no catálogo.
                </Text>
              )}
            </View>

            {/* 6. Acesso ao sistema Card */}
            <View
              className="p-4 rounded-2xl border gap-3"
              style={{
                backgroundColor: "#16171c",
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3 flex-1 mr-2">
                  <View
                    className="items-center justify-center rounded-xl"
                    style={{
                      width: 36,
                      height: 36,
                      backgroundColor: hexToRgba(primaryColor, 0.15),
                    }}
                  >
                    <ShieldCheck size={18} color={primaryColor} />
                  </View>
                  <View className="flex-1">
                    <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "700" }}>
                      Acesso ao sistema
                    </Text>
                    <Text style={{ color: "#9ca3af", fontSize: 11, lineHeight: 15 }}>
                      Permite que este profissional acesse o sistema com login próprio.
                    </Text>
                  </View>
                </View>

                <Switch
                  value={grantAccess}
                  onValueChange={setGrantAccess}
                  trackColor={{ false: "#27272a", true: primaryColor }}
                  thumbColor="#ffffff"
                />
              </View>

              {grantAccess && (
                <View className="gap-3 pt-2 border-t" style={{ borderTopColor: "rgba(255, 255, 255, 0.08)" }}>
                  <View className="gap-1.5">
                    <Text style={{ color: "#d1d5db", fontSize: 12, fontWeight: "600" }}>
                      E-mail de acesso
                    </Text>
                    <View
                      className="flex-row items-center px-3.5 rounded-xl border"
                      style={{
                        backgroundColor: "#121316",
                        borderColor: "rgba(255, 255, 255, 0.1)",
                        height: 42,
                      }}
                    >
                      <Mail size={15} color="#6b7280" style={{ marginRight: 8 }} />
                      <TextInput
                        value={email}
                        onChangeText={setEmail}
                        placeholder="profissional@empresa.com"
                        placeholderTextColor="#6b7280"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        className="flex-1 text-white text-xs"
                        style={{ height: 42 }}
                      />
                    </View>
                  </View>

                  <View className="gap-1.5">
                    <Text style={{ color: "#d1d5db", fontSize: 12, fontWeight: "600" }}>
                      Senha inicial
                    </Text>
                    <View
                      className="flex-row items-center px-3.5 rounded-xl border"
                      style={{
                        backgroundColor: "#121316",
                        borderColor: "rgba(255, 255, 255, 0.1)",
                        height: 42,
                      }}
                    >
                      <Lock size={15} color="#6b7280" style={{ marginRight: 8 }} />
                      <TextInput
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Mínimo 6 caracteres"
                        placeholderTextColor="#6b7280"
                        secureTextEntry
                        className="flex-1 text-white text-xs"
                        style={{ height: 42 }}
                      />
                    </View>
                    <Text style={{ color: "#6b7280", fontSize: 11 }}>
                      O profissional poderá trocar a senha depois. Compartilhe com segurança.
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* 7. Banner de capa do card */}
            <View className="gap-2.5">
              <View className="flex-row items-center gap-1.5">
                <ImagePlus size={13} color={primaryColor} />
                <Text style={{ color: "#d1d5db", fontSize: 12, fontWeight: "600" }}>
                  Banner de capa do card
                </Text>
              </View>

              {/* Presets Grid */}
              <View className="flex-row flex-wrap gap-2">
                {BANNER_PRESETS.map((preset) => {
                  const isSelected = bannerUrl === preset.url;
                  return (
                    <Pressable
                      key={preset.id}
                      onPress={() => setBannerUrl(preset.url)}
                      className="rounded-xl overflow-hidden border justify-end p-2.5"
                      style={{
                        width: "48.5%",
                        height: 64,
                        borderColor: isSelected ? primaryColor : "rgba(255, 255, 255, 0.12)",
                        borderWidth: isSelected ? 2 : 1,
                      }}
                    >
                      <Image
                        source={{ uri: preset.url }}
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                        contentFit="cover"
                      />
                      <View
                        style={{
                          position: "absolute",
                          inset: 0,
                          backgroundColor: "rgba(0, 0, 0, 0.45)",
                        }}
                      />
                      <Text
                        numberOfLines={1}
                        style={{
                          color: "#ffffff",
                          fontSize: 11.5,
                          fontWeight: "700",
                          textShadowColor: "rgba(0,0,0,0.8)",
                          textShadowRadius: 3,
                        }}
                      >
                        {preset.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Upload or Custom URL row */}
              <View className="flex-row items-center gap-2 mt-1">
                <Pressable
                  onPress={handlePickBanner}
                  disabled={uploadingBanner}
                  className="flex-row items-center gap-1.5 px-3 py-2.5 rounded-xl border"
                  style={{
                    backgroundColor: "#16171c",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                  }}
                >
                  {uploadingBanner ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Upload size={13} color="#ffffff" />
                      <Text style={{ color: "#ffffff", fontSize: 11.5, fontWeight: "600" }}>
                        Subir foto (celular / PC)
                      </Text>
                    </>
                  )}
                </Pressable>

                <View
                  className="flex-1 px-3 rounded-xl border justify-center"
                  style={{
                    backgroundColor: "#16171c",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    height: 38,
                  }}
                >
                  <TextInput
                    value={bannerUrl}
                    onChangeText={setBannerUrl}
                    placeholder="Ou cole a URL de uma image..."
                    placeholderTextColor="#6b7280"
                    className="text-white text-xs"
                    style={{ height: 38 }}
                  />
                </View>
              </View>
              <Text style={{ color: "#6b7280", fontSize: 11 }}>
                Escolha uma imagem de capa para o card deste profissional.
              </Text>
            </View>
          </ScrollView>

          {/* 8. Sticky Footer Actions */}
          <View
            className="px-5 pt-3.5 pb-6 border-t gap-2.5"
            style={{
              backgroundColor: "#111215",
              borderTopColor: "rgba(255, 255, 255, 0.08)",
            }}
          >
            {Boolean(employee) && (
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
                    <Text style={{ color: "#ef4444", fontSize: 13, fontWeight: "600" }}>
                      Desativar profissional
                    </Text>
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
                backgroundColor: primaryColor,
                opacity: busy || deleting ? 0.7 : 1,
              }}
            >
              {busy ? (
                <ActivityIndicator size="small" color={primaryForeground} />
              ) : (
                <>
                  {employee ? (
                    <Check size={16} color={primaryForeground} strokeWidth={2.5} />
                  ) : (
                    <UserPlus size={16} color={primaryForeground} strokeWidth={2.5} />
                  )}
                  <Text style={{ color: primaryForeground, fontSize: 13.5, fontWeight: "700" }}>
                    {employee ? "Salvar alterações" : "Adicionar"}
                  </Text>
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
      </KeyboardAvoidingView>
    </Modal>
  );
}
