import Constants from "expo-constants";
import * as Device from "expo-device";
import { useEffect } from "react";
import { Platform } from "react-native";
import { useAuth } from "@/lib/auth";
import { useHousehold } from "@/lib/hooks/useHousehold";
import { supabase } from "@/lib/supabase";

const isExpoGo = Constants.appOwnership === "expo";

export function usePushToken() {
  const { session } = useAuth();
  const { data: householdId } = useHousehold();

  useEffect(() => {
    if (!session || !householdId || isExpoGo) return;
    registerAndSaveToken(session.user.id, householdId);
  }, [session?.user.id, householdId]);
}

async function registerAndSaveToken(userId: string, householdId: string) {
  if (!Device.isDevice) return;

  // Dynamic import — expo-notifications is not available in Expo Go SDK 53+
  const Notifications = await import("expo-notifications");

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("expiry", {
      name: "Dates d'expiration",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const projectId =
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra as any)?.eas?.projectId;

  if (!projectId) {
    console.warn("[push] No EAS projectId — run `eas init` to enable push tokens");
    return;
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

  await supabase
    .from("household_members")
    .update({ expo_push_token: token, push_token_updated_at: new Date().toISOString() })
    .eq("household_id", householdId)
    .eq("user_id", userId);
}
