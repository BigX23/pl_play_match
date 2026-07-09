import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

const login = vi.fn();
const loginWithGoogle = vi.fn();
const resetPassword = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ login, loginWithGoogle, resetPassword }),
}));

import LoginPage from "./page";

beforeEach(() => {
  push.mockReset();
  login.mockReset().mockResolvedValue(true);
  loginWithGoogle.mockReset().mockResolvedValue(true);
  resetPassword.mockReset().mockResolvedValue(true);
});

describe("LoginPage", () => {
  it("shows an error when submitting empty fields", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole("button", { name: "Sign In" }));
    expect(await screen.findByText("Please fill in all fields.")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("fills the form, submits, calls login and navigates to dashboard", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign In" }));
    await waitFor(() => expect(login).toHaveBeenCalledWith("a@b.com", "secret123"));
    expect(push).toHaveBeenCalledWith("/dashboard");
  });

  it("surfaces an error message when login throws", async () => {
    login.mockRejectedValue({ code: "auth/wrong-password" });
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign In" }));
    expect(await screen.findByText("Incorrect email or password.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("logs in with Google and navigates", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole("button", { name: /Login with Google/i }));
    await waitFor(() => expect(loginWithGoogle).toHaveBeenCalled());
    expect(push).toHaveBeenCalledWith("/dashboard");
  });

  it("surfaces an error when Google sign-in throws", async () => {
    loginWithGoogle.mockRejectedValue({ code: "auth/popup-closed-by-user" });
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole("button", { name: /Login with Google/i }));
    expect(await screen.findByText("Sign-in was cancelled.")).toBeInTheDocument();
  });

  it("switches to reset-password mode and sends a reset link", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole("button", { name: /Forgot password/i }));
    expect(screen.getByText("Reset Password")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.click(screen.getByRole("button", { name: "Send Reset Link" }));
    await waitFor(() => expect(resetPassword).toHaveBeenCalledWith("a@b.com"));
    expect(await screen.findByText(/Check your email for a reset link/i)).toBeInTheDocument();
  });

  it("validates empty email in reset mode", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole("button", { name: /Forgot password/i }));
    await user.click(screen.getByRole("button", { name: "Send Reset Link" }));
    expect(await screen.findByText("Enter your email address.")).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("surfaces an error when reset throws", async () => {
    resetPassword.mockRejectedValue({ code: "auth/invalid-email" });
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole("button", { name: /Forgot password/i }));
    // "a@b" satisfies HTML5 email validation so the form submits; resetPassword
    // then rejects with the invalid-email code.
    await user.type(screen.getByLabelText("Email"), "a@b");
    await user.click(screen.getByRole("button", { name: "Send Reset Link" }));
    expect(await screen.findByText("That email address looks invalid.")).toBeInTheDocument();
  });

  it("returns to sign in from reset mode", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole("button", { name: /Forgot password/i }));
    await user.click(screen.getByRole("button", { name: "Back to Sign In" }));
    expect(screen.getByText("Welcome back")).toBeInTheDocument();
  });
});
