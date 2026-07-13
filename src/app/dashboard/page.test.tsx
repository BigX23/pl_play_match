import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Match, MatchRequest, Player } from "@/lib/mock-data";
import { makePlayer, makeAuth } from "../test-fixtures";

let authValue: ReturnType<typeof makeAuth>;
vi.mock("@/lib/auth-context", () => ({ useAuth: () => authValue }));

vi.mock("@/lib/data", () => ({
  getMatches: vi.fn(),
  getPlayers: vi.fn(),
  getMatchRequests: vi.fn(),
  createMatchRequest: vi.fn(),
  updateMatchRequest: vi.fn(),
  createGroupConversation: vi.fn(),
  addContact: vi.fn(),
}));

import {
  getMatches,
  getPlayers,
  getMatchRequests,
  createMatchRequest,
  updateMatchRequest,
  createGroupConversation,
  addContact,
} from "@/lib/data";
import DashboardPage from "./page";

const self = makePlayer({ id: "u_self" });

// Mutable fixtures the mocked data layer serves; tests seed these.
let playersData: Player[];
let matchesData: Match[];
let requestsData: MatchRequest[];

beforeEach(() => {
  vi.clearAllMocks();
  authValue = makeAuth(self);
  playersData = [self];
  matchesData = [];
  requestsData = [];

  vi.mocked(getMatches).mockImplementation(async () => [...matchesData]);
  vi.mocked(getPlayers).mockImplementation(async () => [...playersData]);
  vi.mocked(getMatchRequests).mockImplementation(async () => [...requestsData]);
  vi.mocked(createMatchRequest).mockImplementation(async (data) => {
    requestsData.push({ id: `mr_${requestsData.length}`, ...data });
    return `mr_${requestsData.length - 1}`;
  });
  vi.mocked(updateMatchRequest).mockImplementation(async (id, data) => {
    const req = requestsData.find((r) => r.id === id);
    if (req) Object.assign(req, data);
  });
  vi.mocked(createGroupConversation).mockResolvedValue("conv_new");
  vi.mocked(addContact).mockResolvedValue(undefined);
});

