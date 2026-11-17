// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { generateKeyPairSync } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWK, type JWTPayload } from "jose";
import * as schema from "@/db/schema";
import {
  APPLE_BUNDLE_ID,
  SESSION_MAX_AGE_SECONDS,
  clientIp,
  createRateLimiter,
  handleNativeSignIn,
  nativeAuthConfig,
  sessionCookie,
  sha256Hex,
  wantsSecureCookies,
  type NativeAuthDeps,
} from "@/server/native-auth";
// Auth.js's own cookie table (not exported from the package root): the test
// pins our cookie to it so an Auth.js upgrade that changes it fails loudly.
import { defaultCookies } from "../../node_modules/@auth/core/lib/utils/cookie.js";

/**
 * Keys are generated at test runtime (nothing secret is committed). The JWKS
 * the handler sees is a local key set built from them, standing in for
 * Google's / Apple's published JWKS.
 */

const client = new PGlite();
const rawDb = drizzle(client, { schema });
const db = rawDb as never as NativeAuthDeps["db"];

// Sign in with Apple key (EC P-256), generated per run.
const APPLE_P8 = generateKeyPairSync("ec", { namedCurve: "P-256" })
  .privateKey.export({ type: "pkcs8", format: "pem" })
  .toString();

const ENV = {
  AUTH_APPLE_TEAM_ID: "TEAM123456",
  AUTH_APPLE_KEY_ID: "KEY1234567",
  AUTH_APPLE_PRIVATE_KEY: APPLE_P8,
  AUTH_GOOGLE_ID: "web-client.apps.googleusercontent.com",
  AUTH_GOOGLE_IOS_CLIENT_ID: "ios-client.apps.googleusercontent.com",
  AUTH_GOOGLE_ANDROID_CLIENT_ID: "android-client.apps.googleusercontent.com",
  AUTH_APPLE_ID: "com.aiplaymatch.web",
  AUTH_URL: "https://aiplaymatch.com",
};

let googleKey: CryptoKey;
let appleKey: CryptoKey;
let rogueKey: CryptoKey;
let deps: NativeAuthDeps;

async function jwkWithKid(key: CryptoKey, kid: string): Promise<JWK> {
  return { ...(await exportJWK(key)), kid, alg: "RS256", use: "sig" };
}

async function applyMigrations() {
  const dir = path.resolve(__dirname, "../../drizzle");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(path.join(dir, file), "utf8").split("--> statement-breakpoint")) {
      if (stmt.trim()) await client.exec(stmt.trim());
    }
  }
}

beforeAll(async () => {
  await applyMigrations();
  const g = await generateKeyPair("RS256", { extractable: true });
  const a = await generateKeyPair("RS256", { extractable: true });
  const r = await generateKeyPair("RS256", { extractable: true });
  googleKey = g.privateKey;
  appleKey = a.privateKey;
  rogueKey = r.privateKey;
  deps = {
    db,
    env: ENV,
    googleJwks: createLocalJWKSet({ keys: [await jwkWithKid(g.publicKey, "g1")] }),
    appleJwks: createLocalJWKSet({ keys: [await jwkWithKid(a.publicKey, "a1")] }),
  };
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await client.exec("DELETE FROM sessions; DELETE FROM accounts; DELETE FROM users;");
  deps.rateLimiter = createRateLimiter({ limit: 1000, windowMs: 60_000 });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

const RAW_NONCE = "raw-nonce-123";

interface SignOpts {
  key?: CryptoKey;
  kid?: string;
  iss?: string;
  aud?: string;
  expSecondsFromNow?: number;
}

async function sign(claims: JWTPayload, opts: SignOpts) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: opts.kid })
    .setIssuer(opts.iss!)
    .setAudience(opts.aud!)
    .setIssuedAt(now - 10)
    .setExpirationTime(now + (opts.expSecondsFromNow ?? 600))
    .sign(opts.key!);
}

