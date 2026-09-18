import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { TextField } from "@/components/ui/text-field";
import { useTheme } from "@/hooks/use-theme";
import { ApiError } from "@/lib/api-client";
import {
  checkCustomerPhone,
  identifyCustomer,
  loginCustomerWithPin,
  setupCustomerPin,
} from "@/lib/auth";
import { useSession } from "@/lib/session-context";

type Step = "phone" | "pin" | "identify" | "setup-pin";

export default function CustomerAccessScreen() {
  const { colors } = useTheme();
  const { refresh } = useSession();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function fail(err: unknown, fallback: string) {
    setError(err instanceof ApiError ? err.message : fallback);
  }

  async function handlePhoneSubmit() {
    setError(null);
    if (phone.trim().length < 10) {
      setError("Informe um telefone válido com DDD.");
      return;
    }
    setLoading(true);
    try {
      const result = await checkCustomerPhone(phone.trim());
      if (result.status === "HAS_PIN") setStep("pin");
      else if (result.status === "NEEDS_PIN_SETUP") setStep("setup-pin");
      else setStep("identify");
    } catch (err) {
      fail(err, "Não foi possível verificar o telefone.");
    } finally {
      setLoading(false);
    }
  }

  async function completeLogin() {
    await loginCustomerWithPin(pin, phone.trim());
    await refresh();
    router.replace("/");
  }

  async function handlePinSubmit() {
    setError(null);
    if (pin.length !== 6) {
      setError("O PIN deve conter 6 números.");
      return;
    }
    setLoading(true);
    try {
      await completeLogin();
    } catch (err) {
      fail(err, "PIN incorreto. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleIdentifySubmit() {
    setError(null);
    if (name.trim().length < 2 || !email.includes("@")) {
      setError("Informe seu nome completo e um e-mail válido.");
      return;
    }
    setLoading(true);
    try {
      const result = await identifyCustomer({ name: name.trim(), phone: phone.trim(), email: email.trim() });
      if (result.hasPin) {
        // Backend detected this phone already has a PIN (race with another device) —
        // don't let identify silently take over the account, send them to PIN login.
        setStep("pin");
      } else {
        setStep("setup-pin");
      }
    } catch (err) {
      fail(err, "Não foi possível identificar seus dados.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetupPinSubmit() {
    setError(null);
    if (pin.length !== 6 || confirmPin.length !== 6) {
      setError("O PIN deve conter 6 números.");
      return;
    }
    if (pin !== confirmPin) {
      setError("Os PINs não coincidem.");
      return;
    }
    setLoading(true);
    try {
      await setupCustomerPin({ pin, confirmPin, phone: phone.trim() });
      await completeLogin();
    } catch (err) {
      fail(err, "Não foi possível criar seu PIN.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          {step === "phone" && "Minhas reservas"}
          {step === "pin" && "Digite seu PIN"}
          {step === "identify" && "Primeiro acesso"}
          {step === "setup-pin" && "Crie seu PIN de acesso"}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {step === "phone" && "Informe o telefone usado no agendamento."}
          {step === "pin" && "Use o PIN de 6 dígitos cadastrado para este telefone."}
          {step === "identify" && "Não encontramos este telefone. Complete seu cadastro."}
          {step === "setup-pin" && "Crie um PIN de 6 dígitos para acessar suas reservas depois."}
        </Text>
      </View>

      <View style={styles.form}>
        {step === "phone" && (
          <>
            <TextField
              label="Telefone / WhatsApp"
              placeholder="(11) 99999-9999"
              keyboardType="phone-pad"
              autoComplete="tel"
              value={phone}
              onChangeText={setPhone}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Button label="Continuar" onPress={handlePhoneSubmit} loading={loading} />
          </>
        )}

        {step === "pin" && (
          <>
            <TextField
              label="PIN de 6 dígitos"
              placeholder="••••••"
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              value={pin}
              onChangeText={setPin}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Button label="Entrar" onPress={handlePinSubmit} loading={loading} />
          </>
        )}

        {step === "identify" && (
          <>
            <TextField label="Nome completo" placeholder="Seu nome" value={name} onChangeText={setName} />
            <TextField
              label="E-mail"
              placeholder="seu@email.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Button label="Continuar" onPress={handleIdentifySubmit} loading={loading} />
          </>
        )}

        {step === "setup-pin" && (
          <>
            <TextField
              label="Novo PIN"
              placeholder="••••••"
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              value={pin}
              onChangeText={setPin}
            />
            <TextField
              label="Confirme o PIN"
              placeholder="••••••"
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              value={confirmPin}
              onChangeText={setConfirmPin}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Button label="Criar PIN e entrar" onPress={handleSetupPinSubmit} loading={loading} />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: "center", gap: 32 },
  header: { gap: 8 },
  title: { fontSize: 24, fontWeight: "700" },
  subtitle: { fontSize: 14, lineHeight: 20 },
  form: { gap: 14 },
  errorText: { color: "#ee8a8f", fontSize: 13 },
});