describe("DashboardPage", () => {
  it("returns null when no user", () => {
    authValue = makeAuth(null);
    const { container } = render(<DashboardPage />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders greeting and stats after loading", async () => {
    render(<DashboardPage />);
    expect(await screen.findByText(/Welcome back, Self/i)).toBeInTheDocument();
    // matchesPlayed=4, winRate=75%, NTRP 3.5
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("3.5")).toBeInTheDocument();
  });

  it("falls back to 0 for missing numeric fields", async () => {
    const sparse = makePlayer({ matchesPlayed: undefined, wins: undefined, ntrpRating: undefined as unknown as number });
    authValue = makeAuth(sparse);
    playersData = [sparse];
    render(<DashboardPage />);
    await screen.findByText(/Welcome back/i);
    expect(screen.getByText("0%")).toBeInTheDocument(); // win rate 0
    expect(screen.getByText("0.0")).toBeInTheDocument(); // NTRP fallback
  });

  it("shows top matches and lets the user send a request", async () => {
    const other = makePlayer({ id: "u_other", name: "Other Person", firstName: "Other", lastName: "Person" });
    playersData = [self, other];
    render(<DashboardPage />);
    expect(await screen.findByText("Your Top Matches")).toBeInTheDocument();
    expect(await screen.findByText(/Other Person/i)).toBeInTheDocument();
    const matchBtn = await screen.findByRole("button", { name: /Match/i });
    const user = userEvent.setup();
    await user.click(matchBtn);
    // After sending, the row shows a "Requested" badge and creates a request.
    await waitFor(() => expect(screen.getByText("Requested")).toBeInTheDocument());
    expect(createMatchRequest).toHaveBeenCalledWith(
      expect.objectContaining({ fromUserId: "u_self", toUserId: "u_other", status: "pending" })
    );
  });

  it("shows a received request and accepts it (creates the group chat)", async () => {
    const from = makePlayer({ id: "u_from", name: "From Guy", firstName: "From" });
    playersData = [self, from];
    requestsData = [
      { id: "mr1", fromUserId: "u_from", toUserId: "u_self", status: "pending", score: 88, createdAt: new Date().toISOString() },
    ];
    render(<DashboardPage />);
    expect(await screen.findByText("New Match Requests")).toBeInTheDocument();
    expect(screen.getByText("From Guy")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Accept/i }));

    // A group conversation is created for the two players and the request is
    // marked accepted with that conversation attached.
    await waitFor(() => {
      expect(createGroupConversation).toHaveBeenCalledWith(
        ["u_from", "u_self"],
        "",
        expect.stringContaining("From"),
        expect.any(String),
        "u_self"
      );
      expect(updateMatchRequest).toHaveBeenCalledWith("mr1", { status: "accepted", conversationId: "conv_new" });
    });
    // Both players get each other as contacts.
    expect(addContact).toHaveBeenCalledWith("u_self", expect.objectContaining({ id: "u_from" }));
    expect(addContact).toHaveBeenCalledWith("u_from", expect.objectContaining({ id: "u_self" }));
    // The accepted request now renders in the Accepted Matches section.
    expect(await screen.findByText("Accepted Matches")).toBeInTheDocument();
  });

  it("declines a received request", async () => {
    const from = makePlayer({ id: "u_from2", name: "From Two", firstName: "FromTwo" });
    playersData = [self, from];
    requestsData = [
      { id: "mr2", fromUserId: "u_from2", toUserId: "u_self", status: "pending", score: 70, createdAt: new Date().toISOString() },
    ];
    render(<DashboardPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Decline/i }));
    await waitFor(() => {
      expect(updateMatchRequest).toHaveBeenCalledWith("mr2", { status: "declined" });
    });
    expect(createGroupConversation).not.toHaveBeenCalled();
  });

  it("shows pending sent and accepted request sections", async () => {
    const a = makePlayer({ id: "u_a", name: "Player A", firstName: "PA" });
    const b = makePlayer({ id: "u_b", name: "Player B", firstName: "PB" });
    playersData = [self, a, b];
    requestsData = [
      { id: "sent1", fromUserId: "u_self", toUserId: "u_a", status: "pending", score: 60, createdAt: new Date().toISOString() },
      { id: "acc1", fromUserId: "u_self", toUserId: "u_b", status: "accepted", score: 90, createdAt: new Date().toISOString(), conversationId: "direct_u_b_u_self" },
    ];
    render(<DashboardPage />);
    expect(await screen.findByText("Pending Requests")).toBeInTheDocument();
    expect(screen.getByText("Player A")).toBeInTheDocument();
    expect(screen.getByText("Accepted Matches")).toBeInTheDocument();
    expect(screen.getByText("Player B")).toBeInTheDocument();
    // The accepted match with a conversationId renders a Chat link.
    expect(screen.getByRole("link", { name: /Chat/i })).toBeInTheDocument();
  });

  it("renders upcoming and completed matches", async () => {
    const opp = makePlayer({ id: "u_opp", name: "Opponent X" });
    playersData = [self, opp];
    matchesData = [
      { id: "m1", player1Id: "u_self", player2Id: "u_opp", date: "2026-08-01", time: "10:00", location: "Court 1", sport: "tennis", status: "scheduled", compatibilityScore: 0, matchExplanation: "" },
      { id: "m2", player1Id: "u_self", player2Id: "u_opp", date: "2026-07-01", time: "10:00", location: "Court 2", sport: "tennis", status: "completed", score: "6-4", compatibilityScore: 0, matchExplanation: "" },
    ];
    render(<DashboardPage />);
    expect(await screen.findByText("Upcoming Matches")).toBeInTheDocument();
    expect(screen.getAllByText("Opponent X").length).toBeGreaterThan(0);
    expect(screen.getByText("6-4")).toBeInTheDocument();
  });
});
