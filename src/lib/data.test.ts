import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getUser,
  updateUser,
  getPlayers,
  findPlayerByEmail,
  getMatches,
  createMatch,
  updateMatch,
  deleteMatch,
  joinOpenMatch,
  getMatchRequests,
  createMatchRequest,
  updateMatchRequest,
  directConversationId,
  getConversations,
  subscribeConversations,
  getConversation,
  findDirectConversation,
  createDirectConversation,
  createGroupConversation,
  deleteConversation,
  markConversationRead,
  getTotalUnread,
  getMessages,
  subscribeMessages,
  sendMessage,
  getContacts,
  addContact,
  removeContact,
  getNotifications,
  markNotificationRead,
} from "./data";
import type { Conversation, Match, Message } from "./mock-data";

const fetchMock = vi.fn();

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) } as Response;
}

function errorResponse(status = 500) {
  return { ok: false, status, json: () => Promise.resolve({}) } as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** The [url, init] pair of the most recent fetch call. */
function lastCall(): [string, RequestInit | undefined] {
  const call = fetchMock.mock.calls.at(-1);
  return [call![0] as string, call![1] as RequestInit | undefined];
}

describe("users / players", () => {
  it("getUser GETs /api/players/:id with no-store and returns the player", async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ id: "u1", name: "Ann" }));
    const player = await getUser("u1");
    expect(player).toEqual({ id: "u1", name: "Ann" });
    expect(lastCall()).toEqual(["/api/players/u1", { cache: "no-store" }]);
  });

  it("getUser encodes the id and returns undefined on failure", async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(404));
    const player = await getUser("u 1/x");
    expect(player).toBeUndefined();
    expect(lastCall()[0]).toBe("/api/players/u%201%2Fx");
  });

  it("updateUser PATCHes /api/me with the profile data (ignoring the legacy userId)", async () => {
    fetchMock.mockResolvedValueOnce(okResponse({}));
    await updateUser("legacy-id", { firstName: "New" });
    const [url, init] = lastCall();
    expect(url).toBe("/api/me");
    expect(init?.method).toBe("PATCH");
    expect(init?.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init?.body as string)).toEqual({ firstName: "New" });
  });

  it("updateUser throws on a non-ok response", async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(403));
    await expect(updateUser("x", {})).rejects.toThrow("PATCH /api/me → 403");
  });

  it("getPlayers GETs /api/players and returns the list", async () => {
    fetchMock.mockResolvedValueOnce(okResponse([{ id: "a" }, { id: "b" }]));
    await expect(getPlayers()).resolves.toHaveLength(2);
    expect(lastCall()[0]).toBe("/api/players");
  });

  it("getPlayers throws on failure", async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(500));
    await expect(getPlayers()).rejects.toThrow("GET /api/players → 500");
  });

  it("findPlayerByEmail GETs the lookup endpoint with an encoded email", async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ id: "u2" }));
    const found = await findPlayerByEmail("a+b@x.com");
    expect(found).toEqual({ id: "u2" });
    expect(lastCall()[0]).toBe("/api/players/lookup?email=a%2Bb%40x.com");
  });

  it("findPlayerByEmail returns undefined on failure", async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(404));
    await expect(findPlayerByEmail("nobody@x.com")).resolves.toBeUndefined();
  });
});

describe("matches", () => {
  it("getMatches uses ?mine=1 when a userId is passed and plain URL otherwise", async () => {
    fetchMock.mockResolvedValue(okResponse([]));
    await getMatches("me");
    expect(lastCall()[0]).toBe("/api/matches?mine=1");
    await getMatches();
    expect(lastCall()[0]).toBe("/api/matches");
  });

  it("createMatch POSTs the match and returns the created id", async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ id: "m9" }));
    const data = { player1Id: "me", sport: "tennis" } as unknown as Omit<Match, "id">;
    await expect(createMatch(data)).resolves.toBe("m9");
    const [url, init] = lastCall();
    expect(url).toBe("/api/matches");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ player1Id: "me", sport: "tennis" });
  });

  it("updateMatch PATCHes /api/matches/:id including extra fields like winnerId", async () => {
    fetchMock.mockResolvedValueOnce(okResponse({}));
    await updateMatch("m1", { status: "completed", score: "6-4", winnerId: "me" });
    const [url, init] = lastCall();
    expect(url).toBe("/api/matches/m1");
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(init?.body as string)).toEqual({ status: "completed", score: "6-4", winnerId: "me" });
  });

  it("deleteMatch DELETEs /api/matches/:id without a body", async () => {
    fetchMock.mockResolvedValueOnce(okResponse({}));
    await deleteMatch("m1");
    const [url, init] = lastCall();
    expect(url).toBe("/api/matches/m1");
    expect(init?.method).toBe("DELETE");
    expect(init?.body).toBeUndefined();
    expect(init?.headers).toBeUndefined();
  });

  it("joinOpenMatch POSTs .../join and returns the joined flag", async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ joined: true }));
    await expect(joinOpenMatch("m1", "ignored")).resolves.toBe(true);
    const [url, init] = lastCall();
    expect(url).toBe("/api/matches/m1/join");
    expect(init?.method).toBe("POST");

    fetchMock.mockResolvedValueOnce(okResponse({ joined: false }));
    await expect(joinOpenMatch("m1", "ignored")).resolves.toBe(false);
  });

  it("joinOpenMatch throws on failure", async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(409));
    await expect(joinOpenMatch("m1", "me")).rejects.toThrow("POST /api/matches/m1/join → 409");
  });
});

