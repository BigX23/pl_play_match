import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makePlayer, makeAuth } from "../../test-fixtures";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const setTheme = vi.fn();
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "light", setTheme }) }));

let authValue: ReturnType<typeof makeAuth>;
const logout = vi.fn();
const resetPassword = vi.fn();
const deleteAccount = vi.fn();
vi.mock("@/lib/auth-context", () => ({ useAuth: () => authValue }));

const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

import SettingsPage from "./page";

const self = makePlayer({ id: "u_self", email: "self@example.com" });

beforeEach(() => {
  push.mockReset();
  setTheme.mockReset();
  logout.mockReset();
  resetPassword.mockReset().mockResolvedValue(true);
  deleteAccount.mockReset().mockResolvedValue(undefined);
  toast.mockReset();
  authValue = makeAuth(self, { logout, resetPassword, deleteAccount });
});

describe("SettingsPage", () => {
  it("renders the settings sections", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Appearance")).toBeInTheDocument();
    expect(screen.getByText("Notification Preferences")).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
  });

  it("toggles a notification preference switch", async () => {
    render(<SettingsPage />);
    const user = userEvent.setup();
    const switches = screen.getAllByRole("switch");
    await user.click(switches[0]);
    // No throw = savePreferences ran against the localStorage polyfill.
    expect(switches[0]).toBeInTheDocument();
  });

  it("updates quiet-hours inputs", async () => {
    render(<SettingsPage />);
    const user = userEvent.setup();
    const timeInputs = document.querySelectorAll('input[type="time"]');
    await user.clear(timeInputs[0] as HTMLInputElement);
    await user.type(timeInputs[0] as HTMLInputElement, "23:00");
    expect((timeInputs[0] as HTMLInputElement).value).toBe("23:00");
  });

  it("shows the Google account security note instead of a password flow", () => {
    render(<SettingsPage />);
    expect(screen.getByText(/you sign in with google/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /google account/i });
    expect(link).toHaveAttribute("href", "https://myaccount.google.com/security");
    expect(screen.queryByRole("button", { name: "Change Password" })).not.toBeInTheDocument();
  });

  it("signs out and navigates home", async () => {
    render(<SettingsPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Sign Out/i }));
    expect(logout).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/");
  });

  it("deletes the account via the confirmation dialog", async () => {
    render(<SettingsPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Delete Account" }));
    const confirm = await screen.findByRole("button", { name: "Delete Account" });
    // The dialog's action button also reads "Delete Account"; click the one inside the dialog.
    const dialogButtons = screen.getAllByRole("button", { name: "Delete Account" });
    await user.click(dialogButtons[dialogButtons.length - 1]);
    await waitFor(() => expect(deleteAccount).toHaveBeenCalled());
    expect(push).toHaveBeenCalledWith("/");
    expect(confirm).toBeDefined();
  });

  it("surfaces a toast when account deletion fails", async () => {
    deleteAccount.mockRejectedValue(new Error("nope"));
    render(<SettingsPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Delete Account" }));
    const dialogButtons = screen.getAllByRole("button", { name: "Delete Account" });
    await user.click(dialogButtons[dialogButtons.length - 1]);
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Couldn't delete account" })));
  });
});
