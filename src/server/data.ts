import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { getDb } from "@/db";
import {
  contacts,
  conversationParticipants,
  conversations,
  matchRequests,
  matches,
  messages,
  notifications,
  pushSubscriptions,
  users,
  type DbConversation,
  type DbMatch,
  type DbMessage,
  type DbUser,
} from "@/db/schema";

/**
 * Server data layer. Every function takes the Drizzle db and the SESSION user
 * id (`me`) and enforces authorization here (the logic that used to live in the
 * old database security rules). Route handlers stay thin.
 *
 * Errors: throws AuthzError for permission failures (routes map to 403),
 * NotFoundError for missing rows (404).
 */

import { notifyChange } from "./realtime";
import { displayName, ageBracket } from "@/lib/privacy";
import { findMatches, type UserProfile, type SportType, type MatchFormat, type GameType } from "@/lib/matching-engine";

export class AuthzError extends Error {}
export class NotFoundError extends Error {}

type Db = ReturnType<typeof getDb>;

export const RALLY_ID = "rally";

// ---------- serialization ----------

/**
 * Public player card shown to OTHER users. Deliberately privacy-minimized:
 * first name + last initial only (`name`), a 5-year `ageBracket` instead of the
 * exact age, and NO email, last name, availability, or partner preferences.
 * (A user's own full profile comes from /api/me, not this.)
 */
export function toPublicPlayer(u: DbUser) {
  return {
    id: u.id,
    name: displayName(u.firstName, u.lastName),
    firstName: u.firstName ?? undefined,
    ageBracket: ageBracket(u.age ?? undefined),
    gender: u.gender ?? undefined,
    avatar: u.avatar ?? u.image ?? "",
    photoURL: u.photoUrl ?? undefined,
    ntrpRating: u.ntrpRating ?? 0,
    sport: (u.sport as "tennis" | "pickleball" | "both") ?? "both",
    sports: u.sports ?? undefined,
    matchFormats: u.matchFormats ?? undefined,
    gameType: u.gameType ?? undefined,
    profileComplete: u.profileComplete,
    matchesPlayed: u.matchesPlayed,
    wins: u.wins,
    losses: u.losses,
    bio: u.bio ?? "",
    aboutMe: u.aboutMe ?? undefined,
    location: u.location ?? "",
    email: "", // private — use lookupPlayerByEmail for explicit contact adds
    availability: [] as string[],
    preferredTimes: [] as string[],
    joinedDate: u.createdAt.toISOString(),
  };
}

/** Build a matching-engine profile from a DB row (server-side; uses real data). */
function dbUserToProfile(u: DbUser): UserProfile | null {
  if (!u.profileComplete || !u.firstName || !u.weeklyAvailability || !u.partnerPreferences) {
    return null;
  }
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName ?? "",
    age: u.age ?? 30,
    gender: u.gender ?? "Prefer not to say",
    avatar: u.avatar ?? "",
    aboutMe: u.aboutMe ?? u.bio ?? undefined,
    ntrpRating: u.ntrpRating ?? 0,
    sports: (u.sports as SportType[]) ?? ["tennis"],
    matchFormats: (u.matchFormats as MatchFormat[]) ?? ["singles"],
    gameType: (u.gameType as GameType) ?? "slightly-competitive",
    availability: u.weeklyAvailability,
    partnerPreferences: u.partnerPreferences,
    profileComplete: true,
  };
}

function toMatch(m: DbMatch) {
  return {
    ...m,
    player2Id: m.player2Id ?? "",
    score: m.score ?? undefined,
    matchType: (m.matchType as "singles" | "doubles" | null) ?? undefined,
    notes: m.notes ?? undefined,
    createdBy: m.createdBy ?? undefined,
    acceptedBy: m.acceptedBy ?? undefined,
    conversationId: m.conversationId ?? undefined,
    cancelledBy: m.cancelledBy ?? undefined,
    cancelReason: m.cancelReason ?? undefined,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

function toConversation(c: DbConversation, unread: Record<string, number>, participants: string[]) {
  return {
    id: c.id,
    type: c.type as "direct" | "group",
    name: c.name ?? undefined,
    matchId: c.matchId ?? undefined,
    createdBy: c.createdBy ?? undefined,
    lastMessage: c.lastMessage,
    lastMessageAt: c.lastMessageAt.toISOString(),
    createdAt: c.createdAt.toISOString(),
    participants,
    unread,
  };
}

function toMessage(m: DbMessage) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    senderName: m.senderName,
    text: m.text,
    isAI: m.isAi || undefined,
    createdAt: m.createdAt.toISOString(),
    readBy: [] as string[],
  };
}

