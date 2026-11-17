import type { NativeSetup } from "@/components/native-provider";
import { loadNative } from "@/lib/native";

/**
 * Status bar icon color (M2).
 *
 * iOS: the strip behind the status bar is the page itself (see safe-area.ts), so
 * the icons follow the page theme: dark icons on the light header, light icons
 * when next-themes puts `dark` on <html>.
 *
 * Android: the strip is the native window background, which follows the
 * system light/dark mode (res/values-night/colors.xml), not the page. Icons use
 * the system style so they stay readable on it.
 */
export const setupStatusBar: NativeSetup = async (platform) => {
  const mod = await loadNative(() => import("@capacitor/status-bar"));
  if (!mod) return;
  const { StatusBar, Style } = mod;
  if (platform === "android") {
    await StatusBar.setStyle({ style: Style.Default });
    return;
  }
  const root = document.documentElement;

  let last: string | null = null;
  const apply = () => {
    const style = root.classList.contains("dark") ? Style.Dark : Style.Light;
    if (style === last) return;
    last = style;
    StatusBar.setStyle({ style }).catch((err) => console.warn("[native] status bar style failed", err));
  };

  apply();
  const observer = new MutationObserver(apply);
  observer.observe(root, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
};
