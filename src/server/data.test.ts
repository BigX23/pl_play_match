// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import * as data from "@/server/data";
import { AuthzError, NotFoundError, RALLY_ID, directConversationId } from "@/server/data";

/**
 * Tests run against an in-memory Postgres (pglite). data.ts types its Db from
 * the postgres-js driver, so the pglite-drizzle instance is passed with a
 * cast (`db` below is typed `never`-compatible via `asDb`).
 */

const client = new PGlite();
const rawDb = drizzle(client, { schema });
// data.ts expects the postgres-js flavor of the Drizzle type; runtime API is identical.
const db = rawDb as never;

const ALICE = "user_alice";
const BOB = "user_bob";
const CARA = "user_cara";
const NAMELESS = "user_nameless";

async function applyMigrations() {
  const dir = path.resolve(__dirname, "../../drizzle");
  for (const file of ["0000_auth-and-profile.sql", "0001_domain-tables.sql"]) {
    const sqlText = readFileSync(path.join(dir, file), "utf8");
    for (const stmt of sqlText.split("--> statement-breakpoint")) {
      const trimmed = stmt.trim();
      if (trimmed) await client.exec(trimmed);
    }
  }
}

async function seedUsers() {
  await rawDb.insert(schema.users).values([
    {
      id: RALLY_ID,
      name: "Rally",
      firstName: "Rally",
      email: "rally@playmatch.app",
    },
    {
      id: ALICE,
      name: "Alice Smith",
      firstName: "Alice",
      lastName: "Smith",
      email: "Alice@Example.com",
      ntrpRating: 4.0,
      sport: "tennis",
    },
    {
      id: BOB,
      name: "Bob Jones",
      firstName: "Bob",
      lastName: "Jones",
      email: "bob@example.com",
      ntrpRating: 3.5,
    },
    {
      id: CARA,
      name: "Cara Lee",
      firstName: "Cara",
      lastName: "Lee",
      email: "cara@example.com",
    },
    // No firstName / no name — exercises the sendMessage "Player" fallback.
    { id: NAMELESS, email: "nameless@example.com" },
  ]);
}

beforeAll(async () => {
  await applyMigrations();
});

beforeEach(async () => {
  // Full reset between tests: wipe domain rows + users, reseed.
  await client.exec(`
    TRUNCATE TABLE
      contacts, notifications, messages, conversation_participants,
      conversations, match_requests, matches, users
    CASCADE;
  `);
  await seedUsers();
});

afterAll(async () => {
  await client.close();
});

// ---------- players ----------

