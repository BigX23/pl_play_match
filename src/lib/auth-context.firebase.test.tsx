import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// ---- Firebase configured = true ----
// vi.mock factories are hoisted, so state they touch must be created via
// vi.hoisted (evaluated before the factories run).
const h = vi.hoisted(() => ({
  fakeAuth: {},
  authStateCb: undefined as ((u: unknown) => void) | undefined,
  onAuthUnsub: vi.fn(),
  signInWithEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
  registerWithEmail: vi.fn(),
  doSignOut: vi.fn(),
  resetPassword: vi.fn(),
  deleteAccount: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("./firebase", () => ({ isFirebaseConfigured: true, auth: h.fakeAuth }));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    h.authStateCb = cb;
    return h.onAuthUnsub;
  },
}));
vi.mock("./auth", () => ({
  signInWithEmail: (...a: unknown[]) => h.signInWithEmail(...a),
  signInWithGoogle: (...a: unknown[]) => h.signInWithGoogle(...a),
  registerWithEmail: (...a: unknown[]) => h.registerWithEmail(...a),
  signOut: (...a: unknown[]) => h.doSignOut(...a),
  resetPassword: (...a: unknown[]) => h.resetPassword(...a),
  deleteAccount: (...a: unknown[]) => h.deleteAccount(...a),
}));
vi.mock("./firestore", () => ({
  getUser: (...a: unknown[]) => h.getUser(...a),
}));

const { signInWithEmail, signInWithGoogle, registerWithEmail, doSignOut, resetPassword, deleteAccount, getUser } = h;

import { AuthProvider, useAuth } from "./auth-context";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

beforeEach(() => {
  vi.clearAllMocks();
  h.authStateCb = undefined;
  getUser.mockResolvedValue({ id: "u1", name: "Ann", profileComplete: true });
});

function fbUser(extra: Record<string, unknown> = {}) {
  return { uid: "u1", email: "a@b.c", displayName: "Ann", photoURL: "", ...extra };
}

describe("auth-context Firebase mode", () => {
  it("onAuthStateChanged loads profile when user present", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      h.authStateCb!(fbUser());
    });
    await waitFor(() => expect(result.current.user?.id).toBe("u1"));
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.profileComplete).toBe(true);
  });

  it("onAuthStateChanged falls back to minimal profile when getUser returns null", async () => {
    getUser.mockResolvedValue(null);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      h.authStateCb!(fbUser());
    });
    await waitFor(() => expect(result.current.user?.id).toBe("u1"));
    expect(result.current.profileComplete).toBe(false);
  });

  it("onAuthStateChanged uses minimal profile when getUser throws", async () => {
    getUser.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      h.authStateCb!(fbUser());
    });
    await waitFor(() => expect(result.current.user?.id).toBe("u1"));
  });

  it("onAuthStateChanged clears user when signed out", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      h.authStateCb!(null);
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it("login signs in with email and loads profile", async () => {
    signInWithEmail.mockResolvedValue(fbUser());
    const { result } = renderHook(() => useAuth(), { wrapper });
    let ok = false;
    await act(async () => {
      ok = await result.current.login("a@b.c", "pw");
    });
    expect(ok).toBe(true);
    expect(signInWithEmail).toHaveBeenCalledWith("a@b.c", "pw");
    await waitFor(() => expect(result.current.user?.id).toBe("u1"));
  });

  it("loginWithGoogle signs in and loads profile", async () => {
    signInWithGoogle.mockResolvedValue(fbUser());
    const { result } = renderHook(() => useAuth(), { wrapper });
    let ok = false;
    await act(async () => {
      ok = await result.current.loginWithGoogle();
    });
    expect(ok).toBe(true);
    expect(signInWithGoogle).toHaveBeenCalled();
  });

  it("register registers with email/password", async () => {
    registerWithEmail.mockResolvedValue(fbUser());
    const { result } = renderHook(() => useAuth(), { wrapper });
    let ok = false;
    await act(async () => {
      ok = await result.current.register({ email: "a@b.c", password: "pw" });
    });
    expect(ok).toBe(true);
    expect(registerWithEmail).toHaveBeenCalledWith("a@b.c", "pw");
  });

  it("logout calls signOut and clears state", async () => {
    doSignOut.mockResolvedValue(undefined);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      h.authStateCb!(fbUser());
    });
    await waitFor(() => expect(result.current.user?.id).toBe("u1"));
    await act(async () => {
      result.current.logout();
    });
    await waitFor(() => expect(result.current.user).toBeNull());
    expect(doSignOut).toHaveBeenCalled();
  });

  it("resetPassword delegates to auth.resetPassword", async () => {
    resetPassword.mockResolvedValue(undefined);
    const { result } = renderHook(() => useAuth(), { wrapper });
    let ok = false;
    await act(async () => {
      ok = await result.current.resetPassword("a@b.c");
    });
    expect(ok).toBe(true);
    expect(resetPassword).toHaveBeenCalledWith("a@b.c");
  });

  it("deleteAccount delegates to auth.deleteAccount and clears state", async () => {
    deleteAccount.mockResolvedValue(undefined);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      h.authStateCb!(fbUser());
    });
    await waitFor(() => expect(result.current.user?.id).toBe("u1"));
    await act(async () => {
      await result.current.deleteAccount();
    });
    expect(deleteAccount).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
  });

  it("setProfileComplete and updateUserProfile mutate state", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      h.authStateCb!(fbUser());
    });
    await waitFor(() => expect(result.current.user?.id).toBe("u1"));
    await act(async () => {
      result.current.setProfileComplete(false);
    });
    expect(result.current.profileComplete).toBe(false);
    await act(async () => {
      result.current.updateUserProfile({ name: "Renamed" } as never);
    });
    expect(result.current.user?.name).toBe("Renamed");
  });

  it("useAuth throws outside a provider", () => {
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/);
  });
});
