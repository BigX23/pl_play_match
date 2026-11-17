import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { createRemoteJWKSet, errors as joseErrors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";
import type { getDb } from "@/db";
import { accounts, sessions, users } from "@/db/schema";
import { appleKeyConfig, exchangeAppleCode } from "@/server/apple";

/**
 * Native-app sign-in (POST /api/auth/native).
 *
 * Google blocks OAuth inside embedded WebViews, so the iOS/Android apps sign in
 * with the OS-native Google / Apple SDKs and send us the resulting ID token.
 * We verify it here, find or create the user through the SAME tables the
 * Auth.js Drizzle adapter uses, insert a `sessions` row, and set the exact
 * cookie Auth.js reads. From then on the WebView has an ordinary Auth.js
 * database session: `auth()`, `/api/me`, sign-out all work unchanged.
 */

type Db = ReturnType<typeof getDb>;

export type NativeProvider = "google" | "apple";

export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
export const GOOGLE_ISSUERS = ["accounts.google.com", "https://accounts.google.com"];
export const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
export const APPLE_ISSUER = "https://appleid.apple.com";
/** iOS bundle ID = the `aud` of identity tokens minted for the native app. */
export const APPLE_BUNDLE_ID = "com.aiplaymatch.app";

/** Auth.js defaults (node_modules/@auth/core/lib/init.js): 30-day database sessions. */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** Allowed clock skew when checking exp/iat. */
const CLOCK_TOLERANCE_SECONDS = 5;

type Env = Record<string, string | undefined>;

/** Google client IDs whose tokens we accept (web, iOS, Android). Empty → Google disabled. */
export function googleAudiences(env: Env = process.env): string[] {
  return [env.AUTH_GOOGLE_ID, env.AUTH_GOOGLE_IOS_CLIENT_ID, env.AUTH_GOOGLE_ANDROID_CLIENT_ID].filter(
    (v): v is string => !!v && v.trim() !== ""
  );
}

/** Apple audiences: the native bundle ID, plus the web Services ID when configured. */
export function appleAudiences(env: Env = process.env): string[] {
  return [APPLE_BUNDLE_ID, env.AUTH_APPLE_ID].filter((v): v is string => !!v && v.trim() !== "");
}

export class NativeAuthError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message = code
  ) {
    super(message);
    this.name = "NativeAuthError";
  }
}

export interface VerifiedIdentity {
  provider: NativeProvider;
  sub: string;
  email: string | null;
  emailVerified: boolean;
  /** Apple "Hide My Email" relay address: never used to link accounts. */
  isPrivateRelay: boolean;
  name: string | null;
  givenName: string | null;
  familyName: string | null;
  picture: string | null;
}

export const sha256Hex = (value: string) => createHash("sha256").update(value).digest("hex");

/** Apple sends booleans as either JSON booleans or the strings "true"/"false". */
const claimBool = (v: unknown) => v === true || v === "true";
const claimStr = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);

export function isAppleRelayEmail(email: string | null): boolean {
  return !!email && email.toLowerCase().endsWith("@privaterelay.appleid.com");
}

async function verifyJwt(
  token: string,
  jwks: JWTVerifyGetKey,
  issuer: string | string[],
  audience: string[],
  now?: Date
): Promise<JWTPayload> {
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience,
      algorithms: ["RS256"],
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
      currentDate: now,
      requiredClaims: ["sub", "exp", "iat"],
    });
    return payload;
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) throw new NativeAuthError("token_expired", 401);
    if (err instanceof joseErrors.JWTClaimValidationFailed) {
      throw new NativeAuthError(`invalid_${err.claim}`, 401);
    }
    if (err instanceof joseErrors.JOSEError) throw new NativeAuthError("invalid_token", 401);
    throw err; // network failure fetching the JWKS etc. → 500
  }
}

/**
 * Both providers get `sha256(rawNonce)` from the app and echo it in the
 * token's `nonce` claim; the app sends us the raw value. A matching nonce proves
 * this token was minted for this sign-in attempt (no replay of a captured token).
 */
function checkNonce(payload: JWTPayload, rawNonce: string | undefined) {
  if (!rawNonce) throw new NativeAuthError("missing_nonce", 400);
  if (payload.nonce !== sha256Hex(rawNonce)) throw new NativeAuthError("nonce_mismatch", 401);
}