describe("match requests", () => {
  it("getMatchRequests GETs /api/match-requests", async () => {
    fetchMock.mockResolvedValueOnce(okResponse([]));
    await getMatchRequests("ignored");
    expect(lastCall()[0]).toBe("/api/match-requests");
  });

  it("createMatchRequest POSTs only toUserId and score and returns the id", async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ id: "r1" }));
    const id = await createMatchRequest({
      fromUserId: "me",
      toUserId: "them",
      status: "pending",
      score: 88,
      createdAt: "2026-01-01",
    });
    expect(id).toBe("r1");
    const [url, init] = lastCall();
    expect(url).toBe("/api/match-requests");
    expect(JSON.parse(init?.body as string)).toEqual({ toUserId: "them", score: 88 });
  });

  it("updateMatchRequest PATCHes /api/match-requests/:id", async () => {
    fetchMock.mockResolvedValueOnce(okResponse({}));
    await updateMatchRequest("r1", { status: "accepted" });
    const [url, init] = lastCall();
    expect(url).toBe("/api/match-requests/r1");
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(init?.body as string)).toEqual({ status: "accepted" });
  });
});

describe("conversations", () => {
  it("directConversationId sorts the two user ids", () => {
    expect(directConversationId("b", "a")).toBe("direct_a_b");
    expect(directConversationId("a", "b")).toBe("direct_a_b");
  });

  it("getConversations GETs /api/conversations", async () => {
    fetchMock.mockResolvedValueOnce(okResponse([{ id: "c1" }]));
    await expect(getConversations("ignored")).resolves.toEqual([{ id: "c1" }]);
    expect(lastCall()[0]).toBe("/api/conversations");
  });

  it("getConversation returns the conversation, or undefined on failure", async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ id: "c1" }));
    await expect(getConversation("c1")).resolves.toEqual({ id: "c1" });
    expect(lastCall()[0]).toBe("/api/conversations/c1");

    fetchMock.mockResolvedValueOnce(errorResponse(404));
    await expect(getConversation("missing")).resolves.toBeUndefined();
  });

  it("findDirectConversation looks up the sorted direct conversation id", async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ id: "direct_a_b" }));
    await expect(findDirectConversation("b", "a")).resolves.toEqual({ id: "direct_a_b" });
    expect(lastCall()[0]).toBe("/api/conversations/direct_a_b");
  });

  it("createDirectConversation POSTs a direct conversation and returns its id", async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ id: "direct_me_them" }));
    const id = await createDirectConversation("me", "them", "My Name", "Their Name");
    expect(id).toBe("direct_me_them");
    const [url, init] = lastCall();
    expect(url).toBe("/api/conversations");
    expect(JSON.parse(init?.body as string)).toEqual({ type: "direct", otherUserId: "them" });
  });

  it("createGroupConversation POSTs the group payload and returns its id", async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ id: "g1" }));
    const id = await createGroupConversation(["a", "b"], "m1", "Match: A vs B", "Welcome!", "a");
    expect(id).toBe("g1");
    const [url, init] = lastCall();
    expect(url).toBe("/api/conversations");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      type: "group",
      participantIds: ["a", "b"],
      matchId: "m1",
      name: "Match: A vs B",
      rallyIntro: "Welcome!",
    });
  });

  it("deleteConversation DELETEs /api/conversations/:id", async () => {
    fetchMock.mockResolvedValueOnce(okResponse({}));
    await deleteConversation("c1");
    const [url, init] = lastCall();
    expect(url).toBe("/api/conversations/c1");
    expect(init?.method).toBe("DELETE");
  });

  it("markConversationRead POSTs .../read without a body", async () => {
    fetchMock.mockResolvedValueOnce(okResponse({}));
    await markConversationRead("c1", "ignored");
    const [url, init] = lastCall();
    expect(url).toBe("/api/conversations/c1/read");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeUndefined();
  });

  it("getTotalUnread sums the user's unread counts across conversations", async () => {
    const convs = [
      { id: "c1", unread: { me: 2, other: 9 } },
      { id: "c2", unread: { me: 3 } },
      { id: "c3", unread: {} },
      { id: "c4" },
    ] as unknown as Conversation[];
    fetchMock.mockResolvedValueOnce(okResponse(convs));
    await expect(getTotalUnread("me")).resolves.toBe(5);
  });
});

