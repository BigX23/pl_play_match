import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const initialize = vi.fn(async () => {});
const login = vi.fn();
vi.mock("@capgo/capacitor-social-login", () => ({ SocialLogin: { initialize, login } }));

import {
  NativeSignInError,
  __resetNativeSignIn,
  nativeGoogleSignIn,
  randomNonce,
  sha256Hex,
} from "./native-sign-in";

type Win = Window & { Capacitor?: unknown };
const fetchMock = vi.fn();

const CONFIG = { google: { enabled: true, webClientId: "web.apps", iosClientId: "ios.apps" } };

function respond(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

beforeEach(() => {
  (window as Win).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  initialize.mockClear();
  login.mockReset();
  __resetNativeSignIn();
});

afterEach(() => {
  delete (window as Win).Capacitor;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("nonce helpers", () => {
  it("makes distinct url-safe nonces and hex sha256 digests that match node's", async () => {
    const a = randomNonce();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomNonce()).not.toBe(a);
    expect(await sha256Hex(a)).toBe(createHash("sha256").update(a).digest("hex"));
  });
});

describe("nativeGoogleSignIn", () => {
  it("initializes the plugin, passes sha256(nonce) to Google, and posts the raw nonce", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) =>
      init?.method === "POST" ? respond({ ok: true, userId: "u1", created: true, profileComplete: false }) : respond(CONFIG)
    );
    login.mockResolvedValue({ provider: "google", result: { responseType: "online", idToken: "id.tok.en" } });

    const result = await nativeGoogleSignIn("ios");
    expect(result).toMatchObject({ userId: "u1", profileComplete: false });
    expect(initialize).toHaveBeenCalledWith({ google: { webClientId: "web.apps", iOSClientId: "ios.apps", mode: "online", skipAuthOnlyAuthorizationAfterSignIn: true } });

    const loginNonce = login.mock.calls[0][0].options.nonce;
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    const body = JSON.parse(post[1].body);
    expect(body).toMatchObject({ provider: "google", idToken: "id.tok.en" });
    expect(loginNonce).toBe(await sha256Hex(body.nonce));
    expect(post[1].headers).toMatchObject({ "Content-Type": "application/json" });

    // A second sign-in reuses the initialized plugin.
    await nativeGoogleSignIn("ios");
    expect(initialize).toHaveBeenCalledOnce();
  });

  it("fails closed when the server has no client IDs", async () => {
    fetchMock.mockImplementation(() => respond({ google: { enabled: false, webClientId: null, iosClientId: null } }));
    await expect(nativeGoogleSignIn("android")).rejects.toMatchObject({ code: "not_configured" });
    expect(login).not.toHaveBeenCalled();
  });

  it("requires the iOS client ID on iOS but not on Android", async () => {
    const cfg = { google: { enabled: true, webClientId: "web.apps", iosClientId: null } };
    fetchMock.mockImplementation((_u: string, init?: RequestInit) =>
      init?.method === "POST" ? respond({ ok: true, userId: "u1" }) : respond(cfg)
    );
    await expect(nativeGoogleSignIn("ios")).rejects.toMatchObject({ code: "not_configured" });
    login.mockResolvedValue({ provider: "google", result: { responseType: "online", idToken: "t" } });
    await expect(nativeGoogleSignIn("android")).resolves.toMatchObject({ userId: "u1" });
    expect(initialize).toHaveBeenCalledWith({ google: { webClientId: "web.apps", mode: "online", skipAuthOnlyAuthorizationAfterSignIn: true } });
  });

  it("maps a user cancel to `cancelled` and other plugin errors to `provider`", async () => {
    fetchMock.mockImplementation(() => respond(CONFIG));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    login.mockRejectedValueOnce(Object.assign(new Error("dismissed"), { code: "USER_CANCELLED" }));
    await expect(nativeGoogleSignIn("ios")).rejects.toMatchObject({ code: "cancelled" });
    login.mockRejectedValueOnce(new Error("The user canceled the sign-in flow."));
    await expect(nativeGoogleSignIn("ios")).rejects.toMatchObject({ code: "cancelled" });
    login.mockRejectedValueOnce(new Error("invalid client"));
    await expect(nativeGoogleSignIn("ios")).rejects.toMatchObject({ code: "provider" });
    login.mockResolvedValueOnce({ provider: "google", result: { responseType: "offline", serverAuthCode: "x" } });
    await expect(nativeGoogleSignIn("ios")).rejects.toMatchObject({ code: "provider" });
  });

  it("surfaces the server's error code", async () => {
    fetchMock.mockImplementation((_u: string, init?: RequestInit) =>
      init?.method === "POST" ? respond({ error: "invalid_aud" }, 401) : respond(CONFIG)
    );
    login.mockResolvedValue({ provider: "google", result: { responseType: "online", idToken: "t" } });
    const err = await nativeGoogleSignIn("ios").catch((e) => e);
    expect(err).toBeInstanceOf(NativeSignInError);
    expect(err.code).toBe("invalid_aud");
  });

  it("is unavailable outside the app and when the config can't load", async () => {
    fetchMock.mockImplementation(() => respond({}, 500));
    await expect(nativeGoogleSignIn("ios")).rejects.toMatchObject({ code: "unavailable" });
    delete (window as Win).Capacitor;
    fetchMock.mockImplementation(() => respond(CONFIG));
    await expect(nativeGoogleSignIn("ios")).rejects.toMatchObject({ code: "unavailable" });
  });
});
