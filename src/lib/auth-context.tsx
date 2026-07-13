"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { signIn, signOut } from "next-auth/react";
import { type Player } from "./mock-data";

/**
 * Auth context — thin client shim over Auth.js (Google-only).
 *
 * The full profile lives in Postgres and is served by /api/me; this context
 * loads it once, exposes it as `user`, and persists edits via PATCH /api/me.
 * The exported interface is kept stable across the backend migration so pages and
 * components don't need to know the backend moved.
 *
 * Mock mode (NEXT_PUBLIC_MOCK_AUTH="true", local dev only): a fake user kept
 * in localStorage, no server calls.
 */

interface AuthContextType {
  user: Player | null;
  isAuthenticated: boolean;
  profileComplete: boolean;
  loading: boolean;
  login: () => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  register: () => Promise<boolean>;
  logout: () => void;
  deleteAccount: () => Promise<void>;
  setProfileComplete: (complete: boolean) => void;
  updateUserProfile: (data: Partial<Player>) => void;
  /** Refresh the profile from the server (e.g. after external changes). */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isMockAuth = () => process.env.NEXT_PUBLIC_MOCK_AUTH === "true";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  const persistMock = (u: Player | null) => {
    if (typeof window === "undefined") return;
    if (u) localStorage.setItem("playmatch_user", JSON.stringify(u));
    else localStorage.removeItem("playmatch_user");
  };

  const refreshProfile = useCallback(async () => {
    if (isMockAuth()) return;
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      setUser(res.ok ? await res.json() : null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (isMockAuth()) {
      try {
        const saved = typeof window !== "undefined" ? localStorage.getItem("playmatch_user") : null;
        if (saved) setUser(JSON.parse(saved));
      } catch {}
      setLoading(false);
      return;
    }
    refreshProfile().finally(() => setLoading(false));
  }, [refreshProfile]);

  const startGoogleSignIn = useCallback(async () => {
    if (isMockAuth()) {
      const u = { id: "mock", name: "Mock User", email: "mock@playmatch.app", profileComplete: false } as unknown as Player;
      setUser(u);
      persistMock(u);
      return true;
    }
    // Full-page redirect to Google; the promise usually never resolves here.
    await signIn("google", { callbackUrl: "/dashboard" });
    return true;
  }, []);

  const logout = useCallback(() => {
    if (isMockAuth()) {
      setUser(null);
      persistMock(null);
      return;
    }
    setUser(null);
    signOut({ callbackUrl: "/" });
  }, []);

  const deleteAccount = useCallback(async () => {
    if (isMockAuth()) {
      setUser(null);
      persistMock(null);
      return;
    }
    const res = await fetch("/api/me", { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete account");
    setUser(null);
    await signOut({ callbackUrl: "/" });
  }, []);

  const updateUserProfile = useCallback((data: Partial<Player>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...data };
      if (isMockAuth()) persistMock(updated);
      return updated;
    });
    if (!isMockAuth()) {
      // Persist in the background; refresh on failure so UI matches the server.
      fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((res) => {
        if (!res.ok) refreshProfile();
      }).catch(() => refreshProfile());
    }
  }, [refreshProfile]);

  const setProfileComplete = useCallback((complete: boolean) => {
    updateUserProfile({ profileComplete: complete } as Partial<Player>);
  }, [updateUserProfile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        profileComplete: user?.profileComplete ?? false,
        loading,
        login: startGoogleSignIn,
        loginWithGoogle: startGoogleSignIn,
        register: startGoogleSignIn,
        logout,
        deleteAccount,
        setProfileComplete,
        updateUserProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
