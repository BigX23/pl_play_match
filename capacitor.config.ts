import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor wrapper config for shipping PlayMatch to the App Store / Play Store.
 *
 * PHASE 1 (current): the native shell loads the live hosted app at
 * `server.url`. This gets a real, installable app binary onto a phone/simulator
 * the fastest way, while we keep deploying the web app as normal. Downsides:
 * no offline, and Apple review guideline 4.2 ("minimum functionality") can push
 * back on a pure web wrapper — we counter that by adding native push, splash,
 * and status-bar theming so it behaves like a real app.
 *
 * PHASE 2 (store-quality): bundle the UI locally (webDir) and talk to the
 * existing API on the VPS via client fetch, for offline + a cleaner review.
 */
const config: CapacitorConfig = {
  appId: "com.aiplaymatch.app",
  appName: "Pleasanton PlayMatch",
  webDir: "capacitor-shell",
  server: {
    url: "https://aiplaymatch.com",
    cleartext: false,
  },
  ios: {
    contentInset: "always",
  },
};

export default config;
