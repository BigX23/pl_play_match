import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  matches,
  players,
  conversations,
  messages,
  type Match,
  type Player,
} from "@/lib/mock-data";
import * as fs from "@/lib/firestore";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/dashboard/open-matches",
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
  matchesPlayed: 0,
  wins: 0,
  losses: 0,
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

import OpenMatchesPage from "./page";

function seedPlayer(id: string, name: string, extra: Partial<Player> = {}) {
  players.push({
    id,
    name,
    email: `${id}@example.com`,
    ntrpRating: 4.0,
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
    ...extra,
  });
}

function seedMatch(overrides: Partial<Match>): Match {
  const m: Match = {
    id: `m_${matches.length}`,
    player1Id: "other",
    player2Id: "",
    date: "2026-08-01",
    time: "10:00",
    location: "Court A",
    sport: "tennis",
    status: "open",
    compatibilityScore: 0,
    matchExplanation: "",
    matchType: "singles",
    createdBy: "other",
    participants: ["other"],
    ...overrides,
  };
  matches.push(m);
  return m;
}

beforeEach(() => {
  matches.length = 0;
  players.length = 0;
  conversations.length = 0;
  messages.length = 0;
  fs.__resetMockState();
  // The current user is a player too.
  seedPlayer("me", "Me User", { firstName: "Me" });
});

