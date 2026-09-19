import { Image } from "expo-image";
import { router } from "expo-router";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { PinInput } from "@/components/ui/pin-input";
import { Screen } from "@/components/ui/screen";
import { TextField } from "@/components/ui/text-field";
import { authSplit, colors, typography } from "@/constants/design-tokens";
import { ApiError } from "@/lib/api-client";
import {
  checkCustomerPhone,
  confirmCustomerPinReset,
  identifyCustomer,
  loginCustomerWithPin,
  requestCustomerPinReset,
  setupCustomerPin,
} from "@/lib/auth";
import { formatPhoneInput } from "@/lib/formatters";
import { useSession } from "@/lib/session-context";

type Step = "phone" | "pin_login" | "pin_setup" | "pin_reset_confirm" | "not_found";

export default function CustomerAccessScreen() {
  const { refresh } = useSession();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [resetDestination, setResetDestination] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function fail(err: unknown, fallback: string) {
    setError(err instanceof ApiError ? err.message : fallback);
  }

  async function completeLogin() {
    await refresh();
    router.replace("/");
  }

  // ─── Step 1: Phone check ───
  async function handlePhoneSubmit() {
    setError(null);
    setSuccessBanner(null);
    const cleanDigits = phone.replace(/\D/g, "");
    if (cleanDigits.length < 8) {
      setError("Por favor, digite um número de celular válido com DDD.");
      return;
    }
    setLoading(true);
    try {
      const response = await checkCustomerPhone(phone.trim());
      setMaskedPhone(response.maskedPhone || phone.trim());
      setPin("");
      setConfirmPin("");

      if (response.status === "HAS_PIN") {
        setStep("pin_login");
      } else if (response.status === "NEEDS_PIN_SETUP") {
        setStep("pin_setup");
      } else {
        setStep("not_found");
      }
    } catch (err) {
      fail(err, "Não foi possível verificar o telefone.");
    } finally {
      setLoading(false);
    }
  }

  // ─── Step 2A: PIN Login ───
  async function handlePinLogin(overridePin?: string) {
    const pinToUse = overridePin || pin;
    setError(null);
    setSuccessBanner(null);
    if (pinToUse.length !== 6) {
      setError("Digite os 6 números do seu PIN.");
      return;
    }
    setLoading(true);
    try {
      await loginCustomerWithPin(pinToUse, phone.trim().length >= 8 ? phone.trim() : undefined);
      await completeLogin();
    } catch (err) {
      fail(err, "PIN incorreto. Verifique os números digitados.");
    } finally {
      setLoading(false);
    }
  }

  // ─── Step 2B: PIN Setup (First Access) ───
  async function handlePinSetup() {
    setError(null);
    setSuccessBanner(null);
    if (pin.length !== 6) {
      setError("O PIN deve conter exatamente 6 números.");
      return;
    }
    if (confirmPin.length !== 6) {
      setError("Confirme seu PIN digitando os 6 números.");
      return;
    }
    if (pin !== confirmPin) {
      setError("Os PINs não coincidem.");
      return;
    }
    setLoading(true);
    try {
      await setupCustomerPin({
        phone: phone.trim(),
        pin,
        confirmPin,
      });
      await loginCustomerWithPin(pin, phone.trim());
      await completeLogin();
    } catch (err) {
      fail(err, "Não foi possível criar o PIN. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  // ─── PIN Recovery: Request OTP ───
  async function handleRequestPinReset() {
    setError(null);
    setLoading(true);
    try {
      const response = await requestCustomerPinReset(phone.trim());
      setResetDestination(response.destination || maskedPhone || phone);
      setSuccessBanner(response.message || "Código de recuperação enviado!");
      setResetOtp("");
      setPin("");
      setConfirmPin("");
      setStep("pin_reset_confirm");
    } catch (err) {
      fail(err, "Não foi possível solicitar a recuperação do PIN.");
    } finally {
      setLoading(false);
    }
  }

  // ─── PIN Recovery: Confirm OTP & Set New PIN ───
  async function handleConfirmPinReset() {
    setError(null);
    setSuccessBanner(null);
    if (resetOtp.trim().length < 6) {
      setError("Informe o código de verificação recebido.");
      return;
    }
    if (pin.length !== 6) {
      setError("O novo PIN deve conter exatamente 6 números.");
      return;
    }
    if (pin !== confirmPin) {
      setError("Os PINs não coincidem.");
      return;
    }
    setLoading(true);
    try {
      await confirmCustomerPinReset({
        phone: phone.trim(),
        otp: resetOtp.trim(),
        newPin: pin,
        confirmNewPin: confirmPin,
      });
      await completeLogin();
    } catch (err) {
      fail(err, "Código inválido ou expirado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  // ─── Step 2D: Identify customer when not found ───
  async function handleIdentifySubmit() {
    setError(null);
    if (name.trim().length < 2 || !email.includes("@")) {
      setError("Informe seu nome completo e um e-mail válido.");
      return;
    }
    if (pin.length !== 6) {
      setError("Crie um PIN de 6 dígitos para o seu acesso.");
      return;
    }
    setLoading(true);
    try {
      const result = await identifyCustomer({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
      });
      if (result.hasPin) {
        setStep("pin_login");
      } else {
        await setupCustomerPin({
          phone: phone.trim(),
          pin,
          confirmPin: pin,
        });
        await loginCustomerWithPin(pin, phone.trim());
        await completeLogin();
      }
    } catch (err) {
      fail(err, "Não foi possível concluir seu cadastro.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen noPadding>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        {/* Top Split Banner */}
        <Image
          source={require("../../../assets/images/login-banner.png")}
          style={{ width: "100%", height: authSplit.bannerHeight }}
          contentFit="cover"
        />

        <View className="flex-1 gap-6 px-3.5 pb-8 pt-4" style={{ backgroundColor: authSplit.formBackground }}>
          {/* Logo */}
          <Image
            source={require("../../../assets/images/reservei-logo.png")}
            style={{ width: 80, height: 34 }}
            contentFit="contain"
          />

          {/* Feedback alerts */}
          {error ? (
            <View
              className="flex-row items-center gap-2 rounded-lg border px-3.5 py-2.5"
              style={{ backgroundColor: authSplit.errorBackground, borderColor: authSplit.errorBorder }}
            >
              <AlertCircle size={16} color={authSplit.errorText} />
              <Text style={{ color: authSplit.errorText, flex: 1, ...typography.authError }}>{error}</Text>
            </View>
          ) : null}

          {successBanner ? (
            <View
              className="flex-row items-center gap-2 rounded-lg border px-3.5 py-2.5"
              style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", borderColor: "rgba(16, 185, 129, 0.35)" }}
            >
              <CheckCircle2 size={16} color="#10b981" />
              <Text style={{ color: "#86efac", flex: 1, ...typography.authError }}>{successBanner}</Text>
            </View>
          ) : null}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* STEP 1: PHONE INPUT                                        */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {step === "phone" && (
            <View className="gap-6">
              <View>
                <Text style={{ color: "#f5f5f5", ...typography.authTitle }}>Minhas Reservas</Text>
                <Text style={{ color: "#a3a3a3", marginTop: 8, ...typography.authSubtitle }}>
                  Informe seu celular para consultar, remarcar ou acompanhar seus agendamentos.
                </Text>
              </View>

              <View className="gap-[18px]">
                <View className="gap-1">
                  <TextField
                    label="Número de celular / WhatsApp"
                    required
                    icon={Phone}
                    placeholder="(11) 99999-9999"
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    textContentType="telephoneNumber"
                    value={phone}
                    onChangeText={(val) => setPhone(formatPhoneInput(val))}
                    autoFocus
                  />
                  <Text style={{ color: "#737373", fontSize: 12, marginTop: 2 }}>
                    Digite o mesmo número informado no seu agendamento.
                  </Text>
                </View>

                <Button
                  label="Continuar"
                  onPress={handlePhoneSubmit}
                  loading={loading}
                  disabled={phone.replace(/\D/g, "").length < 8}
                />

                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    setError(null);
                    setStep("pin_login");
                  }}
                  className="items-center py-1"
                >
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>
                    Já tem um PIN de 6 dígitos? Entrar diretamente
                  </Text>
                </Pressable>
              </View>

              {/* Divider */}
              <View className="flex-row items-center gap-3">
                <View className="h-px flex-1" style={{ backgroundColor: authSplit.inputBorder }} />
                <Text style={{ color: authSplit.mutedIcon, fontSize: 12, fontWeight: "500" }}>
                  ou é profissional / proprietário?
                </Text>
                <View className="h-px flex-1" style={{ backgroundColor: authSplit.inputBorder }} />
              </View>

              {/* Secondary button */}
              <Pressable
                className="h-[46px] flex-row items-center justify-center gap-2 rounded-[10px] border"
                style={{ backgroundColor: authSplit.inputBackground, borderColor: authSplit.inputBorder }}
                onPress={() => router.replace("/(auth)/login")}
              >
                <Lock size={16} color="#ffffff" />
                <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "600" }}>
                  Entrar com e-mail e senha
                </Text>
              </Pressable>
            </View>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* STEP 2A: PIN LOGIN (6-box PIN)                             */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {step === "pin_login" && (
            <View className="gap-6">
              <View>
                <Text style={{ color: "#f5f5f5", ...typography.authTitle }}>Minhas Reservas</Text>
                <Text style={{ color: "#a3a3a3", marginTop: 8, ...typography.authSubtitle }}>
                  Digite seu PIN de 6 dígitos para consultar, remarcar ou acompanhar seus agendamentos.
                </Text>
              </View>

              {(maskedPhone || phone) && (
                <View
                  className="items-center justify-center rounded-lg border py-2.5 px-3"
                  style={{ backgroundColor: authSplit.inputBackground, borderColor: authSplit.inputBorder }}
                >
                  <Text style={{ color: "#a3a3a3", fontSize: 13 }}>
                    PIN para:{" "}
                    <Text style={{ color: "#fafafa", fontWeight: "700" }}>
                      {maskedPhone || phone}
                    </Text>
                  </Text>
                </View>
              )}

              <View className="gap-4">
                <View className="items-center py-2">
                  <PinInput
                    value={pin}
                    onChange={setPin}
                    length={6}
                    autoFocus
                    error={Boolean(error)}
                    onComplete={(code) => handlePinLogin(code)}
                  />
                </View>

                <Button
                  label="Acessar minhas reservas"
                  onPress={() => handlePinLogin()}
                  loading={loading}
                  disabled={pin.length !== 6}
                />

                <View className="flex-row items-center justify-between pt-1">
                  <Pressable
                    hitSlop={8}
                    onPress={() => {
                      setError(null);
                      setStep("phone");
                    }}
                    className="flex-row items-center gap-1.5"
                  >
                    <ArrowLeft size={14} color={colors.textSecondary} />
                    <Text style={{ color: colors.textSecondary, fontSize: 12.5 }}>Trocar número</Text>
                  </Pressable>

                  <Pressable
                    hitSlop={8}
                    onPress={handleRequestPinReset}
                    disabled={loading || !phone}
                  >
                    <Text style={{ color: colors.primary, fontSize: 12.5, fontWeight: "600" }}>
                      Esqueci meu PIN
                    </Text>
                  </Pressable>
                </View>

                <Text style={{ color: "#737373", fontSize: 12, textAlign: "center", marginTop: 8 }}>
                  O PIN de 6 dígitos é gerado ao confirmar uma reserva.
                </Text>
              </View>

              {/* Back to Staff */}
              <View className="flex-row items-center justify-center gap-1.5 pt-4">
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>É da equipe?</Text>
                <Pressable onPress={() => router.replace("/(auth)/login")}>
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>
                    Entrar com e-mail
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* STEP 2B: PIN SETUP (First Access)                          */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {step === "pin_setup" && (
            <View className="gap-6">
              <View>
                <View className="flex-row items-center gap-1.5 mb-1">
                  <ShieldCheck size={16} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700", letterSpacing: 0.8 }}>
                    PRIMEIRO ACESSO
                  </Text>
                </View>
                <Text style={{ color: "#f5f5f5", ...typography.authTitle }}>Proteja suas reservas</Text>
                <Text style={{ color: "#a3a3a3", marginTop: 8, ...typography.authSubtitle }}>
                  Crie um PIN de 6 dígitos que você usará junto ao seu celular para acessar suas reservas.
                </Text>
              </View>

              {(maskedPhone || phone) && (
                <View
                  className="items-center justify-center rounded-lg border py-2.5 px-3"
                  style={{ backgroundColor: authSplit.inputBackground, borderColor: authSplit.inputBorder }}
                >
                  <Text style={{ color: "#a3a3a3", fontSize: 13 }}>
                    Celular:{" "}
                    <Text style={{ color: "#fafafa", fontWeight: "700" }}>
                      {maskedPhone || phone}
                    </Text>
                  </Text>
                </View>
              )}

              <View className="gap-4">
                <View className="gap-2">
                  <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "600", textAlign: "center" }}>
                    Crie seu PIN (6 dígitos) <Text style={{ color: colors.primary }}>*</Text>
                  </Text>
                  <PinInput value={pin} onChange={setPin} length={6} autoFocus />
                </View>

                <View className="gap-2">
                  <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "600", textAlign: "center" }}>
                    Confirme seu PIN <Text style={{ color: colors.primary }}>*</Text>
                  </Text>
                  <PinInput value={confirmPin} onChange={setConfirmPin} length={6} />
                </View>

                {confirmPin.length === 6 ? (
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      textAlign: "center",
                      color: pin === confirmPin ? "#10b981" : colors.danger,
                    }}
                  >
                    {pin === confirmPin ? "✓ Os PINs coincidem" : "✕ Os PINs não coincidem"}
                  </Text>
                ) : null}

                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    setError(null);
                    setStep("phone");
                  }}
                  className="flex-row items-center gap-1 py-1"
                >
                  <ArrowLeft size={14} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 12.5 }}>Usar outro número</Text>
                </Pressable>

                <Button
                  label="Criar PIN e acessar"
                  onPress={handlePinSetup}
                  loading={loading}
                  disabled={pin.length !== 6 || confirmPin.length !== 6 || pin !== confirmPin}
                />
              </View>
            </View>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* STEP 2C: PIN RESET CONFIRM (OTP + New PIN)                 */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {step === "pin_reset_confirm" && (
            <View className="gap-6">
              <View>
                <View className="flex-row items-center gap-1.5 mb-1">
                  <KeyRound size={16} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700", letterSpacing: 0.8 }}>
                    REDEFINIR PIN
                  </Text>
                </View>
                <Text style={{ color: "#f5f5f5", ...typography.authTitle }}>Recuperação de PIN</Text>
                <Text style={{ color: "#a3a3a3", marginTop: 8, ...typography.authSubtitle }}>
                  Informe o código de 6 números enviado para {resetDestination || maskedPhone || phone} e defina o novo PIN.
                </Text>
              </View>

              <View className="gap-4">
                <View className="gap-2">
                  <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "600", textAlign: "center" }}>
                    Código de verificação (6 dígitos) <Text style={{ color: colors.primary }}>*</Text>
                  </Text>
                  <PinInput value={resetOtp} onChange={setResetOtp} length={6} mask={false} autoFocus />
                </View>

                <View className="gap-2">
                  <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "600", textAlign: "center" }}>
                    Novo PIN (6 dígitos) <Text style={{ color: colors.primary }}>*</Text>
                  </Text>
                  <PinInput value={pin} onChange={setPin} length={6} />
                </View>

                <View className="gap-2">
                  <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "600", textAlign: "center" }}>
                    Confirme o novo PIN <Text style={{ color: colors.primary }}>*</Text>
                  </Text>
                  <PinInput value={confirmPin} onChange={setConfirmPin} length={6} />
                </View>

                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    setError(null);
                    setStep("pin_login");
                  }}
                  className="flex-row items-center gap-1 py-1"
                >
                  <ArrowLeft size={14} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 12.5 }}>Voltar para login</Text>
                </Pressable>

                <Button
                  label="Redefinir PIN e entrar"
                  onPress={handleConfirmPinReset}
                  loading={loading}
                  disabled={resetOtp.length < 6 || pin.length !== 6 || confirmPin.length !== 6}
                />
              </View>
            </View>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* STEP 2D: NOT FOUND (Create Customer & Setup PIN)           */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {step === "not_found" && (
            <View className="gap-6">
              <View>
                <Text style={{ color: "#f5f5f5", ...typography.authTitle }}>Minhas Reservas</Text>
                <Text style={{ color: "#a3a3a3", marginTop: 8, ...typography.authSubtitle }}>
                  Não encontramos reservas vinculadas a este número.
                </Text>
              </View>

              <View
                className="rounded-lg border p-3.5 gap-2"
                style={{ backgroundColor: authSplit.inputBackground, borderColor: authSplit.inputBorder }}
              >
                <Text style={{ color: "#d4d4d8", fontSize: 13 }}>
                  Número pesquisado: <Text style={{ color: "#fafafa", fontWeight: "700" }}>{maskedPhone || phone}</Text>
                </Text>
                <Text style={{ color: "#a3a3a3", fontSize: 12, lineHeight: 17 }}>
                  Cadastre seus dados para agendar e acompanhar seus atendimentos com segurança pelo aplicativo.
                </Text>
              </View>

              <View className="gap-[18px]">
                <TextField
                  label="Nome completo"
                  required
                  icon={User}
                  placeholder="Seu nome"
                  value={name}
                  onChangeText={setName}
                />

                <TextField
                  label="E-mail"
                  required
                  icon={Mail}
                  placeholder="seu@email.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                  value={email}
                  onChangeText={setEmail}
                />

                <View className="gap-2">
                  <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "600", textAlign: "center" }}>
                    Crie seu PIN de 6 dígitos <Text style={{ color: colors.primary }}>*</Text>
                  </Text>
                  <PinInput value={pin} onChange={setPin} length={6} />
                </View>

                <Button
                  label="Cadastrar e entrar"
                  onPress={handleIdentifySubmit}
                  loading={loading}
                  disabled={name.trim().length < 2 || !email.includes("@") || pin.length !== 6}
                />

                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    setError(null);
                    setStep("phone");
                  }}
                  className="flex-row items-center justify-center gap-1 py-1"
                >
                  <ArrowLeft size={14} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Verificar outro número</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Footer Terms */}
          <Text style={{ color: "#737373", fontSize: 11.5, textAlign: "center", marginTop: 12, lineHeight: 16 }}>
            Ao continuar, você concorda com nossos Termos de Uso e Política de Privacidade.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
