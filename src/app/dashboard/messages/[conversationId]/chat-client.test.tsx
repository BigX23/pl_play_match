import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  conversations,
  messages,
  players,
  type Conversation,
  type Message,
} from "@/lib/mock-data";
import * as fs from "@/lib/firestore";

/* ─────────── router / auth mocks ─────────── */
const pushMock = vi.fn();
let currentPath = "/dashboard/messages/direct_a_me";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  usePathname: () => currentPath,
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

const COMPLETE_USER = {
  id: "me",
  firstName: "Me",
  lastName: "User",
  name: "Me User",
  email: "me@example.com",
  ntrpRating: 3.5,
  avatar: "🎾",
  sport: "tennis" as const,
};

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: COMPLETE_USER,
    firebaseUser: null,
    isAuthenticated: true,
    profileComplete: true,
    loading: false,
    login: vi.fn(),
    loginWithGoogle: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    resetPassword: vi.fn(),
    deleteAccount: vi.fn(),
    setProfileComplete: vi.fn(),
    updateUserProfile: vi.fn(),
  }),
}));

import ChatPage from "./chat-client";

function seedPlayer(id: string, name: string, firstName?: string) {
  players.push({
    id,
    name,
    email: `${id}@example.com`,
    ntrpRating: 3.5,
    avatar: "👤",
    location: "",
    availability: [],
    preferredTimes: [],
    sport: "tennis",
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    bio: "",
    joinedDate: "2024-01-01",
    ...(firstName ? { firstName, lastName: "Doe" } : {}),
  });
}

function seedConversation(overrides: Partial<Conversation> = {}): Conversation {
  const conv: Conversation = {
    id: "direct_a_me",
    participants: ["a", "me"],
    type: "direct",
    lastMessage: "",
    lastMessageAt: new Date().toISOString(),
    unread: { a: 0, me: 1 },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
  conversations.push(conv);
  return conv;
}

function seedMessage(conversationId: string, overrides: Partial<Message> = {}): Message {
  const msg: Message = {
    id: `msg_${messages.length}`,
    conversationId,
    senderId: "a",
    senderName: "Alice",
    text: "hello there",
    createdAt: new Date().toISOString(),
    readBy: ["a"],
    ...overrides,
  };
  messages.push(msg);
  return msg;
}

beforeEach(() => {
  conversations.length = 0;
  messages.length = 0;
  players.length = 0;
  pushMock.mockClear();
  currentPath = "/dashboard/messages/direct_a_me";
  fs.__resetMockState();
});

describe("ChatPage", () => {
  it("returns null placeholder early", () => {
    currentPath = "/dashboard/messages/placeholder";
    const { container } = render(<ChatPage />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows not-found state for a missing conversation", async () => {
    currentPath = "/dashboard/messages/does_not_exist";
    render(<ChatPage />);
    expect(await screen.findByText("Conversation not found")).toBeInTheDocument();
    const back = screen.getByRole("button", { name: /Back to Messages/i });
    await userEvent.click(back);
    expect(pushMock).toHaveBeenCalledWith("/dashboard/messages");
  });

  it("renders title, messages with date separators, and empty back nav", async () => {
    seedPlayer("a", "Alice", "Alice");
    seedConversation();
    // yesterday + today messages to trigger the date separator branch
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    seedMessage("direct_a_me", { id: "m_old", text: "yesterday msg", createdAt: yesterday.toISOString() });
    seedMessage("direct_a_me", { id: "m_new", text: "today msg" });

    render(<ChatPage />);

    expect(await screen.findByText("today msg")).toBeInTheDocument();
    expect(screen.getByText("yesterday msg")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
    // Direct message label
    expect(screen.getByText("Direct Message")).toBeInTheDocument();
    // Title resolves to Alice's name
    await waitFor(() => expect(screen.getByText("Alice Doe")).toBeInTheDocument());
  });

  it("shows empty-state and sends a message via the input", async () => {
    seedPlayer("a", "Alice");
    seedConversation();
    const user = userEvent.setup();
    render(<ChatPage />);

    expect(await screen.findByText(/No messages yet/i)).toBeInTheDocument();

    const input = screen.getByPlaceholderText("Type a message…");
    await user.type(input, "hi Alice{Enter}");

    expect(await screen.findByText("hi Alice")).toBeInTheDocument();
  });

  it("triggers a Rally reply in a group conversation when addressed", async () => {
    seedPlayer("a", "Alice");
    seedConversation({
      id: "direct_a_me",
      type: "group",
      name: "Match: Me vs Alice",
      participants: ["a", "me", "rally"],
    });
    const user = userEvent.setup();
    render(<ChatPage />);

    // Group + Rally badges rendered
    expect(await screen.findByText("Group")).toBeInTheDocument();
    expect(screen.getByText("Rally")).toBeInTheDocument();

    const input = screen.getByPlaceholderText("Type a message…");
    await user.type(input, "@rally where do we play?{Enter}");

    // Rally's fallback response about courts should appear
    expect(
      await screen.findByText(/Lifetime Activities Pleasanton/i)
    ).toBeInTheDocument();
  });

  it("opens the delete dropdown and confirms deletion", async () => {
    seedPlayer("a", "Alice");
    seedConversation();
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
  });

  it("shows Add-to-contacts entries for group members and adds a contact", async () => {
    seedPlayer("a", "Alice");
    seedPlayer("b", "Bob");
    seedConversation({
      id: "direct_a_me",
      type: "group",
      name: "Trio",
      participants: ["a", "b", "me", "rally"],
    });
    const user = userEvent.setup();
    render(<ChatPage />);

    await screen.findByText("Group");

    const buttons = screen.getAllByRole("button");
    const trigger = buttons.find((b) => b.querySelector("svg.lucide-ellipsis-vertical")) || buttons[buttons.length - 1];
    await user.click(trigger!);

    const addAlice = await screen.findByText(/Add Alice to contacts/i);
    await user.click(addAlice);

    await waitFor(async () => {
      const contacts = await fs.getContacts("me");
      expect(contacts.some((c) => c.id === "a")).toBe(true);
    });
  });
});