function googleToken(claims: JWTPayload = {}, opts: SignOpts = {}) {
  return sign(
    {
      sub: "google-sub-1",
      email: "Pat@Example.com",
      email_verified: true,
      name: "Pat Player",
      given_name: "Pat",
      family_name: "Player",
      picture: "https://lh3.googleusercontent.com/pat",
      nonce: sha256Hex(RAW_NONCE),
      ...claims,
    },
    { key: googleKey, kid: "g1", iss: "https://accounts.google.com", aud: ENV.AUTH_GOOGLE_IOS_CLIENT_ID, ...opts }
  );
}

function appleToken(claims: JWTPayload = {}, opts: SignOpts = {}) {
  return sign(
    {
      sub: "apple-sub-1",
      email: "pat@example.com",
      email_verified: "true", // Apple sends these as strings
      is_private_email: "false",
      nonce: sha256Hex(RAW_NONCE),
      nonce_supported: true,
      ...claims,
    },
    { key: appleKey, kid: "a1", iss: "https://appleid.apple.com", aud: APPLE_BUNDLE_ID, ...opts }
  );
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/auth/native", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-proto": "https", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function signIn(body: Record<string, unknown>, headers?: Record<string, string>, d: Partial<NativeAuthDeps> = {}) {
  const res = await handleNativeSignIn(post({ nonce: RAW_NONCE, ...body }, headers), { ...deps, ...d });
  return { res, json: (await res.json()) as Record<string, unknown> };
}

describe("POST /api/auth/native — Google", () => {
  it("creates a user, account, and session for a valid token", async () => {
    const { res, json } = await signIn({ provider: "google", idToken: await googleToken() });
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ ok: true, created: true, profileComplete: false });

    const [u] = await rawDb.select().from(schema.users);
    expect(u).toMatchObject({ email: "pat@example.com", name: "Pat Player", firstName: "Pat", lastName: "Player" });
    expect(u.emailVerified).toBeInstanceOf(Date);
    const [acct] = await rawDb.select().from(schema.accounts);
    expect(acct).toMatchObject({ userId: u.id, provider: "google", providerAccountId: "google-sub-1", type: "oidc" });

    const [s] = await rawDb.select().from(schema.sessions);
    expect(s.userId).toBe(u.id);
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toContain(`__Secure-authjs.session-token=${s.sessionToken}`);
    const ttl = s.expires.getTime() - Date.now();
    expect(ttl).toBeGreaterThan((SESSION_MAX_AGE_SECONDS - 60) * 1000);
    expect(ttl).toBeLessThanOrEqual(SESSION_MAX_AGE_SECONDS * 1000);
  });

  it.each([ENV.AUTH_GOOGLE_ID, ENV.AUTH_GOOGLE_ANDROID_CLIENT_ID])("accepts aud %s", async (aud) => {
    const { res } = await signIn({ provider: "google", idToken: await googleToken({}, { aud }) });
    expect(res.status).toBe(200);
  });

  it("accepts the bare accounts.google.com issuer", async () => {
    const { res } = await signIn({ provider: "google", idToken: await googleToken({}, { iss: "accounts.google.com" }) });
    expect(res.status).toBe(200);
  });

  it("signs a returning user into the same account without duplicating rows", async () => {
    await signIn({ provider: "google", idToken: await googleToken() });
    const { json } = await signIn({ provider: "google", idToken: await googleToken() });
    expect(json.created).toBe(false);
    expect(await rawDb.select().from(schema.users)).toHaveLength(1);
    expect(await rawDb.select().from(schema.accounts)).toHaveLength(1);
    expect(await rawDb.select().from(schema.sessions)).toHaveLength(2);
  });

  it("links to an existing web user with the same verified email (case-insensitive)", async () => {
    await rawDb.insert(schema.users).values({ id: "web-user", email: "pat@example.com", name: "Web Pat", profileComplete: true });
    await rawDb.insert(schema.accounts).values({ userId: "web-user", type: "oidc", provider: "google", providerAccountId: "other-web-sub" });
    const { res, json } = await signIn({ provider: "google", idToken: await googleToken() });
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ userId: "web-user", created: false, profileComplete: true });
    expect(await rawDb.select().from(schema.users)).toHaveLength(1);
    const [u] = await rawDb.select().from(schema.users);
    expect(u.name).toBe("Web Pat"); // existing profile untouched
  });

  it.each([
    ["wrong audience", { aud: "someone-elses-client.apps.googleusercontent.com" }, "invalid_aud"],
    ["wrong issuer", { iss: "https://evil.example.com" }, "invalid_iss"],
    ["expired", { expSecondsFromNow: -60 }, "token_expired"],
    ["unknown signing key", { key: undefined as never, kid: "g1" }, "invalid_token"],
  ])("rejects a token with %s", async (_label, opts, code) => {
    const o = opts as SignOpts;
    const token = await googleToken({}, { ...o, key: o.key ?? (o.kid ? rogueKey : googleKey) });
    const { res, json } = await signIn({ provider: "google", idToken: token });
    expect(res.status).toBe(401);
    expect(json.error).toBe(code);
    expect(await rawDb.select().from(schema.sessions)).toHaveLength(0);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("rejects a nonce mismatch and a missing nonce", async () => {
    const token = await googleToken();
    const bad = await handleNativeSignIn(post({ provider: "google", idToken: token, nonce: "other" }), deps);
    expect(bad.status).toBe(401);
    expect((await bad.json()).error).toBe("nonce_mismatch");
    const missing = await handleNativeSignIn(post({ provider: "google", idToken: token }), deps);
    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toBe("missing_nonce");
  });

  it("rejects an unverified email and stores nothing", async () => {
    const { res, json } = await signIn({ provider: "google", idToken: await googleToken({ email_verified: false }) });
    expect(res.status).toBe(403);
    expect(json.error).toBe("email_not_verified");
    expect(await rawDb.select().from(schema.users)).toHaveLength(0);
  });

  it("fails closed with 503 when no Google client IDs are configured", async () => {
    const { res, json } = await signIn({ provider: "google", idToken: await googleToken() }, {}, { env: { AUTH_URL: ENV.AUTH_URL } });
    expect(res.status).toBe(503);
    expect(json.error).toBe("google_not_configured");
  });
});

