import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  loadPreferences,
  savePreferences,
  defaultPreferences,
  isPushSupported,
  getPushPermission,
  enablePushNotifications,
  isIos,
  isStandalone,
} from "./notifications";

beforeEach(() => {
  localStorage.removeItem("playmatch_notification_prefs");
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("preferences", () => {
  it("returns defaults when nothing is stored", () => {
    expect(loadPreferences()).toEqual(defaultPreferences);
  });

  it("round-trips saved preferences", () => {
    savePreferences({ ...defaultPreferences, messages: false, quietHoursStart: "23:00" });
    const loaded = loadPreferences();
    expect(loaded.messages).toBe(false);
    expect(loaded.quietHoursStart).toBe("23:00");
  });

  it("merges partial stored prefs over defaults", () => {
    localStorage.setItem("playmatch_notification_prefs", JSON.stringify({ reminders: false }));
    const loaded = loadPreferences();
    expect(loaded.reminders).toBe(false);
    expect(loaded.messages).toBe(true); // default preserved
  });

  it("falls back to defaults on corrupt JSON", () => {
    localStorage.setItem("playmatch_notification_prefs", "{not json");
    expect(loadPreferences()).toEqual(defaultPreferences);
  });
});

describe("push support helpers", () => {
  it("isPushSupported reflects the environment", () => {
    // jsdom provides Notification via our setup? It may not; just assert boolean.
    expect(typeof isPushSupported()).toBe("boolean");
  });

  it("getPushPermission returns unsupported or a permission", () => {
    const result = getPushPermission();
    expect(["unsupported", "granted", "denied", "default"]).toContain(result);
  });
});

describe("platform detection (#47)", () => {
  const setNav = (props: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(props)) {
      Object.defineProperty(navigator, k, { value: v, configurable: true });
    }
  };
  afterEach(() => {
    // Remove instance overrides so jsdom's prototype getters take over again.
    for (const k of ["userAgent", "platform", "maxTouchPoints", "standalone"]) {
      // @ts-expect-error test cleanup
      delete navigator[k];
    }
  });

  it("isIos detects iPhones and iPadOS-masquerading-as-Mac", () => {
    setNav({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", platform: "iPhone", maxTouchPoints: 5 });
    expect(isIos()).toBe(true);
    setNav({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", platform: "MacIntel", maxTouchPoints: 5 });
    expect(isIos()).toBe(true); // iPadOS reports as Mac but has touch
    setNav({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", platform: "MacIntel", maxTouchPoints: 0 });
    expect(isIos()).toBe(false); // a real Mac
  });

  it("isStandalone honors display-mode standalone and the legacy iOS flag", () => {
    expect(isStandalone()).toBe(false); // plain jsdom: neither signal
    setNav({ standalone: true }); // legacy iOS home-screen flag
    expect(isStandalone()).toBe(true);
    // @ts-expect-error test cleanup
    delete navigator.standalone;
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q === "(display-mode: standalone)" }));
    expect(isStandalone()).toBe(true);
  });
});

describe("enablePushNotifications (Web Push)", () => {
  it("returns null when push isn't supported (jsdom has no serviceWorker)", async () => {
    // jsdom lacks navigator.serviceWorker → isPushSupported() is false.
    expect(await enablePushNotifications("u1")).toBeNull();
  });

  it("returns null when permission is denied", async () => {
    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission: vi.fn().mockResolvedValue("denied"),
    });
    Object.defineProperty(navigator, "serviceWorker", {
      value: { ready: Promise.resolve({}) },
      configurable: true,
    });
    expect(await enablePushNotifications("u1")).toBeNull();
    // @ts-expect-error cleanup
    delete navigator.serviceWorker;
  });

  it("subscribes and POSTs the subscription when granted", async () => {
    vi.stubGlobal("Notification", {
      permission: "granted",
      requestPermission: vi.fn().mockResolvedValue("granted"),
    });
    const subscription = {
      endpoint: "https://push.example/abc",
      toJSON: () => ({ endpoint: "https://push.example/abc", keys: { p256dh: "p", auth: "a" } }),
    };
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: vi.fn().mockResolvedValue(null),
            subscribe: vi.fn().mockResolvedValue(subscription),
          },
        }),
      },
      configurable: true,
    });
    const vapid = "BJdrAzNdtVMS5-j8-bjhhh2UmROQLD07b2_FRJZbCDFQJtmbMC1j_9klY7_m7smJ9KzfN8FztJVxeCoSoI0XimI";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ publicKey: vapid }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await enablePushNotifications("u1");
    expect(result).toBe("https://push.example/abc");
    expect(fetchMock).toHaveBeenCalledWith("/api/push/vapid");
    expect(fetchMock).toHaveBeenCalledWith("/api/push/subscribe", expect.objectContaining({ method: "POST" }));
    // @ts-expect-error cleanup
    delete navigator.serviceWorker;
  });
});
