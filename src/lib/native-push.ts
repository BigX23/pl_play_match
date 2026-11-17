/**
 * Native (iOS/Android app) push via Firebase Cloud Messaging.
 *
 * WKWebView and Android WebView have no Web Push, so inside the app shell we
 * ask the OS for permission through `@capacitor-firebase/messaging`, get an FCM
 * token, and register it with `/api/push/native/register`. The server sends to
 * it alongside Web Push (src/server/push.ts). Everything here is a no-op on the
 * web: the plugin is only loaded through loadNative().
 */
import { loadNative, platform } from "@/lib/native";

type Messaging = typeof import("@capacitor-firebase/messaging").FirebaseMessaging;

export type NativePushPermission = "granted" | "denied" | "prompt" | "unsupported";

/** Load the plugin (null on the web or if it fails to load). */
export function loadMessaging(): Promise<Messaging | null> {
  return loadNative(() => import("@capacitor-firebase/messaging").then((m) => m.FirebaseMessaging));
}

/** Current OS notification permission inside the app; "unsupported" on the web. */
export async function getNativePushPermission(): Promise<NativePushPermission> {
  const fcm = await loadMessaging();
  if (!fcm) return "unsupported";
  try {
    const { receive } = await fcm.checkPermissions();
    if (receive === "granted" || receive === "denied") return receive;
    return "prompt";
  } catch {
    return "unsupported";
  }
}

/** Send a token to the server for the signed-in user (401s harmlessly when signed out). */
export async function sendTokenToServer(token: string): Promise<boolean> {
  const p = platform();
  if (p === "web") return false;
  const res = await fetch("/api/push/native/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, platform: p }),
  });
  return res.ok;
}

/** Fetch this install's FCM token and register it. False if Firebase isn't set up in the build. */
async function fetchAndRegister(fcm: Messaging): Promise<boolean> {
  try {
    const { token } = await fcm.getToken();
    if (!token) return false;
    return await sendTokenToServer(token);
  } catch (err) {
    // Rejects when the build has no GoogleService-Info.plist / google-services.json.
    console.warn("[native-push] could not get an FCM token", err);
    return false;
  }
}

export type EnableNativePushResult = "enabled" | "denied" | "unavailable";

/** Settings → "Enable Push Notifications" inside the app. */
export async function enableNativePush(): Promise<EnableNativePushResult> {
  const fcm = await loadMessaging();
  if (!fcm) return "unavailable";
  try {
    const { receive } = await fcm.requestPermissions();
    if (receive !== "granted") return "denied";
  } catch (err) {
    console.warn("[native-push] permission request failed", err);
    return "unavailable";
  }
  return (await fetchAndRegister(fcm)) ? "enabled" : "unavailable";
}

/** At launch: refresh the server's copy of the token if permission was already granted. */
export async function registerNativePushIfGranted(): Promise<void> {
  const fcm = await loadMessaging();
  if (!fcm) return;
  try {
    const { receive } = await fcm.checkPermissions();
    if (receive !== "granted") return;
  } catch {
    return;
  }
  await fetchAndRegister(fcm);
}

/** Before sign-out: stop pushes to this phone for the account that's leaving (best-effort). */
export async function unregisterNativePush(): Promise<void> {
  const fcm = await loadMessaging();
  if (!fcm) return;
  try {
    const { receive } = await fcm.checkPermissions();
    if (receive !== "granted") return;
    const { token } = await fcm.getToken();
    if (!token) return;
    await fetch("/api/push/native/unregister", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch {
    /* best-effort */
  }
}

/**
 * A same-origin path from a notification's `data.url`, or null. The bridge is
 * exposed to whatever the WebView loads, so never navigate off our origin.
 */
export function safeNotificationPath(url: unknown, origin: string): string | null {
  if (typeof url !== "string" || !url.startsWith("/") || url.startsWith("//") || url.includes("\\")) return null;
  try {
    const parsed = new URL(url, origin);
    if (parsed.origin !== origin) return null;
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return null;
  }
}
