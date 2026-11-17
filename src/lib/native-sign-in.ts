/**
 * Native-app sign-in (Capacitor only).
 *
 * Google refuses OAuth inside an embedded WebView (403 disallowed_useragent),
 * so inside the iOS/Android app the sign-in buttons run the OS-native SDK via
 * @capgo/capacitor-social-login, then POST the ID token to /api/auth/native,
 * which sets the normal Auth.js session cookie. The web never loads this code
 * path (loadNative resolves null outside the app).
 */
import { loadNative } from "@/lib/native";

export type NativeSignInProvider = "google";

export class NativeSignInError extends Error {
  constructor(
    /** `cancelled` (user backed out, show nothing), `not_configured`, `unavailable`, `provider`, or a server error code. */
    public readonly code: string,
    message = code
  ) {
    super(message);
    this.name = "NativeSignInError";
  }
}

interface NativeAuthConfig {
  google: { enabled: boolean; webClientId: string | null; iosClientId: string | null };
}

export interface NativeSignInResult {
  userId: string;
  created: boolean;
  profileComplete: boolean;
}

type SocialLoginModule = typeof import("@capgo/capacitor-social-login");

/** 32 random bytes, base64url. The provider gets sha256(raw); the server gets raw. */
export function randomNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

const isCancel = (err: unknown) => {
  // The plugin rejects dismissals with code USER_CANCELLED; older paths only say "cancel" in the message.
  if ((err as { code?: unknown })?.code === "USER_CANCELLED") return true;
  const msg = String((err as { message?: unknown })?.message ?? err).toLowerCase();
  return msg.includes("cancel");
};

let initialized: string | null = null;

async function fetchConfig(): Promise<NativeAuthConfig> {
  const res = await fetch("/api/auth/native", { cache: "no-store" });
  if (!res.ok) throw new NativeSignInError("unavailable");
  return res.json();
}

async function postToken(body: Record<string, unknown>): Promise<NativeSignInResult> {
  const res = await fetch("/api/auth/native", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new NativeSignInError(typeof json.error === "string" ? json.error : `http_${res.status}`);
  return json as NativeSignInResult;
}

async function loadPlugin(): Promise<SocialLoginModule["SocialLogin"]> {
  const mod = await loadNative(() => import("@capgo/capacitor-social-login"));
  if (!mod) throw new NativeSignInError("unavailable");
  return mod.SocialLogin;
}

/** Google sign-in through the native SDK → Auth.js session. */
export async function nativeGoogleSignIn(platform: "ios" | "android"): Promise<NativeSignInResult> {
  const config = await fetchConfig();
  const { webClientId, iosClientId } = config.google;
  // Fail closed and say why: the client IDs are created in GCP (see docs/OPERATIONS.md).
  if (!config.google.enabled || !webClientId || (platform === "ios" && !iosClientId)) {
    throw new NativeSignInError("not_configured");
  }
  const SocialLogin = await loadPlugin();
  const key = `google:${webClientId}:${iosClientId}`;
  if (initialized !== key) {
    await SocialLogin.initialize({
      google: {
        webClientId,
        ...(iosClientId ? { iOSClientId: iosClientId } : {}),
        mode: "online",
        // We only need the ID token. Skips Android's AuthorizationClient step,
        // which would otherwise need a modified MainActivity.
        skipAuthOnlyAuthorizationAfterSignIn: true,
      },
    });
    initialized = key;
  }

  const rawNonce = randomNonce();
  let idToken: string | null = null;
  try {
    const { result } = await SocialLogin.login({
      provider: "google",
      options: { nonce: await sha256Hex(rawNonce), forcePrompt: true },
    });
    if (result.responseType === "online") idToken = result.idToken;
  } catch (err) {
    if (isCancel(err)) throw new NativeSignInError("cancelled");
    console.warn("[native] Google sign-in failed", err);
    throw new NativeSignInError("provider", String((err as Error)?.message ?? err));
  }
  if (!idToken) throw new NativeSignInError("provider", "Google returned no ID token");
  return postToken({ provider: "google", idToken, nonce: rawNonce });
}

/** For tests. */
export function __resetNativeSignIn() {
  initialized = null;
}
