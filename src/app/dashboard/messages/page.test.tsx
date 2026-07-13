import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Contact, Conversation } from "@/lib/mock-data";
import { makePlayer, makeAuth } from "../../test-fixtures";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

let authValue: ReturnType<typeof makeAuth>;
vi.mock("@/lib/auth-context", () => ({ useAuth: () => authValue }));

// getUser is used by the nested ConversationCard to resolve names.
vi.mock("@/lib/data", () => ({
  subscribeConversations: vi.fn(),
  getContacts: vi.fn(),
  addContact: vi.fn(),
  removeContact: vi.fn(),
  createDirectConversation: vi.fn(),
  deleteConversation: vi.fn(),
  findPlayerByEmail: vi.fn(),
  getUser: vi.fn(),
}));

import {
  subscribeConversations,
  getContacts,
  addContact,
  removeContact,
  createDirectConversation,
  findPlayerByEmail,
  getUser,
} from "@/lib/data";
import MessagesPage from "./page";

const self = makePlayer({ id: "u_self", firstName: "Self" });

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "direct_u_other_u_self",
    participants: ["u_self", "u_other"],
    type: "direct",
    lastMessage: "hey",
    lastMessageAt: new Date().toISOString(),
    unread: { u_self: 0 },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return { id: "u_c", name: "Contact One", email: "c@x.com", avatar: "🎾", addedAt: new Date().toISOString(), ...overrides };
}

let conversationsData: Conversation[];
let contactsData: Contact[];
const unsubscribe = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  authValue = makeAuth(self);
  conversationsData = [];
  contactsData = [];

  // Deliver the current fixture synchronously, like the poll's first tick.
  vi.mocked(subscribeConversations).mockImplementation((_userId, cb) => {
    cb([...conversationsData]);
    return unsubscribe;
  });
  vi.mocked(getContacts).mockImplementation(async () => [...contactsData]);
  vi.mocked(getUser).mockResolvedValue(undefined);
  vi.mocked(findPlayerByEmail).mockResolvedValue(undefined);
  vi.mocked(addContact).mockResolvedValue(undefined);
  vi.mocked(removeContact).mockResolvedValue(undefined);
});

describe("MessagesPage", () => {
  it("shows the empty chats state when there are no conversations", async () => {
    render(<MessagesPage />);
    expect(await screen.findByText("No conversations yet")).toBeInTheDocument();
  });

  it("renders conversations from the live subscription and unsubscribes on unmount", async () => {
    conversationsData = [makeConversation()];
    vi.mocked(getUser).mockResolvedValue(makePlayer({ id: "u_other", name: "Other Person", firstName: "Other" }));
    const { unmount } = render(<MessagesPage />);
    expect(await screen.findByText("hey")).toBeInTheDocument();
    expect(subscribeConversations).toHaveBeenCalledWith("u_self", expect.any(Function));
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("filter pills are keyboard-operable buttons that filter by type", async () => {
    conversationsData = [
      makeConversation({ id: "direct_a_u_self", participants: ["u_self", "a"], type: "direct", lastMessage: "direct msg" }),
      makeConversation({ id: "conv_group", participants: ["u_self", "b", "rally"], type: "group", name: "Group Chat", lastMessage: "group msg" }),
    ];
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
    contactsData = [makeContact()];
    vi.mocked(createDirectConversation).mockResolvedValue("direct_u_c_u_self");
    render(<MessagesPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /Contacts/i }));
    expect(await screen.findByText("Contact One")).toBeInTheDocument();
    // First icon button in the contact row starts the chat.
    const row = screen.getByText("Contact One").closest("div")!.parentElement!;
    const iconButtons = row.querySelectorAll("button");
    await user.click(iconButtons[0]);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard/messages/direct_u_c_u_self/"));
    expect(createDirectConversation).toHaveBeenCalledWith("u_self", "u_c", "Self", "Contact One");
  });

  it("adds a contact by email via findPlayerByEmail", async () => {
    vi.mocked(findPlayerByEmail).mockResolvedValue(
      makePlayer({ id: "u_new", name: "New Contact", firstName: "New", lastName: "Contact", email: "new@x.com" })
    );
    render(<MessagesPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /Contacts/i }));
    await user.click(screen.getByRole("button", { name: /Add Contact/i }));
    const input = await screen.findByPlaceholderText(/Enter email address/i);
    // Pressing Enter in the input submits via the onKeyDown handler.
    await user.type(input, "new@x.com{Enter}");
    expect(await screen.findByText("New Contact")).toBeInTheDocument();
    expect(findPlayerByEmail).toHaveBeenCalledWith("new@x.com");
    expect(addContact).toHaveBeenCalledWith(
      "u_self",
      expect.objectContaining({ id: "u_new", name: "New Contact", email: "new@x.com" })
    );
  });

  it("shows an error when adding an unknown email", async () => {
    render(<MessagesPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /Contacts/i }));
    await user.click(screen.getByRole("button", { name: /Add Contact/i }));
    const input = await screen.findByPlaceholderText(/Enter email address/i);
    await user.type(input, "ghost@nowhere.com{Enter}");
    expect(await screen.findByText("No user found with that email")).toBeInTheDocument();
    expect(addContact).not.toHaveBeenCalled();
  });

  it("removes a contact", async () => {
    contactsData = [makeContact({ id: "u_rm", name: "Remove Me", email: "rm@x.com" })];
    render(<MessagesPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /Contacts/i }));
    expect(await screen.findByText("Remove Me")).toBeInTheDocument();
    const row = screen.getByText("Remove Me").closest("div")!.parentElement!;
    const iconButtons = row.querySelectorAll("button");
    // Second icon button is the trash/remove.
    await user.click(iconButtons[iconButtons.length - 1]);
    await waitFor(() => expect(screen.queryByText("Remove Me")).not.toBeInTheDocument());
    expect(removeContact).toHaveBeenCalledWith("u_self", "u_rm");
  });
});
