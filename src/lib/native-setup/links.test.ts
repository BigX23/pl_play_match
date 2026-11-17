import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { externalLink, setupExternalLinks } from "./links";

const browser = vi.hoisted(() => ({ open: vi.fn(async () => {}) }));
vi.mock("@capacitor/browser", () => ({ Browser: browser }));

type Win = Window & { Capacitor?: unknown };
const ORIGIN = window.location.origin; // jsdom: http://localhost:3000

describe("externalLink", () => {
  it.each([
    ["/dashboard", null],
    [`${ORIGIN}/dashboard/messages`, null],
    ["#top", null],
    ["javascript:void(0)", null],
    ["https://myaccount.google.com/security", { kind: "browser", url: "https://myaccount.google.com/security" }],
    ["http://localhost:9999/x", { kind: "browser", url: "http://localhost:9999/x" }],
    ["mailto:feedback@aiplaymatch.com?subject=Hi", { kind: "system", url: "mailto:feedback@aiplaymatch.com?subject=Hi" }],
    ["tel:+15555550100", { kind: "system", url: "tel:+15555550100" }],
  ])("%s", (href, expected) => {
    expect(externalLink(href, ORIGIN)).toEqual(expected);
  });
});

describe("setupExternalLinks", () => {
  let cleanup: (() => void) | undefined;
  let assign: ReturnType<typeof vi.fn>;
  let navigations: string[];

  beforeEach(() => {
    (window as Win).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
    browser.open.mockClear();
    navigations = [];
    assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, origin: ORIGIN, assign } as Location);
    cleanup = setupExternalLinks("ios") as () => void;
    // Record what reached the default action (i.e. the WebView would navigate).
    document.addEventListener("click", (e) => {
      if (!e.defaultPrevented) navigations.push((e.target as Element).closest("a")?.getAttribute("href") ?? "");
      e.preventDefault(); // jsdom can't navigate
    });
  });

  afterEach(() => {
    cleanup?.();
    delete (window as Win).Capacitor;
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  function click(href: string, attrs: Record<string, string> = {}) {
    const a = document.createElement("a");
    a.href = href;
    Object.entries(attrs).forEach(([k, v]) => a.setAttribute(k, v));
    const span = document.createElement("span");
    a.appendChild(span);
    document.body.appendChild(a);
    span.click();
  }

  it("opens off-origin links in the in-app browser", async () => {
    click("https://myaccount.google.com/security", { target: "_blank" });
    await vi.waitFor(() => expect(browser.open).toHaveBeenCalledWith({ url: "https://myaccount.google.com/security" }));
    expect(navigations).toEqual([]);
  });

  it("sends mailto and tel to the system handler", () => {
    click("mailto:feedback@aiplaymatch.com");
    click("tel:+15555550100");
    expect(assign).toHaveBeenNthCalledWith(1, "mailto:feedback@aiplaymatch.com");
    expect(assign).toHaveBeenNthCalledWith(2, "tel:+15555550100");
    expect(browser.open).not.toHaveBeenCalled();
    expect(navigations).toEqual([]);
  });

  it("leaves same-origin links to the app", () => {
    click("/dashboard/messages");
    expect(navigations).toEqual(["/dashboard/messages"]);
    expect(assign).not.toHaveBeenCalled();
    expect(browser.open).not.toHaveBeenCalled();
  });

  it("stops intercepting after cleanup", () => {
    cleanup?.();
    cleanup = undefined;
    click("mailto:a@b.c");
    expect(assign).not.toHaveBeenCalled();
    expect(navigations).toEqual(["mailto:a@b.c"]);
  });
});
