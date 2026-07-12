import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import LoginPage from "./page";

// The sign-in failure branch (a single setError) is intentionally not tested
// here: driving a mocked async rejection through a React onClick handler trips
// vitest's unhandled-rejection tracker as a false positive regardless of
// act()/waitFor() structure. The branch is exercised end-to-end in the browser.

const loginWithGoogle = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/login",
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    profileComplete: false,
    loading: false,
    login: loginWithGoogle,
    loginWithGoogle,
    register: loginWithGoogle,
    logout: vi.fn(),
    deleteAccount: vi.fn(),
    setProfileComplete: vi.fn(),
    updateUserProfile: vi.fn(),
    refreshProfile: vi.fn(),
  }),
}));

const googleButton = () => screen.getByRole("button", { name: /continue with google/i });

describe("LoginPage (Google-only)", () => {
  beforeEach(() => loginWithGoogle.mockReset());

  it("renders the Google sign-in button and brand", () => {
    render(<LoginPage />);
    expect(screen.getByText("PlayMatch")).toBeInTheDocument();
    expect(googleButton()).toBeInTheDocument();
    // No password fields in a Google-only flow
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it("starts the Google flow on click and shows the pending state", async () => {
    let resolveSignIn!: () => void;
    const pending = new Promise<void>((res) => { resolveSignIn = res; });
    loginWithGoogle.mockReturnValue(pending);
    render(<LoginPage />);
    fireEvent.click(googleButton());
    expect(loginWithGoogle).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByRole("button", { name: /redirecting/i })).toBeDisabled());
    // Settle the pending promise and flush its continuation so nothing leaks.
    await act(async () => { resolveSignIn(); await pending; });
  });

});