describe("POST /api/auth/native — Apple", () => {
  it("creates a user with the forwarded first-sign-in name", async () => {
    const { res, json } = await signIn({
      provider: "apple",
      idToken: await appleToken(),
      givenName: " Pat ",
      familyName: "Player",
    });
    expect(res.status).toBe(200);
    expect(json.created).toBe(true);
    const [u] = await rawDb.select().from(schema.users);
    expect(u).toMatchObject({ email: "pat@example.com", firstName: "Pat", lastName: "Player", name: "Pat Player" });
    const [acct] = await rawDb.select().from(schema.accounts);
    expect(acct).toMatchObject({ provider: "apple", providerAccountId: "apple-sub-1" });
  });

  it("accepts the web Services ID as audience", async () => {
    const { res } = await signIn({ provider: "apple", idToken: await appleToken({}, { aud: ENV.AUTH_APPLE_ID }) });
    expect(res.status).toBe(200);
  });

  it("keeps the name from the first sign-in when later sign-ins send none", async () => {
    await signIn({ provider: "apple", idToken: await appleToken(), givenName: "Pat", familyName: "Player" });
    await signIn({ provider: "apple", idToken: await appleToken() });
    const [u] = await rawDb.select().from(schema.users);
    expect(u.name).toBe("Pat Player");
  });

  it("fills a missing name on a returning user", async () => {
    await signIn({ provider: "apple", idToken: await appleToken() });
    await signIn({ provider: "apple", idToken: await appleToken(), givenName: "Pat" });
    const [u] = await rawDb.select().from(schema.users);
    expect(u).toMatchObject({ firstName: "Pat", name: "Pat" });
  });

  it("links a verified non-relay Apple email to an existing Google user", async () => {
    await rawDb.insert(schema.users).values({ id: "web-user", email: "pat@example.com" });
    const { json } = await signIn({ provider: "apple", idToken: await appleToken() });
    expect(json.userId).toBe("web-user");
  });

  it("creates a separate user for a private-relay address (no email linking)", async () => {
    const relay = "abc123@privaterelay.appleid.com";
    await rawDb.insert(schema.users).values({ id: "squatter", email: "someone-else@example.com" });
    const { res, json } = await signIn({
      provider: "apple",
      idToken: await appleToken({ email: relay, is_private_email: "true" }),
    });
    expect(res.status).toBe(200);
    expect(json.created).toBe(true);
    expect(json.userId).not.toBe("squatter");
    const [u] = await rawDb.select().from(schema.users).where(eq(schema.users.id, json.userId as string));
    expect(u.email).toBe(relay);
  });

  it("treats a relay-domain email as relay even without is_private_email", async () => {
    await rawDb.insert(schema.users).values({ id: "existing", email: "x@privaterelay.appleid.com" });
    const { res, json } = await signIn({
      provider: "apple",
      idToken: await appleToken({ email: "x@privaterelay.appleid.com", is_private_email: undefined }),
    });
    expect(res.status).toBe(200);
    expect(json.userId).not.toBe("existing");
    // The address is taken, so the new user gets none instead of a unique-key failure.
    const [u] = await rawDb.select().from(schema.users).where(eq(schema.users.id, json.userId as string));
    expect(u.email).toBeNull();
  });

  it("does not link an unverified Apple email", async () => {
    await rawDb.insert(schema.users).values({ id: "web-user", email: "pat@example.com" });
    const { res, json } = await signIn({ provider: "apple", idToken: await appleToken({ email_verified: "false" }) });
    expect(res.status).toBe(200);
    expect(json.userId).not.toBe("web-user");
    const [u] = await rawDb.select().from(schema.users).where(eq(schema.users.id, json.userId as string));
    expect(u.email).toBeNull();
  });

  it("rejects the Google audience, a Google-signed token, and a nonce mismatch", async () => {
    const wrongAud = await signIn({ provider: "apple", idToken: await appleToken({}, { aud: ENV.AUTH_GOOGLE_ID }) });
    expect(wrongAud.json.error).toBe("invalid_aud");
    const wrongKey = await signIn({ provider: "apple", idToken: await googleToken({}, { iss: "https://appleid.apple.com", aud: APPLE_BUNDLE_ID }) });
    expect(wrongKey.json.error).toBe("invalid_token");
    const nonce = await signIn({ provider: "apple", idToken: await appleToken({ nonce: sha256Hex("different") }) });
    expect(nonce.res.status).toBe(401);
    expect(nonce.json.error).toBe("nonce_mismatch");
  });

  it("rejects an expired Apple token", async () => {
    const { res, json } = await signIn({ provider: "apple", idToken: await appleToken({}, { expSecondsFromNow: -60 }) });
    expect(res.status).toBe(401);
    expect(json.error).toBe("token_expired");
  });
});

