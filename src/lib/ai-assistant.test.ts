import { describe, it, expect } from "vitest";
import {
  shouldRallyRespond,
  estimateTokens,
  buildHistory,
  buildRallyPrompt,
  clampWords,
  getStaticResponse,
  getRallyFallbackResponse,
  buildMatchIntro,
  AI_SENDER_ID,
} from "./ai-assistant";
import { type Message } from "./mock-data";

function msg(text: string, senderId = "u1", senderName = "Alex"): Message {
  return { id: "m" + Math.random(), conversationId: "c1", senderId, senderName, text, createdAt: new Date().toISOString(), readBy: [] };
}

describe("shouldRallyRespond", () => {
  it("fires on @rally mention", () => {
    expect(shouldRallyRespond("hey @rally what time?")).toBe(true);
    expect(shouldRallyRespond("@Rally help")).toBe(true);
  });
  it("fires on 'rally,' or 'rally:' address", () => {
    expect(shouldRallyRespond("rally, can you help")).toBe(true);
    expect(shouldRallyRespond("Rally: what courts")).toBe(true);
  });
  it("does NOT fire on casual use", () => {
    expect(shouldRallyRespond("that was a great rally!")).toBe(false);
    expect(shouldRallyRespond("nice rally yesterday")).toBe(false);
  });
});

describe("estimateTokens", () => {
  it("approximates 4 chars per token", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("a".repeat(40))).toBe(10);
  });
});

describe("buildHistory", () => {
  it("returns empty string for no messages", () => {
    expect(buildHistory([], {})).toBe("");
  });
  it("renders in chronological order with names", () => {
    const out = buildHistory([msg("first", "u1"), msg("second", "u2")], { u1: "Alex", u2: "Sam" });
    expect(out).toBe("Alex: first\nSam: second");
  });
  it("labels Rally messages", () => {
    const out = buildHistory([msg("hi", AI_SENDER_ID)], {});
    expect(out).toBe("Rally: hi");
  });
  it("labels unknown senders as User", () => {
    expect(buildHistory([msg("x", "ghost")], {})).toBe("ghost: x".replace("ghost", "User"));
  });
  it("always includes the newest message even if it exceeds the budget", () => {
    const huge = "word ".repeat(50000);
    const out = buildHistory([msg(huge)], { u1: "Alex" });
    expect(out.length).toBeGreaterThan(0);
  });
});

describe("buildRallyPrompt", () => {
  it("wraps history with the reply instruction", () => {
    const p = buildRallyPrompt([msg("hi")], { u1: "Alex" });
    expect(p).toContain("Alex: hi");
    expect(p).toContain("Reply as Rally");
  });
});

describe("clampWords", () => {
  it("passes short text unchanged", () => {
    expect(clampWords("short reply")).toBe("short reply");
  });
  it("truncates long text and appends ellipsis when no sentence boundary", () => {
    const long = Array.from({ length: 120 }, (_, i) => `w${i}`).join(" ");
    const out = clampWords(long, 80);
    expect(out.split(/\s+/).length).toBeLessThanOrEqual(81);
    expect(out.endsWith("…")).toBe(true);
  });
  it("prefers a sentence boundary near the end", () => {
    // A 70-word sentence ending in a period, followed by filler past the cap.
    const sentence = Array.from({ length: 70 }, () => "w").join(" ") + ".";
    const filler = Array.from({ length: 40 }, () => "x").join(" ");
    const out = clampWords(`${sentence} ${filler}`, 85);
    expect(out.endsWith(".")).toBe(true);
  });
});

describe("getStaticResponse", () => {
  it("answers time questions", () => {
    expect(getStaticResponse("what time works?").toLowerCase()).toContain("availability");
  });
  it("answers location/court questions with the phone number", () => {
    expect(getStaticResponse("where is the court")).toContain("925");
  });
  it("answers score prompts", () => {
    expect(getStaticResponse("we won the match").toLowerCase()).toContain("score");
  });
  it("answers cancellations", () => {
    expect(getStaticResponse("I can't make it").toLowerCase()).toContain("reschedule");
  });
  it("answers thanks", () => {
    expect(getStaticResponse("thank you!").toLowerCase()).toContain("anytime");
  });
  it("has a generic fallback", () => {
    expect(getStaticResponse("random text")).toMatch(/help/i);
  });
  it("uses a calm voice (no ALL-CAPS shouting)", () => {
    const responses = ["what time", "where", "score", "cancel", "thanks", "xyz"].map(getStaticResponse);
    for (const r of responses) {
      expect(r).not.toMatch(/LET'S GO|GAME ON|CHAMPION/);
    }
  });
});

describe("getRallyFallbackResponse", () => {
  it("responds based on the last message", () => {
    const out = getRallyFallbackResponse([msg("hi"), msg("where is the court")]);
    expect(out).toContain("925");
  });
  it("returns null for empty history", () => {
    expect(getRallyFallbackResponse([])).toBeNull();
  });
});

describe("buildMatchIntro", () => {
  it("uses first names and stays calm", () => {
    const out = buildMatchIntro("Maya Okonkwo", "Sam Tan");
    expect(out).toContain("Maya");
    expect(out).toContain("Sam");
    expect(out).not.toMatch(/GAME ON|LET'S GO/);
  });
  it("includes match details when provided", () => {
    const out = buildMatchIntro("Maya", "Sam", { sport: "tennis", matchType: "singles", date: "2026-03-01", time: "10:00", location: "Court A" });
    expect(out).toContain("2026-03-01");
    expect(out).toContain("Court A");
    expect(out).toContain("925");
  });
  it("mentions compatibility when only score provided", () => {
    const out = buildMatchIntro("Maya", "Sam", { score: 82 });
    expect(out).toContain("82%");
  });
});