// ---------- players ----------

export async function listPlayers(db: Db) {
  const rows = await db.select().from(users);
  return rows.filter((u) => u.id !== RALLY_ID).map(toPublicPlayer);
}

export async function getPlayer(db: Db, id: string) {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!row) throw new NotFoundError("player");
  return toPublicPlayer(row);
}

/**
 * Ranked compatibility suggestions for the signed-in user. Runs the matching
 * engine server-side over real profiles, then returns only privacy-safe public
 * player cards (name + ageBracket) with a `matchScore`. Exact ages / partner
 * preferences never leave the server.
 */
export async function getMatchSuggestions(db: Db, me: string) {
  const rows = await db.select().from(users);
  const meRow = rows.find((u) => u.id === me);
  const myProfile = meRow ? dbUserToProfile(meRow) : null;
  if (!myProfile) return [];

  const others = rows
    .filter((u) => u.id !== me && u.id !== RALLY_ID)
    .map(dbUserToProfile)
    .filter((p): p is UserProfile => p !== null);

  const results = findMatches(myProfile, others);
  const byId = new Map(rows.map((u) => [u.id, u]));
  return results.map((r) => ({
    ...toPublicPlayer(byId.get(r.user.id)!),
    matchScore: r.score,
  }));
}

/** Exact-email lookup for explicit contact adds; returns email on match. */
export async function lookupPlayerByEmail(db: Db, email: string) {
  const [row] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
    .limit(1);
  if (!row || row.id === RALLY_ID) throw new NotFoundError("player");
  return { ...toPublicPlayer(row), email: row.email ?? "" };
}

// ---------- matches ----------

export async function listMatches(db: Db, me: string, mineOnly = false) {
  const rows = mineOnly
    ? await db.select().from(matches).where(sql`${matches.participants} @> ${JSON.stringify([me])}`)
    : await db.select().from(matches);
  return rows.map(toMatch);
}

export async function createMatch(db: Db, me: string, data: Record<string, unknown>) {
  const player2 = typeof data.player2Id === "string" && data.player2Id ? data.player2Id : null;
  const [row] = await db
    .insert(matches)
    .values({
      player1Id: me, // creator is always player1 — client can't forge
      player2Id: player2,
      date: String(data.date ?? ""),
      time: String(data.time ?? ""),
      location: String(data.location ?? ""),
      sport: String(data.sport ?? "tennis"),
      status: String(data.status ?? "open"),
      compatibilityScore: Number(data.compatibilityScore ?? 0),
      matchExplanation: String(data.matchExplanation ?? ""),
      matchType: data.matchType ? String(data.matchType) : null,
      notes: data.notes ? String(data.notes) : null,
      createdBy: me,
      participants: [me, ...(player2 ? [player2] : [])],
    })
    .returning();
  return toMatch(row);
}

const MATCH_PATCHABLE = new Set([
  "status", "score", "date", "time", "location", "notes", "conversationId",
  "player2Id", "acceptedBy", "participants", "cancelledBy", "cancelReason",
]);

export async function updateMatch(
  db: Db,
  me: string,
  matchId: string,
  data: Record<string, unknown>
) {
  const [m] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!m) throw new NotFoundError("match");
  const involved = m.player1Id === me || m.player2Id === me || m.createdBy === me ||
    (m.participants ?? []).includes(me);
  if (!involved) throw new AuthzError("not a participant of this match");

  const update: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(data)) {
    if (MATCH_PATCHABLE.has(k)) update[k] = v;
  }

  // Roster fields may only be CLEARED via PATCH (withdraw/decline flows) —
  // adding players goes through the transactional join endpoint.
  if (data.player2Id !== undefined && data.player2Id !== "") {
    throw new AuthzError("player2Id can only be cleared; use the join endpoint");
  }
  if (data.acceptedBy !== undefined && data.acceptedBy !== "") {
    throw new AuthzError("acceptedBy can only be cleared");
  }
  if (data.participants !== undefined) {
    const next = Array.isArray(data.participants) ? data.participants.map(String) : [];
    const current = m.participants ?? [];
    if (!next.every((p) => current.includes(p))) {
      throw new AuthzError("participants can only be reduced, not extended");
    }
  }

  // Completing a match with a winner updates both players' stats server-side.
  // The winner must actually be one of the match's players (or a tie).
  const winnerId = typeof data.winnerId === "string" && data.winnerId ? data.winnerId : null;
  const completing = data.status === "completed" && m.status !== "completed";
  if (completing && winnerId && winnerId !== "tie" &&
      winnerId !== m.player1Id && winnerId !== m.player2Id) {
    throw new AuthzError("winner must be one of the match players");
  }

  const [row] = await db.update(matches).set(update).where(eq(matches.id, matchId)).returning();

  if (completing) {
    const ids = [m.player1Id, m.player2Id].filter((x): x is string => Boolean(x));
    for (const id of ids) {
      const win = winnerId === id ? 1 : 0;
      const loss = winnerId && winnerId !== "tie" && winnerId !== id ? 1 : 0;
      await db
        .update(users)
        .set({
          matchesPlayed: sql`${users.matchesPlayed} + 1`,
          wins: sql`${users.wins} + ${win}`,
          losses: sql`${users.losses} + ${loss}`,
        })
        .where(eq(users.id, id));
    }
  }
  return toMatch(row);
}