describe("request validation", () => {
  it("rejects bad bodies", async () => {
    expect((await handleNativeSignIn(post("{nope"), deps)).status).toBe(400);
    expect((await signIn({ provider: "facebook", idToken: "x" })).json.error).toBe("invalid_provider");
    expect((await signIn({ provider: "google", idToken: "" })).json.error).toBe("invalid_token");
    expect((await signIn({ provider: "google", idToken: "x".repeat(9000) })).json.error).toBe("invalid_token");
    expect((await signIn({ provider: "google", idToken: "not.a.jwt" })).json.error).toBe("invalid_token");
  });

  it("requires a JSON content type (login-CSRF guard)", async () => {
    const req = new Request("http://localhost/api/auth/native", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "provider=google",
    });
    expect((await handleNativeSignIn(req, deps)).status).toBe(415);
  });

  it("rejects a cross-site Origin and allows our own", async () => {
    const token = await googleToken();
    const evil = await signIn({ provider: "google", idToken: token }, { origin: "https://evil.example" });
    expect(evil.res.status).toBe(403);
    const ours = await signIn({ provider: "google", idToken: token }, { origin: "https://aiplaymatch.com" });
    expect(ours.res.status).toBe(200);
  });

  it("rate-limits per client IP", async () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    const d = { rateLimiter: limiter };
    const headers = { "x-forwarded-for": "203.0.113.9" };
    expect((await signIn({ provider: "google", idToken: "x" }, headers, d)).res.status).toBe(401);
    expect((await signIn({ provider: "google", idToken: "x" }, headers, d)).res.status).toBe(401);
    const limited = await signIn({ provider: "google", idToken: "x" }, headers, d);
    expect(limited.res.status).toBe(429);
    expect(limited.res.headers.get("retry-after")).toBe("60");
    // Another IP is unaffected.
    expect((await signIn({ provider: "google", idToken: "x" }, { "x-forwarded-for": "198.51.100.1" }, d)).res.status).toBe(401);
  });

  it("returns 500 without a cookie when the JWKS can't be fetched", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const broken = async () => {
      throw new TypeError("fetch failed");
    };
    const { res } = await signIn({ provider: "google", idToken: await googleToken() }, {}, { googleJwks: broken });
    expect(res.status).toBe(500);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});

