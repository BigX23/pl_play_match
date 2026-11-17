import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ShareGameButton, openGameShareContent } from "./share-game-button";
import type { Match } from "@/lib/mock-data";

const share = vi.hoisted(() => vi.fn(async () => true));
const canShare = vi.hoisted(() => vi.fn(() => false));
vi.mock("@/lib/share", () => ({ share, canShare }));

const match = {
  id: "m1",
  sport: "tennis",
  matchType: "singles",
  date: "2026-11-20",
  time: "6:00 PM",
  location: "Pleasanton Tennis Center",
  status: "open",
} as unknown as Match;

afterEach(() => {
  share.mockClear();
  canShare.mockReset();
});

describe("openGameShareContent", () => {
  it("describes the game and links to open games", () => {
    expect(openGameShareContent(match, "https://aiplaymatch.com")).toEqual({
      title: "Join my game on PlayMatch",
      text: "Looking for a tennis singles partner: 2026-11-20 at 6:00 PM, Pleasanton Tennis Center. Join me on PlayMatch!",
      url: "https://aiplaymatch.com/dashboard/open-games",
    });
  });
});

describe("ShareGameButton", () => {
  it("renders nothing where sharing isn't available", () => {
    canShare.mockReturnValue(false);
    const { container } = render(<ShareGameButton match={match} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("opens the share sheet", () => {
    canShare.mockReturnValue(true);
    render(<ShareGameButton match={match} />);
    fireEvent.click(screen.getByRole("button", { name: /share game/i }));
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: `${window.location.origin}/dashboard/open-games` }));
  });
});
