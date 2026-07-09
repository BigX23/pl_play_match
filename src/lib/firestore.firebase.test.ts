import { describe, it, expect, beforeEach, vi } from "vitest";

// ---- Mock firebase config so isFirebaseConfigured && db is truthy ----
vi.mock("./firebase", () => ({ isFirebaseConfigured: true, db: {} }));

// ---- Mock the firebase/firestore SDK (intercepts dynamic imports) ----
const doc = vi.fn((_db: unknown, ...path: string[]) => ({ __ref: path.join("/") }));
const getDoc = vi.fn();
const setDoc = vi.fn(async (_ref?: unknown, _data?: unknown, _opts?: unknown) => undefined);
const collection = vi.fn((_db: unknown, ...path: string[]) => ({ __col: path.join("/") }));
const getDocs = vi.fn();
const addDoc = vi.fn(async (_ref?: unknown, _data?: unknown) => ({ id: "newDocId" }));
const updateDoc = vi.fn(async (_ref?: unknown, _data?: unknown) => undefined);
const deleteDoc = vi.fn(async (_ref?: unknown) => undefined);
const query = vi.fn((...args: unknown[]) => ({ __query: args }));
const where = vi.fn((...args: unknown[]) => ({ __where: args }));
const orderBy = vi.fn((...args: unknown[]) => ({ __orderBy: args }));
const onSnapshot = vi.fn();
const writeBatch = vi.fn();
const runTransaction = vi.fn();
const serverTimestamp = vi.fn(() => ({ __serverTimestamp: true }));
const increment = vi.fn((n: number) => ({ __increment: n }));

vi.mock("firebase/firestore", () => ({
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  runTransaction,
  serverTimestamp,
  increment,
}));

import * as fs from "./firestore";
import { RALLY_USER } from "./mock-data";

// Helpers for building fake snapshots
function docSnap(exists: boolean, data: Record<string, unknown> = {}, id = "x") {
  return { exists: () => exists, data: () => data, id };
}
function querySnap(docs: Array<{ id: string; data: Record<string, unknown>; ref?: unknown }>) {
  return {
    docs: docs.map((d) => ({ id: d.id, data: () => d.data, ref: d.ref ?? { __ref: d.id } })),
  };
}

const isoTimestamp = { toDate: () => new Date("2023-01-02T03:04:05.000Z") };

beforeEach(() => {
  vi.clearAllMocks();
  // Restore default resolved values that clearAllMocks wipes.
  setDoc.mockResolvedValue(undefined);
  updateDoc.mockResolvedValue(undefined);
  deleteDoc.mockResolvedValue(undefined);
  addDoc.mockResolvedValue({ id: "newDocId" });
  serverTimestamp.mockReturnValue({ __serverTimestamp: true });
  increment.mockImplementation((n: number) => ({ __increment: n }));
  doc.mockImplementation((_db: unknown, ...path: string[]) => ({ __ref: path.join("/") }));
  collection.mockImplementation((_db: unknown, ...path: string[]) => ({ __col: path.join("/") }));
  query.mockImplementation((...args: unknown[]) => ({ __query: args }));
  where.mockImplementation((...args: unknown[]) => ({ __where: args }));
  orderBy.mockImplementation((...args: unknown[]) => ({ __orderBy: args }));
});

