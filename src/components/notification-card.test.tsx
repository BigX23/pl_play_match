import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotificationCard from "./notification-card";
import type { Notification, NotificationType } from "@/lib/mock-data";

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "n1",
    userId: "me",
    type: "new_message",
    title: "New message",
    body: "You have a new message",
    read: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("NotificationCard", () => {
  it("renders title, body and time", () => {
    render(<NotificationCard notification={makeNotification()} />);
    expect(screen.getByText("New message")).toBeInTheDocument();
    expect(screen.getByText("You have a new message")).toBeInTheDocument();
  });

  it("shows an unread dot when not read", () => {
    const { container } = render(<NotificationCard notification={makeNotification({ read: false })} />);
    expect(container.querySelector(".bg-primary.rounded-full")).toBeTruthy();
  });

  it("hides the unread dot when read", () => {
    const { container } = render(<NotificationCard notification={makeNotification({ read: true })} />);
    expect(container.querySelector(".bg-primary.rounded-full")).toBeFalsy();
  });

  const types: NotificationType[] = [
    "new_message",
    "match_invitation",
    "match_request",
    "match_confirmed",
    "match_accepted",
    "match_declined",
    "match_reminder",
    "ai_suggestion",
  ];
  it.each(types)("renders an icon for type %s", (type) => {
    const { container } = render(<NotificationCard notification={makeNotification({ type })} />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("falls back to a default icon/color for an unknown type", () => {
    const { container } = render(
      // @ts-expect-error intentionally passing an unknown type
      <NotificationCard notification={makeNotification({ type: "unknown" })} />
    );
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("calls onMarkRead on click (non-link variant)", async () => {
    const onMarkRead = vi.fn();
    const user = userEvent.setup();
    render(<NotificationCard notification={makeNotification()} onMarkRead={onMarkRead} />);
    await user.click(screen.getByRole("button"));
    expect(onMarkRead).toHaveBeenCalledWith("n1");
  });

  it("calls onMarkRead on Enter key (non-link variant)", async () => {
    const onMarkRead = vi.fn();
    const user = userEvent.setup();
    render(<NotificationCard notification={makeNotification()} onMarkRead={onMarkRead} />);
    screen.getByRole("button").focus();
    await user.keyboard("{Enter}");
    expect(onMarkRead).toHaveBeenCalledWith("n1");
  });

  it("calls onMarkRead on Space key (non-link variant)", async () => {
    const onMarkRead = vi.fn();
    const user = userEvent.setup();
    render(<NotificationCard notification={makeNotification()} onMarkRead={onMarkRead} />);
    screen.getByRole("button").focus();
    await user.keyboard(" ");
    expect(onMarkRead).toHaveBeenCalledWith("n1");
  });

  it("does not trigger keyboard handling on other keys", async () => {
    const onMarkRead = vi.fn();
    const user = userEvent.setup();
    render(<NotificationCard notification={makeNotification()} onMarkRead={onMarkRead} />);
    screen.getByRole("button").focus();
    await user.keyboard("a");
    expect(onMarkRead).not.toHaveBeenCalled();
  });

  it("does not crash on click when onMarkRead is undefined", async () => {
    const user = userEvent.setup();
    render(<NotificationCard notification={makeNotification()} />);
    await user.click(screen.getByRole("button"));
    expect(screen.getByText("New message")).toBeInTheDocument();
  });

  it("wraps content in a Link (no button role) when link is set", async () => {
    const onMarkRead = vi.fn();
    const user = userEvent.setup();
    render(<NotificationCard notification={makeNotification({ link: "/dashboard/messages" })} onMarkRead={onMarkRead} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/dashboard/messages");
    // Clicking still marks read
    await user.click(screen.getByText("New message"));
    expect(onMarkRead).toHaveBeenCalledWith("n1");
  });

  it("does not mark read on keydown for the link variant", async () => {
    const onMarkRead = vi.fn();
    const user = userEvent.setup();
    render(<NotificationCard notification={makeNotification({ link: "/x" })} onMarkRead={onMarkRead} />);
    screen.getByText("New message").focus();
    await user.keyboard("{Enter}");
    expect(onMarkRead).not.toHaveBeenCalled();
  });

  it("formats time as hours and days ago", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString();
    const { unmount } = render(<NotificationCard notification={makeNotification({ createdAt: twoHoursAgo })} />);
    expect(screen.getByText("2h ago")).toBeInTheDocument();
    unmount();
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600_000).toISOString();
    render(<NotificationCard notification={makeNotification({ createdAt: threeDaysAgo })} />);
    expect(screen.getByText("3d ago")).toBeInTheDocument();
  });
});