export async function verifyGoogleIdToken(
  idToken: string,
  opts: { jwks: JWTVerifyGetKey; audiences: string[]; nonce?: string; now?: Date }
): Promise<VerifiedIdentity> {
  if (opts.audiences.length === 0) throw new NativeAuthError("google_not_configured", 503);
  const p = await verifyJwt(idToken, opts.jwks, GOOGLE_ISSUERS, opts.audiences, opts.now);
  checkNonce(p, opts.nonce);
  const email = claimStr(p.email);
  // Google always attests verification; an unverified address must not become
  // a PlayMatch identity (it would also squat on that email for its owner).
  if (!email || !claimBool(p.email_verified)) throw new NativeAuthError("email_not_verified", 403);
  return {
    provider: "google",
    sub: p.sub!,
    email: email.toLowerCase(),
    emailVerified: true,
    isPrivateRelay: false,
    name: claimStr(p.name),
    givenName: claimStr(p.given_name),
    familyName: claimStr(p.family_name),
    picture: claimStr(p.picture),
  };
}

export async function verifyAppleIdToken(
  idToken: string,
  opts: { jwks: JWTVerifyGetKey; audiences: string[]; nonce?: string; now?: Date }
): Promise<VerifiedIdentity> {
  const p = await verifyJwt(idToken, opts.jwks, APPLE_ISSUER, opts.audiences, opts.now);
  checkNonce(p, opts.nonce);
  const email = claimStr(p.email)?.toLowerCase() ?? null;
  return {
    provider: "apple",
    sub: p.sub!,
    email,
    emailVerified: !!email && claimBool(p.email_verified),
    isPrivateRelay: claimBool(p.is_private_email) || isAppleRelayEmail(email),
    // Apple never puts the name in the token; the app forwards it (first sign-in only).
    name: null,
    givenName: null,
    familyName: null,
    picture: null,
  };
}

/** Name the app forwards from the native SDK (Apple sends it on the first sign-in only). */
export interface ClientName {
  givenName?: string | null;
  familyName?: string | null;
}

export interface AccountTokens {
  refreshToken?: string | null;
  accessToken?: string | null;
  expiresAt?: number | null;
  idToken?: string | null;
}

const clean = (s: string | null | undefined, max = 100) => {
  const t = typeof s === "string" ? s.trim().slice(0, max) : "";
  return t === "" ? null : t;
};

/**
 * Find or create the PlayMatch user for a verified identity.
 * 1. Known (provider, sub) → that user.
 * 2. Else link to an existing user by email, ONLY when the provider verified
 *    the email and it isn't an Apple relay address (relay addresses are
 *    per-app aliases, so they never identify a pre-existing web account).
 * 3. Else create a new user.
 * Returns the user id and whether it was created.
 */
export async function findOrCreateUser(
  db: Db,
  identity: VerifiedIdentity,
  extra: { clientName?: ClientName; tokens?: AccountTokens } = {}
): Promise<{ userId: string; created: boolean; linked: boolean }> {
  const tokenColumns = {
    ...(extra.tokens?.refreshToken ? { refresh_token: extra.tokens.refreshToken } : {}),
    ...(extra.tokens?.accessToken ? { access_token: extra.tokens.accessToken } : {}),
    ...(extra.tokens?.expiresAt ? { expires_at: extra.tokens.expiresAt } : {}),
    ...(extra.tokens?.idToken ? { id_token: extra.tokens.idToken } : {}),
  };

  const [existing] = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(and(eq(accounts.provider, identity.provider), eq(accounts.providerAccountId, identity.sub)))
    .limit(1);
  if (existing) {
    if (Object.keys(tokenColumns).length > 0) {
      await db
        .update(accounts)
        .set(tokenColumns)
        .where(and(eq(accounts.provider, identity.provider), eq(accounts.providerAccountId, identity.sub)));
    }
    await fillMissingName(db, existing.userId, identity, extra.clientName);
    return { userId: existing.userId, created: false, linked: false };
  }

  let userId: string | null = null;
  let created = false;
  let linked = false;
  const canLink = identity.emailVerified && !identity.isPrivateRelay && !!identity.email;
  if (canLink) {
    const [byEmail] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${identity.email}`)
      .limit(1);
    if (byEmail) {
      userId = byEmail.id;
      linked = true;
    }
  }

  if (!userId) {
    const givenName = clean(extra.clientName?.givenName) ?? identity.givenName;
    const familyName = clean(extra.clientName?.familyName) ?? identity.familyName;
    const name = identity.name ?? ([givenName, familyName].filter(Boolean).join(" ") || null);
    // users.email is unique. If an address we may not link on (relay/unverified)
    // already belongs to someone else, create the user without an email rather
    // than fail or take over that row.
    let email = identity.emailVerified ? identity.email : null;
    if (email) {
      const [taken] = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.email}) = ${email}`)
        .limit(1);
      if (taken) email = null;
    }
    const [row] = await db
      .insert(users)
      .values({
        name,
        firstName: givenName,
        lastName: familyName,
        // Unverified emails are never stored, so they can't block the real owner.
        email,
        emailVerified: email ? new Date() : null,
        image: identity.picture,
      })
      .returning({ id: users.id });
    userId = row.id;
    created = true;
  } else {
    await fillMissingName(db, userId, identity, extra.clientName);
  }

  await db
    .insert(accounts)
    .values({
      userId,
      type: "oidc",
      provider: identity.provider,
      providerAccountId: identity.sub,
      ...tokenColumns,
    })
    // A concurrent sign-in for the same identity already linked it; keep that row.
    .onConflictDoNothing();
  const [winner] = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(and(eq(accounts.provider, identity.provider), eq(accounts.providerAccountId, identity.sub)))
    .limit(1);
  return { userId: winner.userId, created, linked };
}

