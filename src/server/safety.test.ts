// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import * as data from "@/server/data";
import { AuthzError, BadRequestError, NotFoundError, RALLY_ID, directConversationId } from "@/server/data";

/**
 * Block + report enforcement (U1) against an in-memory Postgres (pglite),
 * one case per read/write path that blocks must cover.
 */

const client = new PGlite();
const rawDb = drizzle(client, { schema });
const db = rawDb as never;

const ALICE = "user_alice";
const BOB = "user_bob";
const CARA = "user_cara";
const ADMIN = "user_admin";

async function applyMigrations() {
  const dir = path.resolve(__dirname, "../../drizzle");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const sqlText = readFileSync(path.join(dir, file), "utf8");
    for (const stmt of sqlText.split("--> statement-breakpoint")) {
      const trimmed = stmt.trim();
      if (trimmed) await client.exec(trimmed);
    }
  }
}

const availability = [{ day: "Mon", enabled: true, slots: [{ start: 9, end: 12 }] }];
const complete = {
  profileComplete: true,
  age: 40,
  gender: "Female",
  ntrpRating: 3.5,
  sports: ["tennis"],
  matchFormats: ["singles"],
  gameType: "slightly-competitive",
  weeklyAvailability: availability,
  partnerPreferences: {
    ageRange: "any",
    ntrpMin: 2,
    ntrpMax: 5,
    gameTypes: [],
    sports: [],
    matchFormats: [],
    genderPreference: "No Preference",
  },
};

async function seed() {
  await rawDb.insert(schema.users).values([
    { id: RALLY_ID, name: "Rally", firstName: "Rally", email: "rally@playmatch.app" },
    { id: ALICE, firstName: "Alice", lastName: "Smith", email: "alice@example.com", ...complete } as never,
    { id: BOB, firstName: "Bob", lastName: "Jones", email: "bob@example.com", ...complete } as never,
    { id: CARA, firstName: "Cara", lastName: "Lee", email: "cara@example.com", ...complete } as never,
    { id: ADMIN, firstName: "Ada", lastName: "Min", email: "Admin@Example.com" },
  ]);
}

beforeAll(applyMigrations);
beforeEach(async () => {
  await client.exec(`
    TRUNCATE TABLE
      user_reports, user_blocks, contacts, notifications, messages, conversation_participants,
      conversations, match_requests, matches, suggestion_mutes, users
    CASCADE;
  `);
  await seed();
  delete process.env.ADMIN_EMAILS;
});
afterEach(() => {
  delete process.env.ADMIN_EMAILS;
});
afterAll(async () => {
  await client.close();
});

const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort();

// ---------- block / unblock / list ----------

