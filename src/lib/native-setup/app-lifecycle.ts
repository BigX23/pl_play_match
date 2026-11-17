import type { NativeSetup } from "@/components/native-provider";
import { reconnectRealtime } from "@/lib/data";
import { loadNative } from "@/lib/native";

/** Pages where Android back leaves the app instead of going back in history. */
export const BACK_EXITS_ON = ["/", "/dashboard"];

function isRootPath(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return BACK_EXITS_ON.includes(path);
}

/**
 * Android hardware/gesture back and app lifecycle (M3).
 * - Back goes back in history; on the landing page or dashboard root (or with
 *   no history) it exits the app, like a native root screen.
 * - On resume, live SSE streams are reopened so messages aren't stale after the
 *   app was in the background.
 */
export const setupAppLifecycle: NativeSetup = async (platform) => {
  const mod = await loadNative(() => import("@capacitor/app"));
  if (!mod) return;
  const { App } = mod;

  const handles = [
    await App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) reconnectRealtime();
    }),
  ];

  if (platform === "android") {
    handles.push(
      await App.addListener("backButton", ({ canGoBack }) => {
        if (!canGoBack || isRootPath(window.location.pathname)) {
          void App.exitApp();
        } else {
          window.history.back();
        }
      })
    );
  }

  return () => handles.forEach((h) => void h.remove());
};
