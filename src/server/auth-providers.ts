import type { NextAuthConfig } from "next-auth";
import Apple from "next-auth/providers/apple";
import { appleClientSecret, appleKeyConfig } from "@/server/apple";

type Env = Record<string, string | undefined>;

/**
 * Sign in with Apple on the web. Only registered when the Services ID
 * (AUTH_APPLE_ID) and the Sign in with Apple key (AUTH_APPLE_TEAM_ID /
 * AUTH_APPLE_KEY_ID / AUTH_APPLE_PRIVATE_KEY) are all set; otherwise the
 * provider doesn't exist and /login shows no web Apple button.
 * The client secret is a short-lived JWT minted from the key at runtime
 * (Apple caps it at 6 months, so it is never stored).
 * A broken key disables Apple only: Google sign-in must keep working.
 */
export function appleWebProvider(env: Env = process.env) {
  const cfg = appleKeyConfig(env);
  const servicesId = env.AUTH_APPLE_ID?.trim();
  if (!cfg || !servicesId) return null;
  let clientSecret: string;
  try {
    clientSecret = appleClientSecret(servicesId, cfg);
  } catch (err) {
    console.error("[auth] Apple sign-in disabled: AUTH_APPLE_PRIVATE_KEY is not a valid .p8 key:", (err as Error).message);
    return null;
  }
  return Apple({
    clientId: servicesId,
    clientSecret,
    // Apple always verifies the address it shares, and a private-relay address
    // can't match a pre-existing account, so this links Apple to an existing
    // Google user with the same email, like the native flow
    // (src/server/native-auth.ts). Without it Auth.js answers OAuthAccountNotLinked.
    allowDangerousEmailAccountLinking: true,
  });
}

/**
 * Apple returns to /api/auth/callback/apple with a cross-site form POST, so
 * SameSite=Lax cookies aren't sent with it. Apple's checks use the `state` and
 * `nonce` cookies (Google's use `pkceCodeVerifier`), so only those two become
 * SameSite=None; Google's cookies are untouched. Over https only (None needs Secure).
 */
export function appleCookieOverrides(env: Env = process.env): NextAuthConfig["cookies"] {
  const url = env.AUTH_URL ?? env.NEXTAUTH_URL;
  if (!url || new URL(url).protocol !== "https:") return undefined;
  const options = { httpOnly: true, sameSite: "none" as const, path: "/", secure: true, maxAge: 15 * 60 };
  return {
    state: { name: "__Secure-authjs.state", options },
    nonce: { name: "__Secure-authjs.nonce", options },
  };
}