export async function deleteMatch(db: Db, me: string, matchId: string) {
  const [m] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!m) throw new NotFoundError("match");
  if (m.player1Id !== me && m.createdBy !== me) throw new AuthzError("only the creator can delete");
  await db.delete(matches).where(eq(matches.id, matchId));
}

/** Transactional join — fails cleanly if the match is no longer open. */
export async function joinOpenMatch(db: Db, me: string, matchId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [m] = await tx
      .select()
      .from(matches)
      .where(eq(matches.id, matchId))
      .for("update")
      .limit(1);
    if (!m || m.status !== "open" || m.player2Id) return false;
    if (m.player1Id === me) return false; // can't join your own match
    await tx
      .update(matches)
      .set({
        player2Id: me,
        acceptedBy: me,
        status: "pending",
        participants: [m.player1Id, me],
        updatedAt: new Date(),
      })
      .where(eq(matches.id, matchId));
    return true;
  });
}

// ---------- match requests ----------

export async function listMatchRequests(db: Db, me: string) {
  const rows = await db
    .select()
    .from(matchRequests)
    .where(or(eq(matchRequests.fromUserId, me), eq(matchRequests.toUserId, me)));
  return rows.map((r) => ({
    ...r,
    conversationId: r.conversationId ?? undefined,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createMatchRequest(db: Db, me: string, toUserId: string, score: number) {
  if (toUserId === me) throw new AuthzError("cannot request yourself");
  const [row] = await db
    .insert(matchRequests)
    .values({ fromUserId: me, toUserId, score, status: "pending" })
    .returning();
  await db.insert(notifications).values({
    userId: toUserId,
    type: "match_request",
    title: "New Match Request!",
    body: `Someone wants to match with you! (${score}% compatible)`,
    link: "/dashboard",
  });
  return { ...row, createdAt: row.createdAt.toISOString() };
}

export async function updateMatchRequest(
  db: Db,
  me: string,
  requestId: string,
  data: { status?: string; conversationId?: string }
) {
  const [r] = await db.select().from(matchRequests).where(eq(matchRequests.id, requestId)).limit(1);
  if (!r) throw new NotFoundError("request");
  // Recipient may accept/decline; sender may cancel (set expired) or attach conv.
  const isRecipient = r.toUserId === me;
  const isSender = r.fromUserId === me;
  if (!isRecipient && !isSender) throw new AuthzError("not your request");
  if (data.status && ["accepted", "declined"].includes(data.status) && !isRecipient) {
    throw new AuthzError("only the recipient can accept or decline");
  }
  const [row] = await db
    .update(matchRequests)
    .set({
      ...(data.status ? { status: data.status } : {}),
      ...(data.conversationId !== undefined ? { conversationId: data.conversationId } : {}),
    })
    .where(eq(matchRequests.id, requestId))
    .returning();
  return { ...row, createdAt: row.createdAt.toISOString() };
}

// ---------- conversations ----------

async function participantsOf(db: Db, conversationId: string) {
  const rows = await db
    .select()
    .from(conversationParticipants)
    .where(eq(conversationParticipants.conversationId, conversationId));
  return rows;
}

async function assertParticipant(db: Db, me: string, conversationId: string) {
  const rows = await participantsOf(db, conversationId);
  if (!rows.some((p) => p.userId === me)) throw new AuthzError("not a participant");
  return rows;
}

export async function listConversations(db: Db, me: string) {
  const mine = await db
    .select()
    .from(conversationParticipants)
    .where(eq(conversationParticipants.userId, me));
  if (mine.length === 0) return [];
  const ids = mine.map((p) => p.conversationId);
  const convs = await db
    .select()
    .from(conversations)
    .where(inArray(conversations.id, ids))
    .orderBy(desc(conversations.lastMessageAt));
  const allParts = await db
    .select()
    .from(conversationParticipants)
    .where(inArray(conversationParticipants.conversationId, ids));
  return convs.map((c) => {
    const parts = allParts.filter((p) => p.conversationId === c.id);
    const meRow = parts.find((p) => p.userId === me);
    return toConversation(c, { [me]: meRow?.unreadCount ?? 0 }, parts.map((p) => p.userId));
  });
}

export async function getConversation(db: Db, me: string, conversationId: string) {
  const parts = await assertParticipant(db, me, conversationId);
  const [c] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  if (!c) throw new NotFoundError("conversation");
  const meRow = parts.find((p) => p.userId === me);
  return toConversation(c, { [me]: meRow?.unreadCount ?? 0 }, parts.map((p) => p.userId));
}

export function directConversationId(a: string, b: string): string {
  return `direct_${[a, b].sort().join("_")}`;
}

export async function createDirectConversation(db: Db, me: string, otherUserId: string) {
  if (otherUserId === me) throw new AuthzError("cannot chat with yourself");
  const id = directConversationId(me, otherUserId);
  const [existing] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  if (existing) return getConversation(db, me, id);

  await db.transaction(async (tx) => {
    await tx.insert(conversations).values({ id, type: "direct", createdBy: me });
    await tx.insert(conversationParticipants).values([
      { conversationId: id, userId: me },
      { conversationId: id, userId: otherUserId },
    ]);
  });
  await notifyChange(db, { conversationId: id, participants: [me, otherUserId] });
  return getConversation(db, me, id);
}

export async function createGroupConversation(
  db: Db,
  me: string,
  participantIds: string[],
  matchId: string,
  name: string,
  rallyIntro: string
) {
  if (!participantIds.includes(me)) throw new AuthzError("creator must be a participant");
  const humanIds = [...new Set(participantIds.filter((p) => p !== RALLY_ID))];

  const convId = await db.transaction(async (tx) => {
    const [c] = await tx
      .insert(conversations)
      .values({
        type: "group",
        name,
        matchId: matchId || null,
        createdBy: me,
        lastMessage: rallyIntro,
      })
      .returning();
    await tx.insert(conversationParticipants).values([
      ...humanIds.map((uid) => ({
        conversationId: c.id,
        userId: uid,
        unreadCount: uid === me ? 0 : 1,
      })),
      { conversationId: c.id, userId: RALLY_ID, unreadCount: 0 },
    ]);
    await tx.insert(messages).values({
      conversationId: c.id,
      senderId: RALLY_ID,
      senderName: "Rally",
      text: rallyIntro,
      isAi: true,
    });
    return c.id;
  });
  await notifyChange(db, { conversationId: convId, participants: humanIds });
  return getConversation(db, me, convId);
}

export async function deleteConversation(db: Db, me: string, conversationId: string) {
  const parts = await assertParticipant(db, me, conversationId);
  // messages + participants cascade via FK
  await db.delete(conversations).where(eq(conversations.id, conversationId));
  await notifyChange(db, { conversationId, participants: parts.map((p) => p.userId) });
}

export async function markConversationRead(db: Db, me: string, conversationId: string) {
  await db
    .update(conversationParticipants)
    .set({ unreadCount: 0, lastReadAt: new Date() })
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, me)
      )
    );
  // Only my own unread badge changed — wake my other tabs.
  await notifyChange(db, { conversationId, participants: [me] });
}

// ---------- messages ----------

export async function listMessages(db: Db, me: string, conversationId: string) {
  await assertParticipant(db, me, conversationId);
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));
  return rows.map(toMessage);
}