/** Apple only reveals the name once; keep it if the user row doesn't have one yet. */
async function fillMissingName(db: Db, userId: string, identity: VerifiedIdentity, clientName?: ClientName) {
  const givenName = clean(clientName?.givenName) ?? identity.givenName;
  const familyName = clean(clientName?.familyName) ?? identity.familyName;
  if (!givenName && !familyName) return;
  const [u] = await db
    .select({ name: users.name, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u) return;
  const update: Partial<typeof users.$inferInsert> = {};
  if (!u.firstName && givenName) update.firstName = givenName;
  if (!u.lastName && familyName) update.lastName = familyName;
  if (!u.name) update.name = [givenName, familyName].filter(Boolean).join(" ");
  if (Object.keys(update).length > 0) await db.update(users).set(update).where(eq(users.id, userId));
}

/** Insert a database session exactly like Auth.js's adapter.createSession. */
export async function createSession(db: Db, userId: string, now = new Date()) {
  const sessionToken = randomUUID(); // Auth.js default generateSessionToken
  const expires = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);
  await db.insert(sessions).values({ sessionToken, userId, expires });
  return { sessionToken, expires };
}

/**
 * Whether Auth.js will use `__Secure-` cookies for this request. Mirrors
 * next-auth: AUTH_URL/NEXTAUTH_URL wins, else x-forwarded-proto, else the URL.
 */
export function wantsSecureCookies(req: Request, env: Env = process.env): boolean {
  const envUrl = env.AUTH_URL ?? env.NEXTAUTH_URL;
  if (envUrl) return new URL(envUrl).protocol === "https:";
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (proto) return proto.replace(/:$/, "") === "https";
  return new URL(req.url).protocol === "https:";
}

/** Same name and attributes as Auth.js's defaultCookies().sessionToken. */
export function sessionCookie(token: string, expires: Date, secure: boolean): string {
  const name = `${secure ? "__Secure-" : ""}authjs.session-token`;
  return [
    `${name}=${token}`,
    "Path=/",
    `Expires=${expires.toUTCString()}`,
    "HttpOnly",
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

/**
 * Fixed-window per-key limiter. In-memory: this assumes the single app
 * container we run today (deploy/docker-compose.yml). With more than one
 * instance each would keep its own counts; move it to Postgres/Redis then.
 */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return {
    /** True if allowed (and counts the hit). */
    take(key: string, now = Date.now()): boolean {
      if (hits.size > 10_000) {
        for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      }
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= now) {
        hits.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      entry.count += 1;
      return entry.count <= limit;
    },
  };
}

/** Client IP as Caddy reports it. Caddy appends the peer address last, so the right-most entry is the one it saw. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

// ---------- HTTP handler ----------

let googleJwks: JWTVerifyGetKey | null = null;
let appleJwks: JWTVerifyGetKey | null = null;

export interface NativeAuthDeps {
  db: Db;
  env?: Env;
  googleJwks?: JWTVerifyGetKey;
  appleJwks?: JWTVerifyGetKey;
  rateLimiter?: ReturnType<typeof createRateLimiter>;
  now?: Date;
  /** For Apple's token endpoint (tests stub it). */
  fetchImpl?: typeof fetch;
}

const defaultLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });

const MAX_TOKEN_LENGTH = 8192;

/**
 * Apple only: trade the one-time authorizationCode for a refresh token, so the
 * account can be revoked on deletion (guideline 5.1.1(v)). Returns null (and
 * logs) on failure: sign-in still succeeds, and the next sign-in — which always
 * brings a fresh code — stores the token. Refusing the sign-in instead would
 * lock users out whenever Apple's token endpoint hiccups.
 */
async function appleRefreshToken(
  code: string | undefined,
  sub: string,
  env: Env,
  fetchImpl?: typeof fetch
): Promise<string | null> {
  const cfg = appleKeyConfig(env);
  if (!cfg || !code) return null;
  try {
    const tokens = await exchangeAppleCode(code, APPLE_BUNDLE_ID, cfg, fetchImpl);
    // The code must belong to the same Apple user as the verified identity token.
    // (The response comes straight from Apple over TLS, so decoding is enough.)
    const codeSub = tokens.id_token ? decodeJwtSub(tokens.id_token) : null;
    if (codeSub !== sub) {
      console.warn("[auth/native] apple authorization code belongs to a different user; ignoring it");
      return null;
    }
    return tokens.refresh_token ?? null;
  } catch (err) {
    console.error("[auth/native] apple code exchange failed:", (err as Error).message);
    return null;
  }
}

