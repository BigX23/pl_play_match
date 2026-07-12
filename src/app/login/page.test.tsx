import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "./page";

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

describe("LoginPage (Google-only)", () => {
  beforeEach(() => loginWithGoogle.mockReset());

  it("renders the Google sign-in button and brand", () => {
    render(<LoginPage />);
    expect(screen.getByText("PlayMatch")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
    // No password fields in a Google-only flow
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it("starts the Google flow on click and shows pending state", async () => {
    let resolveSignIn: () => void;
    loginWithGoogle.mockImplementation(
      () => new Promise<void>((res) => { resolveSignIn = res; })
    );
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole("button", { name: /continue with google/i }));
    expect(loginWithGoogle).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: /redirecting/i })).toBeDisabled();
    resolveSignIn!();
  });

  it("surfaces an error and re-enables the button when sign-in fails", async () => {
    loginWithGoogle.mockRejectedValue(new Error("popup blocked"));
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole("button", { name: /continue with google/i }));
    expect(await screen.findByText(/sign-in failed/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeEnabled();
  });
});
