import type { NativeSetup } from "@/components/native-provider";
import { loadMessaging, registerNativePushIfGranted, safeNotificationPath, sendTokenToServer } from "@/lib/native-push";

/**
 * Native launch setup for push (P2): re-register the FCM token when permission
 * is already granted, keep the server's copy current when FCM rotates it, and
 * route a notification tap to its `data.url` (same-origin paths only).
 */
export const setupNativePush: NativeSetup = async () => {
  const fcm = (await loadMessaging())?.fcm;
  if (!fcm) return;

  const handles = await Promise.all([
    fcm.addListener("notificationActionPerformed", (event) => {
      const data = event.notification?.data as { url?: unknown } | undefined;
      const path = safeNotificationPath(data?.url, window.location.origin);
      if (path) window.location.assign(path);
    }),
    fcm.addListener("tokenReceived", ({ token }) => {
      if (token) sendTokenToServer(token).catch(() => {});
    }),
  ]);

  registerNativePushIfGranted().catch(() => {});

  return () => handles.forEach((h) => h.remove());
};
