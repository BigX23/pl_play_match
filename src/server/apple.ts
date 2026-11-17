import { createHash, createPrivateKey, sign as cryptoSign, type KeyObject } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { decodeJwt } from "jose";
import type { getDb } from "@/db";
import { accounts } from "@/db/schema";

/**
 * Sign in with Apple server helpers: the client-secret JWT, the authorization
 * code exchange (to obtain a refresh token), and token revocation on account
 * deletion (App Store guideline 5.1.1(v)).
 *
 * Config (all from the env, none committed — see docs/OPERATIONS.md):
 *   AUTH_APPLE_TEAM_ID      Apple Developer Team ID (10 chars)
 *   AUTH_APPLE_KEY_ID       Key ID of the "Sign in with Apple" key (.p8)
 *   AUTH_APPLE_PRIVATE_KEY  contents of that .p8 (PEM; literal "\n" allowed)
 *   AUTH_APPLE_ID           web Services ID (only needed for web sign-in)
 */

type Db = ReturnType<typeof getDb>;
type Env = Record<string, string | undefined>;

export const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
export const APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke";
const APPLE_AUDIENCE = "https://appleid.apple.com";
/** Apple caps client secrets at 6 months; ours are minted at runtime and live a day. */
export const CLIENT_SECRET_TTL_SECONDS = 24 * 60 * 60;
const APPLE_MAX_SECRET_TTL_SECONDS = 15_777_000;

export interface AppleKeyConfig {
  teamId: string;
  keyId: string;
  privateKey: string;
}

/** The signing key config, or null when any part is missing (Apple sign-in stays off). */
export function appleKeyConfig(env: Env = process.env): AppleKeyConfig | null {
  const teamId = env.AUTH_APPLE_TEAM_ID?.trim();
  const keyId = env.AUTH_APPLE_KEY_ID?.trim();
  const privateKey = env.AUTH_APPLE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (!teamId || !keyId || !privateKey) return null;
  return { teamId, keyId, privateKey };
}

const b64url = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");

const keyCache = new Map<string, KeyObject>();
const secretCache = new Map<string, { secret: string; exp: number }>();

/**
 * ES256 client-secret JWT (iss = team, sub = client ID, aud = appleid.apple.com).
 * Synchronous on purpose so it can be built inside the Auth.js config callback.
 * Cached until 10 minutes before it expires.
 */
export function appleClientSecret(clientId: string, cfg: AppleKeyConfig, nowMs = Date.now()): string {
  const now = Math.floor(nowMs / 1000);
  const keyHash = createHash("sha256").update(cfg.privateKey).digest("hex");
  const cacheKey = `${cfg.teamId}:${cfg.keyId}:${keyHash}:${clientId}`;
  const cached = secretCache.get(cacheKey);
  if (cached && cached.exp - 600 > now) return cached.secret;

  let key = keyCache.get(keyHash);
  if (!key) {
    key = createPrivateKey(cfg.privateKey);
    keyCache.set(keyHash, key);
  }
  const exp = now + Math.min(CLIENT_SECRET_TTL_SECONDS, APPLE_MAX_SECRET_TTL_SECONDS);
  const header = b64url(JSON.stringify({ alg: "ES256", kid: cfg.keyId }));
  const payload = b64url(JSON.stringify({ iss: cfg.teamId, iat: now, exp, aud: APPLE_AUDIENCE, sub: clientId }));
  const signature = cryptoSign("sha256", Buffer.from(`${header}.${payload}`), { key, dsaEncoding: "ieee-p1363" });
  const secret = `${header}.${payload}.${b64url(signature)}`;
  secretCache.set(cacheKey, { secret, exp });
  return secret;
}

export interface AppleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
  token_type?: string;
}

export class AppleApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly appleError: string
  ) {
    super(`Apple API ${status}: ${appleError}`);
    this.name = "AppleApiError";
  }
}

