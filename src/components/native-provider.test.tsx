import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { NativeProvider, useNative, type NativeSetup } from "./native-provider";

type Win = Window & { Capacitor?: unknown };

function Probe() {
  const { isNative, platform } = useNative();
  return <p>{isNative ? `native:${platform}` : "web"}</p>;
}

afterEach(() => {
  delete (window as Win).Capacitor;
  document.documentElement.className = "";
  vi.restoreAllMocks();
});

describe("NativeProvider", () => {
  it("stays web and runs no setup without the bridge", async () => {
    const setup = vi.fn();
    render(<NativeProvider setup={[setup]}><Probe /></NativeProvider>);
    expect(screen.getByText("web")).toBeInTheDocument();
    await Promise.resolve();
    expect(setup).not.toHaveBeenCalled();
    expect(document.documentElement).not.toHaveClass("native");
  });

  it("flags the app shell, runs setup, and cleans up on unmount", async () => {
    (window as Win).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
    vi.spyOn(console, "info").mockImplementation(() => {});
    const cleanup = vi.fn();
    const setup = vi.fn<NativeSetup>(() => cleanup);

    const { unmount } = render(<NativeProvider setup={[setup]}><Probe /></NativeProvider>);

    expect(await screen.findByText("native:ios")).toBeInTheDocument();
    expect(document.documentElement).toHaveClass("native", "native-ios");
    await waitFor(() => expect(setup).toHaveBeenCalledWith("ios"));

    unmount();
    await waitFor(() => expect(cleanup).toHaveBeenCalledTimes(1));
    expect(setup).toHaveBeenCalledTimes(1);
    expect(document.documentElement).not.toHaveClass("native");
  });

  it("keeps running other setup when one fails", async () => {
    (window as Win).Capacitor = { isNativePlatform: () => true, getPlatform: () => "android" };
    vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ok = vi.fn();
    render(
      <NativeProvider setup={[() => { throw new Error("boom"); }, ok]}>
        <Probe />
      </NativeProvider>
    );
    await waitFor(() => expect(ok).toHaveBeenCalledWith("android"));
    await waitFor(() => expect(warn).toHaveBeenCalled());
  });
});
