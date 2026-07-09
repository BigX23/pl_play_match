import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "./firestore";
import {
  players,
  matches,
  conversations,
  messages,
  notifications,
  matchRequests,
  RALLY_USER,
  type Player,
} from "./mock-data";

// These tests exercise the in-memory mock path (isFirebaseConfigured is false
// in the test env because no NEXT_PUBLIC_FIREBASE_* vars are set).

function resetArrays() {
  players.length = 0;
  matches.length = 0;
  conversations.length = 0;
  messages.length = 0;
  notifications.length = 0;
  matchRequests.length = 0;
  fs.__resetMockState();
}

function makePlayer(id: string, extra: Partial<Player> = {}): Player {
  return {
    id,
    name: `Player ${id}`,
    email: `${id}@example.com`,
    ntrpRating: 3.5,
    avatar: "P",
    location: "Pleasanton",
    availability: [],
    preferredTimes: [],
    sport: "tennis",
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    bio: "",
    joinedDate: "2024-01-01",
    ...extra,
  };
}

beforeEach(resetArrays);

describe("users", () => {
  it("getUser / updateUser round-trips", async () => {
    players.push(makePlayer("u1"));
    expect((await fs.getUser("u1"))?.name).toBe("Player u1");
    await fs.updateUser("u1", { name: "Renamed" });
    expect((await fs.getUser("u1"))?.name).toBe("Renamed");
    expect(await fs.getUser("missing")).toBeUndefined();
  });

  it("getPlayers returns all", async () => {
    players.push(makePlayer("a"), makePlayer("b"));
    expect(await fs.getPlayers()).toHaveLength(2);
  });

  it("setUserPrivate / getUserPrivate keeps data off the public player", async () => {
    players.push(makePlayer("u1"));
    await fs.setUserPrivate("u1", { fcmToken: "tok" });
    expect(await fs.getUserPrivate("u1")).toEqual({ fcmToken: "tok" });
    // Not leaked onto the public doc:
    expect((await fs.getUser("u1")) as unknown as { fcmToken?: string }).not.toHaveProperty("fcmToken");
  });
});

describe("direct conversations", () => {
  it("uses a deterministic id and is idempotent", async () => {
    const id1 = await fs.createDirectConversation("a", "b", "A", "B");
    const id2 = await fs.createDirectConversation("b", "a", "B", "A"); // reversed
    expect(id1).toBe(id2);
    expect(id1).toBe(fs.directConversationId("a", "b"));
    expect(conversations).toHaveLength(1);
  });

  it("findDirectConversation locates it", async () => {
    await fs.createDirectConversation("a", "b", "A", "B");
    expect((await fs.findDirectConversation("a", "b"))?.participants).toContain("a");
    expect(await fs.findDirectConversation("a", "zzz")).toBeUndefined();
  });
});