async function postForm(url: string, form: Record<string, string>, fetchImpl: typeof fetch): Promise<Response> {
  return fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
    signal: AbortSignal.timeout(8000),
  });
}

/** Exchange a native authorizationCode (single use, ~5 min) for Apple tokens. */
export async function exchangeAppleCode(
  code: string,
  clientId: string,
  cfg: AppleKeyConfig,
  fetchImpl: typeof fetch = fetch
): Promise<AppleTokenResponse> {
  const res = await postForm(
    APPLE_TOKEN_URL,
    {
      client_id: clientId,
      client_secret: appleClientSecret(clientId, cfg),
      code,
      grant_type: "authorization_code",
    },
    fetchImpl
  );
  const body = (await res.json().catch(() => ({}))) as AppleTokenResponse & { error?: string };
  if (!res.ok) throw new AppleApiError(res.status, body.error ?? "unknown");
  return body;
}

/** Revoke an Apple refresh (or access) token. Apple answers 200 with an empty body. */
export async function revokeAppleToken(
  token: string,
  tokenTypeHint: "refresh_token" | "access_token",
  clientId: string,
  cfg: AppleKeyConfig,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const res = await postForm(
    APPLE_REVOKE_URL,
    {
      client_id: clientId,
      client_secret: appleClientSecret(clientId, cfg),
      token,
      token_type_hint: tokenTypeHint,
    },
    fetchImpl
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new AppleApiError(res.status, body.error ?? "unknown");
  }
}

/**
 * Which client a stored Apple token belongs to: the `aud` of the identity token
 * stored with it (bundle ID for the app, Services ID for the web), else the app.
 */
function clientIdForAccount(idToken: string | null, fallback: string): string {
  if (!idToken) return fallback;
  try {
    const aud = decodeJwt(idToken).aud;
    const first = Array.isArray(aud) ? aud[0] : aud;
    return typeof first === "string" && first ? first : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Best-effort revocation of every Apple token this user has, run BEFORE the
 * account is deleted. Never throws: a failed revoke (Apple down, key rotated,
 * token already revoked) is logged and deletion proceeds, because the user's
 * right to delete their account must not depend on Apple's API being up. The
 * user can still remove the app under Settings → Apple ID → Sign in with Apple,
 * and the log line lets us retry by hand.
 * Returns how many tokens were revoked / failed, for logging and tests.
 */
export async function revokeAppleTokensForUser(
  db: Db,
  userId: string,
  opts: { env?: Env; fetchImpl?: typeof fetch; nativeClientId: string }
): Promise<{ revoked: number; failed: number }> {
  let revoked = 0;
  let failed = 0;
  try {
    const rows = await db
      .select({
        providerAccountId: accounts.providerAccountId,
        refresh_token: accounts.refresh_token,
        access_token: accounts.access_token,
        id_token: accounts.id_token,
      })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.provider, "apple")));
    if (rows.length === 0) return { revoked, failed };

    const cfg = appleKeyConfig(opts.env);
    if (!cfg) {
      console.error(`[apple] cannot revoke tokens for user ${userId}: Apple key env vars are not set`);
      return { revoked, failed: rows.length };
    }
    for (const row of rows) {
      const token = row.refresh_token ?? row.access_token;
      if (!token) {
        console.warn(`[apple] user ${userId} apple account has no stored token to revoke`);
        continue;
      }
      const hint = row.refresh_token ? "refresh_token" : "access_token";
      const clientId = clientIdForAccount(row.id_token, opts.nativeClientId);
      try {
        await revokeAppleToken(token, hint, clientId, cfg, opts.fetchImpl);
        revoked += 1;
      } catch (err) {
        failed += 1;
        console.error(`[apple] revoke failed for user ${userId} (client ${clientId}):`, (err as Error).message);
      }
    }
  } catch (err) {
    failed += 1;
    console.error(`[apple] revoke lookup failed for user ${userId}:`, (err as Error).message);
  }
  return { revoked, failed };
}
