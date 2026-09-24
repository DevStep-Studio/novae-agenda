import { Image } from "expo-image";
import { router } from "expo-router";
import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  MailCheck,
  RotateCcw,
  Settings,
  User,
  X,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ReserveiLogo } from "@/components/brand/reservei-logo";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { TextField } from "@/components/ui/text-field";
import { authSplit, colors, radius, typography } from "@/constants/design-tokens";
import { ApiError } from "@/lib/api-client";
import { loginStaff, registerStaff, requestPasswordReset } from "@/lib/auth";
import { useSession } from "@/lib/session-context";
import { useTheme } from "@/hooks/use-theme";

type AuthMode = "login" | "register" | "forgot-password";
type RecoveryStep = "request_email" | "email_sent";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { session, refresh } = useSession();
  const { isDark, toggleTheme, primaryColor } = useTheme();

  const [mode, setMode] = useState<AuthMode>("login");
  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>("request_email");

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  // Recovery states
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Feedback states
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Auto-redirect if already logged in
  useEffect(() => {
    if (session) {
      if (session.role === "employee") {
        router.replace("/(employee)");
      } else if (session.role === "client") {
        router.replace("/(customer)");
      } else {
        router.replace("/(owner)");
      }
    }
  }, [session]);

  // Timer countdown for resending email
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  function switchMode(newMode: AuthMode) {
    setMode(newMode);
    setError(null);
    setSuccessBanner(null);
    if (newMode === "forgot-password") {
      setRecoveryStep("request_email");
      setRecoveryEmail(email);
    }
  }

  // ─── Mode 1: Login ───
  async function handleLogin() {
    setError(null);
    setSuccessBanner(null);
    if (!email.trim() || !password) {
      setError("Informe e-mail e senha.");
      return;
    }
    setLoading(true);
    try {
      const res = await loginStaff(email.trim(), password);
      const newSession = await refresh();

      const role = newSession?.role || res?.role || "owner";
      if (role === "employee") {
        router.replace("/(employee)");
      } else if (role === "client") {
        router.replace("/(customer)");
      } else {
        router.replace("/(owner)");
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível entrar. Verifique suas credenciais ou sua conexão.",
      );
    } finally {
      setLoading(false);
    }
  }

  // ─── Mode 2: Register (Owner Account) ───
  async function handleRegister() {
    setError(null);
    setSuccessBanner(null);
    if (name.trim().length < 2) {
      setError("Informe seu nome completo.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Informe um e-mail válido.");
      return;
    }
    if (password.length < 8) {
      setError("A senha deve conter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas informadas não conferem.");
      return;
    }

    setLoading(true);
    try {
      await registerStaff({
        name: name.trim(),
        email: email.trim(),
        password,
        confirmPassword,
        accountType: "professional",
      });
      const res = await loginStaff(email.trim(), password);
      const newSession = await refresh();

      const role = newSession?.role || res?.role;
      if (role === "employee") {
        router.replace("/(employee)");
      } else if (role === "client") {
        router.replace("/(customer)");
      } else {
        router.replace("/(owner)");
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível criar sua conta. Verifique os dados informados.",
      );
    } finally {
      setLoading(false);
    }
  }

  // ─── Mode 3: Forgot Password ───
  async function handleRequestRecovery() {
    setError(null);
    if (!recoveryEmail.trim() || !recoveryEmail.includes("@")) {
      setError("Informe seu endereço de e-mail cadastrado.");
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(recoveryEmail.trim());
      setRecoveryStep("email_sent");
      setResendCooldown(30);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível processar a recuperação. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResendRecoveryEmail() {
    if (resendCooldown > 0 || loading) return;
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset(recoveryEmail.trim());
      setResendCooldown(30);
      setSuccessBanner("Instruções reenviadas com sucesso!");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao reenviar e-mail.");
    } finally {
      setLoading(false);
    }
  }

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score;
  };

  const passwordScore = getPasswordStrength(password);
  const strengthLabels = ["Muito fraca", "Fraca", "Média", "Forte", "Excelente"];
  const strengthColors = ["#ef4444", "#f87171", "#f59e0b", "#10b981", "#10b981"];

  const formBackground = isDark ? "#0c0e12" : "#ffffff";
  const titleColor = isDark ? "#ffffff" : "#0f172a";
  const subtitleColor = isDark ? "#94a3b8" : "#64748b";

  return (
    <Screen noPadding>
      <View style={[styles.rootContainer, { backgroundColor: formBackground }]}>
        {/* Top Graphic Hero Banner with Blue Gear Button in Top Right */}
        <View style={styles.bannerContainer}>
          <Image
            source={require("../../../assets/images/login-banner.png")}
            style={styles.bannerImage}
            contentFit="cover"
          />

          {/* Blue circular button with Settings/Gear icon on top right (como na imagem) */}
          <Pressable
            onPress={toggleTheme}
            style={[
              styles.topRightGearBtn,
              { top: Math.max(insets.top + 6, 14) },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Alternar tema"
          >
            <Settings size={22} color="#ffffff" />
          </Pressable>
        </View>

        {/* Main Form Sheet */}
        <View
          style={[
            styles.formPane,
            {
              backgroundColor: formBackground,
              paddingBottom: Math.max(insets.bottom + 8, 16),
            },
          ]}
        >
          {/* Logo Brand Header */}
          <View style={styles.logoRow}>
            <ReserveiLogo variant="full" height={30} />
          </View>

          {/* Feedback: Error banner */}
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
              <AlertCircle size={15} color={authSplit.errorText} />
              <Text style={{ color: authSplit.errorText, flex: 1, ...typography.authError, fontSize: 12 }}>
                {error}
              </Text>
            </View>
          ) : null}

          {/* Feedback: Success banner */}
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
              <CheckCircle2 size={15} color="#10b981" />
              <Text style={{ color: "#86efac", flex: 1, ...typography.authError, fontSize: 12 }}>
                {successBanner}
              </Text>
            </View>
          ) : null}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* MODE 1: LOGIN                                               */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {mode === "login" && (
            <View style={styles.formContent}>
              <View style={styles.headerBlock}>
                <Text style={[styles.title, { color: titleColor }]}>Acesse sua conta</Text>
                <Text style={[styles.subtitle, { color: subtitleColor }]}>
                  Entre para gerenciar seu plano e acessar todos os seus recursos.
                </Text>
              </View>

              <View style={styles.fieldsBlock}>
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

                <TextField
                  label="Senha"
                  required
                  icon={Lock}
                  placeholder="••••••••"
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  textContentType="password"
                  value={password}
                  onChangeText={setPassword}
                  rightElement={
                    <Pressable hitSlop={8} onPress={() => setShowPassword((v) => !v)}>
                      {showPassword ? (
                        <EyeOff size={16} color={authSplit.mutedIcon} />
                      ) : (
                        <Eye size={16} color={authSplit.mutedIcon} />
                      )}
                    </Pressable>
                  }
                />

                {/* Lembrar de mim & Esqueci minha senha */}
                <View style={styles.rememberRow}>
                  <Pressable
                    hitSlop={8}
                    onPress={() => setRemember((v) => !v)}
                    style={styles.rememberBtn}
                  >
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        borderWidth: 1.5,
                        borderColor: remember ? primaryColor : (isDark ? "#353d52" : "#cbd5e1"),
                        backgroundColor: remember ? primaryColor : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {remember ? (
                        <Check size={11} color="#0a0a0a" strokeWidth={3} />
                      ) : null}
                    </View>
                    <Text style={{ color: subtitleColor, fontSize: 13, fontWeight: "500" }}>
                      Lembrar de mim
                    </Text>
                  </Pressable>

                  <Pressable hitSlop={8} onPress={() => switchMode("forgot-password")}>
                    <Text style={{ color: primaryColor, fontSize: 13, fontWeight: "600" }}>
                      Esqueci minha senha
                    </Text>
                  </Pressable>
                </View>

                <Button label="Entrar" onPress={handleLogin} loading={loading} />
              </View>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: isDark ? "#202533" : "#e2e8f0" }]} />
                <Text style={styles.dividerText}>ou</Text>
                <View style={[styles.dividerLine, { backgroundColor: isDark ? "#202533" : "#e2e8f0" }]} />
              </View>

              {/* Secondary PIN Action Feature Card */}
              <Pressable
                style={[
                  styles.featureCard,
                  {
                    backgroundColor: isDark ? "#141720" : "#f8fafc",
                    borderColor: isDark ? "#242938" : "#e2e8f0",
                  },
                ]}
                onPress={() => router.push("/(auth)/customer-access")}
              >
                <View
                  style={[
                    styles.featureIconBadge,
                    { backgroundColor: primaryColor },
                  ]}
                >
                  <KeyRound size={20} color="#0a0a0a" />
                </View>

                <View style={styles.featureTextCol}>
                  <Text style={[styles.featureTitle, { color: titleColor }]}>
                    Consultar reservas com PIN
                  </Text>
                  <Text style={[styles.featureSubtitle, { color: subtitleColor }]}>
                    Acesse seus agendamentos rápidos com celular e PIN
                  </Text>
                </View>

                <ChevronRight size={18} color={isDark ? "#64748b" : "#94a3b8"} />
              </Pressable>

              {/* Switch to Register */}
              <View style={styles.switchRow}>
                <Text style={{ color: subtitleColor, fontSize: 12.5 }}>
                  É dono de estabelecimento?{" "}
                </Text>
                <Pressable onPress={() => switchMode("register")}>
                  <Text style={{ color: primaryColor, fontSize: 12.5, fontWeight: "700" }}>
                    Criar conta de proprietário
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* MODE 2: REGISTER (Owner Account)                            */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {mode === "register" && (
            <View style={styles.formContent}>
              <View style={styles.headerBlock}>
                <Text style={[styles.title, { color: titleColor }]}>
                  Cadastre seu estabelecimento
                </Text>
                <Text style={[styles.subtitle, { color: subtitleColor }]}>
                  Crie sua conta de proprietário e teste gratuitamente por 15 dias.
                </Text>
              </View>

              <View style={styles.fieldsBlock}>
                <TextField
                  label="Nome completo"
                  required
                  icon={User}
                  placeholder="Seu nome completo"
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
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

                <View style={{ gap: 4 }}>
                  <TextField
                    label="Senha"
                    required
                    icon={Lock}
                    placeholder="••••••••"
                    secureTextEntry={!showPassword}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    value={password}
                    onChangeText={setPassword}
                    rightElement={
                      <Pressable hitSlop={8} onPress={() => setShowPassword((v) => !v)}>
                        {showPassword ? (
                          <EyeOff size={16} color={authSplit.mutedIcon} />
                        ) : (
                          <Eye size={16} color={authSplit.mutedIcon} />
                        )}
                      </Pressable>
                    }
                  />

                  {password.length > 0 ? (
                    <View style={{ gap: 3, paddingTop: 2 }}>
                      <View style={{ flexDirection: "row", gap: 4 }}>
                        {[1, 2, 3, 4].map((step) => (
                          <View
                            key={step}
                            style={{
                              flex: 1,
                              height: 3.5,
                              borderRadius: 2,
                              backgroundColor:
                                passwordScore >= step
                                   ? strengthColors[passwordScore]
                                  : (isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"),
                            }}
                          />
                        ))}
                      </View>
                      <Text
                        style={{
                          fontSize: 10.5,
                          color: strengthColors[passwordScore],
                          fontWeight: "600",
                        }}
                      >
                        Força: {strengthLabels[passwordScore]}
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 11, color: subtitleColor }}>
                      Pelo menos 8 caracteres
                    </Text>
                  )}
                </View>

                <View style={{ gap: 4 }}>
                  <TextField
                    label="Confirmar senha"
                    required
                    icon={Lock}
                    placeholder="••••••••"
                    secureTextEntry={!showConfirmPassword}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    rightElement={
                      <Pressable hitSlop={8} onPress={() => setShowConfirmPassword((v) => !v)}>
                        {showConfirmPassword ? (
                          <EyeOff size={16} color={authSplit.mutedIcon} />
                        ) : (
                          <Eye size={16} color={authSplit.mutedIcon} />
                        )}
                      </Pressable>
                    }
                  />

                  {confirmPassword.length > 0 && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingTop: 1 }}>
                      {password === confirmPassword ? (
                        <Check size={12} color="#10b981" strokeWidth={2.5} />
                      ) : (
                        <X size={12} color={colors.danger} strokeWidth={2.5} />
                      )}
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "600",
                          color: password === confirmPassword ? "#10b981" : colors.danger,
                        }}
                      >
                        {password === confirmPassword ? "As senhas coincidem" : "As senhas não coincidem"}
                      </Text>
                    </View>
                  )}
                </View>

                <Button label="Criar conta grátis" onPress={handleRegister} loading={loading} />
              </View>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: isDark ? "#202533" : "#e2e8f0" }]} />
                <Text style={styles.dividerText}>ou</Text>
                <View style={[styles.dividerLine, { backgroundColor: isDark ? "#202533" : "#e2e8f0" }]} />
              </View>

              {/* Secondary PIN Action Feature Card */}
              <Pressable
                style={[
                  styles.featureCard,
                  {
                    backgroundColor: isDark ? "#141720" : "#f8fafc",
                    borderColor: isDark ? "#242938" : "#e2e8f0",
                  },
                ]}
                onPress={() => router.push("/(auth)/customer-access")}
              >
                <View
                  style={[
                    styles.featureIconBadge,
                    { backgroundColor: primaryColor },
                  ]}
                >
                  <KeyRound size={20} color="#0a0a0a" />
                </View>

                <View style={styles.featureTextCol}>
                  <Text style={[styles.featureTitle, { color: titleColor }]}>
                    Consultar reservas com PIN
                  </Text>
                  <Text style={[styles.featureSubtitle, { color: subtitleColor }]}>
                    Acesse seus agendamentos rápidos com celular e PIN
                  </Text>
                </View>

                <ChevronRight size={18} color={isDark ? "#64748b" : "#94a3b8"} />
              </Pressable>

              {/* Switch to Login */}
              <View style={styles.switchRow}>
                <Text style={{ color: subtitleColor, fontSize: 12.5 }}>Já tem uma conta? </Text>
                <Pressable onPress={() => switchMode("login")}>
                  <Text style={{ color: primaryColor, fontSize: 12.5, fontWeight: "700" }}>
                    Entrar
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* MODE 3: FORGOT PASSWORD                                     */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {mode === "forgot-password" && (
            <View style={styles.formContent}>
              {recoveryStep === "request_email" ? (
                <>
                  <View style={styles.headerBlock}>
                    <Text style={[styles.title, { color: titleColor }]}>Recuperar senha</Text>
                    <Text style={[styles.subtitle, { color: subtitleColor }]}>
                      Informe o e-mail cadastrado na sua conta para receber as instruções de recuperação.
                    </Text>
                  </View>

                  <View style={styles.fieldsBlock}>
                    <TextField
                      label="E-mail cadastrado"
                      required
                      icon={Mail}
                      placeholder="seu@email.com"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoComplete="email"
                      textContentType="emailAddress"
                      value={recoveryEmail}
                      onChangeText={setRecoveryEmail}
                      autoFocus
                    />

                    <Button label="Enviar instruções" onPress={handleRequestRecovery} loading={loading} />
                  </View>

                  {/* Switch back to Login */}
                  <View style={styles.switchRow}>
                    <Text style={{ color: subtitleColor, fontSize: 12.5 }}>Lembrou sua senha? </Text>
                    <Pressable onPress={() => switchMode("login")}>
                      <Text style={{ color: primaryColor, fontSize: 12.5, fontWeight: "700" }}>
                        Voltar ao login
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.headerBlock}>
                    <Text style={[styles.title, { color: titleColor }]}>Verifique seu e-mail</Text>
                    <Text style={[styles.subtitle, { color: subtitleColor }]}>
                      Enviamos as orientações de redefinição para o endereço abaixo.
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.sentCard,
                      {
                        backgroundColor: isDark ? "#141720" : "#f8fafc",
                        borderColor: isDark ? "#242938" : "#e2e8f0",
                      },
                    ]}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: colors.primarySoft,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MailCheck size={22} color={primaryColor} />
                    </View>

                    <View
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 5,
                        backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.05)",
                        borderRadius: radius.pill,
                      }}
                    >
                      <Text style={{ color: titleColor, fontSize: 12.5, fontWeight: "600" }}>
                        {recoveryEmail}
                      </Text>
                    </View>

                    <Text style={{ color: subtitleColor, fontSize: 12, textAlign: "center", lineHeight: 17 }}>
                      Abra sua caixa de entrada e siga as instruções para redefinir sua senha com segurança.
                    </Text>
                  </View>

                  <Button label="Voltar ao login" onPress={() => switchMode("login")} />

                  <View style={styles.switchRow}>
                    <Text style={{ color: subtitleColor, fontSize: 12.5 }}>Não recebeu o e-mail? </Text>
                    <Pressable
                      onPress={handleResendRecoveryEmail}
                      disabled={resendCooldown > 0 || loading}
                      style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                    >
                      <RotateCcw size={12} color={primaryColor} />
                      <Text style={{ color: primaryColor, fontSize: 12.5, fontWeight: "600" }}>
                        {resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : "Reenviar e-mail"}
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          )}

          {/* Footer Terms */}
          <Text style={[styles.footerText, { color: subtitleColor }]}>
            Ao continuar, você concorda com nossos{" "}
            <Text style={{ textDecorationLine: "underline", color: titleColor }}>Termos de Uso</Text>{" "}
            e{" "}
            <Text style={{ textDecorationLine: "underline", color: titleColor }}>Política de Privacidade</Text>.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  bannerContainer: {
    width: "100%",
    height: 180,
    backgroundColor: "#0c0e12",
    overflow: "hidden",
    position: "relative",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  topRightGearBtn: {
    position: "absolute",
    right: 18,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0084ff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 20,
  },
  formPane: {
    flex: 1,
    marginTop: -16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 16,
    maxWidth: 460,
    width: "100%",
    alignSelf: "center",
    justifyContent: "space-between",
  },
  logoRow: {
    marginBottom: 2,
  },
  alertBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 6,
    marginBottom: 2,
  },
  formContent: {
    gap: 12,
  },
  headerBlock: {
    gap: 4,
  },
  title: {
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  fieldsBlock: {
    gap: 11,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: -2,
    marginBottom: 1,
  },
  rememberBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 2,
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
  featureCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  featureIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  featureTextCol: {
    flex: 1,
    marginLeft: 12,
    marginRight: 6,
  },
  featureTitle: {
    fontSize: 14.5,
    fontWeight: "700",
  },
  featureSubtitle: {
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 2,
  },
  sentCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    alignItems: "center",
    gap: 10,
  },
  footerText: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 15,
  },
});



