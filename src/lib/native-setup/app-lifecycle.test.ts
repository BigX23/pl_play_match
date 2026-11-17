import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupAppLifecycle } from "./app-lifecycle";

type Listener = (event: Record<string, unknown>) => void;

const app = vi.hoisted(() => ({
  listeners: {} as Record<string, Listener>,
  removed: [] as string[],
  exitApp: vi.fn(async () => {}),
  addListener: vi.fn(),
}));

const reconnectRealtime = vi.hoisted(() => vi.fn());

vi.mock("@capacitor/app", () => ({ App: app }));
vi.mock("@/lib/data", () => ({ reconnectRealtime }));

type Win = Window & { Capacitor?: unknown };

beforeEach(() => {
  app.listeners = {};
  app.removed = [];
  app.exitApp.mockClear();
  reconnectRealtime.mockClear();
  app.addListener.mockImplementation(async (event: string, fn: Listener) => {
    app.listeners[event] = fn;
    return { remove: async () => { app.removed.push(event); } };
  });
});

afterEach(() => {
  delete (window as Win).Capacitor;
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
});

function native(p: "ios" | "android") {
  (window as Win).Capacitor = { isNativePlatform: () => true, getPlatform: () => p };
}

describe("setupAppLifecycle", () => {
  it("does nothing on the web", async () => {
    expect(await setupAppLifecycle("android")).toBeUndefined();
    expect(app.addListener).not.toHaveBeenCalled();
  });

  it("reconnects realtime when the app becomes active", async () => {
    native("ios");
    await setupAppLifecycle("ios");
    expect(app.listeners.backButton).toBeUndefined(); // iOS has no back button
    app.listeners.appStateChange({ isActive: false });
    expect(reconnectRealtime).not.toHaveBeenCalled();
    app.listeners.appStateChange({ isActive: true });
    expect(reconnectRealtime).toHaveBeenCalledTimes(1);
  });

  it("goes back in history below the root on Android", async () => {
    native("android");
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    await setupAppLifecycle("android");
    window.history.replaceState(null, "", "/dashboard/messages/c1");
    app.listeners.backButton({ canGoBack: true });
    expect(back).toHaveBeenCalledTimes(1);
    expect(app.exitApp).not.toHaveBeenCalled();
  });

  it.each(["/", "/dashboard", "/dashboard/"])("exits the app on %s", async (path) => {
    native("android");
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    await setupAppLifecycle("android");
    window.history.replaceState(null, "", path);
    app.listeners.backButton({ canGoBack: true });
    expect(app.exitApp).toHaveBeenCalledTimes(1);
    expect(back).not.toHaveBeenCalled();
  });

  it("exits when there is no history to go back to", async () => {
    native("android");
    await setupAppLifecycle("android");
    window.history.replaceState(null, "", "/dashboard/profile");
    app.listeners.backButton({ canGoBack: false });
    expect(app.exitApp).toHaveBeenCalledTimes(1);
  });

  it("removes its listeners on cleanup", async () => {
    native("android");
    const cleanup = await setupAppLifecycle("android");
    (cleanup as () => void)();
    await Promise.resolve();
    expect(app.removed.sort()).toEqual(["appStateChange", "backButton"]);
  });
});
