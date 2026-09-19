import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const BIOMETRICS_PREF_KEY = "reservei_biometrics_enabled";

export async function isBiometricsSupported(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && isEnrolled;
}

export async function getBiometricsType(): Promise<string> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return "Face ID";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return "Impressão Digital";
  }
  return "Biometria";
}

export async function isBiometricsEnabled(): Promise<boolean> {
  try {
    const val = await SecureStore.getItemAsync(BIOMETRICS_PREF_KEY);
    return val === "true";
  } catch {
    return false;
  }
}

export async function setBiometricsEnabled(enabled: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(BIOMETRICS_PREF_KEY, enabled ? "true" : "false");
  } catch {
    // ignore
  }
}

export async function promptBiometricAuth(promptMessage = "Desbloquear o Reservei"): Promise<boolean> {
  try {
    const supported = await isBiometricsSupported();
    if (!supported) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: "Cancelar",
      fallbackLabel: "Usar Senha / PIN",
      disableDeviceFallback: false,
    });

    return result.success;
  } catch {
    return false;
  }
}
