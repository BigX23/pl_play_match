import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canShare, share } from "./share";
import { tapHaptic } from "./haptics";

const capShare = vi.hoisted(() => ({ share: vi.fn(async () => ({})) }));
const haptics = vi.hoisted(() => ({ impact: vi.fn(async () => {}) }));
vi.mock("@capacitor/share", () => ({ Share: capShare }));
vi.mock("@capacitor/haptics", () => ({ Haptics: haptics, ImpactStyle: { Light: "LIGHT" } }));

type Win = Window & { Capacitor?: unknown };
type Nav = Omit<Navigator, "share"> & { share?: unknown };
const content = { title: "T", text: "X", url: "https://aiplaymatch.com/dashboard/open-games" };

function native() {
  (window as Win).Capacitor = { isNativePlatform: () => true, getPlatform: () => "android" };
}

beforeEach(() => {
  capShare.share.mockClear();
  haptics.impact.mockClear();
});

afterEach(() => {
  delete (window as Win).Capacitor;
  delete (navigator as unknown as Nav).share;
  vi.restoreAllMocks();
});

describe("share", () => {
  it("is unavailable on a browser without navigator.share", async () => {
    expect(canShare()).toBe(false);
    expect(await share(content)).toBe(false);
  });

  it("uses navigator.share on the web when present", async () => {
    const webShare = vi.fn(async () => {});
    (navigator as unknown as Nav).share = webShare;
    expect(canShare()).toBe(true);
    expect(await share(content)).toBe(true);
    expect(webShare).toHaveBeenCalledWith(content);
    expect(capShare.share).not.toHaveBeenCalled();
  });

  it("treats a cancelled web share as not shared", async () => {
    (navigator as unknown as Nav).share = vi.fn(async () => { throw new DOMException("cancel", "AbortError"); });
    expect(await share(content)).toBe(false);
  });

  it("uses the native share sheet in the app", async () => {
    native();
    expect(canShare()).toBe(true);
    expect(await share(content)).toBe(true);
    expect(capShare.share).toHaveBeenCalledWith({ ...content, dialogTitle: "T" });
  });
});

describe("tapHaptic", () => {
  it("does nothing on the web", async () => {
    await tapHaptic();
    expect(haptics.impact).not.toHaveBeenCalled();
  });

  it("plays a light impact in the app and swallows failures", async () => {
    native();
    await tapHaptic();
    expect(haptics.impact).toHaveBeenCalledWith({ style: "LIGHT" });
    haptics.impact.mockRejectedValueOnce(new Error("no engine"));
    await expect(tapHaptic()).resolves.toBeUndefined();
  });
});
