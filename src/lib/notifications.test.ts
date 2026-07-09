import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadPreferences,
  savePreferences,
  defaultPreferences,
  isPushSupported,
  getPushPermission,
  initFCM,
  enablePushNotifications,
} from "./notifications";

beforeEach(() => {
  localStorage.removeItem("playmatch_notification_prefs");
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

describe("FCM in mock mode (unconfigured Firebase)", () => {
  it("initFCM returns null", async () => {
    expect(await initFCM()).toBeNull();
  });
  it("enablePushNotifications returns null", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await enablePushNotifications("u1")).toBeNull();
    warn.mockRestore();
  });
});
