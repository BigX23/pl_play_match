"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { currentUser, type Player } from "./mock-data";
import { isFirebaseConfigured, auth as firebaseAuth } from "./firebase";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";

interface AuthContextType {
  user: Player | null;
  firebaseUser: FirebaseUser | null;
  isAuthenticated: boolean;
  profileComplete: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  register: (data: Partial<Player> & { password?: string }) => Promise<boolean>;
  logout: () => void;
  resetPassword: (email: string) => Promise<boolean>;
  setProfileComplete: (complete: boolean) => void;
  updateUserProfile: (data: Partial<Player>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Player | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper to build a minimal new-user placeholder
  const buildMinimalUser = (fbUser: FirebaseUser): Player => ({
    id: fbUser.uid,
    name: fbUser.displayName || "",
    email: fbUser.email || "",
    avatar: fbUser.photoURL || "",
    profileComplete: false,
    sport: "both",
    skillLevel: "intermediate",
    age: 0,
    gender: "prefer-not-to-say",
    location: "",
    weeklyAvailability: [],
    partnerPreferences: { ageRange: [18, 60], genderPreference: "any", skillRange: ["beginner", "advanced"] },
    bio: "",
    rating: 0,
    wins: 0,
    losses: 0,
  } as unknown as Player);

  // Helper to eagerly load profile from Firestore and set state
  const loadAndSetProfile = useCallback(async (fbUser: FirebaseUser) => {
    const { getUser } = await import("./firestore");
    const firestoreProfile = await getUser(fbUser.uid);
    if (firestoreProfile) {
      setUser(firestoreProfile);
    } else {
      setUser(buildMinimalUser(fbUser));
    }
  }, []);

  useEffect(() => {
    if (isFirebaseConfigured && firebaseAuth) {
      const unsub = onAuthStateChanged(firebaseAuth, async (fbUser) => {
        setFirebaseUser(fbUser);
        if (fbUser) {
          // Keep loading=true while we fetch the Firestore profile
          setLoading(true);
          await loadAndSetProfile(fbUser);
        } else {
          setUser(null);
        }
        setLoading(false);
      });
      return unsub;
    }
    // Mock mode: restore from localStorage
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem("playmatch_user") : null;
      if (saved) setUser(JSON.parse(saved));
    } catch {}
    setLoading(false);
  }, [loadAndSetProfile]);

  const profileComplete = user?.profileComplete ?? false;

  const setProfileComplete = useCallback((complete: boolean) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, profileComplete: complete };
      if (typeof window !== "undefined") localStorage.setItem("playmatch_user", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const updateUserProfile = useCallback((data: Partial<Player>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...data };
      if (typeof window !== "undefined") localStorage.setItem("playmatch_user", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const persistMock = (u: Player | null) => {
    if (typeof window !== "undefined") {
      if (u) localStorage.setItem("playmatch_user", JSON.stringify(u));
      else localStorage.removeItem("playmatch_user");
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    if (isFirebaseConfigured) {
      try {
        const { signInWithEmail } = await import("./auth");
        const fbUser = await signInWithEmail(email, password);
        // Eagerly load profile so state is ready before navigation
        setFirebaseUser(fbUser);
        setLoading(true);
        await loadAndSetProfile(fbUser);
        setLoading(false);
        return true;
      } catch { return false; }
    }
    // Mock
    const u = { ...currentUser, email };
    setUser(u);
    persistMock(u);
    return true;
  }, [loadAndSetProfile]);

  const loginWithGoogle = useCallback(async () => {
    if (isFirebaseConfigured) {
      try {
        const { signInWithGoogle } = await import("./auth");
        const fbUser = await signInWithGoogle();
        // Eagerly load profile so state is ready before navigation
        setFirebaseUser(fbUser);
        setLoading(true);
        await loadAndSetProfile(fbUser);
        setLoading(false);
        return true;
      } catch { return false; }
    }
    setUser(currentUser);
    persistMock(currentUser);
    return true;
  }, [loadAndSetProfile]);

  const register = useCallback(async (data: Partial<Player> & { password?: string }) => {
    if (isFirebaseConfigured && data.email && data.password) {
      try {
        const { registerWithEmail } = await import("./auth");
        const fbUser = await registerWithEmail(data.email, data.password);
        // Eagerly set state so navigation works immediately
        setFirebaseUser(fbUser);
        setLoading(true);
        await loadAndSetProfile(fbUser);
        setLoading(false);
        return true;
      } catch { return false; }
    }
    const u = { ...currentUser, ...data } as Player;
    setUser(u);
    persistMock(u);
    return true;
  }, [loadAndSetProfile]);

  const logout = useCallback(() => {
    if (isFirebaseConfigured) {
      import("./auth").then((m) => m.signOut());
    }
    setUser(null);
    setFirebaseUser(null);
    persistMock(null);
  }, []);

  const resetPasswordFn = useCallback(async (email: string) => {
    if (isFirebaseConfigured) {
      try {
        const { resetPassword } = await import("./auth");
        await resetPassword(email);
        return true;
      } catch { return false; }
    }
    return true; // mock always succeeds
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        isAuthenticated: !!user,
        profileComplete,
        loading,
        login,
        loginWithGoogle,
        register,
        logout,
        resetPassword: resetPasswordFn,
        setProfileComplete,
        updateUserProfile,
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
