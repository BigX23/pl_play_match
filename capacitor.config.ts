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
const PRODUCTION_URL = "https://aiplaymatch.com";

/**
 * Local development only: `CAP_SERVER_URL=http://localhost:9002 npm run cap:sync`
 * points the simulators at `npm run dev`. The value is baked into the native
 * projects at sync time, so run `npm run cap:sync` again without it before any
 * release build. Android reaches the Mac's localhost via `adb reverse tcp:9002 tcp:9002`.
 */
const devUrl = process.env.CAP_SERVER_URL;
const serverUrl = devUrl || PRODUCTION_URL;

const config: CapacitorConfig = {
  appId: "com.aiplaymatch.app",
  appName: "Pleasanton PlayMatch",
  webDir: "capacitor-shell",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http:"),
    // The native bridge is exposed to whatever the WebView loads, so keep it on
    // our own origin; off-domain links must open in the system browser (M5).
    allowNavigation: [new URL(serverUrl).hostname],
  },
  ios: {
    contentInset: "always",
    // Pairs with WKAppBoundDomains in ios/App/App/Info.plist. Also what enables
    // service workers in WKWebView.
    // localhost isn't an app-bound domain, so the dev override switches this off.
    limitsNavigationsToAppBoundDomains: !devUrl,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // Native push (P2). Foreground pushes on iOS still show a banner.
    FirebaseMessaging: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  experimental: {
    ios: {
      spm: {
        // Avoids a SwiftPM package-identity collision with firebase-ios-sdk
        // (capawesome-team/capacitor-firebase#959). Needs Capacitor CLI 8.4+.
        packageOptions: {
          "@capacitor-firebase/messaging": { symlink: true },
        },
      },
    },
  },
};

export default config;