function decodeJwtSub(jwt: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1] ?? "", "base64url").toString("utf8"));
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * Body: `{ provider: "google" | "apple", idToken, nonce, givenName?, familyName?, authorizationCode? }`.
 * 200 → `{ ok, userId, profileComplete, created }` + the Auth.js session cookie.
 */
export async function handleNativeSignIn(req: Request, deps: NativeAuthDeps): Promise<Response> {
  const env = deps.env ?? process.env;
  const limiter = deps.rateLimiter ?? defaultLimiter;
  if (!limiter.take(clientIp(req))) return json({ error: "rate_limited" }, 429, { "Retry-After": "60" });

  // Login-CSRF guard: a cross-site page can't send application/json without a
  // CORS preflight (which we never answer), and browsers send Origin on POST.
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return json({ error: "unsupported_media_type" }, 415);
  }
  const origin = req.headers.get("origin");
  if (origin && origin !== "null") {
    const expected = new URL(env.AUTH_URL ?? env.NEXTAUTH_URL ?? req.url);
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? expected.host;
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return json({ error: "bad_origin" }, 403);
    }
    if (originHost !== host && originHost !== expected.host) return json({ error: "bad_origin" }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const provider = body.provider;
  const idToken = body.idToken;
  const nonce = typeof body.nonce === "string" ? body.nonce : undefined;
  if (provider !== "google" && provider !== "apple") return json({ error: "invalid_provider" }, 400);
  if (typeof idToken !== "string" || idToken.length === 0 || idToken.length > MAX_TOKEN_LENGTH) {
    return json({ error: "invalid_token" }, 400);
  }

  try {
    let identity: VerifiedIdentity;
    if (provider === "google") {
      identity = await verifyGoogleIdToken(idToken, {
        jwks: deps.googleJwks ?? (googleJwks ??= createRemoteJWKSet(new URL(GOOGLE_JWKS_URL))),
        audiences: googleAudiences(env),
        nonce,
        now: deps.now,
      });
    } else {
      // Without the Sign in with Apple key we couldn't revoke the account's
      // tokens on deletion (5.1.1(v)), so Apple sign-in stays off until it's set.
      if (!appleKeyConfig(env)) throw new NativeAuthError("apple_not_configured", 503);
      identity = await verifyAppleIdToken(idToken, {
        jwks: deps.appleJwks ?? (appleJwks ??= createRemoteJWKSet(new URL(APPLE_JWKS_URL))),
        audiences: appleAudiences(env),
        nonce,
        now: deps.now,
      });
    }

    const clientName: ClientName = {
      givenName: typeof body.givenName === "string" ? body.givenName : null,
      familyName: typeof body.familyName === "string" ? body.familyName : null,
    };
    const tokens =
      provider === "apple"
        ? {
            // Kept so revocation knows which client (bundle ID vs Services ID) the token belongs to.
            idToken,
            refreshToken: await appleRefreshToken(
              typeof body.authorizationCode === "string" ? body.authorizationCode : undefined,
              identity.sub,
              env,
              deps.fetchImpl
            ),
          }
        : undefined;
    const { userId, created } = await findOrCreateUser(deps.db, identity, { clientName, tokens });
    const { sessionToken, expires } = await createSession(deps.db, userId, deps.now);
    const [u] = await deps.db
      .select({ profileComplete: users.profileComplete })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return json({ ok: true, userId, created, profileComplete: u?.profileComplete ?? false }, 200, {
      "Set-Cookie": sessionCookie(sessionToken, expires, wantsSecureCookies(req, env)),
    });
  } catch (err) {
    if (err instanceof NativeAuthError) {
      console.warn(`[auth/native] ${provider} sign-in rejected: ${err.code}`);
      return json({ error: err.code }, err.status);
    }
    console.error("[auth/native] sign-in failed:", err);
    return json({ error: "internal_error" }, 500);
  }
}

/** Public, non-secret config the app needs to initialize the native SDKs. */
export function nativeAuthConfig(env: Env = process.env) {
  return {
    google: {
      // Android's Credential Manager needs the web client ID; iOS needs its own.
      enabled: !!env.AUTH_GOOGLE_ID,
      webClientId: env.AUTH_GOOGLE_ID || null,
      iosClientId: env.AUTH_GOOGLE_IOS_CLIENT_ID || null,
    },
    apple: {
      // Native Apple sign-in needs only the bundle ID, but we require the key so
      // tokens can be revoked on account deletion.
      enabled: appleKeyConfig(env) !== null,
    },
  };
}
