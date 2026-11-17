import type { NativeSetup } from "@/components/native-provider";
import { loadNative } from "@/lib/native";

const SYSTEM_SCHEMES = new Set(["mailto:", "tel:", "sms:"]);

export type ExternalLink = { kind: "browser" | "system"; url: string };

/**
 * How the app should open a link, or null to let the WebView handle it.
 * Off-origin http(s) opens in the in-app browser (SFSafariViewController /
 * Custom Tabs); mailto/tel/sms go to the system handler.
 */
export function externalLink(href: string, origin: string): ExternalLink | null {
  let url: URL;
  try {
    url = new URL(href, origin);
  } catch {
    return null;
  }
  if (url.protocol === "http:" || url.protocol === "https:") {
    return url.origin === origin ? null : { kind: "browser", url: url.href };
  }
  if (SYSTEM_SCHEMES.has(url.protocol)) return { kind: "system", url: url.href };
  return null;
}

/**
 * Off-domain links in the app (M5). The bridge is exposed to whatever the
 * WebView shows, so it must never navigate off our origin (allowNavigation is
 * our host only). One capturing click listener handles every <a> on every page,
 * so no link needs its own native code. Web behavior is unchanged: this only
 * runs inside the app.
 */
export const setupExternalLinks: NativeSetup = () => {
  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0) return;
    const anchor = (event.target as Element | null)?.closest?.("a[href]");
    if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute("download")) return;
    const link = externalLink(anchor.getAttribute("href") ?? "", window.location.origin);
    if (!link) return;

    event.preventDefault();
    if (link.kind === "system") {
      // Capacitor hands any main-frame navigation outside the app to the OS
      // (Mail, Phone, ...), so a plain navigation is enough. It also drops
      // target="_blank", which the WebView can't open.
      window.location.assign(link.url);
      return;
    }
    void loadNative(() => import("@capacitor/browser")).then((mod) => {
      if (mod) return mod.Browser.open({ url: link.url });
      window.location.assign(link.url); // plugin missing: Capacitor opens Safari / the browser
    });
  };

  window.addEventListener("click", onClick, true);
  return () => window.removeEventListener("click", onClick, true);
};