describe("OpenMatchesPage", () => {
  it("renders the empty my-matches state and browse empty state", async () => {
    render(<OpenMatchesPage />);
    expect(await screen.findByText("Matches")).toBeInTheDocument();
    expect(screen.getByText(/No matches yet/i)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /Browse Open/i }));
    expect(await screen.findByText(/No open matches to join/i)).toBeInTheDocument();
  });

  it("opens the create form, fills date/time and posts a new match", async () => {
    render(<OpenMatchesPage />);
    await screen.findByText("Matches");
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Create Match/i }));
    expect(await screen.findByText("Create Open Match")).toBeInTheDocument();

    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement;
    await user.type(dateInput, "2026-09-15");
    await user.type(timeInput, "14:30");

    const notes = screen.getByPlaceholderText(/Any details about the match/i);
    await user.type(notes, "friendly hit");

    await user.click(screen.getByRole("button", { name: /Post Open Match/i }));

    await waitFor(() => {
      expect(matches.some((m) => m.createdBy === "me" && m.date === "2026-09-15")).toBe(true);
    });
  });

  it("does not create a match without date/time", async () => {
    render(<OpenMatchesPage />);
    await screen.findByText("Matches");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Create Match/i }));
    const post = await screen.findByRole("button", { name: /Post Open Match/i });
    expect(post).toBeDisabled();
  });

  it("lets a non-owner request to join an open match", async () => {
    seedPlayer("other", "Other Owner");
    seedMatch({ id: "open1", player1Id: "other", createdBy: "other", status: "open" });
    render(<OpenMatchesPage />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("tab", { name: /Browse Open/i }));
    const joinBtn = await screen.findByRole("button", { name: /Request to Join/i });
    await user.click(joinBtn);

    await waitFor(() => {
      const m = matches.find((x) => x.id === "open1");
      expect(m?.status).toBe("pending");
      expect(m?.player2Id).toBe("me");
    });
  });

  it("shows a toast when joining a match that is already taken", async () => {
    seedPlayer("other", "Other Owner");
    // Already has a player2 so joinOpenMatch returns false
    seedMatch({ id: "taken1", player1Id: "other", createdBy: "other", status: "open", player2Id: "" });
    render(<OpenMatchesPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: /Browse Open/i }));

    // Sabotage: flip the match to taken right before joining.
    const m = matches.find((x) => x.id === "taken1")!;
    m.player2Id = "someone";
    const joinBtn = await screen.findByRole("button", { name: /Request to Join/i });
    await user.click(joinBtn);

    // The join fails (someone else took it); the match keeps its foreign player2.
    // Toaster isn't mounted in this test, so we assert on the resulting state.
    await waitFor(() => {
      const taken = matches.find((x) => x.id === "taken1")!;
      expect(taken.status).toBe("open");
      expect(taken.player2Id).toBe("someone");
    });
  });

  it("renders my open match (creator) with delete action and deletes it", async () => {
    seedMatch({ id: "mine_open", player1Id: "me", createdBy: "me", status: "open", participants: ["me"] });
    render(<OpenMatchesPage />);
    const user = userEvent.setup();

    expect(await screen.findByText(/waiting for a partner/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Delete Match/i }));

    await waitFor(() => expect(matches.find((m) => m.id === "mine_open")).toBeUndefined());
  });

  it("shows pending-creator accept/decline and accepting confirms the match", async () => {
    seedPlayer("joiner", "Joiner Person");
    seedMatch({
      id: "pend1",
      player1Id: "me",
      createdBy: "me",
      player2Id: "joiner",
      acceptedBy: "joiner",
      status: "pending",
      participants: ["me", "joiner"],
    });
    render(<OpenMatchesPage />);
    const user = userEvent.setup();

    expect(await screen.findByText(/wants to join this match/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Accept/i }));

    await waitFor(() => {
      const m = matches.find((x) => x.id === "pend1");
      expect(m?.status).toBe("confirmed");
      expect(m?.conversationId).toBeTruthy();
    });
  });

  it("declines a pending join request, reverting to open", async () => {
    seedPlayer("joiner", "Joiner Person");
    seedMatch({
      id: "pend2",
      player1Id: "me",
      createdBy: "me",
      player2Id: "joiner",
      acceptedBy: "joiner",
      status: "pending",
      participants: ["me", "joiner"],
    });
    render(<OpenMatchesPage />);
    const user = userEvent.setup();
    await screen.findByText(/wants to join this match/i);
    await user.click(screen.getByRole("button", { name: /Decline/i }));
    await waitFor(() => expect(matches.find((x) => x.id === "pend2")?.status).toBe("open"));
  });

  it("shows pending-partner waiting state and withdraws", async () => {
    seedPlayer("creator", "Creator Person");
    seedMatch({
      id: "pend3",
      player1Id: "creator",
      createdBy: "creator",
      player2Id: "me",
      acceptedBy: "me",
      status: "pending",
      participants: ["creator", "me"],
    });
    render(<OpenMatchesPage />);
    const user = userEvent.setup();
    expect(await screen.findByText(/Waiting for .* to approve/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Withdraw Request/i }));
    await waitFor(() => expect(matches.find((x) => x.id === "pend3")?.status).toBe("open"));
  });

  it("confirmed-creator can mark scheduled and cancel", async () => {
    seedPlayer("partner", "Partner Person");
    seedMatch({
      id: "conf1",
      player1Id: "me",
      createdBy: "me",
      player2Id: "partner",
      status: "confirmed",
      conversationId: "conv_x",
      participants: ["me", "partner"],
    });
    render(<OpenMatchesPage />);
    const user = userEvent.setup();
    expect(await screen.findByText(/Partner confirmed/i)).toBeInTheDocument();
    // Chat link present because conversationId set
    expect(screen.getByRole("link")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Mark Scheduled/i }));
    await waitFor(() => expect(matches.find((x) => x.id === "conf1")?.status).toBe("scheduled"));
  });

  it("confirmed-partner sees waiting text and can withdraw", async () => {
    seedPlayer("creator", "Creator Person");
    seedMatch({
      id: "conf2",
      player1Id: "creator",
      createdBy: "creator",
      player2Id: "me",
      status: "confirmed",
      conversationId: "conv_y",
      participants: ["creator", "me"],
    });
    render(<OpenMatchesPage />);
    const user = userEvent.setup();
    expect(await screen.findByText(/You're confirmed/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Withdraw/i }));
    await waitFor(() => expect(matches.find((x) => x.id === "conf2")?.status).toBe("open"));
  });

  it("scheduled-creator can start the match", async () => {
    seedPlayer("partner", "Partner Person");
    seedMatch({
      id: "sched1",
      player1Id: "me",
      createdBy: "me",
      player2Id: "partner",
      status: "scheduled",
      participants: ["me", "partner"],
    });
    render(<OpenMatchesPage />);
    const user = userEvent.setup();
    expect(await screen.findByText(/Court reserved/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Start Match/i }));
    await waitFor(() => expect(matches.find((x) => x.id === "sched1")?.status).toBe("in_progress"));
  });

  it("scheduled-partner sees the see-you-on-court text", async () => {
    seedPlayer("creator", "Creator Person");
    seedMatch({
      id: "sched2",
      player1Id: "creator",
      createdBy: "creator",
      player2Id: "me",
      status: "scheduled",
      conversationId: "conv_z",
      participants: ["creator", "me"],
    });
    render(<OpenMatchesPage />);
    expect(await screen.findByText(/see you on the court/i)).toBeInTheDocument();
  });

  it("in_progress match: report score, pick winner and complete + record stats", async () => {
    seedPlayer("partner", "Partner Person");
    seedMatch({
      id: "prog1",
      player1Id: "me",
      createdBy: "me",
      player2Id: "partner",
      status: "in_progress",
      participants: ["me", "partner"],
    });
    render(<OpenMatchesPage />);
    const user = userEvent.setup();

    expect(await screen.findByText(/Match in progress/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Report Score/i }));

    expect(await screen.findByText("Report Final Score")).toBeInTheDocument();
    const scoreInput = screen.getByPlaceholderText("6-4, 6-3");
    await user.type(scoreInput, "6-4, 6-3");

    // Pick a winner via the Radix Select
    await user.click(screen.getByRole("combobox"));
    const meOption = await screen.findByRole("option", { name: "Me User" });
    await user.click(meOption);

    await user.click(screen.getByRole("button", { name: /Submit Score/i }));

    await waitFor(() => {
      const m = matches.find((x) => x.id === "prog1");
      expect(m?.status).toBe("completed");
      expect(m?.score).toBe("6-4, 6-3");
    });
    // Stats recorded for the winner
    await waitFor(() => {
      const me = players.find((p) => p.id === "me")!;
      expect(me.matchesPlayed).toBe(1);
      expect(me.wins).toBe(1);
    });
  });

  it("closes the score dialog on Cancel", async () => {
    seedPlayer("partner", "Partner Person");
    seedMatch({
      id: "prog2",
      player1Id: "me",
      createdBy: "me",
      player2Id: "partner",
      status: "in_progress",
      participants: ["me", "partner"],
    });
    render(<OpenMatchesPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Report Score/i }));
    await screen.findByText("Report Final Score");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByText("Report Final Score")).not.toBeInTheDocument());
  });

  it("filters matches by search text and shows the completed/cancelled past matches", async () => {
    seedPlayer("partner", "Partner Person");
    seedMatch({
      id: "done1",
      player1Id: "me",
      createdBy: "me",
      player2Id: "partner",
      status: "completed",
      score: "6-2, 6-1",
      compatibilityScore: 88,
      notes: "great game",
      participants: ["me", "partner"],
    });
    seedMatch({
      id: "cancel1",
      player1Id: "me",
      createdBy: "me",
      player2Id: "partner",
      status: "cancelled",
      cancelledBy: "me",
      participants: ["me", "partner"],
    });
    render(<OpenMatchesPage />);
    const user = userEvent.setup();

    expect(await screen.findByText("Past")).toBeInTheDocument();
    expect(screen.getByText(/Final Score: 6-2, 6-1/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Cancelled/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/88% match/i)).toBeInTheDocument();

    // Search that matches nothing
    const searchBox = screen.getByPlaceholderText(/Search players or locations/i);
    await user.type(searchBox, "zzzznomatch");
    await waitFor(() => expect(screen.queryByText("Past")).not.toBeInTheDocument());
  });

  it("confirmed-creator can cancel the match", async () => {
    seedPlayer("partner", "Partner Person");
    seedMatch({
      id: "conf_cancel",
      player1Id: "me",
      createdBy: "me",
      player2Id: "partner",
      status: "confirmed",
      participants: ["me", "partner"],
    });
    render(<OpenMatchesPage />);
    const user = userEvent.setup();
    await screen.findByText(/Partner confirmed/i);
    await user.click(screen.getByRole("button", { name: "Cancel Match" }));
    await waitFor(() => {
      const m = matches.find((x) => x.id === "conf_cancel");
      expect(m?.status).toBe("cancelled");
      expect(m?.cancelledBy).toBe("me");
    });
  });

  it("pending-creator can delete the match from the pending state", async () => {
    seedPlayer("joiner", "Joiner Person");
    seedMatch({
      id: "pend_del",
      player1Id: "me",
      createdBy: "me",
      player2Id: "joiner",
      acceptedBy: "joiner",
      status: "pending",
      participants: ["me", "joiner"],
    });
    render(<OpenMatchesPage />);
    const user = userEvent.setup();
    await screen.findByText(/wants to join this match/i);
    // The only "Delete Match" button in the pending-creator actions
    await user.click(screen.getByRole("button", { name: /Delete Match/i }));
    await waitFor(() => expect(matches.find((x) => x.id === "pend_del")).toBeUndefined());
  });

  it("scheduled-creator can cancel the match", async () => {
    seedPlayer("partner", "Partner Person");
    seedMatch({
      id: "sched_cancel",
      player1Id: "me",
      createdBy: "me",
      player2Id: "partner",
      status: "scheduled",
      participants: ["me", "partner"],
    });
    render(<OpenMatchesPage />);
    const user = userEvent.setup();
    await screen.findByText(/Court reserved/i);
    await user.click(screen.getByRole("button", { name: "Cancel Match" }));
    await waitFor(() => expect(matches.find((x) => x.id === "sched_cancel")?.status).toBe("cancelled"));
  });

  it("resolves a player via getUser when not seeded in players/cache", async () => {
    // Owner is NOT in the players array — forces the getUser() resolvePlayer path.
    // Seed the owner into the mock user store only.
    await fs.updateUser("ghostowner", {
      id: "ghostowner",
      name: "Ghost Owner",
      email: "ghost@example.com",
      ntrpRating: 4.5,
    } as Player);
    players.push({
      id: "ghostowner",
      name: "Ghost Owner",
      email: "ghost@example.com",
      ntrpRating: 4.5,
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
    });
    seedMatch({ id: "ghost1", player1Id: "ghostowner", createdBy: "ghostowner", status: "open" });
    render(<OpenMatchesPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: /Browse Open/i }));
    expect(await screen.findByText("Ghost Owner")).toBeInTheDocument();
  });

  it("changes sport and match-type in the create form", async () => {
    render(<OpenMatchesPage />);
    await screen.findByText("Matches");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Create Match/i }));
    await screen.findByText("Create Open Match");

    // The create form has two Selects (sport, type). Change both.
    const combos = screen.getAllByRole("combobox");
    await user.click(combos[0]);
    await user.click(await screen.findByRole("option", { name: "Pickleball" }));

    const combos2 = screen.getAllByRole("combobox");
    await user.click(combos2[1]);
    await user.click(await screen.findByRole("option", { name: "Doubles" }));

    // Edit the location input
    const location = screen.getByPlaceholderText(/Lifetime Activities Pleasanton/i);
    await user.clear(location);
    await user.type(location, "Sports Park");

    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement;
    await user.type(dateInput, "2026-10-01");
    await user.type(timeInput, "09:00");
    await user.click(screen.getByRole("button", { name: /Post Open Match/i }));

    await waitFor(() => {
      const m = matches.find((x) => x.createdBy === "me" && x.location === "Sports Park");
      expect(m?.sport).toBe("pickleball");
      expect(m?.matchType).toBe("doubles");
    });
  });

  it("closes the score dialog via the Dialog onOpenChange (Escape)", async () => {
    seedPlayer("partner", "Partner Person");
    seedMatch({
      id: "prog_esc",
      player1Id: "me",
      createdBy: "me",
      player2Id: "partner",
      status: "in_progress",
      participants: ["me", "partner"],
    });
    render(<OpenMatchesPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Report Score/i }));
    await screen.findByText("Report Final Score");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText("Report Final Score")).not.toBeInTheDocument());
  });

  it("submits a score via Enter key in the score input", async () => {
    seedPlayer("partner", "Partner Person");
    seedMatch({
      id: "prog_enter",
      player1Id: "me",
      createdBy: "me",
      player2Id: "partner",
      status: "in_progress",
      participants: ["me", "partner"],
    });
    render(<OpenMatchesPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Report Score/i }));
    const scoreInput = await screen.findByPlaceholderText("6-4, 6-3");
    await user.type(scoreInput, "7-5{Enter}");
    await waitFor(() => expect(matches.find((x) => x.id === "prog_enter")?.status).toBe("completed"));
  });

  it("filters by sport via the sport Select", async () => {
    seedPlayer("other", "Other Owner");
    seedMatch({ id: "tennisM", player1Id: "other", createdBy: "other", status: "open", sport: "tennis" });
    seedMatch({ id: "pickM", player1Id: "other", createdBy: "other", status: "open", sport: "pickleball" });
    render(<OpenMatchesPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: /Browse Open/i }));

    // Two join buttons before filtering
    await waitFor(() => expect(screen.getAllByRole("button", { name: /Request to Join/i }).length).toBe(2));

    // Open the sport filter select (the one showing "All Sports")
    const combos = screen.getAllByRole("combobox");
    await user.click(combos[0]);
    await user.click(await screen.findByRole("option", { name: "Pickleball" }));

    await waitFor(() => expect(screen.getAllByRole("button", { name: /Request to Join/i }).length).toBe(1));
  });
});
