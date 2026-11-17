import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deepLinkPath, setupDeepLinks } from "./deep-links";

type Listener = (event: { url: string }) => void;

const app = vi.hoisted(() => ({
  listener: null as Listener | null,
  launchUrl: undefined as string | undefined,
  removed: false,
  addListener: vi.fn(),
  getLaunchUrl: vi.fn(),
}));
vi.mock("@capacitor/app", () => ({ App: app }));

type Win = Window & { Capacitor?: unknown };
let assign: ReturnType<typeof vi.fn>;
let current = { pathname: "/", search: "", hash: "" };

beforeEach(() => {
  (window as Win).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
  app.listener = null;
  app.launchUrl = undefined;
  app.removed = false;
  app.addListener.mockImplementation(async (_event: string, fn: Listener) => {
    app.listener = fn;
    return { remove: async () => { app.removed = true; } };
  });
  app.getLaunchUrl.mockImplementation(async () => (app.launchUrl ? { url: app.launchUrl } : undefined));
  assign = vi.fn();
  current = { pathname: "/", search: "", hash: "" };
  vi.spyOn(window, "location", "get").mockImplementation(() => ({ ...current, assign }) as unknown as Location);
  sessionStorage.clear();
});

afterEach(() => {
  delete (window as Win).Capacitor;
  vi.restoreAllMocks();
});

describe("deepLinkPath", () => {
  it.each([
    ["https://aiplaymatch.com/dashboard/messages/c1", "/dashboard/messages/c1"],
    ["https://www.aiplaymatch.com/dashboard?tab=x#y", "/dashboard?tab=x#y"],
    ["https://AIPLAYMATCH.com", "/"],
    ["https://example.com/dashboard", null],
    ["not a url", null],
  ])("%s → %s", (link, path) => {
    expect(deepLinkPath(link)).toBe(path);
  });
});

describe("setupDeepLinks", () => {
  it("does nothing on the web", async () => {
    delete (window as Win).Capacitor;
    expect(await setupDeepLinks("ios")).toBeUndefined();
    expect(app.addListener).not.toHaveBeenCalled();
  });

  it("routes links that open the running app", async () => {
    const cleanup = await setupDeepLinks("android");
    app.listener!({ url: "https://aiplaymatch.com/dashboard/messages/c1" });
    expect(assign).toHaveBeenCalledWith("/dashboard/messages/c1");

    app.listener!({ url: "https://example.com/elsewhere" });
    expect(assign).toHaveBeenCalledTimes(1);

    (cleanup as () => void)();
    await Promise.resolve();
    expect(app.removed).toBe(true);
  });

  it("skips a link to the page already open", async () => {
    current = { pathname: "/dashboard/messages", search: "", hash: "" };
    await setupDeepLinks("ios");
    app.listener!({ url: "https://aiplaymatch.com/dashboard/messages" });
    expect(assign).not.toHaveBeenCalled();
  });

  it("follows the launch link once per app session", async () => {
    app.launchUrl = "https://aiplaymatch.com/dashboard/messages";
    await setupDeepLinks("ios");
    expect(assign).toHaveBeenCalledWith("/dashboard/messages");

    // A later full page load in the same session doesn't jump back.
    assign.mockClear();
    current = { pathname: "/dashboard/profile", search: "", hash: "" };
    await setupDeepLinks("ios");
    expect(assign).not.toHaveBeenCalled();
  });
});
