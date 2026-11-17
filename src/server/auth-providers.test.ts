// @vitest-environment node
import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { appleCookieOverrides, appleWebProvider } from "@/server/auth-providers";

const P8 = generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const ENV = {
  AUTH_APPLE_ID: "com.aiplaymatch.web",
  AUTH_APPLE_TEAM_ID: "TEAM123456",
  AUTH_APPLE_KEY_ID: "KEY1234567",
  AUTH_APPLE_PRIVATE_KEY: P8,
};

describe("appleWebProvider", () => {
  it("is off unless the Services ID and the whole key are configured", () => {
    expect(appleWebProvider({})).toBeNull();
    expect(appleWebProvider({ ...ENV, AUTH_APPLE_ID: "" })).toBeNull();
    expect(appleWebProvider({ ...ENV, AUTH_APPLE_TEAM_ID: undefined })).toBeNull();
  });

  it("builds the Apple provider with a runtime-minted ES256 client secret", () => {
    const p = appleWebProvider(ENV)! as unknown as { id: string; options: Record<string, unknown> };
    expect(p.id).toBe("apple");
    expect(p.options.clientId).toBe("com.aiplaymatch.web");
    expect(p.options.allowDangerousEmailAccountLinking).toBe(true);
    const [header, payload] = String(p.options.clientSecret).split(".").slice(0, 2).map((s) => JSON.parse(Buffer.from(s, "base64url").toString()));
    expect(header).toEqual({ alg: "ES256", kid: "KEY1234567" });
    expect(payload).toMatchObject({ iss: "TEAM123456", sub: "com.aiplaymatch.web", aud: "https://appleid.apple.com" });
  });

  it("a malformed key disables Apple instead of breaking Auth.js (and Google)", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(appleWebProvider({ ...ENV, AUTH_APPLE_PRIVATE_KEY: "not a key" })).toBeNull();
    expect(err).toHaveBeenCalledWith(expect.stringContaining("Apple sign-in disabled"), expect.any(String));
  });
});

describe("appleCookieOverrides", () => {
  it("makes only Apple's state/nonce cookies SameSite=None on https", () => {
    const c = appleCookieOverrides({ AUTH_URL: "https://aiplaymatch.com" })!;
    expect(Object.keys(c)).toEqual(["state", "nonce"]);
    expect(c.state).toEqual({
      name: "__Secure-authjs.state",
      options: { httpOnly: true, sameSite: "none", path: "/", secure: true, maxAge: 900 },
    });
    expect(c.nonce?.name).toBe("__Secure-authjs.nonce");
  });

  it("leaves cookies alone on plain http / without AUTH_URL", () => {
    expect(appleCookieOverrides({ AUTH_URL: "http://localhost:9003" })).toBeUndefined();
    expect(appleCookieOverrides({})).toBeUndefined();
  });
});
