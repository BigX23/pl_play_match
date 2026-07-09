import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// ---- Firebase configured = false (mock mode) ----
vi.mock("./firebase", () => ({ isFirebaseConfigured: false, auth: null }));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn(),
}));

import { AuthProvider, useAuth } from "./auth-context";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

beforeEach(() => {
  localStorage.clear();
});

describe("auth-context mock mode", () => {
  it("restores user from localStorage on mount", async () => {
    localStorage.setItem("playmatch_user", JSON.stringify({ id: "saved", name: "Saved", profileComplete: true }));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user?.id).toBe("saved");
  });

  it("ignores malformed localStorage", async () => {
    localStorage.setItem("playmatch_user", "{not json");
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it("login creates a mock user from the email", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    let ok = false;
    await act(async () => {
      ok = await result.current.login("jane@example.com", "pw");
    });
    expect(ok).toBe(true);
    expect(result.current.user?.name).toBe("jane");
    expect(JSON.parse(localStorage.getItem("playmatch_user")!).id).toBe("mock");
  });

  it("loginWithGoogle creates a mock google user", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.loginWithGoogle();
    });
    expect(result.current.user?.email).toBe("mock@playmatch.app");
  });

  it("register builds name from first/last name", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.register({ firstName: "John", lastName: "Doe" } as never);
    });
    expect(result.current.user?.name).toBe("John Doe");
  });

  it("logout clears the user and localStorage", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.login("a@b.c", "pw");
    });
    expect(result.current.user).not.toBeNull();
    await act(async () => {
      result.current.logout();
    });
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem("playmatch_user")).toBeNull();
  });

  it("resetPassword always succeeds in mock mode", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    let ok = false;
    await act(async () => {
      ok = await result.current.resetPassword("a@b.c");
    });
    expect(ok).toBe(true);
  });

  it("deleteAccount clears state in mock mode", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.login("a@b.c", "pw");
    });
    await act(async () => {
      await result.current.deleteAccount();
    });
    expect(result.current.user).toBeNull();
  });

  it("setProfileComplete and updateUserProfile no-op when no user", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      result.current.setProfileComplete(true);
      result.current.updateUserProfile({ name: "X" } as never);
    });
    expect(result.current.user).toBeNull();
  });

  it("setProfileComplete and updateUserProfile mutate an existing user", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.login("a@b.c", "pw");
    });
    await act(async () => {
      result.current.setProfileComplete(true);
    });
    expect(result.current.profileComplete).toBe(true);
    await act(async () => {
      result.current.updateUserProfile({ name: "Renamed" } as never);
    });
    expect(result.current.user?.name).toBe("Renamed");
  });
});
