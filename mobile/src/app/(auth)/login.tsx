import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { TextField } from "@/components/ui/text-field";
import { useTheme } from "@/hooks/use-theme";
import { ApiError } from "@/lib/api-client";
import { loginStaff } from "@/lib/auth";
import { useSession } from "@/lib/session-context";

export default function LoginScreen() {
  const { colors } = useTheme();
  const { refresh } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <Text style={[styles.brand, { color: colors.primary }]}>reservei</Text>
        <Text style={[styles.title, { color: colors.text }]}>Acesse sua conta</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Entre para gerenciar sua agenda, equipe e atendimentos.
        </Text>
      </View>

      <View style={styles.form}>
        <TextField
          label="E-mail"
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
          placeholder="••••••••"
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          value={password}
          onChangeText={setPassword}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button label="Entrar" onPress={handleSubmit} loading={loading} />
      </View>

      <Pressable
        style={styles.customerLink}
        onPress={() => router.push("/(auth)/customer-access")}
      >
        <Text style={{ color: colors.textSecondary }}>
          É cliente? <Text style={{ color: colors.primary, fontWeight: "700" }}>Consultar minhas reservas com PIN</Text>
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: "center", gap: 32 },
  header: { gap: 8 },
  brand: { fontSize: 15, fontWeight: "800", letterSpacing: 0.4 },
  title: { fontSize: 26, fontWeight: "700" },
  subtitle: { fontSize: 14, lineHeight: 20 },
  form: { gap: 14 },
  errorText: { color: "#ee8a8f", fontSize: 13 },
  customerLink: { alignItems: "center", paddingVertical: 12 },
});
