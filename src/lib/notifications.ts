import { isFirebaseConfigured } from "./firebase";

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
