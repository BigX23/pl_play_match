/**
 * Notification preferences (localStorage) + push scaffolding.
 * FCM was removed with Firebase; Web Push (VAPID) arrives in Phase 6 —
 * until then enablePushNotifications reports unavailable.
 */

export async function initFCM(): Promise<string | null> {
  return null; // replaced by Web Push in Phase 6
}

export async function enablePushNotifications(_userId: string): Promise<string | null> {
  console.warn("[PlayMatch] Push notifications return in Phase 6 (Web Push)");
  return null;
}

/** Check if push notifications are supported by this browser. */
export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

/** Get current notification permission status. */
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
