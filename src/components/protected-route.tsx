"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, profileComplete, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    // If profile not complete and not already on onboarding, redirect
    if (!profileComplete && pathname !== "/onboarding") {
      router.push("/onboarding");
    }
  }, [isAuthenticated, profileComplete, loading, router, pathname]);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!isAuthenticated) return null;
  if (!profileComplete && pathname !== "/onboarding") return null;
  return <>{children}</>;
}
