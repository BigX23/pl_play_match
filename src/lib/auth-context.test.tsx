import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";

const signIn = vi.fn();
const signOut = vi.fn();
vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => signIn(...args),
  signOut: (...args: unknown[]) => signOut(...args),
}));

import { AuthProvider, useAuth } from "./auth-context";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

const me = {
  id: "u1",
  name: "Maya Okonkwo",
  email: "maya@example.com",
  profileComplete: true,
  ntrpRating: 4,
  matchesPlayed: 0,
  wins: 0,
  losses: 0,
};

function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  const fn = vi.fn(impl);
  vi.stubGlobal("fetch", fn);
  return fn;
}

const ok = (body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
const status = (code: number) =>
  Promise.resolve(new Response(JSON.stringify({ error: "x" }), { status: code }));

describe("auth-context (Auth.js shim)", () => {
  beforeEach(() => {
    signIn.mockReset();
    signOut.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the profile from /api/me on mount", async () => {
    const fetchMock = mockFetch(() => ok(me));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).toHaveBeenCalledWith("/api/me", expect.objectContaining({ cache: "no-store" }));
    expect(result.current.user?.id).toBe("u1");
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.profileComplete).toBe(true);
  });

  it("treats a 401 as signed out", async () => {
    mockFetch(() => status(401));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("treats a network failure as signed out (no hang)", async () => {
    mockFetch(() => Promise.reject(new Error("offline")));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it("login / register / loginWithGoogle all start the Google flow", async () => {
    mockFetch(() => status(401));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.login());
    await act(() => result.current.register());
    await act(() => result.current.loginWithGoogle());
    expect(signIn).toHaveBeenCalledTimes(3);
    expect(signIn).toHaveBeenCalledWith("google", { callbackUrl: "/dashboard" });
  });

  it("logout clears the user and calls signOut", async () => {
    mockFetch(() => ok(me));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).not.toBeNull());
    act(() => result.current.logout());
    expect(result.current.user).toBeNull();
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/" });
  });

  it("updateUserProfile optimistically updates and PATCHes /api/me", async () => {
    const fetchMock = mockFetch((url, init) =>
      init?.method === "PATCH" ? ok({ ...me, firstName: "Updated" }) : ok(me)
    );
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).not.toBeNull());
    act(() => result.current.updateUserProfile({ firstName: "Updated" }));
    expect(result.current.user?.firstName).toBe("Updated");
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/me",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ firstName: "Updated" }) })
      );
    });
  });

  it("re-syncs from the server when a PATCH fails", async () => {
    let patchCalls = 0;
    const fetchMock = mockFetch((url, init) => {
      if (init?.method === "PATCH") { patchCalls++; return status(500); }
      return ok(me);
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).not.toBeNull());
    act(() => result.current.setProfileComplete(true));
    await waitFor(() => expect(patchCalls).toBe(1));
    // A refresh GET follows the failed PATCH (initial GET + retry GET)
    await waitFor(() => {
      const gets = fetchMock.mock.calls.filter(([, init]) => !init || !("method" in (init as object)) || (init as RequestInit).method === undefined);
      expect(gets.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("deleteAccount DELETEs /api/me and signs out", async () => {
    const fetchMock = mockFetch((url, init) =>
      init?.method === "DELETE" ? ok({ ok: true }) : ok(me)
    );
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).not.toBeNull());
    await act(() => result.current.deleteAccount());
    expect(fetchMock).toHaveBeenCalledWith("/api/me", expect.objectContaining({ method: "DELETE" }));
    expect(signOut).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
  });

  it("deleteAccount throws when the server refuses", async () => {
    mockFetch((url, init) => (init?.method === "DELETE" ? status(500) : ok(me)));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).not.toBeNull());
    await expect(act(() => result.current.deleteAccount())).rejects.toThrow();
  });

  it("useAuth outside the provider throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(/within AuthProvider/);
    spy.mockRestore();
  });
});
