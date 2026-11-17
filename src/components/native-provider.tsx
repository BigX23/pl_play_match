"use client";

import * as React from "react";
import { isNative, platform, type NativePlatform } from "@/lib/native";
import { setupAppLifecycle } from "@/lib/native-setup/app-lifecycle";
import { setupDeepLinks } from "@/lib/native-setup/deep-links";
import { setupExternalLinks } from "@/lib/native-setup/links";
import { setupSafeArea } from "@/lib/native-setup/safe-area";
import { setupSplashScreen } from "@/lib/native-setup/splash-screen";
import { setupStatusBar } from "@/lib/native-setup/status-bar";
import { setupNativePush } from "@/lib/native-setup/push";

/**
 * One-time setup that runs at launch inside the native app only (status bar,
 * splash screen, back button, deep-link listener, ...). May return a cleanup.
 */
export type NativeSetup = (platform: Exclude<NativePlatform, "web">) => void | (() => void) | Promise<void | (() => void)>;

// Mobile tasks register their launch setup here (see docs/MOBILE_APP_PLAN.md: M2, M3, M4).
export const NATIVE_SETUP: NativeSetup[] = [
  setupSafeArea,
  setupStatusBar,
  setupSplashScreen,
  setupAppLifecycle,
  setupExternalLinks,
  setupDeepLinks,
  setupNativePush,
];

interface NativeState {
  isNative: boolean;
  platform: NativePlatform;
}

const NativeContext = React.createContext<NativeState>({ isNative: false, platform: "web" });

/**
 * Native app state for components. Always `web` during SSR and the first
 * client render, then updates after mount, so server and client HTML match.
 */
export function useNative(): NativeState {
  return React.useContext(NativeContext);
}

export function NativeProvider({
  children,
  setup = NATIVE_SETUP,
}: {
  children: React.ReactNode;
  setup?: NativeSetup[];
}) {
  const [state, setState] = React.useState<NativeState>({ isNative: false, platform: "web" });
  // Setup runs once per launch, even if a caller passes a new array each render.
  const setupRef = React.useRef(setup);

  React.useEffect(() => {
    if (!isNative()) return;
    const p = platform() as Exclude<NativePlatform, "web">;
    setState({ isNative: true, platform: p });

    // Lets CSS target the app shell (safe areas etc.) without touching the PWA.
    const root = document.documentElement;
    root.classList.add("native", `native-${p}`);

    let cancelled = false;
    const cleanups: (() => void)[] = [];
    for (const fn of setupRef.current) {
      Promise.resolve()
        .then(() => fn(p))
        .then((cleanup) => {
          if (typeof cleanup !== "function") return;
          if (cancelled) cleanup();
          else cleanups.push(cleanup);
        })
        .catch((err) => console.warn("[native] setup failed", err));
    }
    console.info(`[native] bridge ready (${p})`);

    return () => {
      cancelled = true;
      cleanups.forEach((c) => c());
      root.classList.remove("native", `native-${p}`);
    };
  }, []);

  return <NativeContext.Provider value={state}>{children}</NativeContext.Provider>;
}
