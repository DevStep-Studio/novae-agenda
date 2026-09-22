import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Coffee,
  Copy,
  ExternalLink,
  Film,
  Globe,
  Image as ImageIcon,
  Layers,
  ListOrdered,
  Moon,
  Palette,
  Percent,
  Plus,
  QrCode,
  RotateCcw,
  Search,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Sun,
  Tag,
  Trash2,
  Type,
  Upload,
  User,
  X,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { colors, radius, typography } from "@/constants/design-tokens";
import { useTheme } from "@/hooks/use-theme";
import { api, resolveImageUrl } from "@/lib/api-client";
import { getEmployees, type EmployeeDTO } from "@/lib/employees";
import { useSession } from "@/lib/session-context";
import { formatBRL } from "@/lib/stats";

type TabKey = "branding" | "carousel" | "link" | "schedules" | "extras";

type FontPackId =
  | "modern-sans"
  | "editorial-serif"
  | "friendly-rounded"
  | "classic-grotesk"
  | "elegant-display";

const FONT_OPTIONS: Array<{ id: FontPackId; name: string; desc: string }> = [
  { id: "modern-sans", name: "Moderno", desc: "Padrão Reservei — geométrico e limpo." },
  { id: "editorial-serif", name: "Editorial", desc: "Serifada com corpo de texto neutro." },
  { id: "friendly-rounded", name: "Amigável", desc: "Traços arredondados, tom acolhedor." },
  { id: "classic-grotesk", name: "Clássico", desc: "Grotesca única, sóbria e neutra." },
  { id: "elegant-display", name: "Elegante", desc: "Display sofisticado para marcas premium." },
];

const SUGGESTED_COLORS = [
  "#ccff00",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#eab308",
  "#696969",
  "#334155",
];

const DAYS_NAMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

type PromoItem = {
  id: string;
  type: "image" | "video";
  url: string;
  title?: string;
  subtitle?: string;
  badge?: string;
  linkUrl?: string;
  buttonText?: string;
};

type ScheduleDay = {
  id?: string;
  employeeId?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakStart: string | null;
  breakEnd: string | null;
  active: boolean;
};

type ProductItem = {
  id: string;
  name: string;
  price: number;
  active: boolean;
};

type CouponItem = {
  id: string;
  code: string;
  type: "percentage" | "fixed";
  value: number;
  active: boolean;
};