describe("session cookie", () => {
  it("matches Auth.js's own session cookie name and attributes", () => {
    const expires = new Date("2030-01-01T00:00:00Z");
    for (const secure of [true, false]) {
      const ours = sessionCookie("tok", expires, secure);
      const theirs = defaultCookies(secure).sessionToken;
      expect(ours.startsWith(`${theirs.name}=tok;`)).toBe(true);
      expect(theirs.options).toEqual({ httpOnly: true, sameSite: "lax", path: "/", secure });
      expect(ours).toContain("Path=/");
      expect(ours).toContain("HttpOnly");
      expect(ours).toContain("SameSite=Lax");
      expect(ours).toContain("Expires=Tue, 01 Jan 2030 00:00:00 GMT");
      expect(ours.includes("Secure")).toBe(secure);
    }
  });

  it("uses http cookie names on plain-http dev and https behind Caddy", () => {
    const req = (url: string, h: Record<string, string> = {}) => new Request(url, { headers: h });
    expect(wantsSecureCookies(req("http://localhost:9003/x"), {})).toBe(false);
    expect(wantsSecureCookies(req("http://localhost:9003/x", { "x-forwarded-proto": "http" }), {})).toBe(false);
    expect(wantsSecureCookies(req("http://app:3000/x", { "x-forwarded-proto": "https" }), {})).toBe(true);
    expect(wantsSecureCookies(req("http://app:3000/x"), { AUTH_URL: "https://aiplaymatch.com" })).toBe(true);
    expect(wantsSecureCookies(req("https://x/x"), { NEXTAUTH_URL: "http://localhost:9003" })).toBe(false);
    expect(wantsSecureCookies(req("https://x/x"), {})).toBe(true);
  });

  it("a session created here is the one Auth.js's adapter resolves", async () => {
    const { DrizzleAdapter } = await import("@auth/drizzle-adapter");
    const adapter = DrizzleAdapter(rawDb, {
      usersTable: schema.users,
      accountsTable: schema.accounts,
      sessionsTable: schema.sessions,
      verificationTokensTable: schema.verificationTokens,
    });
    const { res, json } = await signIn({ provider: "google", idToken: await googleToken() });
    const token = /session-token=([^;]+)/.exec(res.headers.get("set-cookie")!)![1];
    const found = await adapter.getSessionAndUser!(token);
    expect(found?.user.id).toBe(json.userId);
    // And the adapter finds the account we linked, so web sign-in with the same Google account reuses this user.
    const viaAccount = await adapter.getUserByAccount!({ provider: "google", providerAccountId: "google-sub-1" });
    expect(viaAccount?.id).toBe(json.userId);
  });
});

