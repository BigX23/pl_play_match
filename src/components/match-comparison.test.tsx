import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import MatchComparison from "./match-comparison";
import type { Compatibility } from "@/lib/data";
import type { CellState } from "@/lib/availability";

function makeData(): Compatibility {
  const cell = (arr: CellState[]) => arr;
  return {
    // Only the fields the component reads; cast to the Player shape.
    player: {
      id: "u_jill",
      name: "Jill W.",
      firstName: "Jill",
      ageBracket: "45 - 50",
      sports: ["Tennis"],
      location: "Pleasanton",
      avatar: "🏃",
      ntrpRating: 3.5,
    } as unknown as Compatibility["player"],
    score: 68,
    factors: [
      { key: "sport", label: "Sport", weight: 20, score: 1, state: "match", you: "Tennis", them: "Tennis" },
      { key: "ntrp", label: "NTRP Rating", weight: 20, score: 1, state: "match", you: "4.0", them: "3.5" },
      { key: "availability", label: "Availability", weight: 25, score: 0.5, state: "partial", you: "Mon, Tue", them: "Tue, Wed" },
      { key: "gameType", label: "Play Style", weight: 10, score: 0.5, state: "partial", you: "Slightly competitive", them: "Hardcore competitive" },
      { key: "matchFormat", label: "Format", weight: 10, score: 0.5, state: "partial", you: "Singles", them: "Singles & Doubles" },
      { key: "age", label: "Age Preference", weight: 5, score: 1, state: "match", you: "Any age", them: "Within 10 yrs" },
      { key: "gender", label: "Partner Gender", weight: 10, score: 0, state: "miss", you: "No preference", them: "Prefers women" },
    ],
    grid: {
      days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      periods: [
        { key: "morning", label: "Morning" },
        { key: "afternoon", label: "Afternoon" },
        { key: "evening", label: "Evening" },
      ],
      cells: {
        morning: cell(["none", "none", "none", "them", "none", "you", "none"]),
        afternoon: cell(["none", "none", "none", "you", "none", "none", "them"]),
        evening: cell(["you", "both", "them", "both", "none", "none", "none"]),
      },
      sharedCount: 2,
    },
  };
}

describe("MatchComparison", () => {
  it("renders the score, factor table, and availability heatmap", () => {
    render(<MatchComparison data={makeData()} onAccept={vi.fn()} onDecline={vi.fn()} />);

    expect(screen.getByText("68%")).toBeInTheDocument();
    expect(screen.getByText("Jill W.")).toBeInTheDocument();
    expect(screen.getByText(/Age 45 - 50/)).toBeInTheDocument();
    expect(screen.getByText("How the 68% is built")).toBeInTheDocument();

    // Factor rows: labels + both sides' values
    expect(screen.getByText("Sport")).toBeInTheDocument();
    expect(screen.getAllByText("Tennis").length).toBe(2); // you + them
    expect(screen.getByText("Partner Gender")).toBeInTheDocument();
    expect(screen.getByText("Prefers women")).toBeInTheDocument();
    expect(screen.getByText("No preference")).toBeInTheDocument();

    // Availability heatmap summary + at least the shared-slot checks
    expect(screen.getByText("2 shared slots")).toBeInTheDocument();
    expect(screen.getByText("Morning")).toBeInTheDocument();
    expect(screen.getByText("Evening")).toBeInTheDocument();
    // "both" cells + full-match rows both render a ✓
    expect(screen.getAllByText("✓").length).toBeGreaterThanOrEqual(2);
  });

  it("uses singular 'slot' when exactly one shared", () => {
    const data = makeData();
    data.grid.sharedCount = 1;
    render(<MatchComparison data={data} onAccept={vi.fn()} onDecline={vi.fn()} />);
    expect(screen.getByText("1 shared slot")).toBeInTheDocument();
  });

  it("fires the accept and decline handlers", async () => {
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    const user = userEvent.setup();
    render(<MatchComparison data={makeData()} onAccept={onAccept} onDecline={onDecline} />);

    await user.click(screen.getByRole("button", { name: /Accept Match/i }));
    expect(onAccept).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: /Decline/i }));
    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it("disables the actions and shows a busy label while accepting", () => {
    render(<MatchComparison data={makeData()} onAccept={vi.fn()} onDecline={vi.fn()} busy />);
    expect(screen.getByRole("button", { name: /Decline/i })).toBeDisabled();
    const accept = screen.getByRole("button", { name: "…" });
    expect(accept).toBeDisabled();
  });

  it("shows the no-gaps verdict and a fallback avatar when nothing is missed", () => {
    const data = makeData();
    // Every factor matches → no "miss" rows → the positive verdict.
    data.factors = data.factors.map((f) => ({ ...f, state: "match", score: 1 }));
    // Sparse player: no ageBracket, no location, no avatar → meta + avatar fallbacks.
    data.player = { id: "u_x", name: "Sam K.", firstName: "Sam", sports: [] } as unknown as Compatibility["player"];
    render(<MatchComparison data={data} onAccept={vi.fn()} onDecline={vi.fn()} />);
    expect(screen.getByText(/Very few gaps between you/i)).toBeInTheDocument();
    expect(screen.getByText("🎾")).toBeInTheDocument(); // avatar fallback
  });
});
