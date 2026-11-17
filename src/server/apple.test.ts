// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { generateKeyPairSync } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { importSPKI, jwtVerify, SignJWT, generateKeyPair } from "jose";
import * as schema from "@/db/schema";
import {
  APPLE_REVOKE_URL,
  APPLE_TOKEN_URL,
  CLIENT_SECRET_TTL_SECONDS,
  appleClientSecret,
  appleKeyConfig,
  exchangeAppleCode,
  revokeAppleTokensForUser,
} from "@/server/apple";

/**
 * Apple's endpoints are mocked with a fetch stub. The Sign in with Apple
 * signing key is an EC P-256 key generated per run (nothing committed).
 */

const client = new PGlite();
const rawDb = drizzle(client, { schema });
const db = rawDb as never as Parameters<typeof revokeAppleTokensForUser>[0];

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const PUB_PEM = publicKey.export({ type: "spki", format: "pem" }).toString();
const ENV = {
  AUTH_APPLE_TEAM_ID: "TEAM123456",
  AUTH_APPLE_KEY_ID: "KEY1234567",
  // As it would sit in a one-line .env value.
  AUTH_APPLE_PRIVATE_KEY: PEM.replace(/\n/g, "\\n"),
  AUTH_APPLE_ID: "com.aiplaymatch.web",
};
const CFG = appleKeyConfig(ENV)!;

beforeAll(async () => {
  const dir = path.resolve(__dirname, "../../drizzle");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(path.join(dir, file), "utf8").split("--> statement-breakpoint")) {
      if (stmt.trim()) await client.exec(stmt.trim());
    }
  }
});
afterAll(() => client.close());

beforeEach(async () => {
  await client.exec("DELETE FROM accounts; DELETE FROM users;");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

function formOf(init?: RequestInit) {
  return Object.fromEntries(new URLSearchParams(String(init?.body)));
}

describe("appleKeyConfig", () => {
  it("is null unless team, key id, and key are all set", () => {
    expect(appleKeyConfig({})).toBeNull();
    expect(appleKeyConfig({ ...ENV, AUTH_APPLE_KEY_ID: "" })).toBeNull();
    expect(CFG.privateKey).toBe(PEM.trim()); // "\n" escapes restored
  });
});

describe("appleClientSecret", () => {
  it("is an ES256 JWT Apple accepts: iss team, sub client, aud appleid, exp ≤ 6 months", async () => {
    const now = Date.UTC(2030, 0, 1);
    const secret = appleClientSecret("com.aiplaymatch.app", CFG, now);
    const { payload, protectedHeader } = await jwtVerify(secret, await importSPKI(PUB_PEM, "ES256"), {
      currentDate: new Date(now),
    });
    expect(protectedHeader).toEqual({ alg: "ES256", kid: "KEY1234567" });
    expect(payload).toMatchObject({ iss: "TEAM123456", sub: "com.aiplaymatch.app", aud: "https://appleid.apple.com" });
    expect(payload.exp! - payload.iat!).toBe(CLIENT_SECRET_TTL_SECONDS);
    expect(payload.exp! - payload.iat!).toBeLessThanOrEqual(15_777_000);
  });

  it("is cached until near expiry, then re-minted", () => {
    const t0 = Date.UTC(2031, 0, 1);
    const a = appleClientSecret("cache.test", CFG, t0);
    expect(appleClientSecret("cache.test", CFG, t0 + 60_000)).toBe(a);
    expect(appleClientSecret("cache.test", CFG, t0 + (CLIENT_SECRET_TTL_SECONDS - 300) * 1000)).not.toBe(a);
  });
});

describe("exchangeAppleCode", () => {
  it("posts the code with a client secret and returns Apple's tokens", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe(APPLE_TOKEN_URL);
      expect(formOf(init)).toMatchObject({ client_id: "com.aiplaymatch.app", code: "c0de", grant_type: "authorization_code" });
      expect(formOf(init).client_secret.split(".")).toHaveLength(3);
      return Response.json({ refresh_token: "r1", access_token: "a1", id_token: "x.y.z" });
    });
    await expect(exchangeAppleCode("c0de", "com.aiplaymatch.app", CFG, fetchImpl as typeof fetch)).resolves.toMatchObject({
      refresh_token: "r1",
    });
  });

  it("throws Apple's error code", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ error: "invalid_grant" }, { status: 400 }));
    await expect(exchangeAppleCode("used", "com.aiplaymatch.app", CFG, fetchImpl as typeof fetch)).rejects.toMatchObject({
      status: 400,
      appleError: "invalid_grant",
    });
  });
});