describe("helpers", () => {
  it("clientIp takes the right-most forwarded address", () => {
    const r = (h: Record<string, string>) => new Request("http://x", { headers: h });
    expect(clientIp(r({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("2.2.2.2");
    expect(clientIp(r({ "x-real-ip": "3.3.3.3" }))).toBe("3.3.3.3");
    expect(clientIp(r({}))).toBe("unknown");
  });

  it("rate limiter resets after the window", () => {
    const l = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(l.take("k", 0)).toBe(true);
    expect(l.take("k", 10)).toBe(false);
    expect(l.take("k", 1001)).toBe(true);
  });

  it("nativeAuthConfig exposes only public client IDs", () => {
    const cfg = nativeAuthConfig({ ...ENV, AUTH_GOOGLE_SECRET: "s3cret" });
    expect(cfg).toEqual({
      google: { enabled: true, webClientId: ENV.AUTH_GOOGLE_ID, iosClientId: ENV.AUTH_GOOGLE_IOS_CLIENT_ID },
      apple: { enabled: true },
    });
    expect(JSON.stringify(cfg)).not.toMatch(/s3cret|PRIVATE KEY|TEAM123456|KEY1234567/);
    expect(nativeAuthConfig({})).toEqual({
      google: { enabled: false, webClientId: null, iosClientId: null },
      apple: { enabled: false },
    });
  });
});

describe("POST /api/auth/native — Apple refresh token", () => {
  function appleFetch(response: () => Response) {
    return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => response());
  }
  const idTokenFor = (sub: string) =>
    `e30.${Buffer.from(JSON.stringify({ sub, aud: APPLE_BUNDLE_ID })).toString("base64url")}.sig`;

  it("fails closed with 503 when the Apple key isn't configured", async () => {
    const env = { ...ENV, AUTH_APPLE_PRIVATE_KEY: "" };
    const { res, json } = await signIn({ provider: "apple", idToken: await appleToken() }, {}, { env });
    expect(res.status).toBe(503);
    expect(json.error).toBe("apple_not_configured");
    expect(await rawDb.select().from(schema.users)).toHaveLength(0);
  });

  it("exchanges the authorization code and stores the refresh token + identity token", async () => {
    const fetchImpl = appleFetch(() => Response.json({ refresh_token: "apple-rt", access_token: "at", id_token: idTokenFor("apple-sub-1") }));
    const idToken = await appleToken();
    const { res } = await signIn({ provider: "apple", idToken, authorizationCode: "code-1" }, {}, { fetchImpl });
    expect(res.status).toBe(200);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe("https://appleid.apple.com/auth/token");
    const form = new URLSearchParams(String(init?.body));
    expect(form.get("client_id")).toBe(APPLE_BUNDLE_ID);
    expect(form.get("code")).toBe("code-1");
    expect(form.get("grant_type")).toBe("authorization_code");
    const [acct] = await rawDb.select().from(schema.accounts);
    expect(acct.refresh_token).toBe("apple-rt");
    expect(acct.id_token).toBe(idToken);
  });

  it("updates the refresh token on a later sign-in, and keeps it when a sign-in has none", async () => {
    let rt = "rt-1";
    const fetchImpl = appleFetch(() => Response.json({ refresh_token: rt, id_token: idTokenFor("apple-sub-1") }));
    await signIn({ provider: "apple", idToken: await appleToken(), authorizationCode: "c1" }, {}, { fetchImpl });
    rt = "rt-2";
    await signIn({ provider: "apple", idToken: await appleToken(), authorizationCode: "c2" }, {}, { fetchImpl });
    expect((await rawDb.select().from(schema.accounts))[0].refresh_token).toBe("rt-2");
    await signIn({ provider: "apple", idToken: await appleToken() }, {}, { fetchImpl });
    expect((await rawDb.select().from(schema.accounts))[0].refresh_token).toBe("rt-2");
  });

  it("still signs in (without a refresh token) when Apple's token endpoint fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = appleFetch(() => Response.json({ error: "invalid_grant" }, { status: 400 }));
    const { res } = await signIn({ provider: "apple", idToken: await appleToken(), authorizationCode: "used" }, {}, { fetchImpl });
    expect(res.status).toBe(200);
    expect((await rawDb.select().from(schema.accounts))[0].refresh_token).toBeNull();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("code exchange failed"), expect.stringContaining("invalid_grant"));
  });

  it("ignores a code that belongs to a different Apple user", async () => {
    const fetchImpl = appleFetch(() => Response.json({ refresh_token: "someone-elses", id_token: idTokenFor("other-sub") }));
    await signIn({ provider: "apple", idToken: await appleToken(), authorizationCode: "c" }, {}, { fetchImpl });
    expect((await rawDb.select().from(schema.accounts))[0].refresh_token).toBeNull();
  });

  it("never calls Apple for Google sign-ins", async () => {
    const fetchImpl = appleFetch(() => Response.json({}));
    await signIn({ provider: "google", idToken: await googleToken(), authorizationCode: "c" }, {}, { fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