describe("group conversations + messages + unread", () => {
  it("creates a group with Rally, an intro message, and per-user unread", async () => {
    const convId = await fs.createGroupConversation(["a", "b"], "match1", "Match: A vs B", "welcome", "a");
    const conv = await fs.getConversation(convId);
    expect(conv?.participants).toContain(RALLY_USER.id);
    expect(conv?.type).toBe("group");
    // creator "a" starts at 0 unread, "b" at 1 (the intro).
    expect(conv?.unread["a"]).toBe(0);
    expect(conv?.unread["b"]).toBe(1);
    const msgs = await fs.getMessages(convId);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].isAI).toBe(true);
  });

  it("sendMessage increments unread for others, not the sender, and never for Rally", async () => {
    const convId = await fs.createGroupConversation(["a", "b"], "m", "grp", "hi", "a");
    await fs.markConversationRead(convId, "b"); // clear the intro unread
    await fs.sendMessage(convId, "hello", "a", "Alex");
    const conv = await fs.getConversation(convId);
    expect(conv?.unread["a"]).toBe(0); // sender
    expect(conv?.unread["b"]).toBe(1); // recipient
    expect(conv?.unread[RALLY_USER.id]).toBeUndefined();
    expect(conv?.lastMessage).toBe("hello");
  });

  it("persists isAI when sending an AI message", async () => {
    const convId = await fs.createGroupConversation(["a", "b"], "m", "grp", "hi", "a");
    await fs.sendMessage(convId, "beep", RALLY_USER.id, "Rally", true);
    const msgs = await fs.getMessages(convId);
    expect(msgs[msgs.length - 1].isAI).toBe(true);
  });

  it("markConversationRead zeroes the user's unread", async () => {
    const convId = await fs.createGroupConversation(["a", "b"], "m", "grp", "hi", "a");
    await fs.markConversationRead(convId, "b");
    expect((await fs.getConversation(convId))?.unread["b"]).toBe(0);
  });

  it("getTotalUnread sums across conversations", async () => {
    const c1 = await fs.createGroupConversation(["a", "b"], "m1", "g1", "hi", "a");
    const c2 = await fs.createGroupConversation(["a", "b"], "m2", "g2", "hi", "a");
    await fs.sendMessage(c1, "x", "b", "B");
    await fs.sendMessage(c2, "y", "b", "B");
    expect(await fs.getTotalUnread("a")).toBe(2);
  });

  it("message ids are unique even when created rapidly", async () => {
    const convId = await fs.createGroupConversation(["a", "b"], "m", "g", "hi", "a");
    await Promise.all([
      fs.sendMessage(convId, "1", "a", "A"),
      fs.sendMessage(convId, "2", "a", "A"),
      fs.sendMessage(convId, "3", "a", "A"),
    ]);
    const ids = (await fs.getMessages(convId)).map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("subscriptions (mock pub/sub)", () => {
  it("subscribeMessages emits initial and on new message", async () => {
    const convId = await fs.createGroupConversation(["a", "b"], "m", "g", "hi", "a");
    const seen: number[] = [];
    const unsub = fs.subscribeMessages(convId, (m) => seen.push(m.length));
    await fs.sendMessage(convId, "next", "b", "B");
    unsub();
    await fs.sendMessage(convId, "after-unsub", "b", "B");
    expect(seen[0]).toBe(1); // initial (intro)
    expect(seen[seen.length - 1]).toBe(2); // after one more
    expect(Math.max(...seen)).toBe(2); // no update after unsub
  });

  it("subscribeConversations reflects new conversations and unread", async () => {
    const seen: number[] = [];
    const unsub = fs.subscribeConversations("a", (c) => seen.push(c.length));
    await fs.createGroupConversation(["a", "b"], "m", "g", "hi", "a");
    unsub();
    expect(seen[seen.length - 1]).toBe(1);
  });
});

describe("deleteConversation", () => {
  it("removes the conversation and its messages", async () => {
    const convId = await fs.createGroupConversation(["a", "b"], "m", "g", "hi", "a");
    await fs.sendMessage(convId, "x", "a", "A");
    await fs.deleteConversation(convId);
    expect(await fs.getConversation(convId)).toBeUndefined();
    expect(await fs.getMessages(convId)).toHaveLength(0);
  });
});

describe("matches", () => {
  it("createMatch stamps participants and returns id", async () => {
    const id = await fs.createMatch({ player1Id: "a", player2Id: "", date: "", time: "", location: "", sport: "tennis", status: "open", compatibilityScore: 0, matchExplanation: "" } as Parameters<typeof fs.createMatch>[0]);
    const all = await fs.getMatches();
    expect(all.find((m) => m.id === id)?.participants).toEqual(["a"]);
  });

  it("getMatches filters by participant", async () => {
    await fs.createMatch({ player1Id: "a", player2Id: "b", date: "", time: "", location: "", sport: "tennis", status: "open", compatibilityScore: 0, matchExplanation: "" } as Parameters<typeof fs.createMatch>[0]);
    expect(await fs.getMatches("a")).toHaveLength(1);
    expect(await fs.getMatches("zzz")).toHaveLength(0);
  });

  it("updateMatch mutates fields; deleteMatch removes", async () => {
    const id = await fs.createMatch({ player1Id: "a", player2Id: "", date: "", time: "", location: "", sport: "tennis", status: "open", compatibilityScore: 0, matchExplanation: "" } as Parameters<typeof fs.createMatch>[0]);
    await fs.updateMatch(id, { status: "confirmed" });
    expect((await fs.getMatches()).find((m) => m.id === id)?.status).toBe("confirmed");
    await fs.deleteMatch(id);
    expect(await fs.getMatches()).toHaveLength(0);
  });

  it("joinOpenMatch succeeds once and rejects a second joiner", async () => {
    const id = await fs.createMatch({ player1Id: "a", player2Id: "", date: "", time: "", location: "", sport: "tennis", status: "open", compatibilityScore: 0, matchExplanation: "" } as Parameters<typeof fs.createMatch>[0]);
    expect(await fs.joinOpenMatch(id, "b")).toBe(true);
    expect(await fs.joinOpenMatch(id, "c")).toBe(false); // already taken
    const m = (await fs.getMatches()).find((x) => x.id === id)!;
    expect(m.player2Id).toBe("b");
    expect(m.status).toBe("pending");
  });

  it("joinOpenMatch returns false for a missing match", async () => {
    expect(await fs.joinOpenMatch("nope", "b")).toBe(false);
  });
});

describe("contacts", () => {
  it("add / get / remove and de-dupes", async () => {
    await fs.addContact("u1", { id: "c1", name: "C", addedAt: "" });
    await fs.addContact("u1", { id: "c1", name: "C-dup", addedAt: "" });
    expect(await fs.getContacts("u1")).toHaveLength(1);
    await fs.removeContact("u1", "c1");
    expect(await fs.getContacts("u1")).toHaveLength(0);
    await fs.removeContact("u1", "missing"); // no-op, no throw
  });
});

describe("notifications", () => {
  it("getNotifications filters by user and sorts newest first", async () => {
    await fs.createNotification({ userId: "u1", type: "new_message", title: "old", body: "", read: false, createdAt: "2024-01-01T00:00:00Z" });
    await fs.createNotification({ userId: "u1", type: "new_message", title: "new", body: "", read: false, createdAt: "2025-01-01T00:00:00Z" });
    await fs.createNotification({ userId: "other", type: "new_message", title: "x", body: "", read: false, createdAt: "2025-01-01T00:00:00Z" });
    const ns = await fs.getNotifications("u1");
    expect(ns).toHaveLength(2);
    expect(ns[0].title).toBe("new");
  });

  it("markNotificationRead flips the flag", async () => {
    await fs.createNotification({ userId: "u1", type: "new_message", title: "t", body: "", read: false, createdAt: "2025-01-01T00:00:00Z" });
    const id = (await fs.getNotifications("u1"))[0].id;
    await fs.markNotificationRead(id);
    expect((await fs.getNotifications("u1"))[0].read).toBe(true);
  });
});

describe("match requests", () => {
  it("createMatchRequest also creates a recipient notification", async () => {
    const id = await fs.createMatchRequest({ fromUserId: "a", toUserId: "b", status: "pending", score: 80, createdAt: "2025-01-01T00:00:00Z" });
    expect(id).toBeTruthy();
    const ns = await fs.getNotifications("b");
    expect(ns[0].type).toBe("match_request");
  });

  it("getMatchRequests returns sent and received; updateMatchRequest mutates", async () => {
    const id = await fs.createMatchRequest({ fromUserId: "a", toUserId: "b", status: "pending", score: 80, createdAt: "2025-01-01T00:00:00Z" });
    expect(await fs.getMatchRequests("a")).toHaveLength(1);
    expect(await fs.getMatchRequests("b")).toHaveLength(1);
    await fs.updateMatchRequest(id, { status: "accepted" });
    expect((await fs.getMatchRequests("a"))[0].status).toBe("accepted");
  });
});

describe("createConversation legacy helper", () => {
  it("delegates to createGroupConversation", async () => {
    const id = await fs.createConversation(["a", "b"], "intro");
    expect((await fs.getConversation(id))?.type).toBe("group");
  });
});