export async function sendMessage(db: Db, me: string, conversationId: string, text: string) {
  const parts = await assertParticipant(db, me, conversationId);
  const [sender] = await db.select().from(users).where(eq(users.id, me)).limit(1);
  const senderName = sender?.firstName || sender?.name || "Player";

  const msg = await db.transaction(async (tx) => {
    const [m] = await tx
      .insert(messages)
      .values({ conversationId, senderId: me, senderName, text })
      .returning();
    await tx
      .update(conversations)
      .set({ lastMessage: text, lastMessageAt: new Date() })
      .where(eq(conversations.id, conversationId));
    for (const p of parts) {
      if (p.userId !== me && p.userId !== RALLY_ID) {
        await tx
          .update(conversationParticipants)
          .set({ unreadCount: sql`${conversationParticipants.unreadCount} + 1` })
          .where(
            and(
              eq(conversationParticipants.conversationId, conversationId),
              eq(conversationParticipants.userId, p.userId)
            )
          );
      }
    }
    return m;
  });
  await notifyChange(db, {
    conversationId,
    participants: parts.map((p) => p.userId).filter((u) => u !== RALLY_ID),
  });
  return toMessage(msg);
}

/** Insert a message from Rally (the AI). Bumps unread for all human members. */
export async function insertRallyMessage(db: Db, conversationId: string, text: string) {
  const parts = await participantsOf(db, conversationId);
  if (!parts.some((p) => p.userId === RALLY_ID)) return; // Rally not in this chat

  const msg = await db.transaction(async (tx) => {
    const [m] = await tx
      .insert(messages)
      .values({ conversationId, senderId: RALLY_ID, senderName: "Rally", text, isAi: true })
      .returning();
    await tx
      .update(conversations)
      .set({ lastMessage: text, lastMessageAt: new Date() })
      .where(eq(conversations.id, conversationId));
    for (const p of parts) {
      if (p.userId !== RALLY_ID) {
        await tx
          .update(conversationParticipants)
          .set({ unreadCount: sql`${conversationParticipants.unreadCount} + 1` })
          .where(
            and(
              eq(conversationParticipants.conversationId, conversationId),
              eq(conversationParticipants.userId, p.userId)
            )
          );
      }
    }
    return m;
  });
  await notifyChange(db, {
    conversationId,
    participants: parts.map((p) => p.userId).filter((u) => u !== RALLY_ID),
  });
  return toMessage(msg);
}

