import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Conversation, Message } from "@/lib/mock-data";
import { makePlayer, makeAuth } from "../../../test-fixtures";

/* ─────────── router / auth mocks ─────────── */
const pushMock = vi.fn();
let currentPath = "/dashboard/messages/direct_a_me";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  usePathname: () => currentPath,
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

const me = makePlayer({ id: "me", name: "Me User", firstName: "Me", lastName: "User", email: "me@example.com" });
vi.mock("@/lib/auth-context", () => ({ useAuth: () => makeAuth(me) }));

vi.mock("@/lib/data", () => ({
  subscribeMessages: vi.fn(),
  sendMessage: vi.fn(),
  getUser: vi.fn(),
  getConversation: vi.fn(),
  addContact: vi.fn(),
  deleteConversation: vi.fn(),
  markConversationRead: vi.fn(),
}));

import {
  subscribeMessages,
  sendMessage,
  getUser,
  getConversation,
  addContact,
  deleteConversation,
  markConversationRead,
} from "@/lib/data";
import ChatPage from "./chat-client";

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "direct_a_me",
    participants: ["a", "me"],
    type: "direct",
    lastMessage: "",
    lastMessageAt: new Date().toISOString(),
    unread: { a: 0, me: 1 },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: `msg_${Math.random()}`,
    conversationId: "direct_a_me",
    senderId: "a",
    senderName: "Alice",
    text: "hello there",
    createdAt: new Date().toISOString(),
    readBy: ["a"],
    ...overrides,
  };
}

let messagesData: Message[];
const unsubscribe = vi.fn();
// Captured so tests can push a later message (e.g. Rally's reply) after mount.
let messagesCb: ((m: Message[]) => void) | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  currentPath = "/dashboard/messages/direct_a_me";
  messagesData = [];
  messagesCb = null;

  vi.mocked(getConversation).mockResolvedValue(makeConversation());
  // Deliver the fixture messages synchronously, like the poll's first tick.
  vi.mocked(subscribeMessages).mockImplementation((_convId, cb) => {
    messagesCb = cb;
    cb([...messagesData]);
    return unsubscribe;
  });
  vi.mocked(getUser).mockImplementation(async (id) =>
    id === "a"
      ? makePlayer({ id: "a", name: "Alice Doe", firstName: "Alice", lastName: "Doe", email: "a@example.com", avatar: "👤" })
      : undefined
  );
  vi.mocked(sendMessage).mockImplementation(async (convId, text) =>
    makeMessage({ id: "sent_1", conversationId: convId, senderId: "me", senderName: "Me User", text, readBy: ["me"] })
  );
  vi.mocked(addContact).mockResolvedValue(undefined);
  vi.mocked(deleteConversation).mockResolvedValue(undefined);
  vi.mocked(markConversationRead).mockResolvedValue(undefined);
});