describe("messages", () => {
  it("getMessages GETs the conversation messages", async () => {
    fetchMock.mockResolvedValueOnce(okResponse([{ id: "msg1" }]));
    await expect(getMessages("c1")).resolves.toEqual([{ id: "msg1" }]);
    expect(lastCall()[0]).toBe("/api/conversations/c1/messages");
  });

  it("sendMessage POSTs only the text (sender is stamped server-side)", async () => {
    const created = { id: "msg1", text: "hi" } as Message;
    fetchMock.mockResolvedValueOnce(okResponse(created));
    await expect(sendMessage("c1", "hi", "ignored-sender", "Ignored Name", true)).resolves.toEqual(created);
    const [url, init] = lastCall();
    expect(url).toBe("/api/conversations/c1/messages");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ text: "hi" });
  });
});

describe("polling subscriptions", () => {
  it("subscribeMessages fetches immediately, re-polls every 5s, and stops on unsubscribe", async () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    fetchMock.mockResolvedValue(okResponse([{ id: "msg1" }]));

    const unsub = subscribeMessages("c1", cb);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/conversations/c1/messages", { cache: "no-store" });

    await vi.advanceTimersByTimeAsync(0); // flush the initial tick's promise
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith([{ id: "msg1" }]);

    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenCalledTimes(2);

    unsub();
    await vi.advanceTimersByTimeAsync(15000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("subscribeConversations polls /api/conversations on the same 5s cadence", async () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    fetchMock.mockResolvedValue(okResponse([{ id: "c1" }]));

    const unsub = subscribeConversations("ignored", cb);
    expect(fetchMock).toHaveBeenCalledWith("/api/conversations", { cache: "no-store" });

    await vi.advanceTimersByTimeAsync(0);
    expect(cb).toHaveBeenCalledWith([{ id: "c1" }]);

    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    unsub();
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("swallows fetch errors while polling and keeps ticking", async () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    fetchMock.mockResolvedValueOnce(errorResponse(500));
    fetchMock.mockResolvedValue(okResponse([]));

    const unsub = subscribeConversations("me", cb);
    await vi.advanceTimersByTimeAsync(0);
    expect(cb).not.toHaveBeenCalled(); // first tick failed silently

    await vi.advanceTimersByTimeAsync(5000);
    expect(cb).toHaveBeenCalledWith([]);
    unsub();
  });

  it("does not invoke the callback for a fetch that resolves after unsubscribe", async () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    let resolveFetch: (r: Response) => void = () => {};
    fetchMock.mockImplementationOnce(() => new Promise<Response>((res) => { resolveFetch = res; }));

    const unsub = subscribeMessages("c1", cb);
    unsub(); // unsubscribe while the initial fetch is still in flight
    resolveFetch(okResponse([{ id: "late" }]));
    await vi.advanceTimersByTimeAsync(0);
    expect(cb).not.toHaveBeenCalled();
  });
});

describe("contacts", () => {
  it("getContacts GETs /api/contacts", async () => {
    fetchMock.mockResolvedValueOnce(okResponse([]));
    await getContacts("ignored");
    expect(lastCall()[0]).toBe("/api/contacts");
  });

  it("addContact POSTs the contact payload", async () => {
    fetchMock.mockResolvedValueOnce(okResponse({}));
    const contact = { id: "c1", name: "Ann", addedAt: "2026-01-01" };
    await addContact("ignored", contact);
    const [url, init] = lastCall();
    expect(url).toBe("/api/contacts");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual(contact);
  });

  it("removeContact DELETEs /api/contacts/:id", async () => {
    fetchMock.mockResolvedValueOnce(okResponse({}));
    await removeContact("ignored", "c1");
    const [url, init] = lastCall();
    expect(url).toBe("/api/contacts/c1");
    expect(init?.method).toBe("DELETE");
  });
});

describe("notifications", () => {
  it("getNotifications GETs /api/notifications", async () => {
    fetchMock.mockResolvedValueOnce(okResponse([]));
    await getNotifications("ignored");
    expect(lastCall()[0]).toBe("/api/notifications");
  });

  it("markNotificationRead PATCHes /api/notifications/:id without a body", async () => {
    fetchMock.mockResolvedValueOnce(okResponse({}));
    await markNotificationRead("n1");
    const [url, init] = lastCall();
    expect(url).toBe("/api/notifications/n1");
    expect(init?.method).toBe("PATCH");
    expect(init?.body).toBeUndefined();
  });
});
