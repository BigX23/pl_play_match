import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makePlayer } from "@/app/test-fixtures";

const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/lib/safety", () => ({ getBlockedUsers: vi.fn(), unblockUser: vi.fn() }));

import { getBlockedUsers, unblockUser } from "@/lib/safety";
import BlockedUsersCard from "./blocked-users-card";

const bob = { ...makePlayer({ id: "u_bob", name: "Bob J.", avatar: "" }), blockedAt: "2026-10-01T00:00:00Z" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(unblockUser).mockResolvedValue(undefined);
});

describe("BlockedUsersCard", () => {
  it("shows an empty state", async () => {
    vi.mocked(getBlockedUsers).mockResolvedValue([]);
    render(<BlockedUsersCard />);
    expect(screen.getByText("Blocked users")).toBeInTheDocument();
    expect(await screen.findByText(/haven.t blocked anyone/i)).toBeInTheDocument();
  });

  it("lists blocked players and unblocks one", async () => {
    vi.mocked(getBlockedUsers).mockResolvedValue([bob]);
    const user = userEvent.setup();
    render(<BlockedUsersCard />);
    expect(await screen.findByText("Bob J.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Unblock" }));
    await waitFor(() => expect(unblockUser).toHaveBeenCalledWith("u_bob"));
    expect(await screen.findByText(/haven.t blocked anyone/i)).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Bob J. unblocked" }));
  });

  it("keeps the row and toasts when unblock fails", async () => {
    vi.mocked(getBlockedUsers).mockResolvedValue([bob]);
    vi.mocked(unblockUser).mockRejectedValueOnce(new Error("500"));
    const user = userEvent.setup();
    render(<BlockedUsersCard />);
    await user.click(await screen.findByRole("button", { name: "Unblock" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }))
    );
    expect(screen.getByText("Bob J.")).toBeInTheDocument();
  });

  it("shows an error when the list can't load", async () => {
    vi.mocked(getBlockedUsers).mockRejectedValue(new Error("500"));
    render(<BlockedUsersCard />);
    expect(await screen.findByText(/Couldn.t load your blocked list/i)).toBeInTheDocument();
  });
});