describe("players", () => {
  it("listPlayers excludes the rally user and strips email", async () => {
    const players = await data.listPlayers(db);
    const ids = players.map((p) => p.id);
    expect(ids).not.toContain(RALLY_ID);
    expect(ids).toEqual(expect.arrayContaining([ALICE, BOB, CARA, NAMELESS]));
    for (const p of players) expect(p.email).toBe("");
  });

  it("listPlayers serializes profile fields", async () => {
    const players = await data.listPlayers(db);
    const alice = players.find((p) => p.id === ALICE)!;
    expect(alice.name).toBe("Alice Smith");
    expect(alice.firstName).toBe("Alice");
    expect(alice.ntrpRating).toBe(4);
    expect(alice.sport).toBe("tennis");
    expect(alice.matchesPlayed).toBe(0);
    expect(alice.joinedDate).toEqual(expect.any(String));
    // Nameless user: name falls back to trimmed first/last (empty here).
    const nameless = players.find((p) => p.id === NAMELESS)!;
    expect(nameless.name).toBe("");
    expect(nameless.sport).toBe("both");
    expect(nameless.ntrpRating).toBe(0);
  });

  it("getPlayer returns a public player and 404s on missing", async () => {
    const p = await data.getPlayer(db, BOB);
    expect(p.id).toBe(BOB);
    expect(p.email).toBe("");
    await expect(data.getPlayer(db, "nope")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lookupPlayerByEmail matches case-insensitively and includes email", async () => {
    const p = await data.lookupPlayerByEmail(db, "alice@example.COM");
    expect(p.id).toBe(ALICE);
    expect(p.email).toBe("Alice@Example.com");
  });

  it("lookupPlayerByEmail 404s on miss and on the rally user", async () => {
    await expect(data.lookupPlayerByEmail(db, "ghost@example.com")).rejects.toBeInstanceOf(
      NotFoundError
    );
    await expect(data.lookupPlayerByEmail(db, "rally@playmatch.app")).rejects.toBeInstanceOf(
      NotFoundError
    );
  });
});

// ---------- matches ----------

describe("matches", () => {
  it("createMatch stamps player1Id from the session user and builds participants", async () => {
    const m = await data.createMatch(db, ALICE, {
      player1Id: BOB, // forged — must be ignored
      player2Id: BOB,
      date: "2026-07-20",
      time: "10:00",
      location: "Court 1",
      sport: "pickleball",
      status: "pending",
      compatibilityScore: 88,
      matchExplanation: "great fit",
      matchType: "singles",
      notes: "bring water",
    });
    expect(m.player1Id).toBe(ALICE);
    expect(m.player2Id).toBe(BOB);
    expect(m.createdBy).toBe(ALICE);
    expect(m.participants).toEqual([ALICE, BOB]);
    expect(m.sport).toBe("pickleball");
    expect(m.matchType).toBe("singles");
    expect(m.notes).toBe("bring water");
    expect(m.compatibilityScore).toBe(88);
  });

  it("createMatch without player2 defaults to an open solo match", async () => {
    const m = await data.createMatch(db, ALICE, {});
    expect(m.player1Id).toBe(ALICE);
    expect(m.player2Id).toBe("");
    expect(m.status).toBe("open");
    expect(m.sport).toBe("tennis");
    expect(m.participants).toEqual([ALICE]);
  });

  it("listMatches returns all matches, or only mine with mineOnly", async () => {
    await data.createMatch(db, ALICE, { player2Id: BOB });
    await data.createMatch(db, BOB, { player2Id: CARA });
    const all = await data.listMatches(db, ALICE);
    expect(all).toHaveLength(2);
    const mine = await data.listMatches(db, ALICE, true);
    expect(mine).toHaveLength(1);
    expect(mine[0].player1Id).toBe(ALICE);
  });

  it("updateMatch only applies allow-listed fields", async () => {
    const m = await data.createMatch(db, ALICE, { player2Id: BOB });
    const updated = await data.updateMatch(db, ALICE, m.id, {
      location: "Court 9",
      player1Id: BOB, // not patchable — ignored
      createdBy: BOB, // not patchable — ignored
      compatibilityScore: 1, // not patchable — ignored
    });
    expect(updated.location).toBe("Court 9");
    expect(updated.player1Id).toBe(ALICE);
    expect(updated.createdBy).toBe(ALICE);
    expect(updated.compatibilityScore).toBe(m.compatibilityScore);
  });

  it("updateMatch rejects non-participants and 404s on missing", async () => {
    const m = await data.createMatch(db, ALICE, { player2Id: BOB });
    await expect(data.updateMatch(db, CARA, m.id, { location: "x" })).rejects.toBeInstanceOf(
      AuthzError
    );
    await expect(data.updateMatch(db, ALICE, "missing", {})).rejects.toBeInstanceOf(NotFoundError);
  });

  it("updateMatch allows player2 (a participant) to patch", async () => {
    const m = await data.createMatch(db, ALICE, { player2Id: BOB });
    const updated = await data.updateMatch(db, BOB, m.id, { notes: "see you there" });
    expect(updated.notes).toBe("see you there");
  });

  it("completing with a winner updates both players' stats exactly once", async () => {
    const m = await data.createMatch(db, ALICE, { player2Id: BOB, status: "confirmed" });
    await data.updateMatch(db, ALICE, m.id, { status: "completed", winnerId: ALICE, score: "6-4" });

    let alice = await data.getPlayer(db, ALICE);
    let bob = await data.getPlayer(db, BOB);
    expect(alice.matchesPlayed).toBe(1);
    expect(alice.wins).toBe(1);
    expect(alice.losses).toBe(0);
    expect(bob.matchesPlayed).toBe(1);
    expect(bob.wins).toBe(0);
    expect(bob.losses).toBe(1);

    // Already completed — updating again must not re-count.
    await data.updateMatch(db, ALICE, m.id, { status: "completed", winnerId: BOB });
    alice = await data.getPlayer(db, ALICE);
    bob = await data.getPlayer(db, BOB);
    expect(alice.matchesPlayed).toBe(1);
    expect(alice.wins).toBe(1);
    expect(bob.matchesPlayed).toBe(1);
    expect(bob.losses).toBe(1);
  });

  it("completing a tie increments matchesPlayed only", async () => {
    const m = await data.createMatch(db, ALICE, { player2Id: BOB });
    await data.updateMatch(db, BOB, m.id, { status: "completed", winnerId: "tie" });
    const alice = await data.getPlayer(db, ALICE);
    const bob = await data.getPlayer(db, BOB);
    for (const p of [alice, bob]) {
      expect(p.matchesPlayed).toBe(1);
      expect(p.wins).toBe(0);
      expect(p.losses).toBe(0);
    }
  });

  it("completing without a winner increments matchesPlayed only", async () => {
    const m = await data.createMatch(db, ALICE, { player2Id: BOB });
    await data.updateMatch(db, ALICE, m.id, { status: "completed" });
    const alice = await data.getPlayer(db, ALICE);
    expect(alice.matchesPlayed).toBe(1);
    expect(alice.wins).toBe(0);
    expect(alice.losses).toBe(0);
  });

  it("completing a solo match only touches player1", async () => {
    const m = await data.createMatch(db, ALICE, {});
    await data.updateMatch(db, ALICE, m.id, { status: "completed", winnerId: ALICE });
    const alice = await data.getPlayer(db, ALICE);
    expect(alice.matchesPlayed).toBe(1);
    expect(alice.wins).toBe(1);
  });

  it("deleteMatch is creator-only and 404s on missing", async () => {
    const m = await data.createMatch(db, ALICE, { player2Id: BOB });
    await expect(data.deleteMatch(db, BOB, m.id)).rejects.toBeInstanceOf(AuthzError);
    await expect(data.deleteMatch(db, ALICE, "missing")).rejects.toBeInstanceOf(NotFoundError);
    await data.deleteMatch(db, ALICE, m.id);
    expect(await data.listMatches(db, ALICE)).toHaveLength(0);
  });

  it("joinOpenMatch joins an open match: pending status + participants", async () => {
    const m = await data.createMatch(db, ALICE, {});
    const joined = await data.joinOpenMatch(db, BOB, m.id);
    expect(joined).toBe(true);
    const [row] = await data.listMatches(db, BOB, true);
    expect(row.id).toBe(m.id);
    expect(row.status).toBe("pending");
    expect(row.player2Id).toBe(BOB);
    expect(row.acceptedBy).toBe(BOB);
    expect(row.participants).toEqual([ALICE, BOB]);
  });

  it("joinOpenMatch returns false for missing, non-open, taken, and self-join", async () => {
    expect(await data.joinOpenMatch(db, BOB, "missing")).toBe(false);

    const closed = await data.createMatch(db, ALICE, { status: "completed" });
    expect(await data.joinOpenMatch(db, BOB, closed.id)).toBe(false);

    const taken = await data.createMatch(db, ALICE, { player2Id: CARA });
    expect(await data.joinOpenMatch(db, BOB, taken.id)).toBe(false);

    const own = await data.createMatch(db, ALICE, {});
    expect(await data.joinOpenMatch(db, ALICE, own.id)).toBe(false);
  });
});

// ---------- match requests ----------

describe("match requests", () => {
  it("createMatchRequest stamps fromUserId and notifies the recipient", async () => {
    const r = await data.createMatchRequest(db, ALICE, BOB, 92);
    expect(r.fromUserId).toBe(ALICE);
    expect(r.toUserId).toBe(BOB);
    expect(r.status).toBe("pending");
    expect(r.score).toBe(92);

    const bobNotifs = await data.listNotifications(db, BOB);
    expect(bobNotifs).toHaveLength(1);
    expect(bobNotifs[0].type).toBe("match_request");
    expect(bobNotifs[0].body).toContain("92%");
    expect(await data.listNotifications(db, ALICE)).toHaveLength(0);
  });

  it("createMatchRequest rejects self-requests", async () => {
    await expect(data.createMatchRequest(db, ALICE, ALICE, 100)).rejects.toBeInstanceOf(AuthzError);
  });

  it("listMatchRequests returns only requests sent or received by me", async () => {
    await data.createMatchRequest(db, ALICE, BOB, 80);
    await data.createMatchRequest(db, BOB, CARA, 70);
    await data.createMatchRequest(db, CARA, ALICE, 60);

    const mine = await data.listMatchRequests(db, ALICE);
    expect(mine).toHaveLength(2);
    expect(
      mine.every((r) => r.fromUserId === ALICE || r.toUserId === ALICE)
    ).toBe(true);
  });

  it("updateMatchRequest lets the recipient accept or decline", async () => {
    const r1 = await data.createMatchRequest(db, ALICE, BOB, 80);
    const accepted = await data.updateMatchRequest(db, BOB, r1.id, { status: "accepted" });
    expect(accepted.status).toBe("accepted");

    const r2 = await data.createMatchRequest(db, ALICE, BOB, 81);
    const declined = await data.updateMatchRequest(db, BOB, r2.id, { status: "declined" });
    expect(declined.status).toBe("declined");
  });

  it("updateMatchRequest forbids the sender from accepting or declining", async () => {
    const r = await data.createMatchRequest(db, ALICE, BOB, 80);
    await expect(
      data.updateMatchRequest(db, ALICE, r.id, { status: "accepted" })
    ).rejects.toBeInstanceOf(AuthzError);
    await expect(
      data.updateMatchRequest(db, ALICE, r.id, { status: "declined" })
    ).rejects.toBeInstanceOf(AuthzError);
  });

  it("updateMatchRequest lets the sender attach a conversation or expire it", async () => {
    const r = await data.createMatchRequest(db, ALICE, BOB, 80);
    const withConv = await data.updateMatchRequest(db, ALICE, r.id, { conversationId: "conv_1" });
    expect(withConv.conversationId).toBe("conv_1");
    const expired = await data.updateMatchRequest(db, ALICE, r.id, { status: "expired" });
    expect(expired.status).toBe("expired");
  });

  it("updateMatchRequest rejects strangers and 404s on missing", async () => {
    const r = await data.createMatchRequest(db, ALICE, BOB, 80);
    await expect(
      data.updateMatchRequest(db, CARA, r.id, { status: "accepted" })
    ).rejects.toBeInstanceOf(AuthzError);
    await expect(
      data.updateMatchRequest(db, ALICE, "missing", { status: "expired" })
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ---------- conversations ----------

describe("conversations", () => {
  it("createDirectConversation uses a deterministic sorted id and is idempotent", async () => {
    const c1 = await data.createDirectConversation(db, ALICE, BOB);
    expect(c1.id).toBe(directConversationId(ALICE, BOB));
    expect(c1.id).toBe(`direct_${[ALICE, BOB].sort().join("_")}`);
    expect(c1.type).toBe("direct");
    expect(c1.participants.sort()).toEqual([ALICE, BOB].sort());

    // Second call (from either side) returns the same conversation.
    const c2 = await data.createDirectConversation(db, BOB, ALICE);
    expect(c2.id).toBe(c1.id);
    const convs = await rawDb.select().from(schema.conversations);
    expect(convs).toHaveLength(1);
  });

  it("createDirectConversation rejects chatting with yourself", async () => {
    await expect(data.createDirectConversation(db, ALICE, ALICE)).rejects.toBeInstanceOf(
      AuthzError
    );
  });

  it("createGroupConversation adds rally + intro message and sets unread counts", async () => {
    const c = await data.createGroupConversation(
      db,
      ALICE,
      [ALICE, BOB],
      "match_1",
      "Alice & Bob",
      "Welcome to your match chat!"
    );
    expect(c.type).toBe("group");
    expect(c.name).toBe("Alice & Bob");
    expect(c.matchId).toBe("match_1");
    expect(c.createdBy).toBe(ALICE);
    expect(c.lastMessage).toBe("Welcome to your match chat!");
    expect(c.participants.sort()).toEqual([ALICE, BOB, RALLY_ID].sort());
    // Creator has 0 unread; the other human has 1.
    expect(c.unread[ALICE]).toBe(0);
    const bobView = await data.getConversation(db, BOB, c.id);
    expect(bobView.unread[BOB]).toBe(1);

    const msgs = await data.listMessages(db, ALICE, c.id);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].senderId).toBe(RALLY_ID);
    expect(msgs[0].senderName).toBe("Rally");
    expect(msgs[0].isAI).toBe(true);
    expect(msgs[0].text).toBe("Welcome to your match chat!");
  });

  it("createGroupConversation dedupes participants and tolerates rally in the list", async () => {
    const c = await data.createGroupConversation(
      db,
      ALICE,
      [ALICE, ALICE, BOB, RALLY_ID],
      "",
      "Group",
      "hi"
    );
    expect(c.participants.sort()).toEqual([ALICE, BOB, RALLY_ID].sort());
    expect(c.matchId).toBeUndefined(); // empty matchId stored as null
  });

  it("createGroupConversation throws when the creator is not a participant", async () => {
    await expect(
      data.createGroupConversation(db, ALICE, [BOB, CARA], "m", "Group", "hi")
    ).rejects.toBeInstanceOf(AuthzError);
  });

  it("listConversations returns only mine, newest message first, with my unread", async () => {
    const older = await data.createDirectConversation(db, ALICE, BOB);
    const newer = await data.createDirectConversation(db, ALICE, CARA);
    await data.createDirectConversation(db, BOB, CARA); // not alice's

    // Bump the older conversation so it sorts first.
    await data.sendMessage(db, BOB, older.id, "ping");

    const list = await data.listConversations(db, ALICE);
    expect(list).toHaveLength(2);
    expect(list.map((c) => c.id)).toEqual([older.id, newer.id]);
    expect(list[0].unread[ALICE]).toBe(1); // bob's message unread for alice
    expect(list[1].unread[ALICE]).toBe(0);
  });

  it("listConversations is empty for a user with no conversations", async () => {
    expect(await data.listConversations(db, NAMELESS)).toEqual([]);
  });

  it("getConversation is participant-only", async () => {
    const c = await data.createDirectConversation(db, ALICE, BOB);
    const got = await data.getConversation(db, BOB, c.id);
    expect(got.id).toBe(c.id);
    await expect(data.getConversation(db, CARA, c.id)).rejects.toBeInstanceOf(AuthzError);
    // Unknown id has no participants — surfaces as AuthzError.
    await expect(data.getConversation(db, ALICE, "missing")).rejects.toBeInstanceOf(AuthzError);
  });

  it("deleteConversation is participant-only and cascades messages", async () => {
    const c = await data.createDirectConversation(db, ALICE, BOB);
    await data.sendMessage(db, ALICE, c.id, "hello");
    await expect(data.deleteConversation(db, CARA, c.id)).rejects.toBeInstanceOf(AuthzError);

    await data.deleteConversation(db, BOB, c.id);
    expect(await rawDb.select().from(schema.conversations)).toHaveLength(0);
    expect(
      await rawDb.select().from(schema.messages).where(eq(schema.messages.conversationId, c.id))
    ).toHaveLength(0);
    expect(await rawDb.select().from(schema.conversationParticipants)).toHaveLength(0);
  });

  it("markConversationRead zeroes only my unread count", async () => {
    const c = await data.createGroupConversation(db, ALICE, [ALICE, BOB, CARA], "", "G", "intro");
    await data.markConversationRead(db, BOB, c.id);

    const parts = await rawDb
      .select()
      .from(schema.conversationParticipants)
      .where(eq(schema.conversationParticipants.conversationId, c.id));
    const byUser = Object.fromEntries(parts.map((p) => [p.userId, p]));
    expect(byUser[BOB].unreadCount).toBe(0);
    expect(byUser[BOB].lastReadAt).not.toBeNull();
    expect(byUser[CARA].unreadCount).toBe(1); // untouched
    expect(byUser[ALICE].unreadCount).toBe(0);
  });
});

// ---------- messages ----------

describe("messages", () => {
  it("listMessages is participant-only and ordered oldest-first", async () => {
    const c = await data.createDirectConversation(db, ALICE, BOB);
    await data.sendMessage(db, ALICE, c.id, "first");
    await data.sendMessage(db, BOB, c.id, "second");
    const msgs = await data.listMessages(db, ALICE, c.id);
    expect(msgs.map((m) => m.text)).toEqual(["first", "second"]);
    await expect(data.listMessages(db, CARA, c.id)).rejects.toBeInstanceOf(AuthzError);
  });

  it("sendMessage stamps sender identity from the users row", async () => {
    const c = await data.createDirectConversation(db, ALICE, BOB);
    const m = await data.sendMessage(db, ALICE, c.id, "hey bob");
    expect(m.senderId).toBe(ALICE);
    expect(m.senderName).toBe("Alice"); // firstName, not full name
    expect(m.text).toBe("hey bob");
    expect(m.isAI).toBeUndefined();
    expect(m.conversationId).toBe(c.id);
  });

  it("sendMessage falls back to 'Player' when the sender has no name", async () => {
    const c = await data.createDirectConversation(db, NAMELESS, BOB);
    const m = await data.sendMessage(db, NAMELESS, c.id, "hi");
    expect(m.senderName).toBe("Player");
  });

  it("sendMessage bumps unread for other humans only and updates the conversation", async () => {
    const c = await data.createGroupConversation(db, ALICE, [ALICE, BOB, CARA], "", "G", "intro");
    await data.sendMessage(db, BOB, c.id, "who's in?");

    const parts = await rawDb
      .select()
      .from(schema.conversationParticipants)
      .where(eq(schema.conversationParticipants.conversationId, c.id));
    const unread = Object.fromEntries(parts.map((p) => [p.userId, p.unreadCount]));
    expect(unread[BOB]).toBe(1); // sender not bumped (still 1 from the intro)
    expect(unread[ALICE]).toBe(1); // 0 + 1
    expect(unread[CARA]).toBe(2); // 1 (intro) + 1
    expect(unread[RALLY_ID]).toBe(0); // rally never bumped

    const conv = await data.getConversation(db, BOB, c.id);
    expect(conv.lastMessage).toBe("who's in?");
    expect(new Date(conv.lastMessageAt).getTime()).toBeGreaterThanOrEqual(
      new Date(conv.createdAt).getTime()
    );
  });

  it("sendMessage rejects non-participants", async () => {
    const c = await data.createDirectConversation(db, ALICE, BOB);
    await expect(data.sendMessage(db, CARA, c.id, "let me in")).rejects.toBeInstanceOf(AuthzError);
  });
});

// ---------- Rally message helpers (Phase 5) ----------

describe("insertRallyMessage / conversationContext", () => {
  it("insertRallyMessage inserts as Rally, bumps unread for humans, updates the conversation", async () => {
    const c = await data.createGroupConversation(db, ALICE, [ALICE, BOB], "", "G", "intro");
    await data.markConversationRead(db, ALICE, c.id);
    await data.markConversationRead(db, BOB, c.id);

    const m = await data.insertRallyMessage(db, c.id, "Court is booked, see you there.");
    expect(m?.senderId).toBe(RALLY_ID);
    expect(m?.isAI).toBe(true);

    const parts = await rawDb
      .select()
      .from(schema.conversationParticipants)
      .where(eq(schema.conversationParticipants.conversationId, c.id));
    const unread = Object.fromEntries(parts.map((p) => [p.userId, p.unreadCount]));
    expect(unread[ALICE]).toBe(1);
    expect(unread[BOB]).toBe(1);
    expect(unread[RALLY_ID]).toBe(0);

    const conv = await data.getConversation(db, ALICE, c.id);
    expect(conv.lastMessage).toBe("Court is booked, see you there.");
  });

  it("insertRallyMessage no-ops when Rally isn't in the conversation", async () => {
    const c = await data.createDirectConversation(db, ALICE, BOB); // no Rally
    const m = await data.insertRallyMessage(db, c.id, "should not appear");
    expect(m).toBeUndefined();
    expect(await data.listMessages(db, ALICE, c.id)).toHaveLength(0);
  });

  it("conversationContext returns messages, human names, and hasRally", async () => {
    const c = await data.createGroupConversation(db, ALICE, [ALICE, BOB], "", "G", "intro");
    await data.sendMessage(db, ALICE, c.id, "@rally where do we play?");
    const ctx = await data.conversationContext(db, c.id);
    expect(ctx.hasRally).toBe(true);
    expect(ctx.names[ALICE]).toBe("Alice");
    expect(ctx.names[RALLY_ID]).toBeUndefined(); // Rally excluded from name map
    expect(ctx.messages.some((m) => m.text.includes("where do we play"))).toBe(true);
  });
});

// ---------- contacts ----------

describe("contacts", () => {
  it("addContact / listContacts / removeContact round-trip", async () => {
    await data.addContact(db, ALICE, {
      id: BOB,
      name: "Bob Jones",
      email: "bob@example.com",
      avatar: "b.png",
    });
    let list = await data.listContacts(db, ALICE);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: BOB,
      name: "Bob Jones",
      email: "bob@example.com",
      avatar: "b.png",
    });
    // Contacts are per-user.
    expect(await data.listContacts(db, BOB)).toHaveLength(0);

    await data.removeContact(db, ALICE, BOB);
    list = await data.listContacts(db, ALICE);
    expect(list).toHaveLength(0);
  });

  it("addContact defaults optional fields", async () => {
    await data.addContact(db, ALICE, { id: CARA });
    const [c] = await data.listContacts(db, ALICE);
    expect(c.name).toBe("");
    expect(c.email).toBeUndefined();
    expect(c.avatar).toBeUndefined();
  });

  it("addContact rejects adding yourself", async () => {
    await expect(data.addContact(db, ALICE, { id: ALICE })).rejects.toBeInstanceOf(AuthzError);
  });

  it("duplicate addContact is a no-op", async () => {
    await data.addContact(db, ALICE, { id: BOB, name: "Bob" });
    await data.addContact(db, ALICE, { id: BOB, name: "Bobby (ignored)" });
    const list = await data.listContacts(db, ALICE);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Bob"); // original row untouched
  });
});

// ---------- notifications ----------

describe("notifications", () => {
  it("listNotifications returns only mine, newest first", async () => {
    await rawDb.insert(schema.notifications).values([
      {
        id: "n_old",
        userId: ALICE,
        type: "generic",
        title: "old",
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
      {
        id: "n_new",
        userId: ALICE,
        type: "generic",
        title: "new",
        link: "/somewhere",
        createdAt: new Date("2026-06-01T00:00:00Z"),
      },
      { id: "n_bob", userId: BOB, type: "generic", title: "bob's" },
    ]);
    const mine = await data.listNotifications(db, ALICE);
    expect(mine.map((n) => n.id)).toEqual(["n_new", "n_old"]);
    expect(mine[0].link).toBe("/somewhere");
    expect(mine[1].link).toBeUndefined();
    expect(mine[0].read).toBe(false);
  });

  it("markNotificationRead marks own notifications and 404s on others'", async () => {
    await rawDb
      .insert(schema.notifications)
      .values({ id: "n1", userId: ALICE, type: "generic", title: "t" });

    await data.markNotificationRead(db, ALICE, "n1");
    const [row] = await rawDb
      .select()
      .from(schema.notifications)
      .where(and(eq(schema.notifications.id, "n1"), eq(schema.notifications.userId, ALICE)));
    expect(row.read).toBe(true);

    // Someone else's notification / missing id → NotFoundError (no leak).
    await expect(data.markNotificationRead(db, BOB, "n1")).rejects.toBeInstanceOf(NotFoundError);
    await expect(data.markNotificationRead(db, ALICE, "missing")).rejects.toBeInstanceOf(
      NotFoundError
    );
  });
});
