/**
 * Native-app (Capacitor) detection and plugin loading.
 *
 * The iOS/Android apps load this same site from aiplaymatch.com, and Capacitor
 * injects `window.Capacitor` into their WebView. Detection reads that global
 * directly, so the web/PWA never loads Capacitor code at runtime.
 */

export type NativePlatform = "ios" | "android" | "web";

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

function capacitor(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { Capacitor?: CapacitorGlobal }).Capacitor;
}

/** True only inside the iOS/Android app shell (never during SSR or on the web). */
export function isNative(): boolean {
  return capacitor()?.isNativePlatform?.() === true;
}

export function platform(): NativePlatform {
  if (!isNative()) return "web";
  const p = capacitor()?.getPlatform?.();
  return p === "ios" || p === "android" ? p : "web";
}

/**
 * Load a plugin module only inside the native app, e.g.
 * `await loadNative(() => import("@capacitor/status-bar"))`.
 * Resolves null on the web, or if the module fails to load, so callers
 * degrade to the web behavior instead of throwing.
 */
export async function loadNative<T>(load: () => Promise<T>): Promise<T | null> {
  if (!isNative()) return null;
  try {
    return await load();
  } catch (err) {
    console.warn("[native] plugin failed to load", err);
    return null;
  }
}
