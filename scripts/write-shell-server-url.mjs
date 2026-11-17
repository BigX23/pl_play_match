#!/usr/bin/env node
/**
 * Capacitor `capacitor:copy:after` hook (package.json). Writes the app's
 * server.url into the copied offline page (capacitor-shell/index.html, M6) so
 * its Retry button reloads the server the app was synced against: production,
 * or `CAP_SERVER_URL` during local development. Only the platform copies are
 * changed; the source file keeps the production URL.
 *
 * The value is inlined (not a separate script file) because on Android the
 * error page is served on its own origin, where only the page itself loads.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const COPIES = {
  ios: "ios/App/App/public/index.html",
  android: "android/app/src/main/assets/public/index.html",
};
const MARKER = /(\/\*SERVER_URL\*\/)"[^"]*"/;

const platform = process.env.CAPACITOR_PLATFORM_NAME;
const root = process.env.CAPACITOR_ROOT_DIR ?? process.cwd();
const target = platform && COPIES[platform] ? join(root, COPIES[platform]) : null;

if (target && existsSync(target)) {
  let url = "https://aiplaymatch.com";
  try {
    const config = JSON.parse(process.env.CAPACITOR_CONFIG ?? "{}");
    if (typeof config.server?.url === "string") url = config.server.url;
  } catch {
    // Keep the production default.
  }
  const html = readFileSync(target, "utf8");
  if (!MARKER.test(html)) {
    console.error(`[write-shell-server-url] marker not found in ${target}`);
    process.exit(1);
  }
  writeFileSync(target, html.replace(MARKER, `$1${JSON.stringify(url)}`));
}