/** Load a conversation's messages + participant display names for Rally's prompt. */
export async function conversationContext(db: Db, conversationId: string) {
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));
  const parts = await participantsOf(db, conversationId);
  const names: Record<string, string> = {};
  const humanIds = parts.map((p) => p.userId).filter((u) => u !== RALLY_ID);
  if (humanIds.length) {
    const rows = await db.select().from(users).where(inArray(users.id, humanIds));
    for (const u of rows) names[u.id] = u.firstName || u.name || "Player";
  }
  const hasRally = parts.some((p) => p.userId === RALLY_ID);
  return { messages: msgs.map(toMessage), names, hasRally };
}

// ---------- contacts ----------

export async function listContacts(db: Db, me: string) {
  const rows = await db.select().from(contacts).where(eq(contacts.userId, me));
  return rows.map((c) => ({
    id: c.contactId,
    name: c.name,
    email: c.email ?? undefined,
    avatar: c.avatar ?? undefined,
    addedAt: c.addedAt.toISOString(),
  }));
}

export async function addContact(
  db: Db,
  me: string,
  contact: { id: string; name?: string; email?: string; avatar?: string }
) {
  if (contact.id === me) throw new AuthzError("cannot add yourself");
  await db
    .insert(contacts)
    .values({
      userId: me,
      contactId: contact.id,
      name: contact.name ?? "",
      email: contact.email ?? null,
      avatar: contact.avatar ?? null,
    })
    .onConflictDoNothing();
}

export async function removeContact(db: Db, me: string, contactId: string) {
  await db
    .delete(contacts)
    .where(and(eq(contacts.userId, me), eq(contacts.contactId, contactId)));
}

// ---------- notifications ----------

export async function listNotifications(db: Db, me: string) {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, me))
    .orderBy(desc(notifications.createdAt));
  return rows.map((n) => ({
    ...n,
    link: n.link ?? undefined,
    createdAt: n.createdAt.toISOString(),
  }));
}

export async function markNotificationRead(db: Db, me: string, notificationId: string) {
  const [row] = await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, me)))
    .returning();
  if (!row) throw new NotFoundError("notification");
}

// ---------- push subscriptions (Phase 6) ----------

export async function addPushSubscription(
  db: Db,
  me: string,
  sub: { endpoint: string; p256dh: string; auth: string }
) {
  // An endpoint is unique to a browser install; upsert so it binds to `me`.
  await db
    .insert(pushSubscriptions)
    .values({ userId: me, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId: me, p256dh: sub.p256dh, auth: sub.auth },
    });
}

export async function removePushSubscription(db: Db, me: string, endpoint: string) {
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, me)));
}

/** Human participants of a conversation other than `exceptUserId`. */
export async function otherHumanParticipants(
  db: Db,
  conversationId: string,
  exceptUserId: string
): Promise<string[]> {
  const parts = await participantsOf(db, conversationId);
  return parts
    .map((p) => p.userId)
    .filter((u) => u !== RALLY_ID && u !== exceptUserId);
}
