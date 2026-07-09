import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { notifications } from "@/lib/mock-data";
import { makePlayer, makeAuth } from "../../test-fixtures";

let authValue: ReturnType<typeof makeAuth>;
vi.mock("@/lib/auth-context", () => ({ useAuth: () => authValue }));

import NotificationsPage from "./page";

const self = makePlayer({ id: "u_self" });

beforeEach(() => {
  notifications.length = 0;
  authValue = makeAuth(self);
});

describe("NotificationsPage", () => {
  it("shows the empty state when there are no notifications", async () => {
    render(<NotificationsPage />);
    expect(await screen.findByText("No notifications")).toBeInTheDocument();
  });

  it("renders notifications and marks all as read", async () => {
    notifications.push(
      { id: "n1", userId: "u_self", type: "match_request", title: "Request", body: "Someone", read: false, createdAt: new Date().toISOString() },
      { id: "n2", userId: "u_self", type: "new_message", title: "Message", body: "Hi", read: false, createdAt: new Date().toISOString() },
    );
    render(<NotificationsPage />);
    expect(await screen.findByText("Request")).toBeInTheDocument();
    expect(screen.getByText("Message")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Mark all read/i }));
    // Both notifications flip to read in the mock store.
    await waitFor(() => {
      expect(notifications.every((n) => n.read)).toBe(true);
    });
    // The "Mark all read" button disappears once nothing is unread.
    await waitFor(() => expect(screen.queryByRole("button", { name: /Mark all read/i })).not.toBeInTheDocument());
  });
});
