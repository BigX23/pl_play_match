import { afterEach, describe, expect, it, vi } from "vitest";
import { isNative, loadNative, platform } from "./native";

type Win = Window & { Capacitor?: unknown };

function setCapacitor(value: unknown) {
  (window as Win).Capacitor = value;
}

afterEach(() => {
  delete (window as Win).Capacitor;
  vi.restoreAllMocks();
});

describe("isNative / platform", () => {
  it("is web when the Capacitor bridge is absent", () => {
    expect(isNative()).toBe(false);
    expect(platform()).toBe("web");
  });

  it("is web when the bridge reports a non-native platform", () => {
    setCapacitor({ isNativePlatform: () => false, getPlatform: () => "web" });
    expect(isNative()).toBe(false);
    expect(platform()).toBe("web");
  });

  it.each(["ios", "android"] as const)("detects %s", (p) => {
    setCapacitor({ isNativePlatform: () => true, getPlatform: () => p });
    expect(isNative()).toBe(true);
    expect(platform()).toBe(p);
  });

  it("treats a partial or unknown bridge as web", () => {
    setCapacitor({});
    expect(isNative()).toBe(false);
    setCapacitor({ isNativePlatform: () => true, getPlatform: () => "electron" });
    expect(platform()).toBe("web");
  });
});

describe("loadNative", () => {
  it("does not load the module on the web", async () => {
    const load = vi.fn(async () => ({ ok: true }));
    expect(await loadNative(load)).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it("loads the module inside the app", async () => {
    setCapacitor({ isNativePlatform: () => true, getPlatform: () => "ios" });
    expect(await loadNative(async () => ({ ok: true }))).toEqual({ ok: true });
  });

  it("resolves null and warns when the module fails to load", async () => {
    setCapacitor({ isNativePlatform: () => true, getPlatform: () => "android" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await loadNative(async () => { throw new Error("missing plugin"); })).toBeNull();
    expect(warn).toHaveBeenCalled();
  });
});