async function idTokenWithAud(aud: string) {
  const { privateKey: k } = await generateKeyPair("RS256");
  return new SignJWT({ sub: "s" }).setProtectedHeader({ alg: "RS256" }).setAudience(aud).sign(k);
}

describe("revokeAppleTokensForUser", () => {
  async function seed(rows: Partial<typeof schema.accounts.$inferInsert>[]) {
    await rawDb.insert(schema.users).values({ id: "u1", email: "pat@example.com" });
    for (const [i, r] of rows.entries()) {
      await rawDb.insert(schema.accounts).values({ userId: "u1", type: "oidc", provider: "apple", providerAccountId: `sub${i}`, ...r });
    }
  }

  it("revokes the refresh token against the client the token was issued to", async () => {
    await seed([
      { refresh_token: "native-rt", id_token: await idTokenWithAud("com.aiplaymatch.app") },
      { refresh_token: "web-rt", id_token: await idTokenWithAud("com.aiplaymatch.web") },
    ]);
    await rawDb.insert(schema.accounts).values({ userId: "u1", type: "oidc", provider: "google", providerAccountId: "g", refresh_token: "google-rt" });
    const fetchImpl = vi.fn(async (_u: string | URL | Request, _init?: RequestInit) => new Response(null, { status: 200 }));

    const result = await revokeAppleTokensForUser(db, "u1", { env: ENV, fetchImpl: fetchImpl as typeof fetch, nativeClientId: "com.aiplaymatch.app" });
    expect(result).toEqual({ revoked: 2, failed: 0 });
    const calls: Record<string, string>[] = fetchImpl.mock.calls.map(([u, init]) => ({ url: String(u), ...formOf(init) }));
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: APPLE_REVOKE_URL, token: "native-rt", token_type_hint: "refresh_token", client_id: "com.aiplaymatch.app" }),
        expect.objectContaining({ url: APPLE_REVOKE_URL, token: "web-rt", client_id: "com.aiplaymatch.web" }),
      ])
    );
    expect(calls.some((c) => c.token === "google-rt")).toBe(false);
  });

  it("falls back to the access token and the native client ID", async () => {
    await seed([{ access_token: "at-only" }]);
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
    await revokeAppleTokensForUser(db, "u1", { env: ENV, fetchImpl: fetchImpl as typeof fetch, nativeClientId: "com.aiplaymatch.app" });
    expect(formOf((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1])).toMatchObject({
      token: "at-only",
      token_type_hint: "access_token",
      client_id: "com.aiplaymatch.app",
    });
  });

  it("never throws: Apple errors, network errors, and missing keys are logged and counted", async () => {
    await seed([{ refresh_token: "a" }, { refresh_token: "b" }, {}]);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ error: "invalid_client" }, { status: 400 }))
      .mockRejectedValueOnce(new TypeError("fetch failed"));
    const r = await revokeAppleTokensForUser(db, "u1", { env: ENV, fetchImpl, nativeClientId: "com.aiplaymatch.app" });
    expect(r).toEqual({ revoked: 0, failed: 2 });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("revoke failed for user u1"), expect.stringContaining("invalid_client"));

    const noKeys = await revokeAppleTokensForUser(db, "u1", { env: {}, fetchImpl, nativeClientId: "com.aiplaymatch.app" });
    expect(noKeys.failed).toBe(3);
  });

  it("does nothing for users without an Apple account", async () => {
    await rawDb.insert(schema.users).values({ id: "u1" });
    const fetchImpl = vi.fn();
    expect(await revokeAppleTokensForUser(db, "u1", { env: ENV, fetchImpl, nativeClientId: "x" })).toEqual({ revoked: 0, failed: 0 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("survives a database error", async () => {
    const broken = { select: () => { throw new Error("db down"); } } as never;
    expect(await revokeAppleTokensForUser(broken, "u1", { env: ENV, nativeClientId: "x" })).toEqual({ revoked: 0, failed: 1 });
  });
});
