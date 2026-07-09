import { isFirebaseConfigured } from "./firebase";

// Guard so foreground FCM listener is registered at most once per session
// (revisiting Settings must not stack duplicate Notification popups).
let foregroundListenerRegistered = false;

type ForegroundPayload = { notification?: { title?: string; body?: string } };

function registerForegroundListener<M>(
  messaging: M,
  onMessage: (m: M, cb: (payload: ForegroundPayload) => void) => unknown
): void {
  if (foregroundListenerRegistered) return;
  foregroundListenerRegistered = true;
  onMessage(messaging, (payload: ForegroundPayload) => {
    const { title, body } = payload.notification || {};
    if (title && typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, {
        body: body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-72.png",
      });
    }
  });
}

export async function initFCM(): Promise<string | null> {
  if (!isFirebaseConfigured) {
    console.warn("[PlayMatch] FCM not available in mock mode");
    return null;
  }
  try {
    const { getMessaging, getToken } = await import("firebase/messaging");
    const { app } = await import("./firebase");
    if (!app) return null;
    const messaging = getMessaging(app);
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    });
    return token;
  } catch (err) {
    console.error("[PlayMatch] FCM init failed:", err);
    return null;
  }
}

/**
 * Request notification permission, get FCM token, and store it on the user's Firestore doc.
 * Returns the token string on success, or null on failure/denial.
 */
export async function enablePushNotifications(userId: string): Promise<string | null> {
  if (!isFirebaseConfigured) {
    console.warn("[PlayMatch] Push notifications not available in mock mode");
    return null;
  }

  // Check browser support
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    console.warn("[PlayMatch] Push notifications not supported in this browser");
    return null;
  }

  try {
    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("[PlayMatch] Notification permission denied");
      return null;
    }

    // Get FCM token
    const { getMessaging, getToken, onMessage } = await import("firebase/messaging");
    const { app } = await import("./firebase");
    if (!app) return null;

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    });

    if (!token) return null;

    // Save token to the user's PRIVATE subcollection so it is never delivered
    // to other clients via getPlayers().
    const { setUserPrivate } = await import("./firestore");
    await setUserPrivate(userId, { fcmToken: token });

    // Listen for foreground messages (registered at most once per session).
    registerForegroundListener(messaging, onMessage);

    return token;
  } catch (err) {
    console.error("[PlayMatch] Failed to enable push notifications:", err);
    return null;
  }
}

/** Check if push notifications are currently enabled */
export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

/** Get current notification permission status */
export function getPushPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

export interface NotificationPreferences {
  messages: boolean;
  matchInvites: boolean;
  reminders: boolean;
  aiSuggestions: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export const defaultPreferences: NotificationPreferences = {
  messages: true,
  matchInvites: true,
  reminders: true,
  aiSuggestions: true,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
};

export function loadPreferences(): NotificationPreferences {
  if (typeof window === "undefined") return defaultPreferences;
  try {
    const saved = localStorage.getItem("playmatch_notification_prefs");
    return saved ? { ...defaultPreferences, ...JSON.parse(saved) } : defaultPreferences;
  } catch {
    return defaultPreferences;
  }
}

export function savePreferences(prefs: NotificationPreferences): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("playmatch_notification_prefs", JSON.stringify(prefs));
}