export default function LinkAgendamentoScreen() {
  const { session, refresh: refreshSession } = useSession();
  const { isDark, primaryColor: themePrimaryColor, setPrimaryColorOverride } = useTheme();

  const [activeTab, setActiveTab] = useState<TabKey>("branding");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // 1. Branding States
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverPosition, setCoverPosition] = useState<"top" | "center" | "bottom">("center");
  const [primaryColor, setPrimaryColor] = useState("#696969");
  const [bookingThemeMode, setBookingThemeMode] = useState<"auto" | "light" | "dark">("auto");
  const [fontFamily, setFontFamily] = useState<FontPackId>("friendly-rounded");
  const [copySubtitle, setCopySubtitle] = useState("Selecione o que deseja agendar.");
  const [copySearch, setCopySearch] = useState("Buscar serviço...");
  const [copyEmpty, setCopyEmpty] = useState("Os serviços estarão aqui em breve.");
  const [sectionsConfig, setSectionsConfig] = useState([
    { id: "search", label: "Busca e filtro por categoria", visible: true },
    { id: "photos", label: "Galeria de fotos do estabelecimento", visible: true },
    { id: "hours", label: "Horário de funcionamento e telefone", visible: true },
  ]);

  // 2. Promo Carousel States
  const [carouselEnabled, setCarouselEnabled] = useState(true);
  const [promoItems, setPromoItems] = useState<PromoItem[]>([
    {
      id: "arte-1",
      type: "image",
      url: "/uploads/branding/5bbad1da-4e62-475c-930c-15a013d52671.webp",
      title: "Combo Especial de Verão",
      badge: "20% OFF",
      subtitle: "Válido até o fim do mês em todos os serviços",
      linkUrl: "",
      buttonText: "Saiba mais",
    },
  ]);

  // 3. Link & Info States
  const [slug, setSlug] = useState(session?.company?.publicSlug || session?.company?.slug || "barbeariapelly");
  const [companyName, setCompanyName] = useState(session?.company?.name || "Barbearia Pelly");
  const [publicDescription, setPublicDescription] = useState((session?.company as any)?.publicDescription || "");
  const [businessType, setBusinessType] = useState(session?.company?.businessType || "Barbearia");
  const [address, setAddress] = useState(session?.company?.address || "");
  const [phone, setPhone] = useState(session?.company?.phone || "");
  const [whatsapp, setWhatsapp] = useState(session?.company?.whatsapp || "");
  const [instagram, setInstagram] = useState(session?.company?.instagram || "");
  const [cancellationHours, setCancellationHours] = useState("24");
  const [publicEnabled, setPublicEnabled] = useState(true);
  const [showPhone, setShowPhone] = useState(true);
  const [showInstagram, setShowInstagram] = useState(true);

  // 4. Schedules States
  const [employees, setEmployees] = useState<EmployeeDTO[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [schedules, setSchedules] = useState<ScheduleDay[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  // 5. Extras (Products & Coupons) States
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [allowProducts, setAllowProducts] = useState(true);
  const [newProductName, setNewProductName] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newCouponCode, setNewCouponCode] = useState("");
  const [newCouponType, setNewCouponType] = useState<"percentage" | "fixed">("percentage");
  const [newCouponValue, setNewCouponValue] = useState("");

  const publicUrl = `https://usereservei.com.br/${slug}`;

  // Load all initial data
  const loadAll = useCallback(async () => {
    try {
      // 1. Branding data
      const brandingRes = await api<any>("/api/business/branding").catch(() => null);
      if (brandingRes?.data) {
        const b = brandingRes.data;
        if (b.logoUrl) setLogoUrl(b.logoUrl);
        if (b.coverUrl) setCoverUrl(b.coverUrl);
        if (b.coverPosition) setCoverPosition(b.coverPosition);
        if (b.primaryColor) setPrimaryColor(b.primaryColor);
        if (b.bookingThemeMode) setBookingThemeMode(b.bookingThemeMode);
        if (b.bookingFontFamily) setFontFamily(b.bookingFontFamily);
        if (b.bookingCopyOverrides) {
          if (b.bookingCopyOverrides.heroSubtitle) setCopySubtitle(b.bookingCopyOverrides.heroSubtitle);
          if (b.bookingCopyOverrides.searchPlaceholder) setCopySearch(b.bookingCopyOverrides.searchPlaceholder);
          if (b.bookingCopyOverrides.emptyServicesTitle) setCopyEmpty(b.bookingCopyOverrides.emptyServicesTitle);
        }
        if (b.bookingSectionsConfig && Array.isArray(b.bookingSectionsConfig)) {
          setSectionsConfig((prev) =>
            prev.map((s) => {
              const found = b.bookingSectionsConfig.find((x: any) => x.id === s.id);
              return found ? { ...s, visible: found.visible } : s;
            })
          );
        }
        if (b.bookingPromoBanners) {
          setCarouselEnabled(Boolean(b.bookingPromoBanners.enabled));
          if (Array.isArray(b.bookingPromoBanners.items)) {
            setPromoItems(b.bookingPromoBanners.items);
          }
        }
      }

      // 2. Booking Settings
      const settingsRes = await api<any>("/api/booking-settings").catch(() => null);
      if (settingsRes) {
        const c = settingsRes.company;
        if (c) {
          if (c.publicSlug) setSlug(c.publicSlug);
          if (c.name) setCompanyName(c.name);
          if (c.publicDescription) setPublicDescription(c.publicDescription);
          if (c.businessType) setBusinessType(c.businessType);
          if (c.address) setAddress(c.address);
          if (c.phone) setPhone(c.phone);
          if (c.whatsapp) setWhatsapp(c.whatsapp);
          if (c.instagram) setInstagram(c.instagram);
          if (c.cancellationHours !== undefined) setCancellationHours(String(c.cancellationHours));
          if (c.publicEnabled !== undefined) setPublicEnabled(Boolean(c.publicEnabled));
          if (c.publicPhone !== undefined) setShowPhone(Boolean(c.publicPhone));
          if (c.publicInstagram !== undefined) setShowInstagram(Boolean(c.publicInstagram));
          if (c.allowProducts !== undefined) setAllowProducts(Boolean(c.allowProducts));
        }
        if (Array.isArray(settingsRes.products)) {
          setProducts(
            settingsRes.products.map((p: any) => ({
              id: p.id,
              name: p.name,
              price: Number(p.price || 0),
              active: Boolean(p.active),
            }))
          );
        }
        if (Array.isArray(settingsRes.coupons)) {
          setCoupons(
            settingsRes.coupons.map((c: any) => ({
              id: c.id,
              code: c.code,
              type: c.type === "fixed" ? "fixed" : "percentage",
              value: Number(c.value || 0),
              active: Boolean(c.active),
            }))
          );
        }
      }

      // 3. Employees list for Schedules tab
      const emps = await getEmployees().catch(() => []);
      setEmployees(emps);
      if (emps.length > 0 && !selectedEmployeeId) {
        setSelectedEmployeeId(emps[0].id);
      }
    } catch {
      // Keep state
    }
  }, [selectedEmployeeId]);

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

  // Load schedules when selected employee changes
  useEffect(() => {
    if (!selectedEmployeeId) return;
    let cancelled = false;
    async function loadEmpSchedules() {
      setLoadingSchedule(true);
      try {
        const res = await api<{ data: any[] }>(`/api/employees/${selectedEmployeeId}/schedules`);
        if (cancelled) return;
        const rows = res.data || [];
        const full: ScheduleDay[] = Array.from({ length: 7 }, (_, d) => {
          const found = rows.find((r) => r.dayOfWeek === d);
          if (found) {
            return {
              id: found.id,
              employeeId: selectedEmployeeId,
              dayOfWeek: d,
              startTime: (found.startTime || "09:00").slice(0, 5),
              endTime: (found.endTime || "19:00").slice(0, 5),
              breakStart: found.breakStart ? found.breakStart.slice(0, 5) : null,
              breakEnd: found.breakEnd ? found.breakEnd.slice(0, 5) : null,
              active: Boolean(found.active),
            };
          }
          return {
            employeeId: selectedEmployeeId,
            dayOfWeek: d,
            startTime: "09:00",
            endTime: "19:00",
            breakStart: "12:00",
            breakEnd: "13:00",
            active: d >= 1 && d <= 6,
          };
        });
        setSchedules(full);
      } catch {
        // Fallback default
      } finally {
        if (!cancelled) setLoadingSchedule(false);
      }
    }
    loadEmpSchedules();
    return () => {
      cancelled = true;
    };
  }, [selectedEmployeeId]);

  async function onRefresh() {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }

  // Copy URL
  const handleCopyLink = async () => {
    try {
      await Share.share({
        message: `Agende seu horário no(a) ${companyName}: ${publicUrl}`,
        url: publicUrl,
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      Alert.alert("Link copiado!", publicUrl);
    }
  };

  // Pick Logo from library
  const handlePickLogo = async () => {
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
        setLogoUrl(dataUrl);
        Alert.alert("Logo carregada", "Clique em 'Salvar alterações' para aplicar.");
      }
    } catch {
      Alert.alert("Erro", "Não foi possível selecionar a imagem.");
    }
  };

  // Pick Cover from library
  const handlePickCover = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [16, 5],
        base64: true,
        quality: 0.85,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const dataUrl = asset.base64
          ? `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`
          : asset.uri;
        setCoverUrl(dataUrl);
        Alert.alert("Capa carregada", "Clique em 'Salvar alterações' para aplicar.");
      }
    } catch {
      Alert.alert("Erro", "Não foi possível selecionar a imagem.");
    }
  };

  // Save Branding
  const handleSaveBranding = async () => {
    setBusy(true);
    try {
      await api("/api/business/branding", {
        method: "PUT",
        body: JSON.stringify({
          logoUrl,
          coverUrl,
          coverPosition,
          primaryColor,
          bookingThemeMode,
          bookingFontFamily: fontFamily,
          bookingCopyOverrides: {
            heroSubtitle: copySubtitle,
            searchPlaceholder: copySearch,
            emptyServicesTitle: copyEmpty,
          },
          bookingSectionsConfig: sectionsConfig.map((s) => ({ id: s.id, visible: s.visible })),
          bookingPromoBanners: {
            enabled: carouselEnabled,
            items: promoItems,
          },
        }),
      });

      if (setPrimaryColorOverride) {
        setPrimaryColorOverride(primaryColor);
      }
      await refreshSession();
      Alert.alert("Sucesso", "Identidade visual salva com sucesso!");
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível salvar a identidade visual.");
    } finally {
      setBusy(false);
    }
  };

  // Save Carousel
  const handleSaveCarousel = async () => {
    setBusy(true);
    try {
      await api("/api/business/branding", {
        method: "PUT",
        body: JSON.stringify({
          bookingPromoBanners: {
            enabled: carouselEnabled,
            items: promoItems,
          },
        }),
      });
      Alert.alert("Sucesso", "Carrossel promocional atualizado com sucesso!");
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível salvar o carrossel.");
    } finally {
      setBusy(false);
    }
  };

  // Save Link & Info
  const handleSaveLinkAndInfo = async () => {
    setBusy(true);
    try {
      await api("/api/booking-settings", {
        method: "PUT",
        body: JSON.stringify({
          slug: slug.trim(),
          enabled: publicEnabled,
          name: companyName.trim(),
          description: publicDescription.trim(),
          category: businessType.trim(),
          address: address.trim(),
          phone: phone.trim(),
          whatsapp: whatsapp.trim(),
          instagram: instagram.trim(),
          showPhone,
          showInstagram,
          cancellationHours: parseInt(cancellationHours, 10) || 24,
          allowProducts,
        }),
      });
      await refreshSession();
      Alert.alert("Sucesso", "Link e informações da empresa atualizados com sucesso!");
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível atualizar as informações.");
    } finally {
      setBusy(false);
    }
  };

  // Save Schedule
  const handleSaveSchedules = async () => {
    if (!selectedEmployeeId) return;
    setBusy(true);
    try {
      await api(`/api/employees/${selectedEmployeeId}/schedules`, {
        method: "PUT",
        body: JSON.stringify({ schedules }),
      });
      Alert.alert("Sucesso", "Horários salvos para este profissional!");
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível salvar os horários.");
    } finally {
      setBusy(false);
    }
  };

  // Quick Schedules helpers
  const handleApplyNoLunchAll = () => {
    setSchedules((prev) =>
      prev.map((s) => ({ ...s, breakStart: null, breakEnd: null }))
    );
  };

  const handleApplyStandardLunchAll = () => {
    setSchedules((prev) =>
      prev.map((s) => (s.active ? { ...s, breakStart: "12:00", breakEnd: "13:00" } : s))
    );
  };

  // Add Product
  const handleAddProduct = async () => {
    if (!newProductName.trim()) {
      Alert.alert("Erro", "Nome do produto é obrigatório.");
      return;
    }
    const priceNum = parseFloat(newProductPrice.replace(",", ".")) || 0;
    setBusy(true);
    try {
      await api("/api/booking-settings", {
        method: "POST",
        body: JSON.stringify({
          kind: "product",
          name: newProductName.trim(),
          price: priceNum,
          active: true,
        }),
      });
      setNewProductName("");
      setNewProductPrice("");
      await loadAll();
      Alert.alert("Sucesso", "Produto adicionado com sucesso!");
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível adicionar o produto.");
    } finally {
      setBusy(false);
    }
  };

  // Toggle Product Active
  const handleToggleProduct = async (prod: ProductItem) => {
    setBusy(true);
    try {
      await api("/api/booking-settings", {
        method: "POST",
        body: JSON.stringify({
          kind: "product",
          id: prod.id,
          name: prod.name,
          price: prod.price,
          active: !prod.active,
        }),
      });
      await loadAll();
    } catch {
      Alert.alert("Erro", "Não foi possível atualizar o produto.");
    } finally {
      setBusy(false);
    }
  };

  // Add Coupon
  const handleAddCoupon = async () => {
    if (!newCouponCode.trim()) {
      Alert.alert("Erro", "Código do cupom é obrigatório.");
      return;
    }
    const valNum = parseFloat(newCouponValue.replace(",", ".")) || 10;
    setBusy(true);
    try {
      await api("/api/booking-settings", {
        method: "POST",
        body: JSON.stringify({
          kind: "coupon",
          code: newCouponCode.trim().toUpperCase(),
          type: newCouponType,
          value: valNum,
          active: true,
        }),
      });
      setNewCouponCode("");
      setNewCouponValue("");
      await loadAll();
      Alert.alert("Sucesso", "Cupom criado com sucesso!");
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível criar o cupom.");
    } finally {
      setBusy(false);
    }
  };

  // Toggle Coupon Active
  const handleToggleCoupon = async (coup: CouponItem) => {
    setBusy(true);
    try {
      await api("/api/booking-settings", {
        method: "POST",
        body: JSON.stringify({
          kind: "coupon",
          id: coup.id,
          code: coup.code,
          type: coup.type,
          value: coup.value,
          active: !coup.active,
        }),
      });
      await loadAll();
    } catch {
      Alert.alert("Erro", "Não foi possível atualizar o cupom.");
    } finally {
      setBusy(false);
    }
  };

  // Promo Art Add / Remove / Move
  const handleAddPromoItem = () => {
    if (promoItems.length >= 3) {
      Alert.alert("Limite", "Você pode adicionar no máximo 3 artes.");
      return;
    }
    const newItem: PromoItem = {
      id: `arte-${Date.now()}`,
      type: "image",
      url: "",
      title: "",
      badge: "",
      subtitle: "",
      buttonText: "Saiba mais",
    };
    setPromoItems([...promoItems, newItem]);
  };

  const handleRemovePromoItem = (index: number) => {
    setPromoItems(promoItems.filter((_, i) => i !== index));
  };

  const handleMovePromoItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= promoItems.length) return;
    const copy = [...promoItems];
    const temp = copy[index];
    copy[index] = copy[target];
    copy[target] = temp;
    setPromoItems(copy);
  };

  const handlePickPromoImage = async (index: number) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 5],
        base64: true,
        quality: 0.85,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const dataUrl = asset.base64
          ? `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`
          : asset.uri;
        setPromoItems((prev) =>
          prev.map((item, i) => (i === index ? { ...item, url: dataUrl, type: "image" } : item))
        );
      }
    } catch {
      Alert.alert("Erro", "Não foi possível carregar a imagem.");
    }
  };

  // Section move
  const handleMoveSection = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sectionsConfig.length) return;
    const copy = [...sectionsConfig];
    const temp = copy[index];
    copy[index] = copy[target];
    copy[target] = temp;
    setSectionsConfig(copy);
  };

  return (
    <Screen
      header={<TopBar title="Link de agendamento" company={session?.company?.name || "Barbearia Pelly"} showBack={true} />}
      style={{ paddingTop: 14 }}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ gap: 16, paddingBottom: 110, paddingHorizontal: 4 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />
        }
      >
        {/* 1. Header: Eyebrow + Title + Subtitle */}
        <View className="gap-1">
          <Text
            style={{
              color: primaryColor || "#71717a",
              fontSize: 11,
              fontWeight: "700",
              letterSpacing: 0.8,
              textTransform: "uppercase",
            }}
          >
            SUA AGENDA, A UM CLIQUE DE DISTÂNCIA
          </Text>
          <Text
            style={{
              color: "#ffffff",
              fontSize: 26,
              fontWeight: "800",
              letterSpacing: -0.5,
            }}
          >
            Link de agendamento
          </Text>
          <Text style={{ color: "#9ca3af", fontSize: 13.5, marginTop: 2 }}>
            Receba reservas pelo Instagram, WhatsApp ou onde seus clientes estiverem.
          </Text>
        </View>

        {/* 2. Top Navigation Tabs Bar */}
        <View
          className="rounded-2xl border p-1.5"
          style={{
            backgroundColor: "#0f1014",
            borderColor: "rgba(255, 255, 255, 0.08)",
          }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6 }}
          >
            <Pressable
              onPress={() => setActiveTab("branding")}
              className="flex-row items-center gap-2 py-2.5 px-3.5 rounded-xl"
              style={{
                backgroundColor: activeTab === "branding" ? "#27272a" : "transparent",
                borderWidth: activeTab === "branding" ? 1 : 0,
                borderColor: "rgba(255, 255, 255, 0.15)",
              }}
            >
              <Palette size={15} color={activeTab === "branding" ? "#ffffff" : "#71717a"} />
              <Text
                style={{
                  color: activeTab === "branding" ? "#ffffff" : "#71717a",
                  fontSize: 13,
                  fontWeight: activeTab === "branding" ? "700" : "500",
                }}
              >
                Identidade & Branding Studio
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("carousel")}
              className="flex-row items-center gap-2 py-2.5 px-3.5 rounded-xl"
              style={{
                backgroundColor: activeTab === "carousel" ? "#27272a" : "transparent",
                borderWidth: activeTab === "carousel" ? 1 : 0,
                borderColor: "rgba(255, 255, 255, 0.15)",
              }}
            >
              <Film size={15} color={activeTab === "carousel" ? "#ffffff" : "#71717a"} />
              <Text
                style={{
                  color: activeTab === "carousel" ? "#ffffff" : "#71717a",
                  fontSize: 13,
                  fontWeight: activeTab === "carousel" ? "700" : "500",
                }}
              >
                Carrossel Promocional
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("link")}
              className="flex-row items-center gap-2 py-2.5 px-3.5 rounded-xl"
              style={{
                backgroundColor: activeTab === "link" ? "#27272a" : "transparent",
                borderWidth: activeTab === "link" ? 1 : 0,
                borderColor: "rgba(255, 255, 255, 0.15)",
              }}
            >
              <Globe size={15} color={activeTab === "link" ? "#ffffff" : "#71717a"} />
              <Text
                style={{
                  color: activeTab === "link" ? "#ffffff" : "#71717a",
                  fontSize: 13,
                  fontWeight: activeTab === "link" ? "700" : "500",
                }}
              >
                Link & Informações
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("schedules")}
              className="flex-row items-center gap-2 py-2.5 px-3.5 rounded-xl"
              style={{
                backgroundColor: activeTab === "schedules" ? "#27272a" : "transparent",
                borderWidth: activeTab === "schedules" ? 1 : 0,
                borderColor: "rgba(255, 255, 255, 0.15)",
              }}
            >
              <Clock size={15} color={activeTab === "schedules" ? "#ffffff" : "#71717a"} />
              <Text
                style={{
                  color: activeTab === "schedules" ? "#ffffff" : "#71717a",
                  fontSize: 13,
                  fontWeight: activeTab === "schedules" ? "700" : "500",
                }}
              >
                Horários da Equipe
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("extras")}
              className="flex-row items-center gap-2 py-2.5 px-3.5 rounded-xl"
              style={{
                backgroundColor: activeTab === "extras" ? "#27272a" : "transparent",
                borderWidth: activeTab === "extras" ? 1 : 0,
                borderColor: "rgba(255, 255, 255, 0.15)",
              }}
            >
              <ShoppingBag size={15} color={activeTab === "extras" ? "#ffffff" : "#71717a"} />
              <Text
                style={{
                  color: activeTab === "extras" ? "#ffffff" : "#71717a",
                  fontSize: 13,
                  fontWeight: activeTab === "extras" ? "700" : "500",
                }}
              >
                Produtos & Cupons
              </Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* TAB 1: IDENTIDADE & BRANDING STUDIO */}
        {activeTab === "branding" && (
          <View className="gap-4">
            {/* Branding Studio Header + Quick Save */}
            <View className="flex-row items-start justify-between gap-2">
              <View className="flex-1 gap-0.5">
                <Text style={{ color: "#71717a", fontSize: 11, fontWeight: "700", textTransform: "uppercase" }}>
                  BRANDING STUDIO
                </Text>
                <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "800" }}>
                  Identidade da sua página
                </Text>
                <Text style={{ color: "#9ca3af", fontSize: 12.5, lineHeight: 17 }}>
                  Personalize como seus clientes veem seu espaço ao agendar pelo seu link público.
                </Text>
              </View>

              <Pressable
                onPress={handleSaveBranding}
                disabled={busy}
                className="flex-row items-center gap-1.5 py-2.5 px-3.5 rounded-xl border"
                style={{
                  backgroundColor: "#27272a",
                  borderColor: "rgba(255, 255, 255, 0.16)",
                }}
              >
                <Check size={14} color="#ffffff" />
                <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "700" }}>
                  {busy ? "Salvando..." : "Salvar alterações"}
                </Text>
              </Pressable>
            </View>

            {/* Card: Logo da Empresa */}
            <View
              className="p-4 rounded-2xl border gap-3"
              style={{ backgroundColor: "#111216", borderColor: "rgba(255, 255, 255, 0.09)" }}
            >
              <View className="flex-row items-center gap-2 border-b pb-2.5" style={{ borderBottomColor: "rgba(255, 255, 255, 0.07)" }}>
                <ImageIcon size={16} color="#a1a1aa" />
                <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "700" }}>Logo da Empresa</Text>
              </View>

              <View className="flex-row items-center gap-4">
                <View
                  className="w-20 h-20 rounded-2xl overflow-hidden border items-center justify-center"
                  style={{
                    backgroundColor: "#181920",
                    borderColor: "rgba(255, 255, 255, 0.12)",
                  }}
                >
                  {logoUrl ? (
                    <Image source={{ uri: resolveImageUrl(logoUrl) || undefined }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  ) : (
                    <Text style={{ color: "#71717a", fontSize: 12 }}>Sem logo</Text>
                  )}
                </View>

                <View className="flex-1 gap-2">
                  <View className="flex-row flex-wrap gap-2">
                    <Pressable
                      onPress={handlePickLogo}
                      className="flex-row items-center gap-1.5 py-2 px-3 rounded-xl border"
                      style={{ backgroundColor: "#1a1b22", borderColor: "rgba(255, 255, 255, 0.12)" }}
                    >
                      <Upload size={13} color="#ffffff" />
                      <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "600" }}>Alterar logo</Text>
                    </Pressable>

                    <Pressable
                      onPress={handlePickLogo}
                      className="flex-row items-center gap-1.5 py-2 px-3 rounded-xl border"
                      style={{ backgroundColor: "rgba(16, 185, 129, 0.12)", borderColor: "rgba(16, 185, 129, 0.3)" }}
                    >
                      <Text style={{ color: "#34d399", fontSize: 12, fontWeight: "600" }}>Ajustar / Cortar</Text>
                    </Pressable>

                    {logoUrl && (
                      <Pressable
                        onPress={() => setLogoUrl(null)}
                        className="flex-row items-center gap-1 py-2 px-3 rounded-xl border"
                        style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", borderColor: "rgba(239, 68, 68, 0.3)" }}
                      >
                        <Trash2 size={13} color="#ef4444" />
                        <Text style={{ color: "#ef4444", fontSize: 12, fontWeight: "600" }}>Remover</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>

              <Text style={{ color: "#71717a", fontSize: 12 }}>
                PNG, JPG, WEBP ou SVG (máx. 5MB). Aparece no cabeçalho da página de agendamento.
              </Text>
            </View>

            {/* Card: Imagem de Capa */}
            <View
              className="p-4 rounded-2xl border gap-3"
              style={{ backgroundColor: "#111216", borderColor: "rgba(255, 255, 255, 0.09)" }}
            >
              <View className="flex-row items-center gap-2 border-b pb-2.5" style={{ borderBottomColor: "rgba(255, 255, 255, 0.07)" }}>
                <ImageIcon size={16} color="#a1a1aa" />
                <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "700" }}>Imagem de Capa</Text>
              </View>

              <View
                className="w-full h-28 rounded-2xl overflow-hidden border items-center justify-center"
                style={{
                  backgroundColor: "#181920",
                  borderColor: "rgba(255, 255, 255, 0.12)",
                }}
              >
                {coverUrl ? (
                  <Image source={{ uri: resolveImageUrl(coverUrl) || undefined }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                ) : (
                  <Text style={{ color: "#71717a", fontSize: 13 }}>Nenhuma capa configurada</Text>
                )}
              </View>

              <View className="flex-row flex-wrap gap-2">
                <Pressable
                  onPress={handlePickCover}
                  className="flex-row items-center gap-1.5 py-2 px-3 rounded-xl border"
                  style={{ backgroundColor: "#1a1b22", borderColor: "rgba(255, 255, 255, 0.12)" }}
                >
                  <Upload size={13} color="#ffffff" />
                  <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "600" }}>Alterar capa</Text>
                </Pressable>

                <Pressable
                  onPress={handlePickCover}
                  className="flex-row items-center gap-1.5 py-2 px-3 rounded-xl border"
                  style={{ backgroundColor: "rgba(16, 185, 129, 0.12)", borderColor: "rgba(16, 185, 129, 0.3)" }}
                >
                  <Text style={{ color: "#34d399", fontSize: 12, fontWeight: "600" }}>Ajustar / Cortar</Text>
                </Pressable>

                {coverUrl && (
                  <Pressable
                    onPress={() => setCoverUrl(null)}
                    className="flex-row items-center gap-1 py-2 px-3 rounded-xl border"
                    style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", borderColor: "rgba(239, 68, 68, 0.3)" }}
                  >
                    <Trash2 size={13} color="#ef4444" />
                    <Text style={{ color: "#ef4444", fontSize: 12, fontWeight: "600" }}>Remover</Text>
                  </Pressable>
                )}
              </View>

              <Text style={{ color: "#71717a", fontSize: 12 }}>
                Aparece no topo do link de agendamento. Recomendado: proporção 16:5 ou 1200x380.
              </Text>

              {/* Enquadramento da capa */}
              <View className="gap-1.5 pt-2 border-t" style={{ borderTopColor: "rgba(255, 255, 255, 0.07)" }}>
                <Text style={{ color: "#a1a1aa", fontSize: 12, fontWeight: "600" }}>Enquadramento da capa</Text>
                <View className="flex-row rounded-xl border p-1" style={{ backgroundColor: "#181920", borderColor: "rgba(255, 255, 255, 0.08)" }}>
                  {(["top", "center", "bottom"] as const).map((pos) => {
                    const label = pos === "top" ? "Topo" : pos === "center" ? "Centro" : "Base";
                    const isSelected = coverPosition === pos;
                    return (
                      <Pressable
                        key={pos}
                        onPress={() => setCoverPosition(pos)}
                        className="flex-1 py-2 rounded-lg items-center justify-center"
                        style={{
                          backgroundColor: isSelected ? "#27272a" : "transparent",
                          borderWidth: isSelected ? 1 : 0,
                          borderColor: "rgba(255, 255, 255, 0.15)",
                        }}
                      >
                        <Text style={{ color: isSelected ? "#ffffff" : "#71717a", fontSize: 12.5, fontWeight: isSelected ? "700" : "500" }}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Card: Cor da Marca */}
            <View
              className="p-4 rounded-2xl border gap-3.5"
              style={{ backgroundColor: "#111216", borderColor: "rgba(255, 255, 255, 0.09)" }}
            >
              <View className="flex-row items-center gap-2 border-b pb-2.5" style={{ borderBottomColor: "rgba(255, 255, 255, 0.07)" }}>
                <Palette size={16} color="#a1a1aa" />
                <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "700" }}>Cor da Marca</Text>
              </View>

              <View className="gap-2">
                <Text style={{ color: "#a1a1aa", fontSize: 12, fontWeight: "600" }}>Cor de destaque</Text>
                <View className="flex-row items-center gap-3">
                  <View
                    className="w-11 h-11 rounded-xl border"
                    style={{ backgroundColor: primaryColor, borderColor: "rgba(255, 255, 255, 0.2)" }}
                  />
                  <TextInput
                    value={primaryColor}
                    onChangeText={setPrimaryColor}
                    placeholder="#696969"
                    placeholderTextColor="#71717a"
                    autoCapitalize="none"
                    style={{
                      backgroundColor: "#181920",
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      borderWidth: 1,
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      height: 44,
                      width: 140,
                      color: "#ffffff",
                      fontSize: 14,
                      fontWeight: "700",
                    }}
                  />
                </View>
              </View>

              {/* Cores sugeridas */}
              <View className="gap-2">
                <Text style={{ color: "#71717a", fontSize: 11.5 }}>Cores sugeridas:</Text>
                <View className="flex-row flex-wrap gap-2.5">
                  {SUGGESTED_COLORS.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setPrimaryColor(c)}
                      className="w-8 h-8 rounded-full border items-center justify-center"
                      style={{
                        backgroundColor: c,
                        borderColor: primaryColor.toLowerCase() === c.toLowerCase() ? "#ffffff" : "transparent",
                        borderWidth: primaryColor.toLowerCase() === c.toLowerCase() ? 2.5 : 1,
                      }}
                    >
                      {primaryColor.toLowerCase() === c.toLowerCase() && (
                        <Check size={14} color={c === "#ccff00" || c === "#eab308" ? "#000" : "#fff"} strokeWidth={3} />
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Security contrast badge */}
              <View
                className="flex-row items-center gap-2.5 p-3 rounded-xl border"
                style={{ backgroundColor: "#15161b", borderColor: "rgba(255, 255, 255, 0.08)" }}
              >
                <ShieldCheck size={16} color="#34d399" />
                <Text style={{ color: "#a1a1aa", fontSize: 12, flex: 1, lineHeight: 16 }}>
                  Cor escura: o sistema usará <Text style={{ color: "#ffffff", fontWeight: "700" }}>texto branco</Text> nos botões com contraste ideal.
                </Text>
              </View>
            </View>

            {/* Card: Aparência da Página Pública */}
            <View
              className="p-4 rounded-2xl border gap-3"
              style={{ backgroundColor: "#111216", borderColor: "rgba(255, 255, 255, 0.09)" }}
            >
              <View className="flex-row items-center gap-2 border-b pb-2.5" style={{ borderBottomColor: "rgba(255, 255, 255, 0.07)" }}>
                <Sun size={16} color="#a1a1aa" />
                <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "700" }}>Aparência da Página Pública</Text>
              </View>

              <Text style={{ color: "#a1a1aa", fontSize: 12, fontWeight: "600" }}>Modo de visualização padrão</Text>
              <View className="flex-row rounded-xl border p-1" style={{ backgroundColor: "#181920", borderColor: "rgba(255, 255, 255, 0.08)" }}>
                {(["auto", "light", "dark"] as const).map((mode) => {
                  const label = mode === "auto" ? "Automático" : mode === "light" ? "Claro" : "Escuro";
                  const isSelected = bookingThemeMode === mode;
                  return (
                    <Pressable
                      key={mode}
                      onPress={() => setBookingThemeMode(mode)}
                      className="flex-1 py-2.5 rounded-lg flex-row items-center justify-center gap-1.5"
                      style={{
                        backgroundColor: isSelected ? "#27272a" : "transparent",
                        borderWidth: isSelected ? 1 : 0,
                        borderColor: "rgba(255, 255, 255, 0.15)",
                      }}
                    >
                      {mode === "auto" && <Sparkles size={14} color={isSelected ? "#ffffff" : "#71717a"} />}
                      {mode === "light" && <Sun size={14} color={isSelected ? "#ffffff" : "#71717a"} />}
                      {mode === "dark" && <Moon size={14} color={isSelected ? "#ffffff" : "#71717a"} />}
                      <Text style={{ color: isSelected ? "#ffffff" : "#71717a", fontSize: 12.5, fontWeight: isSelected ? "700" : "500" }}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={{ color: "#71717a", fontSize: 12 }}>
                "Automático" adapta-se às preferências de tema do celular/computador do visitante.
              </Text>
            </View>

            {/* Card: Tipografia */}
            <View
              className="p-4 rounded-2xl border gap-3"
              style={{ backgroundColor: "#111216", borderColor: "rgba(255, 255, 255, 0.09)" }}
            >
              <View className="flex-row items-center gap-2 border-b pb-2.5" style={{ borderBottomColor: "rgba(255, 255, 255, 0.07)" }}>
                <Type size={16} color="#a1a1aa" />
                <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "700" }}>Tipografia</Text>
              </View>

              <Text style={{ color: "#a1a1aa", fontSize: 12, fontWeight: "600" }}>Combinação de fontes</Text>
              <View className="flex-row flex-wrap gap-2.5">
                {FONT_OPTIONS.map((f) => {
                  const isSelected = fontFamily === f.id;
                  return (
                    <Pressable
                      key={f.id}
                      onPress={() => setFontFamily(f.id)}
                      className="py-3 px-4 rounded-xl border items-center justify-center min-w-[100px]"
                      style={{
                        backgroundColor: isSelected ? "#27272a" : "#181920",
                        borderColor: isSelected ? "#ffffff" : "rgba(255, 255, 255, 0.08)",
                        borderWidth: isSelected ? 1.5 : 1,
                      }}
                    >
                      <Text style={{ color: isSelected ? "#ffffff" : "#a1a1aa", fontSize: 16, fontWeight: "800" }}>
                        Aa
                      </Text>
                      <Text style={{ color: isSelected ? "#ffffff" : "#71717a", fontSize: 12, fontWeight: "600", marginTop: 2 }}>
                        {f.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={{ color: "#71717a", fontSize: 12 }}>
                {FONT_OPTIONS.find((f) => f.id === fontFamily)?.desc || "Traços arredondados, tom acolhedor."}
              </Text>
            </View>

            {/* Card: Textos da página */}
            <View
              className="p-4 rounded-2xl border gap-3"
              style={{ backgroundColor: "#111216", borderColor: "rgba(255, 255, 255, 0.09)" }}
            >
              <View className="flex-row items-center gap-2 border-b pb-2.5" style={{ borderBottomColor: "rgba(255, 255, 255, 0.07)" }}>
                <AlignLeft size={16} color="#a1a1aa" />
                <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "700" }}>Textos da página</Text>
              </View>

              <View className="gap-1.5">
                <Text style={{ color: "#a1a1aa", fontSize: 12, fontWeight: "600" }}>Subtítulo da etapa de serviços</Text>
                <TextInput
                  value={copySubtitle}
                  onChangeText={setCopySubtitle}
                  placeholder="Selecione o que deseja agendar."
                  placeholderTextColor="#71717a"
                  style={{
                    backgroundColor: "#181920",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    height: 42,
                    color: "#ffffff",
                    fontSize: 13.5,
                  }}
                />
              </View>

              <View className="gap-1.5">
                <Text style={{ color: "#a1a1aa", fontSize: 12, fontWeight: "600" }}>Texto do campo de busca</Text>
                <TextInput
                  value={copySearch}
                  onChangeText={setCopySearch}
                  placeholder="Buscar serviço..."
                  placeholderTextColor="#71717a"
                  style={{
                    backgroundColor: "#181920",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    height: 42,
                    color: "#ffffff",
                    fontSize: 13.5,
                  }}
                />
              </View>

              <View className="gap-1.5">
                <Text style={{ color: "#a1a1aa", fontSize: 12, fontWeight: "600" }}>Título quando não há serviços</Text>
                <TextInput
                  value={copyEmpty}
                  onChangeText={setCopyEmpty}
                  placeholder="Os serviços estarão aqui em breve."
                  placeholderTextColor="#71717a"
                  style={{
                    backgroundColor: "#181920",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    height: 42,
                    color: "#ffffff",
                    fontSize: 13.5,
                  }}
                />
              </View>
            </View>

            {/* Card: Seções da página */}
            <View
              className="p-4 rounded-2xl border gap-3"
              style={{ backgroundColor: "#111216", borderColor: "rgba(255, 255, 255, 0.09)" }}
            >
              <View className="flex-row items-center gap-2 border-b pb-2.5" style={{ borderBottomColor: "rgba(255, 255, 255, 0.07)" }}>
                <ListOrdered size={16} color="#a1a1aa" />
                <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "700" }}>Seções da página</Text>
              </View>

              <Text style={{ color: "#71717a", fontSize: 12.5 }}>
                Escolha quais blocos aparecem e em que ordem. O perfil do estabelecimento e a lista de serviços são sempre exibidos.
              </Text>

              <View className="gap-2">
                {sectionsConfig.map((sec, idx) => (
                  <View
                    key={sec.id}
                    className="flex-row items-center justify-between p-3 rounded-xl border"
                    style={{ backgroundColor: "#181920", borderColor: "rgba(255, 255, 255, 0.08)" }}
                  >
                    <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "600", flex: 1 }}>
                      {sec.label}
                    </Text>

                    <View className="flex-row items-center gap-3">
                      <Switch
                        value={sec.visible}
                        onValueChange={(val) =>
                          setSectionsConfig((prev) =>
                            prev.map((s, i) => (i === idx ? { ...s, visible: val } : s))
                          )
                        }
                        trackColor={{ false: "#27272a", true: primaryColor || "#22c55e" }}
                        thumbColor="#ffffff"
                      />

                      <View className="flex-col gap-1">
                        <Pressable
                          onPress={() => handleMoveSection(idx, -1)}
                          disabled={idx === 0}
                          className="p-1"
                          style={{ opacity: idx === 0 ? 0.3 : 1 }}
                        >
                          <ArrowUp size={14} color="#a1a1aa" />
                        </Pressable>
                        <Pressable
                          onPress={() => handleMoveSection(idx, 1)}
                          disabled={idx === sectionsConfig.length - 1}
                          className="p-1"
                          style={{ opacity: idx === sectionsConfig.length - 1 ? 0.3 : 1 }}
                        >
                          <ArrowDown size={14} color="#a1a1aa" />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Bottom Save Bar */}
            <View className="gap-2.5 mt-2">
              <Button
                label={busy ? "Salvando..." : "Salvar alterações"}
                onPress={handleSaveBranding}
                disabled={busy}
              />
              <Pressable
                onPress={loadAll}
                className="py-2.5 items-center justify-center flex-row gap-1.5"
              >
                <RotateCcw size={14} color="#71717a" />
                <Text style={{ color: "#71717a", fontSize: 13, fontWeight: "600" }}>Restaurar padrão</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* TAB 2: CARROSSEL PROMOCIONAL */}
        {activeTab === "carousel" && (
          <View className="gap-4">
            <View
              className="p-4 rounded-2xl border gap-4"
              style={{ backgroundColor: "#111216", borderColor: "rgba(255, 255, 255, 0.09)" }}
            >
              <View className="gap-1 border-b pb-3" style={{ borderBottomColor: "rgba(255, 255, 255, 0.07)" }}>
                <View className="flex-row items-center gap-2">
                  <Film size={16} color="#a1a1aa" />
                  <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "800" }}>
                    Carrossel Promocional
                  </Text>
                </View>
                <Text style={{ color: "#71717a", fontSize: 12.5, lineHeight: 17 }}>
                  Exiba de 1 até 3 artes promocionais (fotos ou vídeos) rotativas logo abaixo do resumo "Seu agendamento". Se o recurso estiver desligado ou sem mídias, nada será exibido.
                </Text>
              </View>

              {/* Toggle Switch */}
              <View
                className="flex-row items-center justify-between p-3.5 rounded-xl border"
                style={{ backgroundColor: "#181920", borderColor: "rgba(255, 255, 255, 0.08)" }}
              >
                <View>
                  <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "700" }}>
                    Ativar banner promocional na página
                  </Text>
                  <Text style={{ color: "#71717a", fontSize: 12 }}>
                    {promoItems.length} {promoItems.length === 1 ? "arte configurada" : "artes configuradas"}
                  </Text>
                </View>
                <Switch
                  value={carouselEnabled}
                  onValueChange={setCarouselEnabled}
                  trackColor={{ false: "#27272a", true: primaryColor || "#22c55e" }}
                  thumbColor="#ffffff"
                />
              </View>

              {/* Items List */}
              <View className="gap-4">
                {promoItems.map((item, idx) => (
                  <View
                    key={item.id}
                    className="p-4 rounded-xl border gap-3"
                    style={{ backgroundColor: "#16171d", borderColor: "rgba(255, 255, 255, 0.1)" }}
                  >
                    {/* Header: Arte #X + Actions */}
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2">
                        <View className="px-2 py-0.5 rounded-md" style={{ backgroundColor: "#27272a" }}>
                          <Text style={{ color: "#ffffff", fontSize: 11, fontWeight: "700" }}>
                            Arte #{idx + 1}
                          </Text>
                        </View>
                        <Text style={{ color: "#a1a1aa", fontSize: 12 }}>
                          {item.type === "video" ? "Vídeo" : "Foto / Imagem"}
                        </Text>
                      </View>

                      <View className="flex-row items-center gap-2">
                        <Pressable
                          onPress={() => handleMovePromoItem(idx, -1)}
                          disabled={idx === 0}
                          style={{ opacity: idx === 0 ? 0.3 : 1 }}
                        >
                          <ArrowUp size={15} color="#a1a1aa" />
                        </Pressable>
                        <Pressable
                          onPress={() => handleMovePromoItem(idx, 1)}
                          disabled={idx === promoItems.length - 1}
                          style={{ opacity: idx === promoItems.length - 1 ? 0.3 : 1 }}
                        >
                          <ArrowDown size={15} color="#a1a1aa" />
                        </Pressable>
                        <Pressable onPress={() => handleRemovePromoItem(idx)}>
                          <Trash2 size={15} color="#ef4444" />
                        </Pressable>
                      </View>
                    </View>

                    {/* Type Selector */}
                    <View className="flex-row rounded-lg border p-0.5" style={{ backgroundColor: "#1e1f26", borderColor: "rgba(255, 255, 255, 0.08)" }}>
                      <Pressable
                        onPress={() =>
                          setPromoItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, type: "image" } : it))
                          )
                        }
                        className="flex-1 py-1.5 rounded-md items-center justify-center flex-row gap-1"
                        style={{ backgroundColor: item.type === "image" ? "#2a2b34" : "transparent" }}
                      >
                        <ImageIcon size={13} color={item.type === "image" ? "#ffffff" : "#71717a"} />
                        <Text style={{ color: item.type === "image" ? "#ffffff" : "#71717a", fontSize: 11.5, fontWeight: "600" }}>
                          Imagem / Foto
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() =>
                          setPromoItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, type: "video" } : it))
                          )
                        }
                        className="flex-1 py-1.5 rounded-md items-center justify-center flex-row gap-1"
                        style={{ backgroundColor: item.type === "video" ? "#2a2b34" : "transparent" }}
                      >
                        <Film size={13} color={item.type === "video" ? "#ffffff" : "#71717a"} />
                        <Text style={{ color: item.type === "video" ? "#ffffff" : "#71717a", fontSize: 11.5, fontWeight: "600" }}>
                          Vídeo
                        </Text>
                      </Pressable>
                    </View>

                    {/* Media Preview & Upload */}
                    {item.url ? (
                      <View className="w-full h-36 rounded-xl overflow-hidden border" style={{ backgroundColor: "#000000", borderColor: "rgba(255, 255, 255, 0.1)" }}>
                        <Image source={{ uri: resolveImageUrl(item.url) || undefined }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                      </View>
                    ) : null}

                    <View className="flex-row items-center gap-2">
                      <Pressable
                        onPress={() => handlePickPromoImage(idx)}
                        className="flex-row items-center gap-1.5 py-2 px-3 rounded-lg border"
                        style={{ backgroundColor: "#202128", borderColor: "rgba(255, 255, 255, 0.1)" }}
                      >
                        <Upload size={13} color="#ffffff" />
                        <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "600" }}>
                          {item.url ? "Substituir arquivo" : "Escolher mídia"}
                        </Text>
                      </Pressable>

                      {item.url ? (
                        <Pressable
                          onPress={() =>
                            setPromoItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, url: "" } : it))
                            )
                          }
                          className="p-2"
                        >
                          <Text style={{ color: "#71717a", fontSize: 12 }}>Limpar mídia</Text>
                        </Pressable>
                      ) : null}
                    </View>

                    {/* Inputs */}
                    <View className="gap-2 pt-1">
                      <View className="gap-1">
                        <Text style={{ color: "#71717a", fontSize: 11 }}>Título da arte (opcional)</Text>
                        <TextInput
                          value={item.title || ""}
                          onChangeText={(val) =>
                            setPromoItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, title: val } : it))
                            )
                          }
                          placeholder="Ex: Combo Especial de Verão"
                          placeholderTextColor="#71717a"
                          style={{
                            backgroundColor: "#1e1f26",
                            borderColor: "rgba(255, 255, 255, 0.08)",
                            borderWidth: 1,
                            borderRadius: 8,
                            paddingHorizontal: 10,
                            height: 38,
                            color: "#ffffff",
                            fontSize: 13,
                          }}
                        />
                      </View>

                      <View className="gap-1">
                        <Text style={{ color: "#71717a", fontSize: 11 }}>Tag de destaque (opcional)</Text>
                        <TextInput
                          value={item.badge || ""}
                          onChangeText={(val) =>
                            setPromoItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, badge: val } : it))
                            )
                          }
                          placeholder="Ex: 20% OFF, Novidade, Destaque"
                          placeholderTextColor="#71717a"
                          style={{
                            backgroundColor: "#1e1f26",
                            borderColor: "rgba(255, 255, 255, 0.08)",
                            borderWidth: 1,
                            borderRadius: 8,
                            paddingHorizontal: 10,
                            height: 38,
                            color: "#ffffff",
                            fontSize: 13,
                          }}
                        />
                      </View>

                      <View className="gap-1">
                        <Text style={{ color: "#71717a", fontSize: 11 }}>Subtítulo / Descrição da chamada (opcional)</Text>
                        <TextInput
                          value={item.subtitle || ""}
                          onChangeText={(val) =>
                            setPromoItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, subtitle: val } : it))
                            )
                          }
                          placeholder="Ex: Válido até o fim do mês em todos os serviços"
                          placeholderTextColor="#71717a"
                          style={{
                            backgroundColor: "#1e1f26",
                            borderColor: "rgba(255, 255, 255, 0.08)",
                            borderWidth: 1,
                            borderRadius: 8,
                            paddingHorizontal: 10,
                            height: 38,
                            color: "#ffffff",
                            fontSize: 13,
                          }}
                        />
                      </View>

                      <View className="gap-1">
                        <Text style={{ color: "#71717a", fontSize: 11 }}>Link do botão (opcional)</Text>
                        <TextInput
                          value={item.linkUrl || ""}
                          onChangeText={(val) =>
                            setPromoItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, linkUrl: val } : it))
                            )
                          }
                          placeholder="Ex: https://wa.me/5511... ou página externa"
                          placeholderTextColor="#71717a"
                          style={{
                            backgroundColor: "#1e1f26",
                            borderColor: "rgba(255, 255, 255, 0.08)",
                            borderWidth: 1,
                            borderRadius: 8,
                            paddingHorizontal: 10,
                            height: 38,
                            color: "#ffffff",
                            fontSize: 13,
                          }}
                        />
                      </View>

                      <View className="gap-1">
                        <Text style={{ color: "#71717a", fontSize: 11 }}>Texto do botão</Text>
                        <TextInput
                          value={item.buttonText || "Saiba mais"}
                          onChangeText={(val) =>
                            setPromoItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, buttonText: val } : it))
                            )
                          }
                          placeholder="Saiba mais"
                          placeholderTextColor="#71717a"
                          style={{
                            backgroundColor: "#1e1f26",
                            borderColor: "rgba(255, 255, 255, 0.08)",
                            borderWidth: 1,
                            borderRadius: 8,
                            paddingHorizontal: 10,
                            height: 38,
                            color: "#ffffff",
                            fontSize: 13,
                          }}
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </View>

              {promoItems.length < 3 && (
                <Pressable
                  onPress={handleAddPromoItem}
                  className="py-3 items-center justify-center rounded-xl border border-dashed flex-row gap-2"
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.02)",
                    borderColor: "rgba(255, 255, 255, 0.15)",
                  }}
                >
                  <Plus size={16} color="#ffffff" />
                  <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "600" }}>
                    Adicionar outra arte ({promoItems.length}/3)
                  </Text>
                </Pressable>
              )}

              <Button
                label={busy ? "Salvando carrossel..." : "Salvar carrossel"}
                onPress={handleSaveCarousel}
                disabled={busy}
              />
            </View>
          </View>
        )}

        {/* TAB 3: LINK & INFORMAÇÕES */}
        {activeTab === "link" && (
          <View className="gap-4">
            {/* Card: Hero Link Oficial */}
            <View
              className="p-5 rounded-2xl border gap-4"
              style={{ backgroundColor: "#111216", borderColor: "rgba(255, 255, 255, 0.09)" }}
            >
              <View className="flex-row items-center gap-2.5">
                <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: "rgba(255, 255, 255, 0.06)" }}>
                  <Globe size={18} color="#ffffff" />
                </View>
                <View className="flex-1">
                  <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "800" }}>
                    Seu link oficial
                  </Text>
                  <Text style={{ color: "#71717a", fontSize: 12 }}>
                    Acessível em qualquer celular ou navegador
                  </Text>
                </View>
              </View>

              {/* URL Box */}
              <View
                className="flex-row items-center justify-between p-3 rounded-xl border"
                style={{ backgroundColor: "#181920", borderColor: "rgba(255, 255, 255, 0.08)" }}
              >
                <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700", flex: 1, marginRight: 8 }} numberOfLines={1}>
                  {publicUrl}
                </Text>

                <Pressable
                  onPress={handleCopyLink}
                  className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg border"
                  style={{
                    backgroundColor: copied ? "rgba(16, 185, 129, 0.15)" : "#27272a",
                    borderColor: copied ? "#10b981" : "rgba(255, 255, 255, 0.15)",
                  }}
                >
                  {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} color="#ffffff" />}
                  <Text style={{ color: copied ? "#10b981" : "#ffffff", fontSize: 12, fontWeight: "700" }}>
                    {copied ? "Copiado!" : "Copiar"}
                  </Text>
                </Pressable>
              </View>

              {/* Action Buttons: Compartilhar | Visualizar | QR Code */}
              <View className="flex-row gap-2">
                <Pressable
                  onPress={handleCopyLink}
                  className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl border"
                  style={{ backgroundColor: "#1c1d24", borderColor: "rgba(255, 255, 255, 0.1)" }}
                >
                  <Share2 size={15} color="#ffffff" />
                  <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "700" }}>Compartilhar</Text>
                </Pressable>

                <Pressable
                  onPress={() => Linking.openURL(publicUrl)}
                  className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl border"
                  style={{ backgroundColor: "#1c1d24", borderColor: "rgba(255, 255, 255, 0.1)" }}
                >
                  <ExternalLink size={15} color="#ffffff" />
                  <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "700" }}>Visualizar</Text>
                </Pressable>

                <Pressable
                  onPress={() => setShowQrModal(true)}
                  className="flex-row items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border"
                  style={{ backgroundColor: "#1c1d24", borderColor: "rgba(255, 255, 255, 0.1)" }}
                >
                  <QrCode size={15} color="#ffffff" />
                  <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "700" }}>QR Code</Text>
                </Pressable>
              </View>
            </View>

            {/* Card: Personalizar Endereço do Link */}
            <View
              className="p-5 rounded-2xl border gap-3"
              style={{ backgroundColor: "#111216", borderColor: "rgba(255, 255, 255, 0.09)" }}
            >
              <View className="gap-0.5">
                <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "700" }}>
                  Personalizar Endereço do Link
                </Text>
                <Text style={{ color: "#71717a", fontSize: 12 }}>
                  Escolha um endereço simples e memorável para sua marca.
                </Text>
              </View>

              <View
                className="flex-row items-center px-3 rounded-xl border"
                style={{ backgroundColor: "#181920", borderColor: "rgba(255, 255, 255, 0.1)", height: 44 }}
              >
                <Text style={{ color: "#71717a", fontSize: 13, fontWeight: "500" }}>
                  usereservei.com.br/
                </Text>
                <TextInput
                  value={slug}
                  onChangeText={(t) => setSlug(t.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="suaempresa"
                  placeholderTextColor="#71717a"
                  autoCapitalize="none"
                  style={{ flex: 1, color: "#ffffff", fontSize: 13.5, fontWeight: "700" }}
                />
              </View>
            </View>

            {/* Card: Visibilidade & Switches */}
            <View
              className="p-4 rounded-2xl border gap-3"
              style={{ backgroundColor: "#111216", borderColor: "rgba(255, 255, 255, 0.09)" }}
            >
              <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "700" }}>
                Status e Visibilidade Pública
              </Text>

              <View className="flex-row items-center justify-between py-2 border-b" style={{ borderBottomColor: "rgba(255, 255, 255, 0.06)" }}>
                <View>
                  <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "600" }}>Página pública de agendamento ativa</Text>
                  <Text style={{ color: "#71717a", fontSize: 11.5 }}>Permite que novos clientes façam reservas</Text>
                </View>
                <Switch
                  value={publicEnabled}
                  onValueChange={setPublicEnabled}
                  trackColor={{ false: "#27272a", true: primaryColor || "#22c55e" }}
                  thumbColor="#ffffff"
                />
              </View>

              <View className="flex-row items-center justify-between py-2 border-b" style={{ borderBottomColor: "rgba(255, 255, 255, 0.06)" }}>
                <View>
                  <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "600" }}>Exibir telefone na página pública</Text>
                  <Text style={{ color: "#71717a", fontSize: 11.5 }}>Mostra o número para contato direto</Text>
                </View>
                <Switch
                  value={showPhone}
                  onValueChange={setShowPhone}
                  trackColor={{ false: "#27272a", true: primaryColor || "#22c55e" }}
                  thumbColor="#ffffff"
                />
              </View>

              <View className="flex-row items-center justify-between py-2">
                <View>
                  <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "600" }}>Exibir perfil do Instagram</Text>
                  <Text style={{ color: "#71717a", fontSize: 11.5 }}>Adiciona link para seu perfil comercial</Text>
                </View>
                <Switch
                  value={showInstagram}
                  onValueChange={setShowInstagram}
                  trackColor={{ false: "#27272a", true: primaryColor || "#22c55e" }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>

            {/* Card: Dados do Estabelecimento */}
            <View
              className="p-4 rounded-2xl border gap-3"
              style={{ backgroundColor: "#111216", borderColor: "rgba(255, 255, 255, 0.09)" }}
            >
              <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "700" }}>
                Informações do Estabelecimento
              </Text>

              <View className="gap-1">
                <Text style={{ color: "#a1a1aa", fontSize: 12, fontWeight: "600" }}>Nome do estabelecimento</Text>
                <TextInput
                  value={companyName}
                  onChangeText={setCompanyName}
                  placeholder="Ex: Barbearia Pelly"
                  placeholderTextColor="#71717a"
                  style={{
                    backgroundColor: "#181920",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    height: 42,
                    color: "#ffffff",
                    fontSize: 13.5,
                  }}
                />
              </View>

              <View className="gap-1">
                <Text style={{ color: "#a1a1aa", fontSize: 12, fontWeight: "600" }}>Descrição pública</Text>
                <TextInput
                  value={publicDescription}
                  onChangeText={setPublicDescription}
                  placeholder="Conte um pouco sobre a experiência..."
                  placeholderTextColor="#71717a"
                  multiline
                  numberOfLines={3}
                  style={{
                    backgroundColor: "#181920",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    height: 70,
                    color: "#ffffff",
                    fontSize: 13,
                    textAlignVertical: "top",
                  }}
                />
              </View>

              <View className="gap-1">
                <Text style={{ color: "#a1a1aa", fontSize: 12, fontWeight: "600" }}>Categoria / Ramo de atuação</Text>
                <TextInput
                  value={businessType}
                  onChangeText={setBusinessType}
                  placeholder="Ex: Barbearia, Tatuagem, Estética"
                  placeholderTextColor="#71717a"
                  style={{
                    backgroundColor: "#181920",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    height: 42,
                    color: "#ffffff",
                    fontSize: 13.5,
                  }}
                />
              </View>

              <View className="gap-1">
                <Text style={{ color: "#a1a1aa", fontSize: 12, fontWeight: "600" }}>Endereço completo</Text>
                <TextInput
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Rua, número, bairro, cidade"
                  placeholderTextColor="#71717a"
                  style={{
                    backgroundColor: "#181920",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    height: 42,
                    color: "#ffffff",
                    fontSize: 13.5,
                  }}
                />
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1 gap-1">
                  <Text style={{ color: "#a1a1aa", fontSize: 12, fontWeight: "600" }}>WhatsApp</Text>
                  <TextInput
                    value={whatsapp}
                    onChangeText={setWhatsapp}
                    placeholder="(11) 98888-8888"
                    placeholderTextColor="#71717a"
                    keyboardType="phone-pad"
                    style={{
                      backgroundColor: "#181920",
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      borderWidth: 1,
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      height: 42,
                      color: "#ffffff",
                      fontSize: 13.5,
                    }}
                  />
                </View>

                <View className="flex-1 gap-1">
                  <Text style={{ color: "#a1a1aa", fontSize: 12, fontWeight: "600" }}>Instagram</Text>
                  <TextInput
                    value={instagram}
                    onChangeText={setInstagram}
                    placeholder="@seuperfil"
                    placeholderTextColor="#71717a"
                    autoCapitalize="none"
                    style={{
                      backgroundColor: "#181920",
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      borderWidth: 1,
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      height: 42,
                      color: "#ffffff",
                      fontSize: 13.5,
                    }}
                  />
                </View>
              </View>

              <View className="gap-1">
                <Text style={{ color: "#a1a1aa", fontSize: 12, fontWeight: "600" }}>
                  Cancelamento gratuito até (horas antes)
                </Text>
                <TextInput
                  value={cancellationHours}
                  onChangeText={setCancellationHours}
                  placeholder="24"
                  placeholderTextColor="#71717a"
                  keyboardType="numeric"
                  style={{
                    backgroundColor: "#181920",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    height: 42,
                    color: "#ffffff",
                    fontSize: 13.5,
                    width: 100,
                  }}
                />
              </View>

              <Button
                label={busy ? "Salvando informações..." : "Salvar informações"}
                onPress={handleSaveLinkAndInfo}
                disabled={busy}
              />
            </View>
          </View>
        )}

        {/* TAB 4: HORÁRIOS DA EQUIPE */}
        {activeTab === "schedules" && (
          <View className="gap-4">
            <View
              className="p-4 rounded-2xl border gap-4"
              style={{ backgroundColor: "#111216", borderColor: "rgba(255, 255, 255, 0.09)" }}
            >
              <View className="gap-1 border-b pb-3" style={{ borderBottomColor: "rgba(255, 255, 255, 0.07)" }}>
                <View className="flex-row items-center gap-2">
                  <Clock size={16} color="#a1a1aa" />
                  <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "800" }}>
                    Horários de Atendimento da Equipe
                  </Text>
                </View>
                <Text style={{ color: "#71717a", fontSize: 12.5 }}>
                  Defina os turnos e intervalos de almoço de cada profissional da barbearia/estúdio.
                </Text>
              </View>

              {/* Professional selector */}
              <View className="gap-2">
                <Text style={{ color: "#a1a1aa", fontSize: 12, fontWeight: "700" }}>
                  SELECIONE O PROFISSIONAL:
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {employees.map((emp) => {
                    const isSelected = emp.id === selectedEmployeeId;
                    return (
                      <Pressable
                        key={emp.id}
                        onPress={() => setSelectedEmployeeId(emp.id)}
                        className="flex-row items-center gap-2 py-2 px-3 rounded-xl border"
                        style={{
                          backgroundColor: isSelected ? "#27272a" : "#181920",
                          borderColor: isSelected ? "#ffffff" : "rgba(255, 255, 255, 0.08)",
                          borderWidth: isSelected ? 1.5 : 1,
                        }}
                      >
                        <Avatar name={emp.name} photoUrl={emp.photoUrl} size="sm" />
                        <Text style={{ color: isSelected ? "#ffffff" : "#a1a1aa", fontSize: 13, fontWeight: isSelected ? "700" : "500" }}>
                          {emp.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Quick Actions Toolbar */}
              <View className="flex-row gap-2 pt-1">
                <Pressable
                  onPress={handleApplyNoLunchAll}
                  className="flex-1 py-2 px-2.5 rounded-xl border items-center justify-center"
                  style={{ backgroundColor: "#1c1d24", borderColor: "rgba(255, 255, 255, 0.1)" }}
                >
                  <Text style={{ color: "#a1a1aa", fontSize: 11.5, fontWeight: "600" }}>
                    Sem almoço (todos)
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleApplyStandardLunchAll}
                  className="flex-1 py-2 px-2.5 rounded-xl border items-center justify-center"
                  style={{ backgroundColor: "#1c1d24", borderColor: "rgba(255, 255, 255, 0.1)" }}
                >
                  <Text style={{ color: "#a1a1aa", fontSize: 11.5, fontWeight: "600" }}>
                    Almoço padrão 1h (todos)
                  </Text>
                </Pressable>
              </View>

              {/* Schedules Days List */}
              {loadingSchedule ? (
                <View className="py-12 items-center justify-center">
                  <ActivityIndicator color={primaryColor} />
                </View>
              ) : (
                <View className="gap-3">
                  {schedules.map((sch, idx) => (
                    <View
                      key={sch.dayOfWeek}
                      className="p-3.5 rounded-xl border gap-2.5"
                      style={{
                        backgroundColor: sch.active ? "#181920" : "#131418",
                        borderColor: sch.active ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.05)",
                        opacity: sch.active ? 1 : 0.6,
                      }}
                    >
                      <View className="flex-row items-center justify-between">
                        <Text style={{ color: sch.active ? "#ffffff" : "#71717a", fontSize: 14, fontWeight: "700" }}>
                          {DAYS_NAMES[sch.dayOfWeek]}
                        </Text>
                        <Switch
                          value={sch.active}
                          onValueChange={(val) =>
                            setSchedules((prev) =>
                              prev.map((s, i) => (i === idx ? { ...s, active: val } : s))
                            )
                          }
                          trackColor={{ false: "#27272a", true: primaryColor || "#22c55e" }}
                          thumbColor="#ffffff"
                        />
                      </View>

                      {sch.active && (
                        <View className="gap-2.5 pt-2 border-t" style={{ borderTopColor: "rgba(255, 255, 255, 0.06)" }}>
                          {/* Turno de Trabalho */}
                          <View className="flex-row items-center gap-2">
                            <Text style={{ color: "#a1a1aa", fontSize: 11.5, width: 55 }}>Turno:</Text>
                            <TextInput
                              value={sch.startTime}
                              onChangeText={(val) =>
                                setSchedules((prev) =>
                                  prev.map((s, i) => (i === idx ? { ...s, startTime: val } : s))
                                )
                              }
                              placeholder="09:00"
                              placeholderTextColor="#71717a"
                              style={{
                                backgroundColor: "#22232b",
                                borderColor: "rgba(255, 255, 255, 0.1)",
                                borderWidth: 1,
                                borderRadius: 8,
                                paddingHorizontal: 8,
                                height: 34,
                                width: 72,
                                color: "#ffffff",
                                fontSize: 13,
                                textAlign: "center",
                              }}
                            />
                            <Text style={{ color: "#71717a", fontSize: 12 }}>até</Text>
                            <TextInput
                              value={sch.endTime}
                              onChangeText={(val) =>
                                setSchedules((prev) =>
                                  prev.map((s, i) => (i === idx ? { ...s, endTime: val } : s))
                                )
                              }
                              placeholder="19:00"
                              placeholderTextColor="#71717a"
                              style={{
                                backgroundColor: "#22232b",
                                borderColor: "rgba(255, 255, 255, 0.1)",
                                borderWidth: 1,
                                borderRadius: 8,
                                paddingHorizontal: 8,
                                height: 34,
                                width: 72,
                                color: "#ffffff",
                                fontSize: 13,
                                textAlign: "center",
                              }}
                            />
                          </View>

                          {/* Intervalo de Almoço */}
                          <View className="flex-row items-center justify-between pt-1">
                            <View className="flex-row items-center gap-1.5">
                              <Coffee size={13} color="#a1a1aa" />
                              <Text style={{ color: "#a1a1aa", fontSize: 11.5 }}>Intervalo de almoço</Text>
                            </View>

                            <Pressable
                              onPress={() =>
                                setSchedules((prev) =>
                                  prev.map((s, i) =>
                                    i === idx
                                      ? {
                                          ...s,
                                          breakStart: s.breakStart ? null : "12:00",
                                          breakEnd: s.breakEnd ? null : "13:00",
                                        }
                                      : s
                                  )
                                )
                              }
                              className="px-2.5 py-1 rounded-lg border"
                              style={{
                                backgroundColor: sch.breakStart ? "rgba(245, 158, 11, 0.15)" : "#22232b",
                                borderColor: sch.breakStart ? "rgba(245, 158, 11, 0.4)" : "rgba(255, 255, 255, 0.1)",
                              }}
                            >
                              <Text style={{ color: sch.breakStart ? "#fbbf24" : "#71717a", fontSize: 11, fontWeight: "600" }}>
                                {sch.breakStart ? "Com almoço" : "Sem almoço"}
                              </Text>
                            </Pressable>
                          </View>

                          {sch.breakStart && (
                            <View className="flex-row items-center gap-2 pl-2">
                              <Text style={{ color: "#71717a", fontSize: 11, width: 47 }}>Pausa:</Text>
                              <TextInput
                                value={sch.breakStart}
                                onChangeText={(val) =>
                                  setSchedules((prev) =>
                                    prev.map((s, i) => (i === idx ? { ...s, breakStart: val } : s))
                                  )
                                }
                                placeholder="12:00"
                                placeholderTextColor="#71717a"
                                style={{
                                  backgroundColor: "#22232b",
                                  borderColor: "rgba(255, 255, 255, 0.1)",
                                  borderWidth: 1,
                                  borderRadius: 8,
                                  paddingHorizontal: 8,
                                  height: 32,
                                  width: 72,
                                  color: "#ffffff",
                                  fontSize: 12.5,
                                  textAlign: "center",
                                }}
                              />
                              <Text style={{ color: "#71717a", fontSize: 12 }}>até</Text>
                              <TextInput
                                value={sch.breakEnd || ""}
                                onChangeText={(val) =>
                                  setSchedules((prev) =>
                                    prev.map((s, i) => (i === idx ? { ...s, breakEnd: val } : s))
                                  )
                                }
                                placeholder="13:00"
                                placeholderTextColor="#71717a"
                                style={{
                                  backgroundColor: "#22232b",
                                  borderColor: "rgba(255, 255, 255, 0.1)",
                                  borderWidth: 1,
                                  borderRadius: 8,
                                  paddingHorizontal: 8,
                                  height: 32,
                                  width: 72,
                                  color: "#ffffff",
                                  fontSize: 12.5,
                                  textAlign: "center",
                                }}
                              />
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  ))}

                  <Button
                    label={busy ? "Salvando horários..." : "Salvar disponibilidade do profissional"}
                    onPress={handleSaveSchedules}
                    disabled={busy}
                  />
                </View>
              )}
            </View>
          </View>
        )}

        {/* TAB 5: PRODUTOS & CUPONS */}
        {activeTab === "extras" && (
          <View className="gap-4">
            {/* Card: Produtos Complementares */}
            <View
              className="p-4 rounded-2xl border gap-4"
              style={{ backgroundColor: "#111216", borderColor: "rgba(255, 255, 255, 0.09)" }}
            >
              <View className="gap-1 border-b pb-3" style={{ borderBottomColor: "rgba(255, 255, 255, 0.07)" }}>
                <View className="flex-row items-center gap-2">
                  <ShoppingBag size={16} color="#a1a1aa" />
                  <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "800" }}>
                    Produtos Complementares
                  </Text>
                </View>
                <Text style={{ color: "#71717a", fontSize: 12.5 }}>
                  Itens que o cliente pode adicionar ao carrinho durante o agendamento (pomadas, óleos, etc.).
                </Text>
              </View>

              {/* Products List */}
              {products.length > 0 ? (
                <View className="gap-2">
                  {products.map((p) => (
                    <View
                      key={p.id}
                      className="flex-row items-center justify-between p-3 rounded-xl border"
                      style={{ backgroundColor: "#181920", borderColor: "rgba(255, 255, 255, 0.08)" }}
                    >
                      <View className="flex-1 mr-2">
                        <Text style={{ color: "#ffffff", fontSize: 13.5, fontWeight: "700" }}>{p.name}</Text>
                        <Text style={{ color: primaryColor || "#38bdf8", fontSize: 13, fontWeight: "700" }}>
                          {formatBRL(p.price)}
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => handleToggleProduct(p)}
                        className="py-1.5 px-3 rounded-lg border"
                        style={{
                          backgroundColor: p.active ? "rgba(16, 185, 129, 0.15)" : "#22232b",
                          borderColor: p.active ? "rgba(16, 185, 129, 0.4)" : "rgba(255, 255, 255, 0.1)",
                        }}
                      >
                        <Text style={{ color: p.active ? "#34d399" : "#71717a", fontSize: 12, fontWeight: "600" }}>
                          {p.active ? "Ativo" : "Inativo"}
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ color: "#71717a", fontSize: 12.5, fontStyle: "italic" }}>
                  Nenhum produto cadastrado para venda no agendamento.
                </Text>
              )}

              {/* Add Product Inline Form */}
              <View className="gap-2 pt-2 border-t" style={{ borderTopColor: "rgba(255, 255, 255, 0.06)" }}>
                <Text style={{ color: "#a1a1aa", fontSize: 12, fontWeight: "700" }}>ADICIONAR NOVO PRODUTO</Text>
                <View className="flex-row gap-2">
                  <TextInput
                    value={newProductName}
                    onChangeText={setNewProductName}
                    placeholder="Nome do produto"
                    placeholderTextColor="#71717a"
                    style={{
                      flex: 2,
                      backgroundColor: "#181920",
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      borderWidth: 1,
                      borderRadius: 10,
                      paddingHorizontal: 10,
                      height: 40,
                      color: "#ffffff",
                      fontSize: 13,
                    }}
                  />
                  <TextInput
                    value={newProductPrice}
                    onChangeText={setNewProductPrice}
                    placeholder="R$ 45,00"
                    placeholderTextColor="#71717a"
                    keyboardType="numeric"
                    style={{
                      flex: 1,
                      backgroundColor: "#181920",
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      borderWidth: 1,
                      borderRadius: 10,
                      paddingHorizontal: 10,
                      height: 40,
                      color: "#ffffff",
                      fontSize: 13,
                    }}
                  />
                </View>

                <Pressable
                  onPress={handleAddProduct}
                  disabled={busy}
                  className="py-2.5 rounded-xl border flex-row items-center justify-center gap-1.5 mt-1"
                  style={{ backgroundColor: "#27272a", borderColor: "rgba(255, 255, 255, 0.15)" }}
                >
                  <Plus size={14} color="#ffffff" />
                  <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700" }}>Adicionar produto</Text>
                </Pressable>
              </View>
            </View>

            {/* Card: Cupons de Desconto */}
            <View
              className="p-4 rounded-2xl border gap-4"
              style={{ backgroundColor: "#111216", borderColor: "rgba(255, 255, 255, 0.09)" }}
            >
              <View className="gap-1 border-b pb-3" style={{ borderBottomColor: "rgba(255, 255, 255, 0.07)" }}>
                <View className="flex-row items-center gap-2">
                  <Tag size={16} color="#a1a1aa" />
                  <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "800" }}>
                    Cupons de Desconto
                  </Text>
                </View>
                <Text style={{ color: "#71717a", fontSize: 12.5 }}>
                  Crie códigos de desconto promocionais para divulgar nas redes e atrair novos clientes.
                </Text>
              </View>

              {/* Coupons List */}
              {coupons.length > 0 ? (
                <View className="gap-2">
                  {coupons.map((c) => (
                    <View
                      key={c.id}
                      className="flex-row items-center justify-between p-3 rounded-xl border"
                      style={{ backgroundColor: "#181920", borderColor: "rgba(255, 255, 255, 0.08)" }}
                    >
                      <View className="flex-row items-center gap-2.5">
                        <View className="px-2.5 py-1 rounded-md border" style={{ backgroundColor: "#27272a", borderColor: "rgba(255, 255, 255, 0.15)" }}>
                          <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "800", letterSpacing: 0.5 }}>
                            {c.code}
                          </Text>
                        </View>
                        <Text style={{ color: "#a1a1aa", fontSize: 12 }}>
                          Desconto:{" "}
                          <Text style={{ color: "#ffffff", fontWeight: "700" }}>
                            {c.type === "percentage" ? `${c.value}%` : formatBRL(c.value)}
                          </Text>
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => handleToggleCoupon(c)}
                        className="py-1.5 px-3 rounded-lg border"
                        style={{
                          backgroundColor: c.active ? "rgba(16, 185, 129, 0.15)" : "#22232b",
                          borderColor: c.active ? "rgba(16, 185, 129, 0.4)" : "rgba(255, 255, 255, 0.1)",
                        }}
                      >
                        <Text style={{ color: c.active ? "#34d399" : "#71717a", fontSize: 12, fontWeight: "600" }}>
                          {c.active ? "Ativo" : "Inativo"}
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ color: "#71717a", fontSize: 12.5, fontStyle: "italic" }}>
                  Nenhum cupom cadastrado ainda.
                </Text>
              )}

              {/* Add Coupon Inline Form */}
              <View className="gap-2 pt-2 border-t" style={{ borderTopColor: "rgba(255, 255, 255, 0.06)" }}>
                <Text style={{ color: "#a1a1aa", fontSize: 12, fontWeight: "700" }}>CRIAR NOVO CUPOM</Text>
                <View className="flex-row gap-2">
                  <TextInput
                    value={newCouponCode}
                    onChangeText={(t) => setNewCouponCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                    placeholder="PRIMEIRA10"
                    placeholderTextColor="#71717a"
                    autoCapitalize="characters"
                    style={{
                      flex: 2,
                      backgroundColor: "#181920",
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      borderWidth: 1,
                      borderRadius: 10,
                      paddingHorizontal: 10,
                      height: 40,
                      color: "#ffffff",
                      fontSize: 13,
                      fontWeight: "700",
                    }}
                  />

                  <Pressable
                    onPress={() => setNewCouponType(newCouponType === "percentage" ? "fixed" : "percentage")}
                    className="w-12 h-10 rounded-xl border items-center justify-center"
                    style={{ backgroundColor: "#1e1f26", borderColor: "rgba(255, 255, 255, 0.1)" }}
                  >
                    <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "800" }}>
                      {newCouponType === "percentage" ? "%" : "R$"}
                    </Text>
                  </Pressable>

                  <TextInput
                    value={newCouponValue}
                    onChangeText={setNewCouponValue}
                    placeholder="10"
                    placeholderTextColor="#71717a"
                    keyboardType="numeric"
                    style={{
                      flex: 1,
                      backgroundColor: "#181920",
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      borderWidth: 1,
                      borderRadius: 10,
                      paddingHorizontal: 10,
                      height: 40,
                      color: "#ffffff",
                      fontSize: 13,
                    }}
                  />
                </View>

                <Pressable
                  onPress={handleAddCoupon}
                  disabled={busy}
                  className="py-2.5 rounded-xl border flex-row items-center justify-center gap-1.5 mt-1"
                  style={{ backgroundColor: "#27272a", borderColor: "rgba(255, 255, 255, 0.15)" }}
                >
                  <Plus size={14} color="#ffffff" />
                  <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700" }}>Criar cupom</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* QR Code Modal */}
      <Modal
        visible={showQrModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQrModal(false)}
      >
        <Pressable
          onPress={() => setShowQrModal(false)}
          className="flex-1 items-center justify-center p-6"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.82)" }}
        >
          <View
            className="w-full max-w-sm rounded-3xl border p-6 items-center gap-4"
            style={{ backgroundColor: "#131418", borderColor: "rgba(255, 255, 255, 0.12)" }}
          >
            <View className="w-full flex-row items-center justify-between">
              <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "800" }}>QR Code de Agendamento</Text>
              <Pressable onPress={() => setShowQrModal(false)} className="p-1 rounded-lg">
                <X size={20} color="#ffffff" />
              </Pressable>
            </View>

            <View className="p-4 rounded-2xl bg-white items-center justify-center">
              <Image
                source={{
                  uri: `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(
                    publicUrl
                  )}`,
                }}
                style={{ width: 220, height: 220 }}
                contentFit="contain"
              />
            </View>

            <Text style={{ color: "#a1a1aa", fontSize: 12.5, textAlign: "center", lineHeight: 17 }}>
              Aponte a câmera do celular para abrir o link de reservas direto da sua bancada ou balcão.
            </Text>

            <View className="w-full gap-2 pt-1">
              <Button label="Compartilhar Link" onPress={handleCopyLink} />
            </View>
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}
