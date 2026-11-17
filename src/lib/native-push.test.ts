import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The real plugin talks to the native bridge; mock its surface.
const fcm = {
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  getToken: vi.fn(),
  addListener: vi.fn(),
};
vi.mock("@capacitor-firebase/messaging", () => ({ FirebaseMessaging: fcm }));

import {
  enableNativePush,
  getNativePushPermission,
  registerNativePushIfGranted,
  safeNotificationPath,
  unregisterNativePush,
} from "./native-push";
import { setupNativePush } from "./native-setup/push";

type Win = Window & { Capacitor?: unknown };
const asNative = (p: "ios" | "android") => {
  (window as Win).Capacitor = { isNativePlatform: () => true, getPlatform: () => p };
};

const fetchMock = vi.fn();

beforeEach(() => {
  Object.values(fcm).forEach((f) => f.mockReset());
  fetchMock.mockReset().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  delete (window as Win).Capacitor;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const bodyOf = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string);

describe("on the web", () => {
  it("never touches the plugin or the native endpoints", async () => {
    expect(await getNativePushPermission()).toBe("unsupported");
    expect(await enableNativePush()).toBe("unavailable");
    await registerNativePushIfGranted();
    await unregisterNativePush();
    expect(await setupNativePush("ios")).toBeUndefined();
    expect(fcm.checkPermissions).not.toHaveBeenCalled();
    expect(fcm.addListener).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("enableNativePush", () => {
  it("requests permission, gets the FCM token and registers it with the platform", async () => {
    asNative("ios");
    fcm.requestPermissions.mockResolvedValue({ receive: "granted" });
    fcm.getToken.mockResolvedValue({ token: "fcm-ios" });
    expect(await enableNativePush()).toBe("enabled");
    expect(fetchMock).toHaveBeenCalledWith("/api/push/native/register", expect.objectContaining({ method: "POST" }));
    expect(bodyOf(fetchMock.mock.calls[0])).toEqual({ token: "fcm-ios", platform: "ios" });
  });

  it("reports denied without fetching a token", async () => {
    asNative("android");
    fcm.requestPermissions.mockResolvedValue({ receive: "denied" });
    expect(await enableNativePush()).toBe("denied");
    expect(fcm.getToken).not.toHaveBeenCalled();
  });

  it("is unavailable when the build has no Firebase config (getToken rejects)", async () => {
    asNative("android");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    fcm.requestPermissions.mockResolvedValue({ receive: "granted" });
    fcm.getToken.mockRejectedValue(new Error("Default FirebaseApp is not initialized"));
    expect(await enableNativePush()).toBe("unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is unavailable when the server rejects the token", async () => {
    asNative("android");
    fcm.requestPermissions.mockResolvedValue({ receive: "granted" });
    fcm.getToken.mockResolvedValue({ token: "t" });
    fetchMock.mockResolvedValue({ ok: false });
    expect(await enableNativePush()).toBe("unavailable");
  });

  it("is unavailable when the permission prompt fails", async () => {
    asNative("ios");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    fcm.requestPermissions.mockRejectedValue(new Error("boom"));
    expect(await enableNativePush()).toBe("unavailable");
  });
});

describe("getNativePushPermission", () => {
  it.each([
    ["granted", "granted"],
    ["denied", "denied"],
    ["prompt", "prompt"],
    ["prompt-with-rationale", "prompt"],
  ])("maps %s → %s", async (receive, expected) => {
    asNative("android");
    fcm.checkPermissions.mockResolvedValue({ receive });
    expect(await getNativePushPermission()).toBe(expected);
  });

  it("is unsupported if the bridge call fails", async () => {
    asNative("ios");
    fcm.checkPermissions.mockRejectedValue(new Error("no plugin"));
    expect(await getNativePushPermission()).toBe("unsupported");
  });
});

describe("registerNativePushIfGranted", () => {
  it("re-registers when permission is already granted", async () => {
    asNative("android");
    fcm.checkPermissions.mockResolvedValue({ receive: "granted" });
    fcm.getToken.mockResolvedValue({ token: "and-tok" });
    await registerNativePushIfGranted();
    expect(bodyOf(fetchMock.mock.calls[0])).toEqual({ token: "and-tok", platform: "android" });
  });

  it("never prompts and never registers when permission isn't granted", async () => {
    asNative("ios");
    fcm.checkPermissions.mockResolvedValue({ receive: "prompt" });
    await registerNativePushIfGranted();
    expect(fcm.requestPermissions).not.toHaveBeenCalled();
    expect(fcm.getToken).not.toHaveBeenCalled();
  });
});

describe("unregisterNativePush", () => {
  it("unregisters this install's token", async () => {
    asNative("ios");
    fcm.checkPermissions.mockResolvedValue({ receive: "granted" });
    fcm.getToken.mockResolvedValue({ token: "ios-tok" });
    await unregisterNativePush();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/push/native/unregister");
    expect(bodyOf(fetchMock.mock.calls[0])).toEqual({ token: "ios-tok" });
  });

  it("swallows errors", async () => {
    asNative("ios");
    fcm.checkPermissions.mockResolvedValue({ receive: "granted" });
    fcm.getToken.mockRejectedValue(new Error("x"));
    await expect(unregisterNativePush()).resolves.toBeUndefined();
  });
});

describe("safeNotificationPath", () => {
  const origin = "https://aiplaymatch.com";
  it.each([
    ["/dashboard/messages/c1", "/dashboard/messages/c1"],
    ["/dashboard?tab=x#y", "/dashboard?tab=x#y"],
  ])("allows same-origin path %s", (url, expected) => {
    expect(safeNotificationPath(url, origin)).toBe(expected);
  });
  it.each([
    "https://evil.example/x",
    "//evil.example/x",
    "/\\evil.example",
    "javascript:alert(1)",
    "dashboard",
    "",
    undefined,
    42,
  ])("rejects %s", (url) => {
    expect(safeNotificationPath(url, origin)).toBeNull();
  });
});

describe("setupNativePush (launch)", () => {
  type Listener = (e: unknown) => void;
  let listeners: Record<string, Listener>;
  const remove = vi.fn();

  beforeEach(() => {
    listeners = {};
    remove.mockReset();
    fcm.addListener.mockImplementation(async (name: string, fn: Listener) => {
      listeners[name] = fn;
      return { remove };
    });
  });

  it("re-registers on launch, routes taps to same-origin data.url, and cleans up", async () => {
    asNative("ios");
    fcm.checkPermissions.mockResolvedValue({ receive: "granted" });
    fcm.getToken.mockResolvedValue({ token: "t" });
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, origin: "https://aiplaymatch.com", assign });

    const cleanup = await setupNativePush("ios");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/push/native/register", expect.anything()));

    listeners.notificationActionPerformed({ actionId: "tap", notification: { data: { url: "/dashboard/messages/c9" } } });
    expect(assign).toHaveBeenCalledWith("/dashboard/messages/c9");

    assign.mockClear();
    listeners.notificationActionPerformed({ actionId: "tap", notification: { data: { url: "https://evil.example/" } } });
    listeners.notificationActionPerformed({ actionId: "tap", notification: {} });
    expect(assign).not.toHaveBeenCalled();

    expect(typeof cleanup).toBe("function");
    (cleanup as () => void)();
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it("sends a rotated token to the server", async () => {
    asNative("android");
    fcm.checkPermissions.mockResolvedValue({ receive: "prompt" });
    await setupNativePush("android");
    listeners.tokenReceived({ token: "rotated" });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(bodyOf(fetchMock.mock.calls[0])).toEqual({ token: "rotated", platform: "android" });
  });
});
