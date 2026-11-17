import type { NativeSetup } from "@/components/native-provider";

/**
 * iOS app only (M2). capacitor.config.ts sets `ios.contentInset: "never"`, so the
 * WebView runs under the status bar and home indicator. Adding
 * `viewport-fit=cover` here (not in the Next `viewport` export) turns on
 * env(safe-area-inset-*) inside the app only; the `html.native-ios` rules in
 * globals.css use it. The PWA keeps its current viewport.
 *
 * Android pads the WebView natively (SystemBars `insetsHandling: "native"`), so
 * it needs nothing here.
 */
export function addViewportFitCover(doc: Document = document): boolean {
  const meta = doc.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!meta) return false;
  const content = meta.getAttribute("content") ?? "";
  if (/viewport-fit\s*=\s*cover/.test(content)) return false;
  meta.setAttribute("content", content ? `${content}, viewport-fit=cover` : "viewport-fit=cover");
  return true;
}

export const setupSafeArea: NativeSetup = (platform) => {
  if (platform !== "ios") return;
  addViewportFitCover();
};
