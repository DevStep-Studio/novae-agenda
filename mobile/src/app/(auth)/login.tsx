import { Image } from "expo-image";
import { router } from "expo-router";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MailCheck,
  RotateCcw,
  User,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { TextField } from "@/components/ui/text-field";
import { authSplit, colors, radius, typography } from "@/constants/design-tokens";
import { ApiError } from "@/lib/api-client";
import { loginStaff, registerStaff, requestPasswordReset } from "@/lib/auth";
import { useSession } from "@/lib/session-context";

type AuthMode = "login" | "register" | "forgot-password";
type RecoveryStep = "request_email" | "email_sent";

export default function LoginScreen() {
  const { refresh } = useSession();

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
      await loginStaff(email.trim(), password);
      await refresh();
      router.replace("/");
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
      await loginStaff(email.trim(), password);
      await refresh();
      router.replace("/");
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

          {/* Feedback: Error banner */}
          {error ? (
            <View
              className="flex-row items-center gap-2 rounded-lg border px-3.5 py-2.5"
              style={{ backgroundColor: authSplit.errorBackground, borderColor: authSplit.errorBorder }}
            >
              <AlertCircle size={16} color={authSplit.errorText} />
              <Text style={{ color: authSplit.errorText, flex: 1, ...typography.authError }}>{error}</Text>
            </View>
          ) : null}

          {/* Feedback: Success banner */}
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
          {/* MODE 1: LOGIN                                               */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {mode === "login" && (
            <View className="gap-6">
              <View>
                <Text style={{ color: "#f5f5f5", ...typography.authTitle }}>Acesse sua conta</Text>
                <Text style={{ color: "#a3a3a3", marginTop: 8, ...typography.authSubtitle }}>
                  Entre para gerenciar seu plano e acessar todos os seus recursos.
                </Text>
              </View>

              <View className="gap-[18px]">
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
                <View className="flex-row items-center justify-between">
                  <Pressable
                    hitSlop={8}
                    onPress={() => setRemember((v) => !v)}
                    className="flex-row items-center gap-2"
                  >
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        borderWidth: 1.5,
                        borderColor: remember ? colors.primary : authSplit.inputBorder,
                        backgroundColor: remember ? colors.primary : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {remember ? <Text style={{ color: "#0a0a0a", fontSize: 12, fontWeight: "900" }}>✓</Text> : null}
                    </View>
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Lembrar de mim</Text>
                  </Pressable>

                  <Pressable hitSlop={8} onPress={() => switchMode("forgot-password")}>
                    <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>
                      Esqueci minha senha
                    </Text>
                  </Pressable>
                </View>

                <Button label="Entrar" onPress={handleLogin} loading={loading} />
              </View>

              {/* Divider */}
              <View className="flex-row items-center gap-3">
                <View className="h-px flex-1" style={{ backgroundColor: authSplit.inputBorder }} />
                <Text style={{ color: authSplit.mutedIcon, fontSize: 12, fontWeight: "500" }}>ou é cliente?</Text>
                <View className="h-px flex-1" style={{ backgroundColor: authSplit.inputBorder }} />
              </View>

              {/* Secondary button */}
              <Pressable
                className="h-[46px] flex-row items-center justify-center gap-2 rounded-[10px] border"
                style={{ backgroundColor: authSplit.inputBackground, borderColor: authSplit.inputBorder }}
                onPress={() => router.push("/(auth)/customer-access")}
              >
                <CalendarDays size={16} color="#ffffff" />
                <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "600" }}>
                  Consultar minhas reservas com PIN
                </Text>
              </Pressable>

              {/* Switch to Register */}
              <View className="flex-row items-center justify-center gap-1.5 pt-2">
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>É dono de estabelecimento?</Text>
                <Pressable onPress={() => switchMode("register")}>
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>
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
            <View className="gap-6">
              <View>
                <Text style={{ color: "#f5f5f5", ...typography.authTitle }}>Cadastre seu estabelecimento</Text>
                <Text style={{ color: "#a3a3a3", marginTop: 8, ...typography.authSubtitle }}>
                  Crie sua conta de proprietário e teste gratuitamente por 15 dias.
                </Text>
              </View>

              <View className="gap-[18px]">
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

                <View className="gap-1.5">
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
                    <View className="gap-1 pt-1">
                      <View className="flex-row gap-1">
                        {[1, 2, 3, 4].map((step) => (
                          <View
                            key={step}
                            style={{
                              flex: 1,
                              height: 4,
                              borderRadius: 2,
                              backgroundColor:
                                passwordScore >= step
                                  ? strengthColors[passwordScore]
                                  : "rgba(255, 255, 255, 0.1)",
                            }}
                          />
                        ))}
                      </View>
                      <Text style={{ fontSize: 11, color: strengthColors[passwordScore], fontWeight: "600" }}>
                        Força: {strengthLabels[passwordScore]}
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 11.5, color: "#737373" }}>Pelo menos 8 caracteres</Text>
                  )}
                </View>

                <View className="gap-1.5">
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
                    <Text
                      style={{
                        fontSize: 11.5,
                        fontWeight: "600",
                        color: password === confirmPassword ? "#10b981" : colors.danger,
                      }}
                    >
                      {password === confirmPassword ? "✓ As senhas coincidem" : "✕ As senhas não coincidem"}
                    </Text>
                  )}
                </View>

                <Button label="Criar conta grátis" onPress={handleRegister} loading={loading} />
              </View>

              {/* Divider */}
              <View className="flex-row items-center gap-3">
                <View className="h-px flex-1" style={{ backgroundColor: authSplit.inputBorder }} />
                <Text style={{ color: authSplit.mutedIcon, fontSize: 12, fontWeight: "500" }}>ou acesse com</Text>
                <View className="h-px flex-1" style={{ backgroundColor: authSplit.inputBorder }} />
              </View>

              {/* Secondary button */}
              <Pressable
                className="h-[46px] flex-row items-center justify-center gap-2 rounded-[10px] border"
                style={{ backgroundColor: authSplit.inputBackground, borderColor: authSplit.inputBorder }}
                onPress={() => router.push("/(auth)/customer-access")}
              >
                <CalendarDays size={16} color="#ffffff" />
                <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "600" }}>
                  Ver minhas reservas
                </Text>
              </Pressable>

              {/* Switch to Login */}
              <View className="flex-row items-center justify-center gap-1.5 pt-2">
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Já tem uma conta?</Text>
                <Pressable onPress={() => switchMode("login")}>
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>
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
            <View className="gap-6">
              {recoveryStep === "request_email" ? (
                <>
                  <View>
                    <Text style={{ color: "#f5f5f5", ...typography.authTitle }}>Recuperar senha</Text>
                    <Text style={{ color: "#a3a3a3", marginTop: 8, ...typography.authSubtitle }}>
                      Informe o e-mail cadastrado na sua conta para receber as instruções de recuperação.
                    </Text>
                  </View>

                  <View className="gap-[18px]">
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
                  <View className="flex-row items-center justify-center gap-1.5 pt-4">
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Lembrou sua senha?</Text>
                    <Pressable onPress={() => switchMode("login")}>
                      <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>
                        Voltar ao login
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <View>
                    <Text style={{ color: "#f5f5f5", ...typography.authTitle }}>Verifique seu e-mail</Text>
                    <Text style={{ color: "#a3a3a3", marginTop: 8, ...typography.authSubtitle }}>
                      Enviamos as orientações de redefinição para o endereço abaixo.
                    </Text>
                  </View>

                  <View
                    className="rounded-xl border p-4 items-center gap-3"
                    style={{ backgroundColor: authSplit.inputBackground, borderColor: authSplit.inputBorder }}
                  >
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: colors.primarySoft,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MailCheck size={24} color={colors.primary} />
                    </View>

                    <View
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 5,
                        backgroundColor: "rgba(255, 255, 255, 0.06)",
                        borderRadius: radius.pill,
                      }}
                    >
                      <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "600" }}>
                        {recoveryEmail}
                      </Text>
                    </View>

                    <Text style={{ color: colors.textSecondary, fontSize: 12.5, textAlign: "center", lineHeight: 18 }}>
                      Abra sua caixa de entrada e siga as instruções para redefinir sua senha com segurança.
                    </Text>
                  </View>

                  <Button label="Voltar ao login" onPress={() => switchMode("login")} />

                  <View className="flex-row items-center justify-center gap-1.5 pt-2">
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Não recebeu o e-mail?</Text>
                    <Pressable
                      onPress={handleResendRecoveryEmail}
                      disabled={resendCooldown > 0 || loading}
                      className="flex-row items-center gap-1"
                    >
                      <RotateCcw size={13} color={colors.primary} />
                      <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>
                        {resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : "Reenviar e-mail"}
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}
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
