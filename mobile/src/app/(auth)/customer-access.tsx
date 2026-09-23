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
  Moon,
  Phone,
  ShieldCheck,
  Sun,
  User,
} from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

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
import { useTheme } from "@/hooks/use-theme";

type Step = "phone" | "pin_login" | "pin_setup" | "pin_reset_confirm" | "not_found";

export default function CustomerAccessScreen() {
  const { refresh } = useSession();
  const { isDark, toggleTheme, colors: themeColors, primaryColor } = useTheme();

  const [step, setStep] = useState<Step>("pin_login");
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
    router.replace("/(customer)");
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

  const formBackground = isDark ? "#0d0f12" : "#ffffff";
  const titleColor = isDark ? "#f8fafc" : "#0f172a";
  const subtitleColor = isDark ? "#94a3b8" : "#64748b";

  return (
    <Screen noPadding>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
        style={{ backgroundColor: formBackground }}
      >
        {/* Top Split Banner */}
        <View style={styles.bannerContainer}>
          <Image
            source={require("../../../assets/images/login-banner.png")}
            style={styles.bannerImage}
            contentFit="cover"
          />
        </View>

        <View style={[styles.formPane, { backgroundColor: formBackground }]}>
          {/* TopBar: Logo and Theme Toggle */}
          <View style={styles.topBar}>
            <Image
              source={require("../../../assets/images/reservei-logo.png")}
              style={{ width: 92, height: 34 }}
              contentFit="contain"
            />

            <View
              style={[
                styles.themePill,
                {
                  backgroundColor: isDark ? "#181b23" : "#f1f5f9",
                  borderColor: isDark ? "#282d3b" : "#e2e8f0",
                },
              ]}
            >
              <Pressable
                onPress={() => !isDark || toggleTheme()}
                style={[
                  styles.themeBtn,
                  !isDark && {
                    backgroundColor: "#ffffff",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 2,
                    elevation: 2,
                  },
                ]}
              >
                <Sun size={13} color={!isDark ? "#0f172a" : "#94a3b8"} />
                <Text
                  style={[
                    styles.themeBtnText,
                    { color: !isDark ? "#0f172a" : "#94a3b8", fontWeight: !isDark ? "700" : "500" },
                  ]}
                >
                  Claro
                </Text>
              </Pressable>

              <Pressable
                onPress={() => isDark || toggleTheme()}
                style={[
                  styles.themeBtn,
                  isDark && {
                    backgroundColor: "#252a37",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.3,
                    shadowRadius: 3,
                    elevation: 2,
                  },
                ]}
              >
                <Moon size={13} color={isDark ? primaryColor : "#94a3b8"} />
                <Text
                  style={[
                    styles.themeBtnText,
                    { color: isDark ? primaryColor : "#94a3b8", fontWeight: isDark ? "700" : "500" },
                  ]}
                >
                  Escuro
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Feedback alerts */}
          {error ? (
            <View
              style={[
                styles.alertBox,
                {
                  backgroundColor: authSplit.errorBackground,
                  borderColor: authSplit.errorBorder,
                },
              ]}
            >
              <AlertCircle size={16} color={authSplit.errorText} />
              <Text style={{ color: authSplit.errorText, flex: 1, ...typography.authError }}>{error}</Text>
            </View>
          ) : null}

          {successBanner ? (
            <View
              style={[
                styles.alertBox,
                {
                  backgroundColor: "rgba(16, 185, 129, 0.15)",
                  borderColor: "rgba(16, 185, 129, 0.35)",
                },
              ]}
            >
              <CheckCircle2 size={16} color="#10b981" />
              <Text style={{ color: "#86efac", flex: 1, ...typography.authError }}>{successBanner}</Text>
            </View>
          ) : null}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* STEP 1: PHONE INPUT                                        */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {step === "phone" && (
            <View style={styles.formContent}>
              <View style={styles.headerBlock}>
                <Text style={[styles.title, { color: titleColor }]}>Minhas Reservas</Text>
                <Text style={[styles.subtitle, { color: subtitleColor }]}>
                  Informe seu celular para consultar, remarcar ou acompanhar seus agendamentos.
                </Text>
              </View>

              <View style={styles.fieldsBlock}>
                <View style={{ gap: 4 }}>
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
                  <Text style={{ color: subtitleColor, fontSize: 12, marginTop: 2 }}>
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
                  style={{ alignItems: "center", paddingVertical: 4 }}
                >
                  <Text style={{ color: primaryColor, fontSize: 13, fontWeight: "600" }}>
                    Já tem um PIN de 6 dígitos? Entrar diretamente
                  </Text>
                </Pressable>
              </View>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: isDark ? "#282d3b" : "#e2e8f0" }]} />
                <Text style={styles.dividerText}>ou é profissional / proprietário?</Text>
                <View style={[styles.dividerLine, { backgroundColor: isDark ? "#282d3b" : "#e2e8f0" }]} />
              </View>

              {/* Secondary button */}
              <Pressable
                style={[
                  styles.secondaryBtn,
                  {
                    backgroundColor: isDark ? "#181b23" : "#f8fafc",
                    borderColor: isDark ? "#282d3b" : "#e2e8f0",
                  },
                ]}
                onPress={() => router.replace("/(auth)/login")}
              >
                <Lock size={16} color={titleColor} />
                <Text style={[styles.secondaryBtnText, { color: titleColor }]}>
                  Entrar com e-mail e senha
                </Text>
              </Pressable>
            </View>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* STEP 2A: PIN LOGIN (6-box PIN)                             */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {step === "pin_login" && (
            <View style={styles.formContent}>
              <View style={styles.headerBlock}>
                <Text style={[styles.title, { color: titleColor }]}>Minhas Reservas</Text>
                <Text style={[styles.subtitle, { color: subtitleColor }]}>
                  Digite seu PIN de 6 dígitos para consultar, remarcar ou acompanhar seus agendamentos.
                </Text>
              </View>

              {(maskedPhone || phone) ? (
                <View
                  style={[
                    styles.phoneInfoBox,
                    {
                      backgroundColor: isDark ? "#181b23" : "#f8fafc",
                      borderColor: isDark ? "#282d3b" : "#e2e8f0",
                    },
                  ]}
                >
                  <Text style={{ color: subtitleColor, fontSize: 13 }}>
                    PIN para:{" "}
                    <Text style={{ color: titleColor, fontWeight: "700" }}>
                      {maskedPhone || phone}
                    </Text>
                  </Text>
                </View>
              ) : null}

              <View style={styles.fieldsBlock}>
                <View style={{ alignItems: "center", paddingVertical: 8 }}>
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

                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
                  <Pressable
                    hitSlop={8}
                    onPress={() => {
                      setError(null);
                      setStep("phone");
                    }}
                    style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                  >
                    <ArrowLeft size={14} color={subtitleColor} />
                    <Text style={{ color: subtitleColor, fontSize: 12.5 }}>
                      {phone ? "Trocar número" : "Buscar por celular"}
                    </Text>
                  </Pressable>

                  <Pressable
                    hitSlop={8}
                    onPress={() => {
                      setError(null);
                      if (!phone) {
                        setStep("phone");
                      } else {
                        void handleRequestPinReset();
                      }
                    }}
                    disabled={loading}
                  >
                    <Text style={{ color: primaryColor, fontSize: 12.5, fontWeight: "600" }}>
                      Esqueci meu PIN
                    </Text>
                  </Pressable>
                </View>

                <Text style={{ color: subtitleColor, fontSize: 12, textAlign: "center", marginTop: 8 }}>
                  O PIN de 6 dígitos é gerado ao confirmar uma reserva.
                </Text>
              </View>

              {/* Back to Staff */}
              <View style={styles.switchRow}>
                <Text style={{ color: subtitleColor, fontSize: 13 }}>É da equipe? </Text>
                <Pressable onPress={() => router.replace("/(auth)/login")}>
                  <Text style={{ color: primaryColor, fontSize: 13, fontWeight: "700" }}>
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
            <View style={styles.formContent}>
              <View style={styles.headerBlock}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <ShieldCheck size={16} color={primaryColor} />
                  <Text style={{ color: primaryColor, fontSize: 11, fontWeight: "700", letterSpacing: 0.8 }}>
                    PRIMEIRO ACESSO
                  </Text>
                </View>
                <Text style={[styles.title, { color: titleColor }]}>Proteja suas reservas</Text>
                <Text style={[styles.subtitle, { color: subtitleColor }]}>
                  Crie um PIN de 6 dígitos que você usará junto ao seu celular para acessar suas reservas.
                </Text>
              </View>

              {(maskedPhone || phone) ? (
                <View
                  style={[
                    styles.phoneInfoBox,
                    {
                      backgroundColor: isDark ? "#181b23" : "#f8fafc",
                      borderColor: isDark ? "#282d3b" : "#e2e8f0",
                    },
                  ]}
                >
                  <Text style={{ color: subtitleColor, fontSize: 13 }}>
                    Número: <Text style={{ color: titleColor, fontWeight: "700" }}>{maskedPhone || phone}</Text>
                  </Text>
                </View>
              ) : null}

              <View style={styles.fieldsBlock}>
                <View style={{ gap: 6 }}>
                  <Text style={{ color: titleColor, fontSize: 13, fontWeight: "600", textAlign: "center" }}>
                    Digite seu novo PIN de 6 dígitos
                  </Text>
                  <View style={{ alignItems: "center", paddingVertical: 4 }}>
                    <PinInput value={pin} onChange={setPin} length={6} autoFocus />
                  </View>
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={{ color: titleColor, fontSize: 13, fontWeight: "600", textAlign: "center" }}>
                    Confirme seu novo PIN
                  </Text>
                  <View style={{ alignItems: "center", paddingVertical: 4 }}>
                    <PinInput value={confirmPin} onChange={setConfirmPin} length={6} />
                  </View>
                </View>

                <Button
                  label="Salvar PIN e acessar"
                  onPress={handlePinSetup}
                  loading={loading}
                  disabled={pin.length !== 6 || confirmPin.length !== 6}
                />

                <Pressable
                  hitSlop={8}
                  onPress={() => setStep("phone")}
                  style={{ alignItems: "center", paddingVertical: 4 }}
                >
                  <Text style={{ color: subtitleColor, fontSize: 12.5 }}>Voltar</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* STEP 2C: PIN RESET CONFIRM (Recovery)                       */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {step === "pin_reset_confirm" && (
            <View style={styles.formContent}>
              <View style={styles.headerBlock}>
                <Text style={[styles.title, { color: titleColor }]}>Recuperar PIN</Text>
                <Text style={[styles.subtitle, { color: subtitleColor }]}>
                  Digite o código enviado para {resetDestination} e defina um novo PIN.
                </Text>
              </View>

              <View style={styles.fieldsBlock}>
                <TextField
                  label="Código de verificação"
                  required
                  icon={KeyRound}
                  placeholder="000000"
                  keyboardType="number-pad"
                  value={resetOtp}
                  onChangeText={setResetOtp}
                  autoFocus
                />

                <View style={{ gap: 6 }}>
                  <Text style={{ color: titleColor, fontSize: 13, fontWeight: "600", textAlign: "center" }}>
                    Novo PIN (6 dígitos)
                  </Text>
                  <View style={{ alignItems: "center", paddingVertical: 4 }}>
                    <PinInput value={pin} onChange={setPin} length={6} />
                  </View>
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={{ color: titleColor, fontSize: 13, fontWeight: "600", textAlign: "center" }}>
                    Confirme o novo PIN
                  </Text>
                  <View style={{ alignItems: "center", paddingVertical: 4 }}>
                    <PinInput value={confirmPin} onChange={setConfirmPin} length={6} />
                  </View>
                </View>

                <Button
                  label="Redefinir PIN e acessar"
                  onPress={handleConfirmPinReset}
                  loading={loading}
                  disabled={resetOtp.length < 6 || pin.length !== 6 || confirmPin.length !== 6}
                />

                <Pressable
                  hitSlop={8}
                  onPress={() => setStep("pin_login")}
                  style={{ alignItems: "center", paddingVertical: 4 }}
                >
                  <Text style={{ color: subtitleColor, fontSize: 12.5 }}>Voltar</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* STEP 2D: NOT FOUND (Identify Customer)                     */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {step === "not_found" && (
            <View style={styles.formContent}>
              <View style={styles.headerBlock}>
                <Text style={[styles.title, { color: titleColor }]}>Completar cadastro</Text>
                <Text style={[styles.subtitle, { color: subtitleColor }]}>
                  Não encontramos reservas vinculadas a este número. Preencha seus dados para criar seu perfil de cliente.
                </Text>
              </View>

              <View style={styles.fieldsBlock}>
                <TextField
                  label="Nome completo"
                  required
                  icon={User}
                  placeholder="Seu nome"
                  value={name}
                  onChangeText={setName}
                  autoFocus
                />

                <TextField
                  label="E-mail"
                  required
                  icon={Mail}
                  placeholder="seu@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />

                <View style={{ gap: 6 }}>
                  <Text style={{ color: titleColor, fontSize: 13, fontWeight: "600", textAlign: "center" }}>
                    Crie seu PIN de 6 dígitos
                  </Text>
                  <View style={{ alignItems: "center", paddingVertical: 4 }}>
                    <PinInput value={pin} onChange={setPin} length={6} />
                  </View>
                </View>

                <Button
                  label="Concluir e acessar"
                  onPress={handleIdentifySubmit}
                  loading={loading}
                  disabled={!name.trim() || !email.includes("@") || pin.length !== 6}
                />

                <Pressable
                  hitSlop={8}
                  onPress={() => setStep("phone")}
                  style={{ alignItems: "center", paddingVertical: 4 }}
                >
                  <Text style={{ color: subtitleColor, fontSize: 12.5 }}>Voltar</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Footer Terms */}
          <Text style={[styles.footerText, { color: subtitleColor }]}>
            Ao continuar, você concorda com nossos Termos de Uso e Política de Privacidade.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    width: "100%",
    height: 120,
    backgroundColor: "#c6f53e",
    overflow: "hidden",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  formPane: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    maxWidth: 460,
    width: "100%",
    alignSelf: "center",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  themePill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    padding: 3,
    gap: 2,
  },
  themeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  themeBtnText: {
    fontSize: 12,
  },
  alertBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  phoneInfoBox: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  formContent: {
    gap: 20,
  },
  headerBlock: {
    gap: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.4,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  fieldsBlock: {
    gap: 16,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "500",
  },
  secondaryBtn: {
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 4,
  },
  footerText: {
    fontSize: 11.5,
    textAlign: "center",
    marginTop: 24,
    lineHeight: 16,
  },
});