describe("firestore Firebase path — users", () => {
  it("getUser returns normalized doc when it exists", async () => {
    getDoc.mockResolvedValue(docSnap(true, { name: "Ann" }, "u1"));
    const u = await fs.getUser("u1");
    expect(doc).toHaveBeenCalledWith({}, "users", "u1");
    expect(u).toEqual({ id: "u1", name: "Ann" });
  });

  it("getUser returns undefined when doc missing", async () => {
    getDoc.mockResolvedValue(docSnap(false));
    expect(await fs.getUser("nope")).toBeUndefined();
  });

  it("updateUser calls setDoc with merge", async () => {
    await fs.updateUser("u1", { name: "Bob" });
    expect(doc).toHaveBeenCalledWith({}, "users", "u1");
    expect(setDoc).toHaveBeenCalledWith({ __ref: "users/u1" }, { name: "Bob" }, { merge: true });
  });

  it("setUserPrivate writes to private subcollection", async () => {
    await fs.setUserPrivate("u1", { email: "a@b.c" });
    expect(doc).toHaveBeenCalledWith({}, "users", "u1", "private", "profile");
    expect(setDoc).toHaveBeenCalledWith(
      { __ref: "users/u1/private/profile" },
      { email: "a@b.c" },
      { merge: true }
    );
  });

  it("getUserPrivate returns data when exists", async () => {
    getDoc.mockResolvedValue(docSnap(true, { email: "a@b.c" }));
    expect(await fs.getUserPrivate("u1")).toEqual({ email: "a@b.c" });
  });

  it("getUserPrivate returns undefined when missing", async () => {
    getDoc.mockResolvedValue(docSnap(false));
    expect(await fs.getUserPrivate("u1")).toBeUndefined();
  });

  it("getPlayers maps docs from users collection", async () => {
    getDocs.mockResolvedValue(querySnap([{ id: "p1", data: { name: "A" } }, { id: "p2", data: { name: "B" } }]));
    const players = await fs.getPlayers();
    expect(collection).toHaveBeenCalledWith({}, "users");
    expect(players).toEqual([{ id: "p1", name: "A" }, { id: "p2", name: "B" }]);
  });
});

describe("firestore Firebase path — matches", () => {
  it("getMatches without userId queries whole collection", async () => {
    getDocs.mockResolvedValue(querySnap([{ id: "m1", data: { status: "open" } }]));
    const m = await fs.getMatches();
    expect(collection).toHaveBeenCalledWith({}, "matches");
    expect(query).not.toHaveBeenCalled();
    expect(m).toEqual([{ id: "m1", status: "open" }]);
  });

  it("getMatches with userId builds an array-contains query", async () => {
    getDocs.mockResolvedValue(querySnap([{ id: "m2", data: {} }]));
    await fs.getMatches("u1");
    expect(where).toHaveBeenCalledWith("participants", "array-contains", "u1");
    expect(query).toHaveBeenCalled();
  });

  it("createMatch addDoc with enriched participants and returns id", async () => {
    const id = await fs.createMatch({ player1Id: "a", player2Id: "b", status: "open" } as never);
    expect(collection).toHaveBeenCalledWith({}, "matches");
    expect(addDoc).toHaveBeenCalled();
    const written = addDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(written.participants).toEqual(["a", "b"]);
    expect(written.createdAt).toBeDefined();
    expect(id).toBe("newDocId");
  });

  it("createMatch with only player1 has single participant", async () => {
    await fs.createMatch({ player1Id: "a", status: "open" } as never);
    const written = addDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(written.participants).toEqual(["a"]);
  });

  it("updateMatch calls updateDoc with updatedAt", async () => {
    await fs.updateMatch("m1", { status: "completed" } as never);
    expect(doc).toHaveBeenCalledWith({}, "matches", "m1");
    const payload = updateDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.status).toBe("completed");
    expect(payload.updatedAt).toBeDefined();
  });

  it("deleteMatch calls deleteDoc", async () => {
    await fs.deleteMatch("m1");
    expect(deleteDoc).toHaveBeenCalledWith({ __ref: "matches/m1" });
  });
});

