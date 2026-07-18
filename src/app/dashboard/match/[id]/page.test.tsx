import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Compatibility } from "@/lib/data";
import { makePlayer, makeAuth } from "../../../test-fixtures";

const pushMock = vi.fn();
let currentPath = "/dashboard/match/u_jill";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => currentPath,
}));

const me = makePlayer({ id: "me" });
vi.mock("@/lib/auth-context", () => ({ useAuth: () => makeAuth(me) }));

vi.mock("@/lib/data", () => ({
  getCompatibility: vi.fn(),
  createMatchRequest: vi.fn(),
}));

import { getCompatibility, createMatchRequest } from "@/lib/data";
import MatchDetailPage from "./page";

function makeData(): Compatibility {
  return {
    player: { id: "u_jill", name: "Jill W.", firstName: "Jill", ageBracket: "45 - 50", sports: ["Tennis"], avatar: "🏃", ntrpRating: 3.5 } as unknown as Compatibility["player"],
    score: 68,
    factors: [
      { key: "sport", label: "Sport", weight: 20, score: 1, state: "match", you: "Tennis", them: "Tennis" },
      { key: "gender", label: "Partner Gender", weight: 10, score: 0, state: "miss", you: "No preference", them: "Prefers women" },
    ],
    grid: {
      days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      periods: [{ key: "evening", label: "Evening" }],
      cells: {
        morning: ["none", "none", "none", "none", "none", "none", "none"],
        afternoon: ["none", "none", "none", "none", "none", "none", "none"],
        evening: ["none", "both", "none", "none", "none", "none", "none"],
      },
      sharedCount: 1,
    } as Compatibility["grid"],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  currentPath = "/dashboard/match/u_jill";
  vi.mocked(getCompatibility).mockResolvedValue(makeData());
  vi.mocked(createMatchRequest).mockResolvedValue("mr_1");
});

describe("MatchDetailPage", () => {
  it("loads and renders the compatibility breakdown", async () => {
    render(<MatchDetailPage />);
    expect(await screen.findByText("Jill W.")).toBeInTheDocument();
    expect(screen.getByText("68%")).toBeInTheDocument();
    expect(getCompatibility).toHaveBeenCalledWith("u_jill");
  });

  it("shows an unavailable state when the fetch fails", async () => {
    vi.mocked(getCompatibility).mockRejectedValueOnce(new Error("404"));
    render(<MatchDetailPage />);
    expect(await screen.findByText(/no longer available/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Back to dashboard/i }));
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });

  it("accepts the match: creates a request and returns to the dashboard", async () => {
    const user = userEvent.setup();
    render(<MatchDetailPage />);
    await screen.findByText("Jill W.");

    await user.click(screen.getByRole("button", { name: /Accept Match/i }));
    await waitFor(() =>
      expect(createMatchRequest).toHaveBeenCalledWith(
        expect.objectContaining({ fromUserId: "me", toUserId: "u_jill", status: "pending", score: 68 })
      )
    );
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });

  it("declines and returns to the dashboard without creating a request", async () => {
    const user = userEvent.setup();
    render(<MatchDetailPage />);
    await screen.findByText("Jill W.");

    await user.click(screen.getByRole("button", { name: /Decline/i }));
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
    expect(createMatchRequest).not.toHaveBeenCalled();
  });
});
