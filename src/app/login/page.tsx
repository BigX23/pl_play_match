"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getProviders, signIn } from "next-auth/react";
import { useAuth } from "@/lib/auth-context";
import { useNative } from "@/components/native-provider";
import { NativeSignInError, nativeAppleSignIn, nativeGoogleSignIn } from "@/lib/native-sign-in";
import { registerNativePushIfGranted } from "@/lib/native-push";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { LegalLinks } from "@/components/legal/legal-links";

function GoogleMark() {
  return (
    <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

/** Apple logo for the Sign in with Apple button (Apple HIG: logo + title, black or white). */
function AppleMark() {
  return (
    <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.62-1.7-3.19-1.72-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.19-1.54 2.67-.39 6.63 1.11 8.8.73 1.06 1.6 2.25 2.74 2.21 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.7.71 2.87.69 1.18-.02 1.93-1.08 2.66-2.14.84-1.23 1.18-2.42 1.2-2.48-.03-.01-2.3-.88-2.32-3.5zM14.18 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.65-1.05 1.68-.92 2.67.97.08 1.96-.49 2.56-1.22z" />
    </svg>
  );
}

function nativeErrorMessage(code: string, provider: "Google" | "Apple") {
  return code === "not_configured" || code.endsWith("_not_configured")
    ? `${provider} sign-in isn't set up for the app yet.`
    : "Sign-in failed. Please try again.";
}

export default function LoginPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { loginWithGoogle, refreshProfile } = useAuth();
  const native = useNative();
  const router = useRouter();
  const [webApple, setWebApple] = useState(false);

  // Web: offer Apple only once the server has it configured (see src/server/auth-providers.ts).
  useEffect(() => {
    let alive = true;
    getProviders()
      .then((p) => alive && setWebApple(!!p?.apple))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  // Sign in with Apple: native on iOS (App Store 4.8), web flow when configured, not in the Android app.
  const showApple = native.isNative ? native.platform === "ios" : webApple;

  // Inside the iOS/Android app: native SDK → /api/auth/native → session cookie.
  const runNative = async (provider: "Google" | "Apple", run: () => Promise<unknown>) => {
    try {
      await run();
      await refreshProfile();
      // Launch setup ran while signed out; link this device's push token now
      // (no prompt; only if notifications were already allowed).
      registerNativePushIfGranted().catch(() => {});
      // /dashboard sends incomplete profiles on to /onboarding, like the web flow.
      router.replace("/dashboard");
    } catch (err) {
      const code = err instanceof NativeSignInError ? err.code : "unknown";
      if (code !== "cancelled") setError(nativeErrorMessage(code, provider));
      setBusy(false);
    }
  };

  const handleApple = async () => {
    setError("");
    setBusy(true);
    if (native.isNative) return runNative("Apple", nativeAppleSignIn);
    try {
      await signIn("apple", { callbackUrl: "/dashboard" });
    } catch {
      setError("Sign-in failed. Please try again.");
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setBusy(true);
    const p = native.platform;
    if (native.isNative && p !== "web") return runNative("Google", () => nativeGoogleSignIn(p));
    try {
      await loginWithGoogle();
      // Full-page redirect to Google follows; nothing else to do here.
    } catch {
      setError("Sign-in failed. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-secondary/40">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link href="/" className="inline-flex items-center justify-center gap-2 mb-2">
            <Trophy className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">PlayMatch</span>
          </Link>
          <CardTitle className="text-2xl">Welcome</CardTitle>
          <CardDescription>
            Sign in with {showApple ? "Apple or Google" : "Google"} — new players get set up automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          {showApple && (
            <Button
              className="w-full bg-black text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/85"
              onClick={handleApple}
              disabled={busy}
            >
              <AppleMark />
              Continue with Apple
            </Button>
          )}
          <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={busy}>
            <GoogleMark />
            {busy ? (native.isNative ? "Signing in…" : "Redirecting…") : "Continue with Google"}
          </Button>
        </CardContent>
        <CardFooter className="flex-col gap-3">
          <p className="text-xs text-muted-foreground text-center w-full">
            We only use your {showApple ? "Apple or Google" : "Google"} account to sign you in — no passwords to remember.
          </p>
          <p className="text-xs text-muted-foreground text-center w-full">
            By continuing, you agree to our{" "}
            <Link href="/terms" className="text-primary hover:underline">Terms of Use</Link> and{" "}
            <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
          </p>
          <LegalLinks className="text-xs text-muted-foreground" />
        </CardFooter>
      </Card>
    </div>
  );
}
