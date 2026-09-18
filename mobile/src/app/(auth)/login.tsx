import { Image } from "expo-image";
import { router } from "expo-router";
import { AlertCircle, CalendarDays, Eye, EyeOff, Lock, Mail } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { TextField } from "@/components/ui/text-field";
import { authSplit, typography } from "@/constants/design-tokens";
import { ApiError } from "@/lib/api-client";
import { loginStaff } from "@/lib/auth";
import { useSession } from "@/lib/session-context";

// Mirrors the real production /login screen (src/components/auth/auth-screen.tsx
// "mode === login" branch + `.auth-split-*` in globals.css, root project) — NOT
// the simpler `.auth-shell`/`.auth-card` pattern, which is a different screen
// family used only by onboarding/password-reset. See MOBILE_DESIGN_SYSTEM.md.
//
// Intentionally dropped from the web version: the "Lembrar de mim" checkbox
// (the native session already persists indefinitely via SecureStore — that
// checkbox exists on web only because browsers don't otherwise persist login)
// and "Esqueceu a senha?" (no forgot-password screen/API wrapper exists in the
// mobile app yet; shipping the link with nowhere to go would be a fake affordance).
export default function LoginScreen() {
  const { refresh } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
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
        err instanceof ApiError ? err.message : "Não foi possível entrar. Verifique sua conexão.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen noPadding>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <Image
          source={require("../../../assets/images/login-banner.png")}
          style={{ width: "100%", height: authSplit.bannerHeight }}
          contentFit="cover"
        />

        <View className="flex-1 gap-6 px-3.5 pb-8 pt-4" style={{ backgroundColor: authSplit.formBackground }}>
          <Image
            source={require("../../../assets/images/reservei-logo.png")}
            style={{ width: 80, height: 34 }}
            contentFit="contain"
          />

          <View className="gap-6">
            <View>
              <Text style={{ color: "#f5f5f5", ...typography.authTitle }}>Acesse sua conta</Text>
              <Text style={{ color: "#a3a3a3", marginTop: 8, ...typography.authSubtitle }}>
                Entre para gerenciar sua agenda, equipe e atendimentos.
              </Text>
            </View>

            {error ? (
              <View
                className="flex-row items-center gap-2 rounded-lg border px-3.5 py-2.5"
                style={{ backgroundColor: authSplit.errorBackground, borderColor: authSplit.errorBorder }}
              >
                <AlertCircle size={16} color={authSplit.errorText} />
                <Text style={{ color: authSplit.errorText, flex: 1, ...typography.authError }}>{error}</Text>
              </View>
            ) : null}

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

              <Button label="Entrar" onPress={handleSubmit} loading={loading} />
            </View>
          </View>

          {/* .auth-split-divider, globals.css:9686-9708 */}
          <View className="flex-row items-center gap-3">
            <View className="h-px flex-1" style={{ backgroundColor: authSplit.inputBorder }} />
            <Text style={{ color: authSplit.mutedIcon, fontSize: 12, fontWeight: "500" }}>ou é cliente?</Text>
            <View className="h-px flex-1" style={{ backgroundColor: authSplit.inputBorder }} />
          </View>

          {/* .auth-split-secondary-btn, globals.css:9710-9731 */}
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
        </View>
      </ScrollView>
    </Screen>
  );
}
