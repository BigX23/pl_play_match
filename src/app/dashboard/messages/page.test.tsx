import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { players, conversations, messages, notifications, matchRequests } from "@/lib/mock-data";
import { __resetMockState, addContact } from "@/lib/firestore";
import { makePlayer, makeAuth } from "../../test-fixtures";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

let authValue: ReturnType<typeof makeAuth>;
vi.mock("@/lib/auth-context", () => ({ useAuth: () => authValue }));

import MessagesPage from "./page";

const self = makePlayer({ id: "u_self", firstName: "Self" });

function resetData() {
  players.length = 0;
  conversations.length = 0;
  messages.length = 0;
  notifications.length = 0;
  matchRequests.length = 0;
  __resetMockState();
}

beforeEach(() => {
  push.mockReset();
  resetData();
  players.push(self);
  authValue = makeAuth(self);
});

describe("MessagesPage", () => {
  it("shows the empty chats state when there are no conversations", async () => {
    render(<MessagesPage />);
    expect(await screen.findByText("No conversations yet")).toBeInTheDocument();
  });

  it("renders conversations from the live subscription", async () => {
    conversations.push({
      id: "direct_u_other_u_self", participants: ["u_self", "u_other"], type: "direct",
      lastMessage: "hey", lastMessageAt: new Date().toISOString(), unread: { u_self: 0 }, createdAt: new Date().toISOString(),
    });
    players.push(makePlayer({ id: "u_other", name: "Other Person", firstName: "Other" }));
    render(<MessagesPage />);
    expect(await screen.findByText("hey")).toBeInTheDocument();
  });

  it("filter pills are keyboard-operable buttons that filter by type", async () => {
    conversations.push(
      { id: "direct_a_u_self", participants: ["u_self", "a"], type: "direct", lastMessage: "direct msg", lastMessageAt: new Date().toISOString(), unread: {}, createdAt: new Date().toISOString() },
      { id: "conv_group", participants: ["u_self", "b", "rally"], type: "group", name: "Group Chat", lastMessage: "group msg", lastMessageAt: new Date().toISOString(), unread: {}, createdAt: new Date().toISOString() },
    );
    players.push(makePlayer({ id: "a", name: "Alpha" }), makePlayer({ id: "b", name: "Bravo" }));
    render(<MessagesPage />);
    await screen.findByText("direct msg");

    const user = userEvent.setup();
    const directPill = screen.getByRole("button", { name: "Direct" });
    // Keyboard-operate the pill.
    directPill.focus();
    await user.keyboard("{Enter}");
    expect(directPill).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(screen.queryByText("group msg")).not.toBeInTheDocument());
    expect(screen.getByText("direct msg")).toBeInTheDocument();

    // Switch to Groups.
    await user.click(screen.getByRole("button", { name: "Groups" }));
    await waitFor(() => expect(screen.queryByText("direct msg")).not.toBeInTheDocument());
    expect(screen.getByText("group msg")).toBeInTheDocument();
  });

  it("shows contacts tab and starts a chat from a contact", async () => {
    const contact = makePlayer({ id: "u_c", name: "Contact One", firstName: "Contact", email: "c@x.com" });
    players.push(contact);
    await addContact("u_self", { id: "u_c", name: "Contact One", email: "c@x.com", avatar: "🎾", addedAt: new Date().toISOString() });
    render(<MessagesPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /Contacts/i }));
    expect(await screen.findByText("Contact One")).toBeInTheDocument();
    // First ghost button in the contact row starts the chat.
    const startBtns = screen.getAllByRole("button").filter((b) => b.querySelector("svg"));
    // Click the message-circle button (start chat) — it's the first icon button in the row.
    const row = screen.getByText("Contact One").closest("div")!.parentElement!;
    const iconButtons = row.querySelectorAll("button");
    await user.click(iconButtons[0]);
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(push.mock.calls[0][0]).toMatch(/\/dashboard\/messages\//);
    expect(startBtns.length).toBeGreaterThan(0);
  });

  it("adds a contact by email", async () => {
    players.push(makePlayer({ id: "u_new", name: "New Contact", firstName: "New", lastName: "Contact", email: "new@x.com" }));
    render(<MessagesPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /Contacts/i }));
    await user.click(screen.getByRole("button", { name: /Add Contact/i }));
    const input = await screen.findByPlaceholderText(/Enter email address/i);
    // Pressing Enter in the input submits via the onKeyDown handler.
    await user.type(input, "new@x.com{Enter}");
    expect(await screen.findByText("New Contact")).toBeInTheDocument();
  });

  it("shows an error when adding an unknown email", async () => {
    render(<MessagesPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /Contacts/i }));
    await user.click(screen.getByRole("button", { name: /Add Contact/i }));
    const input = await screen.findByPlaceholderText(/Enter email address/i);
    await user.type(input, "ghost@nowhere.com{Enter}");
    expect(await screen.findByText("No user found with that email")).toBeInTheDocument();
  });

  it("removes a contact", async () => {
    players.push(makePlayer({ id: "u_rm", name: "Remove Me", firstName: "Remove", email: "rm@x.com" }));
    await addContact("u_self", { id: "u_rm", name: "Remove Me", email: "rm@x.com", avatar: "🎾", addedAt: new Date().toISOString() });
    render(<MessagesPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /Contacts/i }));
    expect(await screen.findByText("Remove Me")).toBeInTheDocument();
    const row = screen.getByText("Remove Me").closest("div")!.parentElement!;
    const iconButtons = row.querySelectorAll("button");
    // Second icon button is the trash/remove.
    await user.click(iconButtons[iconButtons.length - 1]);
    await waitFor(() => expect(screen.queryByText("Remove Me")).not.toBeInTheDocument());
  });
});
