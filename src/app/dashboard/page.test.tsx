import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { players, matchRequests, matches, conversations, messages, notifications } from "@/lib/mock-data";
import { __resetMockState } from "@/lib/firestore";
import { makePlayer, makeAuth } from "../test-fixtures";

let authValue: ReturnType<typeof makeAuth>;
vi.mock("@/lib/auth-context", () => ({ useAuth: () => authValue }));

import DashboardPage from "./page";

const self = makePlayer({ id: "u_self" });

function resetData() {
  players.length = 0;
  matchRequests.length = 0;
  matches.length = 0;
  conversations.length = 0;
  messages.length = 0;
  notifications.length = 0;
  __resetMockState();
}

beforeEach(() => {
  resetData();
  authValue = makeAuth(self);
});

describe("DashboardPage", () => {
  it("returns null when no user", () => {
    authValue = makeAuth(null);
    const { container } = render(<DashboardPage />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders greeting and stats after loading", async () => {
    players.push(self);
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
    players.push(sparse);
    render(<DashboardPage />);
    await screen.findByText(/Welcome back/i);
    expect(screen.getByText("0%")).toBeInTheDocument(); // win rate 0
    expect(screen.getByText("0.0")).toBeInTheDocument(); // NTRP fallback
  });

  it("shows top matches and lets the user send a request", async () => {
    const other = makePlayer({ id: "u_other", name: "Other Person", firstName: "Other", lastName: "Person" });
    players.push(self, other);
    render(<DashboardPage />);
    expect(await screen.findByText("Your Top Matches")).toBeInTheDocument();
    expect(await screen.findByText(/Other Person/i)).toBeInTheDocument();
    const matchBtn = await screen.findByRole("button", { name: /Match/i });
    const user = userEvent.setup();
    await user.click(matchBtn);
    // After sending, the row shows a "Requested" badge and creates a request.
    await waitFor(() => expect(screen.getByText("Requested")).toBeInTheDocument());
    expect(matchRequests.length).toBe(1);
  });

  it("shows a received request and accepts it (button disables while acting)", async () => {
    const from = makePlayer({ id: "u_from", name: "From Guy", firstName: "From" });
    players.push(self, from);
    matchRequests.push({
      id: "mr1", fromUserId: "u_from", toUserId: "u_self", status: "pending", score: 88, createdAt: new Date().toISOString(),
    });
    render(<DashboardPage />);
    expect(await screen.findByText("New Match Requests")).toBeInTheDocument();
    expect(screen.getByText("From Guy")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Accept/i }));
    await waitFor(() => {
      const req = matchRequests.find((r) => r.id === "mr1");
      expect(req?.status).toBe("accepted");
    });
    // A group conversation was created for the accepted request.
    expect(conversations.length).toBeGreaterThan(0);
  });

  it("declines a received request", async () => {
    const from = makePlayer({ id: "u_from2", name: "From Two", firstName: "FromTwo" });
    players.push(self, from);
    matchRequests.push({
      id: "mr2", fromUserId: "u_from2", toUserId: "u_self", status: "pending", score: 70, createdAt: new Date().toISOString(),
    });
    render(<DashboardPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Decline/i }));
    await waitFor(() => {
      expect(matchRequests.find((r) => r.id === "mr2")?.status).toBe("declined");
    });
  });

  it("shows pending sent and accepted request sections", async () => {
    const a = makePlayer({ id: "u_a", name: "Player A", firstName: "PA" });
    const b = makePlayer({ id: "u_b", name: "Player B", firstName: "PB" });
    players.push(self, a, b);
    matchRequests.push(
      { id: "sent1", fromUserId: "u_self", toUserId: "u_a", status: "pending", score: 60, createdAt: new Date().toISOString() },
      { id: "acc1", fromUserId: "u_self", toUserId: "u_b", status: "accepted", score: 90, createdAt: new Date().toISOString(), conversationId: "direct_u_b_u_self" },
    );
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
    players.push(self, opp);
    matches.push(
      { id: "m1", player1Id: "u_self", player2Id: "u_opp", date: "2026-08-01", time: "10:00", location: "Court 1", sport: "tennis", status: "scheduled", compatibilityScore: 0, matchExplanation: "" },
      { id: "m2", player1Id: "u_self", player2Id: "u_opp", date: "2026-07-01", time: "10:00", location: "Court 2", sport: "tennis", status: "completed", score: "6-4", compatibilityScore: 0, matchExplanation: "" },
    );
    render(<DashboardPage />);
    expect(await screen.findByText("Upcoming Matches")).toBeInTheDocument();
    expect(screen.getAllByText("Opponent X").length).toBeGreaterThan(0);
    expect(screen.getByText("6-4")).toBeInTheDocument();
  });
});
