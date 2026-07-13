import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Notification } from "@/lib/mock-data";
import { makePlayer, makeAuth } from "../../test-fixtures";

let authValue: ReturnType<typeof makeAuth>;
vi.mock("@/lib/auth-context", () => ({ useAuth: () => authValue }));

const getNotifications = vi.fn();
const markNotificationRead = vi.fn();
vi.mock("@/lib/data", () => ({
  getNotifications: (...a: unknown[]) => getNotifications(...a),
  markNotificationRead: (...a: unknown[]) => markNotificationRead(...a),
}));

import NotificationsPage from "./page";

const self = makePlayer({ id: "u_self" });
const notif = (over: Partial<Notification>): Notification => ({
  id: "n", userId: "u_self", type: "new_message", title: "T", body: "B",
  read: false, createdAt: new Date().toISOString(), ...over,
});

beforeEach(() => {
  getNotifications.mockReset().mockResolvedValue([]);
  markNotificationRead.mockReset().mockResolvedValue(undefined);
  authValue = makeAuth(self);
});

describe("NotificationsPage", () => {
  it("shows the empty state when there are no notifications", async () => {
    render(<NotificationsPage />);
    expect(await screen.findByText("No notifications")).toBeInTheDocument();
  });

  it("renders notifications and marks all as read", async () => {
    getNotifications.mockResolvedValue([
      notif({ id: "n1", type: "match_request", title: "Request", body: "Someone" }),
      notif({ id: "n2", type: "new_message", title: "Message", body: "Hi" }),
    ]);
    render(<NotificationsPage />);
    expect(await screen.findByText("Request")).toBeInTheDocument();
    expect(screen.getByText("Message")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Mark all read/i }));
    // Each unread notification is marked read via the API.
    await waitFor(() => {
      expect(markNotificationRead).toHaveBeenCalledWith("n1");
      expect(markNotificationRead).toHaveBeenCalledWith("n2");
    });
    // The "Mark all read" button disappears once nothing is unread.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Mark all read/i })).not.toBeInTheDocument()
    );
  });
});
