import type { NativeSetup } from "@/components/native-provider";
import { loadNative } from "@/lib/native";

/** Wait until the browser has painted the current DOM. */
function afterNextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

/**
 * Hide the launch splash once the hydrated page has painted (M2), instead of on
 * a timer. capacitor.config.ts keeps a long auto-hide only as a failsafe.
 */
export const setupSplashScreen: NativeSetup = async () => {
  const mod = await loadNative(() => import("@capacitor/splash-screen"));
  if (!mod) return;
  await afterNextPaint();
  await mod.SplashScreen.hide();
};
