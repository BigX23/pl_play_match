import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConversationCard from "./conversation-card";
import type { Conversation } from "@/lib/mock-data";
import { players } from "@/lib/mock-data";

// getUser returns undefined so the component falls back to getPlayerById.
vi.mock("@/lib/data", () => ({
  getUser: vi.fn(async () => undefined),
}));

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "c1",
    participants: ["me", "bob"],
    type: "direct",
    lastMessage: "See you on court",
    lastMessageAt: new Date().toISOString(),
    unread: {},
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  // Seed the mock player array so getPlayerById resolves.
  players.length = 0;
  players.push({
    id: "bob",
    name: "Bob Smith",
    email: "bob@example.com",
    ntrpRating: 3.5,
    avatar: "",
    location: "",
    availability: [],
    preferredTimes: [],
    sport: "tennis",
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    bio: "",
    joinedDate: "2024-01-01",
  });
});

describe("ConversationCard", () => {
  it("renders the other participant's name and last message", async () => {
    render(<ConversationCard conversation={makeConversation()} currentUserId="me" />);
    expect(screen.getByText("See you on court")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Bob Smith")).toBeInTheDocument());
  });

  it("renders 'Unknown' when no participant resolves", async () => {
    const conv = makeConversation({ participants: ["me", "ghost"] });
    render(<ConversationCard conversation={conv} currentUserId="me" />);
    await waitFor(() => expect(screen.getByText("Unknown")).toBeInTheDocument());
  });

  it("shows the per-user unread badge from conversation.unread", async () => {
    const conv = makeConversation({ unread: { me: 4, other: 9 } });
    render(<ConversationCard conversation={conv} currentUserId="me" />);
    await waitFor(() => expect(screen.getByText("Bob Smith")).toBeInTheDocument());
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("renders a group conversation with its name and Group badge", async () => {
    const conv = makeConversation({ type: "group", name: "Doubles Crew", participants: ["me", "bob", "carl"] });
    render(<ConversationCard conversation={conv} currentUserId="me" />);
    await waitFor(() => expect(screen.getByText("Doubles Crew")).toBeInTheDocument());
    expect(screen.getByText("Group")).toBeInTheDocument();
  });

  it("shows the Rally indicator when a Rally participant is present", async () => {
    const conv = makeConversation({ participants: ["me", "rally"], type: "group", name: "Rally Chat" });
    render(<ConversationCard conversation={conv} currentUserId="me" />);
    await waitFor(() => expect(screen.getByText("Rally Chat")).toBeInTheDocument());
    expect(screen.getByText("🎾")).toBeInTheDocument();
  });

  it("opens the AlertDialog and calls onDelete on confirm", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<ConversationCard conversation={makeConversation()} currentUserId="me" onDelete={onDelete} />);
    await waitFor(() => expect(screen.getByText("Bob Smith")).toBeInTheDocument());

    await user.click(screen.getByLabelText("Delete conversation"));
    expect(await screen.findByText("Delete this conversation?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("does not confirm delete when Cancel is clicked", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<ConversationCard conversation={makeConversation()} currentUserId="me" onDelete={onDelete} />);
    await user.click(screen.getByLabelText("Delete conversation"));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("does not render a delete button when onDelete is not provided", async () => {
    render(<ConversationCard conversation={makeConversation()} currentUserId="me" />);
    await waitFor(() => expect(screen.getByText("Bob Smith")).toBeInTheDocument());
    expect(screen.queryByLabelText("Delete conversation")).not.toBeInTheDocument();
  });

  it("formats the timeAgo string for hours and days", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString();
    const { unmount } = render(
      <ConversationCard conversation={makeConversation({ lastMessageAt: twoHoursAgo })} currentUserId="me" />
    );
    await waitFor(() => expect(screen.getByText("2h")).toBeInTheDocument());
    unmount();

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600_000).toISOString();
    render(<ConversationCard conversation={makeConversation({ lastMessageAt: threeDaysAgo })} currentUserId="me" />);
    await waitFor(() => expect(screen.getByText("3d")).toBeInTheDocument());
  });

  it("resolves a name from the firestore user when getUser returns one", async () => {
    const { getUser } = await import("@/lib/data");
    (getUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      firstName: "Firestore",
      lastName: "User",
    });
    render(<ConversationCard conversation={makeConversation()} currentUserId="me" />);
    await waitFor(() => expect(screen.getByText("Firestore User")).toBeInTheDocument());
  });
});