describe("blockUser / unblockUser / listBlockedUsers", () => {
  it("rejects self, rally and unknown targets", async () => {
    await expect(data.blockUser(db, ALICE, ALICE)).rejects.toBeInstanceOf(AuthzError);
    await expect(data.blockUser(db, ALICE, RALLY_ID)).rejects.toBeInstanceOf(NotFoundError);
    await expect(data.blockUser(db, ALICE, "ghost")).rejects.toBeInstanceOf(NotFoundError);
    await expect(data.blockUser(db, ALICE, "")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("is idempotent and lists only the blocks I placed", async () => {
    await data.blockUser(db, ALICE, BOB);
    await data.blockUser(db, ALICE, BOB);
    expect((await rawDb.select().from(schema.userBlocks)).length).toBe(1);
    const mine = await data.listBlockedUsers(db, ALICE);
    expect(ids(mine)).toEqual([BOB]);
    expect(mine[0].name).toBe("Bob J.");
    expect(mine[0].email).toBe("");
    expect(mine[0].blockedAt).toEqual(expect.any(String));
    // Bob is blocked BY Alice — he doesn't see her in his own block list.
    expect(await data.listBlockedUsers(db, BOB)).toEqual([]);
  });

  it("blockedIdsFor / isBlockedBetween are symmetric", async () => {
    await data.blockUser(db, ALICE, BOB);
    expect([...(await data.blockedIdsFor(db, ALICE))]).toEqual([BOB]);
    expect([...(await data.blockedIdsFor(db, BOB))]).toEqual([ALICE]);
    expect(await data.isBlockedBetween(db, BOB, ALICE)).toBe(true);
    expect(await data.isBlockedBetween(db, ALICE, CARA)).toBe(false);
  });

  it("unblock is blocker-only and idempotent", async () => {
    await data.blockUser(db, ALICE, BOB);
    await data.unblockUser(db, BOB, ALICE); // Bob can't lift Alice's block
    expect(await data.isBlockedBetween(db, ALICE, BOB)).toBe(true);
    await data.unblockUser(db, ALICE, BOB);
    await data.unblockUser(db, ALICE, BOB);
    expect(await data.isBlockedBetween(db, ALICE, BOB)).toBe(false);
  });

  it("expires pending match requests in both directions", async () => {
    await data.createMatchRequest(db, ALICE, BOB, 80);
    await data.createMatchRequest(db, BOB, ALICE, 80);
    await data.createMatchRequest(db, ALICE, CARA, 80);
    await data.blockUser(db, BOB, ALICE);
    const rows = await rawDb.select().from(schema.matchRequests);
    const status = (from: string, to: string) =>
      rows.find((r) => r.fromUserId === from && r.toUserId === to)!.status;
    expect(status(ALICE, BOB)).toBe("expired");
    expect(status(BOB, ALICE)).toBe("expired");
    expect(status(ALICE, CARA)).toBe("pending");
  });

  it("cascades away when either account is deleted", async () => {
    await data.blockUser(db, ALICE, BOB);
    await rawDb.delete(schema.users).where(eq(schema.users.id, BOB));
    expect(await rawDb.select().from(schema.userBlocks)).toEqual([]);
  });
});

// ---------- players ----------

describe("players respect blocks (both directions)", () => {
  beforeEach(async () => {
    await data.blockUser(db, ALICE, BOB);
  });

  it("listPlayers omits the other side for both users, but not for others", async () => {
    // (The list includes the caller themself, as before.)
    expect(ids(await data.listPlayers(db, ALICE))).toEqual([ADMIN, ALICE, CARA].sort());
    expect(ids(await data.listPlayers(db, BOB))).toEqual([ADMIN, BOB, CARA].sort());
    expect(ids(await data.listPlayers(db, CARA))).toContain(BOB);
  });

  it("getPlayer 404s across a block (but not for self or third parties)", async () => {
    await expect(data.getPlayer(db, BOB, ALICE)).rejects.toBeInstanceOf(NotFoundError);
    await expect(data.getPlayer(db, ALICE, BOB)).rejects.toBeInstanceOf(NotFoundError);
    expect((await data.getPlayer(db, BOB, CARA)).id).toBe(BOB);
    expect((await data.getPlayer(db, ALICE, ALICE)).id).toBe(ALICE);
  });

  it("lookupPlayerByEmail 404s across a block", async () => {
    await expect(data.lookupPlayerByEmail(db, "bob@example.com", ALICE)).rejects.toBeInstanceOf(NotFoundError);
    await expect(data.lookupPlayerByEmail(db, "alice@example.com", BOB)).rejects.toBeInstanceOf(NotFoundError);
    expect((await data.lookupPlayerByEmail(db, "bob@example.com", CARA)).id).toBe(BOB);
  });

  it("getMatchSuggestions excludes the other side for both users", async () => {
    expect(ids(await data.getMatchSuggestions(db, ALICE))).toEqual([CARA]);
    expect(ids(await data.getMatchSuggestions(db, BOB))).toEqual([CARA]);
    expect(ids(await data.getMatchSuggestions(db, CARA))).toEqual([ALICE, BOB].sort());
  });

  it("getCompatibility 404s across a block", async () => {
    await expect(data.getCompatibility(db, ALICE, BOB)).rejects.toBeInstanceOf(NotFoundError);
    await expect(data.getCompatibility(db, BOB, ALICE)).rejects.toBeInstanceOf(NotFoundError);
    expect((await data.getCompatibility(db, ALICE, CARA)).player.id).toBe(CARA);
  });

  it("notifyNewCompatiblePlayer never notifies the other side", async () => {
    const recipients = await data.notifyNewCompatiblePlayer(db, ALICE);
    expect(recipients.map((r) => r.userId)).toEqual([CARA]);
  });

  it("unblocking restores visibility", async () => {
    await data.unblockUser(db, ALICE, BOB);
    expect(ids(await data.listPlayers(db, ALICE))).toContain(BOB);
    expect(ids(await data.getMatchSuggestions(db, BOB))).toContain(ALICE);
  });
});

// ---------- matches / open games ----------

describe("matches and open games respect blocks", () => {
  it("listMatches hides games created by, joined by, or shared with the other side", async () => {
    const bobOpen = await data.createMatch(db, BOB, { date: "2026-11-01" });
    const caraOpen = await data.createMatch(db, CARA, { date: "2026-11-02" });
    const caraWithBob = await data.createMatch(db, CARA, { date: "2026-11-03" });
    expect(await data.joinOpenMatch(db, BOB, caraWithBob.id)).toBe(true);

    await data.blockUser(db, ALICE, BOB);
    const aliceSees = ids(await data.listMatches(db, ALICE));
    expect(aliceSees).toEqual([caraOpen.id]);
    const bobMine = ids(await data.listMatches(db, BOB, true));
    expect(bobMine.sort()).toEqual([bobOpen.id, caraWithBob.id].sort()); // no Alice involved
    expect(ids(await data.listMatches(db, CARA)).length).toBe(3);
  });

  it("a game between the two is hidden from both after a block", async () => {
    const m = await data.createMatch(db, ALICE, {});
    await data.joinOpenMatch(db, BOB, m.id);
    await data.blockUser(db, BOB, ALICE);
    expect(await data.listMatches(db, ALICE, true)).toEqual([]);
    expect(await data.listMatches(db, BOB, true)).toEqual([]);
  });

  it("joinOpenMatch refuses a game created by the other side (either direction)", async () => {
    const bobOpen = await data.createMatch(db, BOB, {});
    const aliceOpen = await data.createMatch(db, ALICE, {});
    await data.blockUser(db, ALICE, BOB);
    expect(await data.joinOpenMatch(db, ALICE, bobOpen.id)).toBe(false);
    expect(await data.joinOpenMatch(db, BOB, aliceOpen.id)).toBe(false);
    expect(await data.joinOpenMatch(db, CARA, bobOpen.id)).toBe(true);
  });

  it("createMatch with player2 is refused across a block even for accepted connections", async () => {
    const r = await data.createMatchRequest(db, ALICE, BOB, 70);
    await data.updateMatchRequest(db, BOB, r.id, { status: "accepted" });
    await data.blockUser(db, BOB, ALICE);
    await expect(data.createMatch(db, ALICE, { player2Id: BOB })).rejects.toBeInstanceOf(AuthzError);
  });
});

// ---------- match requests ----------

describe("match requests respect blocks", () => {
  it("createMatchRequest is refused in both directions", async () => {
    await data.blockUser(db, ALICE, BOB);
    await expect(data.createMatchRequest(db, ALICE, BOB, 50)).rejects.toBeInstanceOf(AuthzError);
    await expect(data.createMatchRequest(db, BOB, ALICE, 50)).rejects.toBeInstanceOf(AuthzError);
  });

  it("listMatchRequests hides requests with the other side", async () => {
    await data.createMatchRequest(db, BOB, ALICE, 50);
    await data.createMatchRequest(db, CARA, ALICE, 50);
    await data.blockUser(db, ALICE, BOB);
    const list = await data.listMatchRequests(db, ALICE);
    expect(list.map((r) => r.fromUserId)).toEqual([CARA]);
    expect(await data.listMatchRequests(db, BOB)).toEqual([]);
  });

  it("updateMatchRequest cannot accept a request across a block", async () => {
    const r = await data.createMatchRequest(db, BOB, ALICE, 50);
    await data.blockUser(db, BOB, ALICE);
    await expect(
      data.updateMatchRequest(db, ALICE, r.id, { status: "accepted" })
    ).rejects.toBeInstanceOf(AuthzError);
  });
});

// ---------- conversations & messages ----------

describe("conversations and messages respect blocks", () => {
  it("createDirectConversation is refused in both directions", async () => {
    await data.blockUser(db, ALICE, BOB);
    await expect(data.createDirectConversation(db, ALICE, BOB)).rejects.toBeInstanceOf(AuthzError);
    await expect(data.createDirectConversation(db, BOB, ALICE)).rejects.toBeInstanceOf(AuthzError);
  });

  it("createGroupConversation is refused when it would include the other side", async () => {
    await data.blockUser(db, BOB, ALICE);
    await expect(
      data.createGroupConversation(db, ALICE, [ALICE, BOB], "", "x", "hi")
    ).rejects.toBeInstanceOf(AuthzError);
    // Third parties are unaffected.
    const c = await data.createGroupConversation(db, CARA, [CARA, BOB], "", "x", "hi");
    expect(c.participants).toContain(BOB);
  });

  it("an existing 1:1 thread is hidden from both lists, unreachable, and returns on unblock", async () => {
    const conv = await data.createDirectConversation(db, ALICE, BOB);
    await data.sendMessage(db, BOB, conv.id, "hey");
    // A 2-player match group (with Rally) counts as a 1:1 thread too.
    const group = await data.createGroupConversation(db, ALICE, [ALICE, BOB], "", "A & B", "hi");
    const caraConv = await data.createDirectConversation(db, ALICE, CARA);

    await data.blockUser(db, ALICE, BOB);

    expect(ids(await data.listConversations(db, ALICE))).toEqual([caraConv.id]);
    expect(await data.listConversations(db, BOB)).toEqual([]);
    for (const [me, id] of [[ALICE, conv.id], [BOB, conv.id], [BOB, group.id]] as const) {
      await expect(data.getConversation(db, me, id)).rejects.toBeInstanceOf(NotFoundError);
      await expect(data.listMessages(db, me, id)).rejects.toBeInstanceOf(NotFoundError);
      await expect(data.sendMessage(db, me, id, "x")).rejects.toBeInstanceOf(NotFoundError);
      await expect(data.deleteConversation(db, me, id)).rejects.toBeInstanceOf(NotFoundError);
    }

    await data.unblockUser(db, ALICE, BOB);
    expect(ids(await data.listConversations(db, BOB))).toEqual([conv.id, group.id].sort());
    expect((await data.listMessages(db, ALICE, conv.id)).map((m) => m.text)).toEqual(["hey"]);
  });

  it("in a larger group: stays visible, blocked member's messages are hidden, neither can post", async () => {
    const g = await data.createGroupConversation(db, CARA, [CARA, ALICE, BOB], "", "Doubles", "hi");
    await data.sendMessage(db, BOB, g.id, "from bob");
    await data.sendMessage(db, ALICE, g.id, "from alice");
    await data.blockUser(db, ALICE, BOB);

    expect(ids(await data.listConversations(db, ALICE))).toEqual([g.id]);
    const aliceView = (await data.listMessages(db, ALICE, g.id)).map((m) => m.text);
    expect(aliceView).toEqual(["hi", "from alice"]);
    const bobView = (await data.listMessages(db, BOB, g.id)).map((m) => m.text);
    expect(bobView).toEqual(["hi", "from bob"]);
    const caraView = (await data.listMessages(db, CARA, g.id)).map((m) => m.text);
    expect(caraView).toEqual(["hi", "from bob", "from alice"]);

    await expect(data.sendMessage(db, ALICE, g.id, "x")).rejects.toBeInstanceOf(AuthzError);
    await expect(data.sendMessage(db, BOB, g.id, "x")).rejects.toBeInstanceOf(AuthzError);
    expect((await data.sendMessage(db, CARA, g.id, "still works")).text).toBe("still works");
  });

  it("the direct conversation id is deterministic, so a stale link can't bypass the block", async () => {
    await data.createDirectConversation(db, ALICE, BOB);
    await data.blockUser(db, BOB, ALICE);
    await expect(
      data.getConversation(db, ALICE, directConversationId(ALICE, BOB))
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ---------- contacts ----------

describe("contacts respect blocks", () => {
  it("addContact is refused and existing contacts are hidden", async () => {
    await data.addContact(db, ALICE, { id: BOB, name: "Bob" });
    await data.addContact(db, ALICE, { id: CARA, name: "Cara" });
    await data.blockUser(db, BOB, ALICE);
    expect((await data.listContacts(db, ALICE)).map((c) => c.id)).toEqual([CARA]);
    await expect(data.addContact(db, BOB, { id: ALICE })).rejects.toBeInstanceOf(AuthzError);
    // Unblock restores the existing contact row.
    await data.unblockUser(db, BOB, ALICE);
    expect((await data.listContacts(db, ALICE)).map((c) => c.id).sort()).toEqual([BOB, CARA].sort());
  });
});

// ---------- reports ----------

describe("createReport", () => {
  it("files a profile report", async () => {
    const { report, adminIds } = await data.createReport(db, ALICE, {
      reportedUserId: BOB,
      reason: "harassment",
      details: "  rude  ",
    });
    expect(report.status).toBe("open");
    expect(adminIds).toEqual([]);
    const [row] = await rawDb.select().from(schema.userReports);
    expect(row).toMatchObject({
      reporterId: ALICE,
      reportedUserId: BOB,
      context: "profile",
      reason: "harassment",
      details: "rude",
      messageId: null,
    });
  });

  it("validates reason, self, target, and caps details", async () => {
    await expect(data.createReport(db, ALICE, { reportedUserId: BOB, reason: "nope" })).rejects.toBeInstanceOf(BadRequestError);
    await expect(data.createReport(db, ALICE, { reportedUserId: ALICE, reason: "spam" })).rejects.toBeInstanceOf(AuthzError);
    await expect(data.createReport(db, ALICE, { reportedUserId: "ghost", reason: "spam" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(data.createReport(db, ALICE, { reason: "spam" })).rejects.toBeInstanceOf(BadRequestError);
    await expect(data.createReport(db, ALICE, { reportedUserId: RALLY_ID, reason: "spam" })).rejects.toBeInstanceOf(BadRequestError);
    await data.createReport(db, ALICE, { reportedUserId: BOB, reason: "other", details: "x".repeat(5000), context: "conversation" });
    const [row] = await rawDb.select().from(schema.userReports);
    expect(row.details.length).toBe(data.REPORT_DETAILS_MAX);
    expect(row.context).toBe("conversation");
  });

  it("message reports derive the sender + snapshot server-side and require participation", async () => {
    const conv = await data.createDirectConversation(db, ALICE, BOB);
    const msg = await data.sendMessage(db, BOB, conv.id, "nasty words");
    // The client can't misattribute: reportedUserId is ignored for message reports.
    await data.createReport(db, ALICE, { messageId: msg.id, reportedUserId: CARA, reason: "harassment" });
    const [row] = await rawDb.select().from(schema.userReports);
    expect(row).toMatchObject({
      reportedUserId: BOB,
      context: "message",
      messageId: msg.id,
      messageText: "nasty words",
      conversationId: conv.id,
    });
    await expect(data.createReport(db, CARA, { messageId: msg.id, reason: "spam" })).rejects.toBeInstanceOf(AuthzError);
    await expect(data.createReport(db, BOB, { messageId: msg.id, reason: "spam" })).rejects.toBeInstanceOf(AuthzError); // own message
    await expect(data.createReport(db, ALICE, { messageId: "ghost", reason: "spam" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("reports on a Rally reply are tagged 'rally'", async () => {
    const g = await data.createGroupConversation(db, ALICE, [ALICE, BOB], "", "x", "Rally says hi");
    const [intro] = await data.listMessages(db, ALICE, g.id);
    await data.createReport(db, ALICE, { messageId: intro.id, reason: "inappropriate_ai" });
    const [row] = await rawDb.select().from(schema.userReports);
    expect(row).toMatchObject({ reportedUserId: RALLY_ID, context: "rally", messageText: "Rally says hi" });
  });

  it("works after blocking, and the evidence survives conversation + reporter deletion", async () => {
    const conv = await data.createDirectConversation(db, ALICE, BOB);
    const msg = await data.sendMessage(db, BOB, conv.id, "threat");
    await data.blockUser(db, ALICE, BOB);
    await data.createReport(db, ALICE, { messageId: msg.id, reason: "violence" });
    // Delete the conversation (cascades the message) and the reporter's account.
    await rawDb.delete(schema.conversations).where(eq(schema.conversations.id, conv.id));
    await rawDb.delete(schema.users).where(eq(schema.users.id, ALICE));
    const [row] = await rawDb.select().from(schema.userReports);
    expect(row).toMatchObject({ reporterId: null, messageId: null, messageText: "threat", reportedUserId: BOB });
  });

  it("notifies admins from ADMIN_EMAILS in-app and returns their ids", async () => {
    process.env.ADMIN_EMAILS = " admin@example.com , nobody@example.com";
    const { adminIds } = await data.createReport(db, ALICE, { reportedUserId: BOB, reason: "spam" });
    expect(adminIds).toEqual([ADMIN]);
    const notes = await data.listNotifications(db, ADMIN);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ type: "report", link: "/dashboard/admin/reports" });
    expect(notes[0].body).toContain("Bob J.");
    // The reported user and reporter get nothing.
    expect(await data.listNotifications(db, BOB)).toEqual([]);
  });
});

describe("moderation authz", () => {
  beforeEach(async () => {
    await data.createReport(db, ALICE, { reportedUserId: BOB, reason: "spam" });
  });

  it("non-admins (and everyone, when ADMIN_EMAILS is unset) can't list or update reports", async () => {
    const [r] = await rawDb.select().from(schema.userReports);
    await expect(data.listReports(db, ADMIN)).rejects.toBeInstanceOf(AuthzError);
    process.env.ADMIN_EMAILS = "admin@example.com";
    await expect(data.listReports(db, ALICE)).rejects.toBeInstanceOf(AuthzError);
    await expect(data.listReports(db, BOB)).rejects.toBeInstanceOf(AuthzError);
    await expect(data.updateReportStatus(db, ALICE, r.id, "reviewed")).rejects.toBeInstanceOf(AuthzError);
    expect(await data.isAdmin(db, ALICE)).toBe(false);
    expect(await data.isAdmin(db, ADMIN)).toBe(true);
    expect(await data.isAdmin(db, "ghost")).toBe(false);
  });

  it("admins list open reports with names, then move them through statuses", async () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    const [r] = await data.listReports(db, ADMIN);
    expect(r).toMatchObject({
      reporter: { id: ALICE, name: "Alice S." },
      reported: { id: BOB, name: "Bob J.", email: "bob@example.com" },
      reason: "spam",
      status: "open",
    });

    expect(await data.updateReportStatus(db, ADMIN, r.id, "actioned")).toEqual({ id: r.id, status: "actioned" });
    expect(await data.listReports(db, ADMIN)).toEqual([]);
    const [actioned] = await data.listReports(db, ADMIN, "actioned");
    expect(actioned.reviewedAt).toEqual(expect.any(String));
    expect((await data.listReports(db, ADMIN, "all")).length).toBe(1);
    const [stored] = await rawDb.select().from(schema.userReports);
    expect(stored.reviewedBy).toBe(ADMIN);

    await data.updateReportStatus(db, ADMIN, r.id, "open");
    const [reopened] = await rawDb.select().from(schema.userReports);
    expect(reopened.reviewedBy).toBeNull();

    await expect(data.updateReportStatus(db, ADMIN, r.id, "bogus")).rejects.toBeInstanceOf(BadRequestError);
    await expect(data.updateReportStatus(db, ADMIN, "ghost", "reviewed")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("shows a deleted reporter as '(deleted account)'", async () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    await rawDb.delete(schema.users).where(eq(schema.users.id, ALICE));
    const [r] = await data.listReports(db, ADMIN);
    expect(r.reporter).toEqual({ id: null, name: "(deleted account)", email: null });
  });
});
