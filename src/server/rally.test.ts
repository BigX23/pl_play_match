// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const conversationContext = vi.fn();
const insertRallyMessage = vi.fn();
vi.mock("./data", () => ({
  conversationContext: (...a: unknown[]) => conversationContext(...a),
  insertRallyMessage: (...a: unknown[]) => insertRallyMessage(...a),
}));

import { maybeReplyAsRally } from "./rally";

const db = {} as never;

beforeEach(() => {
  conversationContext.mockReset();
  insertRallyMessage.mockReset().mockResolvedValue(undefined);
  vi.unstubAllGlobals();
});

describe("maybeReplyAsRally", () => {
  it("no-ops when the message doesn't address Rally", async () => {
    await maybeReplyAsRally(db, "c1", "great match today");
    expect(conversationContext).not.toHaveBeenCalled();
    expect(insertRallyMessage).not.toHaveBeenCalled();
  });

  it("no-ops when Rally isn't a participant", async () => {
    conversationContext.mockResolvedValue({ messages: [], names: {}, hasRally: false });
    await maybeReplyAsRally(db, "c1", "@rally where do we play?");
    expect(insertRallyMessage).not.toHaveBeenCalled();
  });

  it("inserts the Ollama reply (clamped) when Rally is addressed", async () => {
    conversationContext.mockResolvedValue({
      messages: [{ senderId: "u1", text: "@rally where?", senderName: "A", id: "m", conversationId: "c1", createdAt: "", readBy: [] }],
      names: { u1: "Alex" },
      hasRally: true,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: { content: "  Lifetime Activities Pleasanton — (925) 460-8600.  " } }), { status: 200 })
    ));
    await maybeReplyAsRally(db, "c1", "@rally where do we play?");
    expect(insertRallyMessage).toHaveBeenCalledWith(db, "c1", expect.stringContaining("Lifetime Activities Pleasanton"));
  });

  it("falls back to a static reply when Ollama is unavailable", async () => {
    conversationContext.mockResolvedValue({ messages: [], names: {}, hasRally: true });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection refused")));
    await maybeReplyAsRally(db, "c1", "@rally where can we play?");
    // Static "where/court" response mentions the phone number.
    expect(insertRallyMessage).toHaveBeenCalledWith(db, "c1", expect.stringContaining("925"));
  });

  it("falls back to static when Ollama returns a non-200", async () => {
    conversationContext.mockResolvedValue({ messages: [], names: {}, hasRally: true });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("err", { status: 500 })));
    await maybeReplyAsRally(db, "c1", "@rally thanks!");
    expect(insertRallyMessage).toHaveBeenCalled();
  });

  it("swallows errors from the data layer", async () => {
    conversationContext.mockRejectedValue(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(maybeReplyAsRally(db, "c1", "@rally hi")).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
