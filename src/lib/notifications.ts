/**
 * Notification preferences (localStorage) + push scaffolding.
 * FCM was removed with Firebase; Web Push (VAPID) arrives in Phase 6 —
 * until then enablePushNotifications reports unavailable.
 */

/** base64url VAPID public key → Uint8Array for PushManager. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Enable Web Push (VAPID): register the service worker, subscribe via the
 * PushManager using the server's public key, and persist the subscription.
 * Returns the endpoint on success, or null on denial / unsupported / error.
 */
export async function enablePushNotifications(_userId: string): Promise<string | null> {
  if (!isPushSupported()) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const reg = await navigator.serviceWorker.ready;

    const { publicKey } = await fetch("/api/push/vapid").then((r) => r.json());
    if (!publicKey) {
      console.warn("[PlayMatch] No VAPID public key configured");
      return null;
    }

    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      }));

    const json = sub.toJSON();
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    });
    if (!res.ok) return null;
    return sub.endpoint;
  } catch (err) {
    console.error("[PlayMatch] enablePushNotifications failed:", err);
    return null;
  }
}

/** Unsubscribe this browser from push (best-effort). */
export async function disablePushNotifications(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
  } catch {
    /* best-effort */
  }
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
