import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

const register = vi.fn();
const loginWithGoogle = vi.fn();
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ register, loginWithGoogle }),
}));

import RegisterPage from "./page";

async function fill(user: ReturnType<typeof userEvent.setup>, fields: Partial<Record<"name" | "email" | "password" | "confirm", string>>) {
  if (fields.name) await user.type(screen.getByLabelText(/Full Name/i), fields.name);
  if (fields.email) await user.type(screen.getByLabelText(/^Email/i), fields.email);
  if (fields.password) await user.type(screen.getByLabelText(/^Password/i), fields.password);
  if (fields.confirm) await user.type(screen.getByLabelText(/Confirm Password/i), fields.confirm);
}

beforeEach(() => {
  push.mockReset();
  register.mockReset().mockResolvedValue(true);
  loginWithGoogle.mockReset().mockResolvedValue(true);
});

describe("RegisterPage", () => {
  it("requires all fields", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);
    await user.click(screen.getByRole("button", { name: "Create Account" }));
    expect(await screen.findByText("Please fill in required fields.")).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("rejects an invalid email", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);
    // "a@b" passes HTML5 email validation (so the form actually submits) but
    // fails the app's stricter regex that requires a dotted domain.
    await fill(user, { name: "Jo", email: "a@b", password: "password1", confirm: "password1" });
    await user.click(screen.getByRole("button", { name: "Create Account" }));
    expect(await screen.findByText("Please enter a valid email.")).toBeInTheDocument();
  });

  it("rejects a short password", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);
    await fill(user, { name: "Jo", email: "a@b.com", password: "short", confirm: "short" });
    await user.click(screen.getByRole("button", { name: "Create Account" }));
    expect(await screen.findByText("Password must be at least 8 characters.")).toBeInTheDocument();
  });

  it("rejects mismatched passwords", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);
    await fill(user, { name: "Jo", email: "a@b.com", password: "password1", confirm: "password2" });
    await user.click(screen.getByRole("button", { name: "Create Account" }));
    expect(await screen.findByText("Passwords do not match.")).toBeInTheDocument();
  });

  it("registers and navigates to /onboarding on success", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);
    await fill(user, { name: "Jo Doe", email: "a@b.com", password: "password1", confirm: "password1" });
    await user.click(screen.getByRole("button", { name: "Create Account" }));
    await waitFor(() => expect(register).toHaveBeenCalledWith({ name: "Jo Doe", email: "a@b.com", password: "password1" }));
    expect(push).toHaveBeenCalledWith("/onboarding");
  });

  it("surfaces an error when register throws", async () => {
    register.mockRejectedValue({ code: "auth/email-already-in-use" });
    const user = userEvent.setup();
    render(<RegisterPage />);
    await fill(user, { name: "Jo Doe", email: "a@b.com", password: "password1", confirm: "password1" });
    await user.click(screen.getByRole("button", { name: "Create Account" }));
    expect(await screen.findByText("An account with that email already exists.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("signs up with Google and navigates to dashboard", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);
    await user.click(screen.getByRole("button", { name: /Login with Google/i }));
    await waitFor(() => expect(loginWithGoogle).toHaveBeenCalled());
    expect(push).toHaveBeenCalledWith("/dashboard");
  });

  it("surfaces an error when Google sign-up throws", async () => {
    loginWithGoogle.mockRejectedValue({ code: "auth/network-request-failed" });
    const user = userEvent.setup();
    render(<RegisterPage />);
    await user.click(screen.getByRole("button", { name: /Login with Google/i }));
    expect(await screen.findByText(/Network error/i)).toBeInTheDocument();
  });
});