describe("ChatPage", () => {
  it("returns null placeholder early", () => {
    currentPath = "/dashboard/messages/placeholder";
    const { container } = render(<ChatPage />);
    expect(container).toBeEmptyDOMElement();
    expect(getConversation).not.toHaveBeenCalled();
  });

  it("shows not-found state for a missing conversation", async () => {
    currentPath = "/dashboard/messages/does_not_exist";
    vi.mocked(getConversation).mockResolvedValue(undefined);
    render(<ChatPage />);
    expect(await screen.findByText("Conversation not found")).toBeInTheDocument();
    expect(getConversation).toHaveBeenCalledWith("does_not_exist");
    const back = screen.getByRole("button", { name: /Back to Messages/i });
    await userEvent.click(back);
    expect(pushMock).toHaveBeenCalledWith("/dashboard/messages");
  });

  it("renders title, messages with date separators, and marks the conversation read", async () => {
    // yesterday + today messages to trigger the date separator branch
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    messagesData = [
      makeMessage({ id: "m_old", text: "yesterday msg", createdAt: yesterday.toISOString() }),
      makeMessage({ id: "m_new", text: "today msg" }),
    ];

    render(<ChatPage />);

    expect(await screen.findByText("today msg")).toBeInTheDocument();
    expect(screen.getByText("yesterday msg")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
    // Direct message label
    expect(screen.getByText("Direct Message")).toBeInTheDocument();
    // Title resolves to Alice's name via getUser
    await waitFor(() => expect(screen.getByText("Alice Doe")).toBeInTheDocument());
    expect(markConversationRead).toHaveBeenCalledWith("direct_a_me", "me");
  });

  it("shows empty-state and sends a message via the input", async () => {
    const user = userEvent.setup();
    render(<ChatPage />);

    expect(await screen.findByText(/No messages yet/i)).toBeInTheDocument();

    const input = screen.getByPlaceholderText("Type a message…");
    await user.type(input, "hi Alice{Enter}");

    // sendMessage is called with (conversationId, text) and the sent message
    // is shown immediately.
    expect(await screen.findByText("hi Alice")).toBeInTheDocument();
    expect(sendMessage).toHaveBeenCalledWith("direct_a_me", "hi Alice");
  });

  it("renders group + Rally badges and Rally's server-generated (isAI) messages", async () => {
    vi.mocked(getConversation).mockResolvedValue(
      makeConversation({ type: "group", name: "Match: Me vs Alice", participants: ["a", "me", "rally"] })
    );
    messagesData = [
      makeMessage({ id: "rally1", senderId: "rally", senderName: "Rally", isAI: true, text: "Welcome to your match chat!" }),
    ];
    render(<ChatPage />);

    // Group + Rally badges rendered
    expect(await screen.findByText("Group")).toBeInTheDocument();
    expect(screen.getAllByText("Rally").length).toBeGreaterThan(0);

    // The AI message renders like any other incoming message.
    expect(screen.getByText("Welcome to your match chat!")).toBeInTheDocument();
  });

  it("shows 'Rally is typing' after an @rally message and hides it when Rally replies", async () => {
    vi.mocked(getConversation).mockResolvedValue(
      makeConversation({ type: "group", name: "Match chat", participants: ["a", "me", "rally"] })
    );
    const user = userEvent.setup();
    render(<ChatPage />);
    await screen.findByText("Group");

    const input = screen.getByPlaceholderText("Type a message…");
    await user.type(input, "@rally where do we play?{Enter}");

    // Typing indicator appears while Rally's server-side reply is generated.
    expect(await screen.findByRole("status", { name: /rally is typing/i })).toBeInTheDocument();

    // Rally's reply arrives over the (mocked) stream → indicator disappears.
    await act(async () => {
      messagesCb?.([
        makeMessage({ id: "sent_1", senderId: "me", text: "@rally where do we play?" }),
        makeMessage({ id: "rally_reply", senderId: "rally", senderName: "Rally", isAI: true, text: "Lifetime Activities Pleasanton." }),
      ]);
    });
    await waitFor(() =>
      expect(screen.queryByRole("status", { name: /rally is typing/i })).not.toBeInTheDocument()
    );
    expect(screen.getByText("Lifetime Activities Pleasanton.")).toBeInTheDocument();
  });

  it("does not show the typing indicator when the message doesn't address Rally", async () => {
    vi.mocked(getConversation).mockResolvedValue(
      makeConversation({ type: "group", name: "Match chat", participants: ["a", "me", "rally"] })
    );
    const user = userEvent.setup();
    render(<ChatPage />);
    await screen.findByText("Group");

    await user.type(screen.getByPlaceholderText("Type a message…"), "just chatting{Enter}");
    await screen.findByText("just chatting");
    expect(screen.queryByRole("status", { name: /rally is typing/i })).not.toBeInTheDocument();
  });

  it("does not show the typing indicator in a conversation without Rally", async () => {
    const user = userEvent.setup();
    render(<ChatPage />); // default direct conversation, no rally
    await screen.findByText("Direct Message");

    await user.type(screen.getByPlaceholderText("Type a message…"), "@rally hi{Enter}");
    await screen.findByText("@rally hi");
    expect(screen.queryByRole("status", { name: /rally is typing/i })).not.toBeInTheDocument();
  });

  it("unsubscribes from messages on unmount", async () => {
    const { unmount } = render(<ChatPage />);
    await screen.findByText("Direct Message");
    expect(subscribeMessages).toHaveBeenCalledWith("direct_a_me", expect.any(Function));
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("opens the delete dropdown and confirms deletion", async () => {
    const user = userEvent.setup();
    render(<ChatPage />);

    await screen.findByText("Direct Message");

    // Open the dropdown (MoreVertical trigger is the last icon button in header)
    const buttons = screen.getAllByRole("button");
    const trigger = buttons.find((b) => b.querySelector("svg.lucide-ellipsis-vertical")) || buttons[buttons.length - 1];
    await user.click(trigger!);

    const del = await screen.findByText("Delete conversation");
    await user.click(del);

    expect(await screen.findByText("Delete this conversation?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard/messages"));
    expect(deleteConversation).toHaveBeenCalledWith("direct_a_me");
  });

  it("shows Add-to-contacts entries for group members and adds a contact", async () => {
    vi.mocked(getConversation).mockResolvedValue(
      makeConversation({ type: "group", name: "Trio", participants: ["a", "b", "me", "rally"] })
    );
    vi.mocked(getUser).mockImplementation(async (id) => {
      if (id === "a") return makePlayer({ id: "a", name: "Alice Doe", firstName: "Alice", lastName: "Doe", email: "a@example.com" });
      if (id === "b") return makePlayer({ id: "b", name: "Bob Roe", firstName: "Bob", lastName: "Roe", email: "b@example.com" });
      return undefined;
    });
    const user = userEvent.setup();
    render(<ChatPage />);

    await screen.findByText("Group");

    const buttons = screen.getAllByRole("button");
    const trigger = buttons.find((b) => b.querySelector("svg.lucide-ellipsis-vertical")) || buttons[buttons.length - 1];
    await user.click(trigger!);

    const addAlice = await screen.findByText(/Add Alice Doe to contacts/i);
    await user.click(addAlice);

    await waitFor(() => {
      expect(addContact).toHaveBeenCalledWith(
        "me",
        expect.objectContaining({ id: "a", name: "Alice Doe", email: "a@example.com" })
      );
    });
  });
});