describe("firestore Firebase path — joinOpenMatch transaction", () => {
  it("succeeds when match is open and unclaimed", async () => {
    const tx = {
      get: vi.fn(async () => docSnap(true, { status: "open", player1Id: "p1" })),
      update: vi.fn(),
    };
    runTransaction.mockImplementation(async (_db: unknown, fn: (t: typeof tx) => Promise<boolean>) => fn(tx));
    const ok = await fs.joinOpenMatch("m1", "p2");
    expect(ok).toBe(true);
    expect(tx.update).toHaveBeenCalled();
    const upd = tx.update.mock.calls[0][1] as Record<string, unknown>;
    expect(upd.player2Id).toBe("p2");
    expect(upd.status).toBe("pending");
  });

  it("fails when match not open", async () => {
    const tx = { get: vi.fn(async () => docSnap(true, { status: "pending", player1Id: "p1" })), update: vi.fn() };
    runTransaction.mockImplementation(async (_db: unknown, fn: (t: typeof tx) => Promise<boolean>) => fn(tx));
    expect(await fs.joinOpenMatch("m1", "p2")).toBe(false);
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("fails when match does not exist", async () => {
    const tx = { get: vi.fn(async () => docSnap(false)), update: vi.fn() };
    runTransaction.mockImplementation(async (_db: unknown, fn: (t: typeof tx) => Promise<boolean>) => fn(tx));
    expect(await fs.joinOpenMatch("m1", "p2")).toBe(false);
  });

  it("fails when match already has player2", async () => {
    const tx = { get: vi.fn(async () => docSnap(true, { status: "open", player1Id: "p1", player2Id: "x" })), update: vi.fn() };
    runTransaction.mockImplementation(async (_db: unknown, fn: (t: typeof tx) => Promise<boolean>) => fn(tx));
    expect(await fs.joinOpenMatch("m1", "p2")).toBe(false);
  });

  it("returns false when transaction throws", async () => {
    runTransaction.mockRejectedValue(new Error("conflict"));
    expect(await fs.joinOpenMatch("m1", "p2")).toBe(false);
  });
});

describe("firestore Firebase path — conversations", () => {
  it("getConversations queries and normalizes timestamps", async () => {
    getDocs.mockResolvedValue(
      querySnap([{ id: "c1", data: { participants: ["u1"], lastMessageAt: isoTimestamp, createdAt: isoTimestamp } }])
    );
    const convs = await fs.getConversations("u1");
    expect(where).toHaveBeenCalledWith("participants", "array-contains", "u1");
    expect(orderBy).toHaveBeenCalledWith("lastMessageAt", "desc");
    expect(convs[0].lastMessageAt).toBe("2023-01-02T03:04:05.000Z");
    expect(convs[0].createdAt).toBe("2023-01-02T03:04:05.000Z");
  });

  it("subscribeConversations wires onSnapshot and returns unsub", async () => {
    let snapCb: ((s: unknown) => void) | undefined;
    const unsubFn = vi.fn();
    onSnapshot.mockImplementation((_q: unknown, cb: (s: unknown) => void) => {
      snapCb = cb;
      return unsubFn;
    });
    const received: unknown[] = [];
    const unsub = fs.subscribeConversations("u1", (c) => received.push(c));
    // let the async IIFE run
    await new Promise((r) => setTimeout(r, 0));
    expect(onSnapshot).toHaveBeenCalled();
    snapCb!(querySnap([{ id: "c1", data: { participants: ["u1"], lastMessageAt: isoTimestamp, createdAt: isoTimestamp } }]));
    expect(received).toHaveLength(1);
    unsub();
    expect(unsubFn).toHaveBeenCalled();
  });

  it("getConversation returns normalized conv when exists", async () => {
    getDoc.mockResolvedValue(docSnap(true, { participants: ["u1"], lastMessageAt: isoTimestamp, createdAt: "2020-01-01T00:00:00.000Z" }, "c1"));
    const c = await fs.getConversation("c1");
    expect(c?.id).toBe("c1");
    expect(c?.createdAt).toBe("2020-01-01T00:00:00.000Z");
  });

  it("getConversation returns undefined when missing", async () => {
    getDoc.mockResolvedValue(docSnap(false));
    expect(await fs.getConversation("c1")).toBeUndefined();
  });

  it("deleteConversation batch-deletes messages and conv", async () => {
    getDocs.mockResolvedValue(querySnap([{ id: "msg1", data: {}, ref: { __ref: "messages/msg1" } }]));
    const batch = { delete: vi.fn(), commit: vi.fn(async () => undefined) };
    writeBatch.mockReturnValue(batch);
    await fs.deleteConversation("c1");
    expect(where).toHaveBeenCalledWith("conversationId", "==", "c1");
    expect(batch.delete).toHaveBeenCalledTimes(2); // one message + the conv doc
    expect(batch.commit).toHaveBeenCalled();
  });

  it("createDirectConversation returns existing id if found", async () => {
    getDoc.mockResolvedValue(docSnap(true, { participants: ["a", "b"] }, "direct_a_b"));
    const id = await fs.createDirectConversation("a", "b", "A", "B");
    expect(id).toBe("direct_a_b");
    expect(setDoc).not.toHaveBeenCalled();
  });

  it("createDirectConversation creates new when none exists", async () => {
    getDoc.mockResolvedValue(docSnap(false));
    const id = await fs.createDirectConversation("a", "b", "A", "B");
    expect(id).toBe("direct_a_b");
    expect(setDoc).toHaveBeenCalled();
    const payload = setDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.lastMessageAt).toEqual({ __serverTimestamp: true });
  });

  it("createGroupConversation writes conv doc and intro message", async () => {
    const id = await fs.createGroupConversation(["a", "b"], "match1", "Group", "hi there", "a");
    expect(setDoc).toHaveBeenCalled();
    expect(addDoc).toHaveBeenCalled();
    const convPayload = setDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(convPayload.type).toBe("group");
    expect((convPayload.participants as string[])).toContain(RALLY_USER.id);
    expect((convPayload.unread as Record<string, number>).a).toBe(0);
    expect((convPayload.unread as Record<string, number>).b).toBe(1);
    expect(id).toBeDefined();
  });
});

describe("firestore Firebase path — messages", () => {
  it("getMessages queries by conversationId ordered asc and normalizes", async () => {
    getDocs.mockResolvedValue(querySnap([{ id: "msg1", data: { text: "hi", createdAt: isoTimestamp } }]));
    const msgs = await fs.getMessages("c1");
    expect(where).toHaveBeenCalledWith("conversationId", "==", "c1");
    expect(orderBy).toHaveBeenCalledWith("createdAt", "asc");
    expect(msgs[0].createdAt).toBe("2023-01-02T03:04:05.000Z");
  });

  it("subscribeMessages wires onSnapshot and returns unsub", async () => {
    let snapCb: ((s: unknown) => void) | undefined;
    const unsubFn = vi.fn();
    onSnapshot.mockImplementation((_q: unknown, cb: (s: unknown) => void) => {
      snapCb = cb;
      return unsubFn;
    });
    const received: unknown[] = [];
    const unsub = fs.subscribeMessages("c1", (m) => received.push(m));
    await new Promise((r) => setTimeout(r, 0));
    snapCb!(querySnap([{ id: "msg1", data: { text: "x", createdAt: isoTimestamp } }]));
    expect(received).toHaveLength(1);
    unsub();
    expect(unsubFn).toHaveBeenCalled();
  });

  it("sendMessage adds message and increments unread for other participants", async () => {
    getDoc.mockResolvedValue(docSnap(true, { participants: ["sender", "other", RALLY_USER.id] }));
    const msg = await fs.sendMessage("c1", "hello", "sender", "Sender");
    expect(addDoc).toHaveBeenCalled();
    const updatePayload = updateDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(updatePayload.lastMessage).toBe("hello");
    expect(updatePayload["unread.other"]).toEqual({ __increment: 1 });
    // Sender and Rally must not get unread increments.
    expect(updatePayload["unread.sender"]).toBeUndefined();
    expect(updatePayload[`unread.${RALLY_USER.id}`]).toBeUndefined();
    expect(msg.id).toBe("newDocId");
    expect(msg.text).toBe("hello");
  });

  it("sendMessage handles missing conversation (no participants)", async () => {
    getDoc.mockResolvedValue(docSnap(false));
    const msg = await fs.sendMessage("c1", "hi", "sender", "Sender", true);
    expect(msg.isAI).toBe(true);
    const updatePayload = updateDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(updatePayload.lastMessage).toBe("hi");
  });

  it("markConversationRead zeroes the user's unread counter", async () => {
    await fs.markConversationRead("c1", "u1");
    expect(updateDoc).toHaveBeenCalledWith({ __ref: "conversations/c1" }, { "unread.u1": 0 });
  });
});

describe("firestore Firebase path — contacts", () => {
  it("getContacts maps contacts subcollection", async () => {
    getDocs.mockResolvedValue(querySnap([{ id: "ct1", data: { name: "Contact" } }]));
    const contacts = await fs.getContacts("u1");
    expect(collection).toHaveBeenCalledWith({}, "users", "u1", "contacts");
    expect(contacts).toEqual([{ id: "ct1", name: "Contact" }]);
  });

  it("addContact writes to contacts subcollection", async () => {
    await fs.addContact("u1", { id: "ct1", name: "C" } as never);
    expect(doc).toHaveBeenCalledWith({}, "users", "u1", "contacts", "ct1");
    expect(setDoc).toHaveBeenCalled();
  });

  it("removeContact deletes from contacts subcollection", async () => {
    await fs.removeContact("u1", "ct1");
    expect(deleteDoc).toHaveBeenCalledWith({ __ref: "users/u1/contacts/ct1" });
  });
});

describe("firestore Firebase path — notifications", () => {
  it("getNotifications queries by userId ordered desc", async () => {
    getDocs.mockResolvedValue(querySnap([{ id: "n1", data: { title: "x" } }]));
    const notifs = await fs.getNotifications("u1");
    expect(where).toHaveBeenCalledWith("userId", "==", "u1");
    expect(orderBy).toHaveBeenCalledWith("createdAt", "desc");
    expect(notifs).toEqual([{ id: "n1", title: "x" }]);
  });

  it("markNotificationRead sets read true", async () => {
    await fs.markNotificationRead("n1");
    expect(updateDoc).toHaveBeenCalledWith({ __ref: "notifications/n1" }, { read: true });
  });

  it("createNotification addDoc to notifications", async () => {
    await fs.createNotification({ userId: "u1", type: "match_request", title: "t", body: "b", read: false, createdAt: "now" } as never);
    expect(collection).toHaveBeenCalledWith({}, "notifications");
    expect(addDoc).toHaveBeenCalled();
  });
});

describe("firestore Firebase path — match requests", () => {
  it("getMatchRequests merges sent and received", async () => {
    getDocs
      .mockResolvedValueOnce(querySnap([{ id: "sent1", data: { fromUserId: "u1" } }]))
      .mockResolvedValueOnce(querySnap([{ id: "recv1", data: { toUserId: "u1" } }]));
    const reqs = await fs.getMatchRequests("u1");
    expect(where).toHaveBeenCalledWith("fromUserId", "==", "u1");
    expect(where).toHaveBeenCalledWith("toUserId", "==", "u1");
    expect(reqs.map((r) => r.id)).toEqual(["sent1", "recv1"]);
  });

  it("createMatchRequest addDoc and creates a notification", async () => {
    const id = await fs.createMatchRequest({ fromUserId: "a", toUserId: "b", score: 80 } as never);
    // First addDoc for the request, second for the notification.
    expect(addDoc).toHaveBeenCalledTimes(2);
    expect(collection).toHaveBeenCalledWith({}, "matchRequests");
    expect(collection).toHaveBeenCalledWith({}, "notifications");
    expect(id).toBe("newDocId");
  });

  it("updateMatchRequest updates the doc", async () => {
    await fs.updateMatchRequest("mr1", { status: "accepted" } as never);
    expect(updateDoc).toHaveBeenCalledWith({ __ref: "matchRequests/mr1" }, { status: "accepted" });
  });
});
