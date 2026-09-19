import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import * as Application from "expo-application";
import * as SecureStore from "expo-secure-store";
import { api } from "./api-client";

const PUSH_TOKEN_STORAGE_KEY = "reservei_push_token";

// Configure how notifications are handled when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

/**
 * Configure native notification channels for Android 8.0+ (API 26+)
 */
export async function setupNotificationChannels() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("appointments", {
      name: "Agendamentos e Reservas",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#10B981",
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
    });

    await Notifications.setNotificationChannelAsync("reminders", {
      name: "Lembretes de Horários",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 200, 200],
      lightColor: "#10B981",
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
    });

    await Notifications.setNotificationChannelAsync("default", {
      name: "Geral",
      importance: Notifications.AndroidImportance.DEFAULT,
      showBadge: true,
    });
  }
}

/**
 * Checks current push notification permission status.
 */
export async function getPushNotificationPermissionStatus(): Promise<Notifications.PermissionStatus> {
  const settings = await Notifications.getPermissionsAsync();
  return settings.status;
}

/**
 * Requests push notification permission from the OS.
 */
export async function requestPushNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowDisplayInCarPlay: false,
        allowCriticalAlerts: false,
      },
    });
    finalStatus = status;
  }

  return finalStatus === "granted";
}

/**
 * Registers the device with Expo Push Service and syncs the token with the Reservei backend.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    await setupNotificationChannels();

    if (!Device.isDevice) {
      console.log("[PushNotifications] Push notifications are only supported on physical devices.");
      return null;
    }

    const hasPermission = await requestPushNotificationPermissions();
    if (!hasPermission) {
      console.log("[PushNotifications] Permission not granted by user.");
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      undefined;

    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const pushToken = tokenResponse.data;
    if (!pushToken) return null;

    // Save token locally in secure store
    await SecureStore.setItemAsync(PUSH_TOKEN_STORAGE_KEY, pushToken);

    // Register token with backend
    const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "unknown";
    const appVersion = Application.nativeApplicationVersion || "1.0.0";
    const environment = __DEV__ ? "development" : "production";

    await api<{ data: { ok: boolean; deviceId: string } }>("/api/push-devices/register", {
      method: "POST",
      body: JSON.stringify({
        pushToken,
        platform,
        appVersion,
        environment,
      }),
    });

    return pushToken;
  } catch (error) {
    console.warn("[PushNotifications] Failed to register push token:", error);
    return null;
  }
}

/**
 * Unregisters the push token on the backend upon user logout.
 */
export async function unregisterPushNotifications(): Promise<void> {
  try {
    const pushToken = await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY);
    if (!pushToken) return;

    await api("/api/push-devices/unregister", {
      method: "POST",
      body: JSON.stringify({ pushToken }),
    });

    await SecureStore.deleteItemAsync(PUSH_TOKEN_STORAGE_KEY);
  } catch (error) {
    console.warn("[PushNotifications] Failed to unregister push token:", error);
  }
}

/**
 * Set up listeners for received notifications and user interactions (deep linking).
 */
export function setupNotificationListeners(
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationResponse?: (response: Notifications.NotificationResponse) => void
) {
  const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
    if (onNotificationReceived) {
      onNotificationReceived(notification);
    }
  });

  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    if (onNotificationResponse) {
      onNotificationResponse(response);
    }
  });

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}
