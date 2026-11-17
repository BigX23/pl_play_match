import type { NativeSetup } from "@/components/native-provider";
import { loadNative } from "@/lib/native";

/** Hosts whose links open in the app (Universal Links / App Links, M4). */
export const DEEP_LINK_HOSTS = ["aiplaymatch.com", "www.aiplaymatch.com"];

/**
 * The in-app path for a link that opened the app, or null if it isn't ours.
 * The path is applied to the app's current origin, so a dev build pointed at
 * localhost routes there too.
 */
export function deepLinkPath(link: string): string | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (!DEEP_LINK_HOSTS.includes(url.hostname.toLowerCase())) return null;
  return `${url.pathname}${url.search}${url.hash}` || "/";
}

function open(link: string | undefined) {
  if (!link) return;
  const path = deepLinkPath(link);
  if (!path) return;
  const { pathname, search, hash } = window.location;
  if (path === `${pathname}${search}${hash}`) return;
  // A full navigation: setup code has no handle on the Next router. It only
  // happens when a link opens the app, so the extra page load is acceptable.
  window.location.assign(path);
}

const HANDLED_LAUNCH_KEY = "playmatch:handled-launch-url";

function readHandledLaunch(): string | null {
  try {
    return sessionStorage.getItem(HANDLED_LAUNCH_KEY);
  } catch {
    return null;
  }
}

function writeHandledLaunch(url: string) {
  try {
    sessionStorage.setItem(HANDLED_LAUNCH_KEY, url);
  } catch {
    // Storage unavailable: worst case the launch link is followed again.
  }
}

/**
 * Route https://aiplaymatch.com/... links that open the app to that page (M4),
 * both when they launch the app and when it is already running.
 */
export const setupDeepLinks: NativeSetup = async () => {
  const mod = await loadNative(() => import("@capacitor/app"));
  if (!mod) return;
  const { App } = mod;

  const handle = await App.addListener("appUrlOpen", ({ url }) => open(url));

  // getLaunchUrl() keeps returning the launch link for the whole app session,
  // so handle it once; later full page loads must not jump back to it.
  const launch = (await App.getLaunchUrl().catch(() => undefined))?.url;
  if (launch && readHandledLaunch() !== launch) {
    writeHandledLaunch(launch);
    open(launch);
  }

  return () => void handle.remove();
};
