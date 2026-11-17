import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addViewportFitCover, setupSafeArea } from "./safe-area";
import { setupStatusBar } from "./status-bar";
import { setupSplashScreen } from "./splash-screen";

const statusBar = vi.hoisted(() => ({ setStyle: vi.fn(async () => {}) }));
const splash = vi.hoisted(() => ({ hide: vi.fn(async () => {}) }));

vi.mock("@capacitor/status-bar", () => ({
  StatusBar: statusBar,
  Style: { Dark: "DARK", Light: "LIGHT", Default: "DEFAULT" },
}));
vi.mock("@capacitor/splash-screen", () => ({ SplashScreen: splash }));

type Win = Window & { Capacitor?: unknown };

function setNative(p: "ios" | "android") {
  (window as Win).Capacitor = { isNativePlatform: () => true, getPlatform: () => p };
}

function setViewport(content: string | null) {
  document.head.querySelectorAll('meta[name="viewport"]').forEach((m) => m.remove());
  if (content === null) return;
  const meta = document.createElement("meta");
  meta.name = "viewport";
  meta.content = content;
  document.head.appendChild(meta);
}

const viewport = () => document.querySelector('meta[name="viewport"]')?.getAttribute("content");

beforeEach(() => {
  statusBar.setStyle.mockClear();
  splash.hide.mockClear();
});

afterEach(() => {
  delete (window as Win).Capacitor;
  document.documentElement.className = "";
  setViewport(null);
  vi.restoreAllMocks();
});

describe("safe area", () => {
  it("adds viewport-fit=cover once", () => {
    setViewport("width=device-width, initial-scale=1");
    expect(addViewportFitCover()).toBe(true);
    expect(viewport()).toBe("width=device-width, initial-scale=1, viewport-fit=cover");
    expect(addViewportFitCover()).toBe(false);
    expect(viewport()).toBe("width=device-width, initial-scale=1, viewport-fit=cover");
  });

  it("does nothing without a viewport meta", () => {
    expect(addViewportFitCover()).toBe(false);
  });

  it("only changes the viewport in the iOS app", () => {
    setViewport("width=device-width");
    setupSafeArea("android");
    expect(viewport()).toBe("width=device-width");
    setupSafeArea("ios");
    expect(viewport()).toBe("width=device-width, viewport-fit=cover");
  });
});

describe("status bar", () => {
  it("does not load the plugin on the web", async () => {
    await setupStatusBar("ios");
    expect(statusBar.setStyle).not.toHaveBeenCalled();
  });

  it("follows the page theme on iOS", async () => {
    setNative("ios");
    const cleanup = await setupStatusBar("ios");
    expect(statusBar.setStyle).toHaveBeenLastCalledWith({ style: "LIGHT" });

    document.documentElement.classList.add("dark");
    await vi.waitFor(() => expect(statusBar.setStyle).toHaveBeenLastCalledWith({ style: "DARK" }));

    // Unrelated class changes don't re-send the same style.
    document.documentElement.classList.add("native");
    await new Promise((r) => setTimeout(r, 0));
    expect(statusBar.setStyle).toHaveBeenCalledTimes(2);

    expect(typeof cleanup).toBe("function");
    (cleanup as () => void)();
    document.documentElement.classList.remove("dark");
    await new Promise((r) => setTimeout(r, 0));
    expect(statusBar.setStyle).toHaveBeenCalledTimes(2);
  });

  it("uses the system style on Android", async () => {
    setNative("android");
    document.documentElement.classList.add("dark");
    expect(await setupStatusBar("android")).toBeUndefined();
    expect(statusBar.setStyle).toHaveBeenCalledTimes(1);
    expect(statusBar.setStyle).toHaveBeenCalledWith({ style: "DEFAULT" });
  });
});

describe("splash screen", () => {
  it("does nothing on the web", async () => {
    await setupSplashScreen("ios");
    expect(splash.hide).not.toHaveBeenCalled();
  });

  it("hides after the next paint in the app", async () => {
    setNative("android");
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    const done = setupSplashScreen("android");
    await vi.waitFor(() => expect(frames).toHaveLength(1));
    expect(splash.hide).not.toHaveBeenCalled();
    frames[0](0);
    frames[1](0);
    await done;
    expect(splash.hide).toHaveBeenCalledTimes(1);
  });
});
