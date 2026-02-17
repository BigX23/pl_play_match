"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { currentUser, type Player } from "./mock-data";

interface AuthContextType {
  user: Player | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (data: Partial<Player>) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Player | null>(null);

  const login = useCallback(async (_email: string, _password: string) => {
    // Mock login — always succeeds
    setUser(currentUser);
    return true;
  }, []);

  const register = useCallback(async (data: Partial<Player>) => {
    setUser({ ...currentUser, ...data } as Player);
    return true;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
