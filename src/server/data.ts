import { and, asc, desc, eq, inArray, lt, ne, notInArray, or, sql } from "drizzle-orm";
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
  suggestionMutes,
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
import {
  findMatches,
  calculateMatchScore,
  mutualNtrpReject,
  genderPrefReject,
  sportPrefReject,
  WEIGHTS,
  type UserProfile,
  type SportType,
  type MatchFormat,
  type GameType,
  type AgeRange,
} from "@/lib/matching-engine";
import { availabilityGrid, sharedSlotsSummary, type AvailabilityGrid } from "@/lib/availability";

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
  const [meRow] = await db.select().from(users).where(eq(users.id, me)).limit(1);
  const myProfile = meRow ? dbUserToProfile(meRow) : null;
  if (!myProfile) return [];

  const muted = await db
    .select({ id: suggestionMutes.mutedUserId })
    .from(suggestionMutes)
    .where(eq(suggestionMutes.userId, me));
  const mutedIds = muted.map((m) => m.id);

  // Candidate pool filtered in SQL — only complete profiles can ever match,
  // so incomplete rows never need to leave the database. Muted players are
  // excluded from suggestions entirely (see muteSuggestion).
  const rows = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.profileComplete, true),
        ne(users.id, me),
        ne(users.id, RALLY_ID),
        ...(mutedIds.length ? [notInArray(users.id, mutedIds)] : [])
      )
    );

  const others = rows
    .map(dbUserToProfile)
    .filter((p): p is UserProfile => p !== null);

  const results = findMatches(myProfile, others);
  const byId = new Map(rows.map((u) => [u.id, u]));
  return results.map((r) => ({
    ...toPublicPlayer(byId.get(r.user.id)!),
    matchScore: r.score,
  }));
}

/**
 * Silence a suggestion: the muted player stops appearing in my Top Matches.
 * One-directional and reversible; the other player is never told.
 */
export async function muteSuggestion(db: Db, me: string, mutedUserId: string) {
  if (mutedUserId === me) throw new AuthzError("cannot mute yourself");
  const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, mutedUserId)).limit(1);
  if (!target || mutedUserId === RALLY_ID) throw new NotFoundError("player");
  await db
    .insert(suggestionMutes)
    .values({ userId: me, mutedUserId })
    .onConflictDoNothing();
}

/** Un-silence a suggestion. Idempotent. */
export async function unmuteSuggestion(db: Db, me: string, mutedUserId: string) {
  await db
    .delete(suggestionMutes)
    .where(and(eq(suggestionMutes.userId, me), eq(suggestionMutes.mutedUserId, mutedUserId)));
}

/** The players I've silenced, as privacy-safe public cards (for the manage UI). */
export async function listMutedSuggestions(db: Db, me: string) {
  const rows = await db
    .select({ user: users })
    .from(suggestionMutes)
    .innerJoin(users, eq(users.id, suggestionMutes.mutedUserId))
    .where(eq(suggestionMutes.userId, me));
  return rows.map((r) => toPublicPlayer(r.user));
}

/** Max players notified when a new compatible player completes onboarding. */
export const NEW_PLAYER_NOTIFY_LIMIT = 5;

/**
 * Called when a user completes onboarding: tells their top matches a
 * compatible new player joined. Inserts in-app notifications and returns the
 * recipients so the route can additionally send web pushes (push.ts imports
 * from this module, so the push itself can't live here).
 */
export async function notifyNewCompatiblePlayer(db: Db, newUserId: string) {
  const [row] = await db.select().from(users).where(eq(users.id, newUserId)).limit(1);
  const profile = row ? dbUserToProfile(row) : null;
  if (!row || !profile) return [];

  const others = await db
    .select()
    .from(users)
    .where(and(eq(users.profileComplete, true), ne(users.id, newUserId), ne(users.id, RALLY_ID)));
  const candidates = others.map(dbUserToProfile).filter((p): p is UserProfile => p !== null);

  // Scores are symmetric, so the new player's best matches are exactly the
  // players for whom the new player ranks highly too.
  const top = findMatches(profile, candidates).slice(0, NEW_PLAYER_NOTIFY_LIMIT);
  if (top.length === 0) return [];

  const name = displayName(row.firstName, row.lastName);
  const recipients = top.map((r) => ({ userId: r.user.id, score: r.score, name }));
  await db.insert(notifications).values(
    recipients.map((r) => ({
      userId: r.userId,
      type: "new_player",
      title: "New player joined 🎾",
      body: `${name} just joined and is ${r.score}% compatible with you — take a look!`,
      link: "/dashboard",
    }))
  );
  return recipients;
}

// ---------- compatibility breakdown (match-detail view) ----------

export type FactorState = "match" | "partial" | "miss";

/** One row of the You-vs-them comparison table. */
export interface CompatFactor {
  key: string;
  label: string;
  weight: number; // percent contribution to the total
  score: number; // 0..1 the factor scored
  state: FactorState;
  you: string;
  them: string;
}

export interface Compatibility {
  player: ReturnType<typeof toPublicPlayer>;
  score: number; // overall %, matches the engine
  factors: CompatFactor[];
  grid: AvailabilityGrid;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const sportsLabel = (s: SportType[]) =>
  s.map((x) => (x === "both" ? "Tennis & Pickleball" : cap(x))).join(", ") || "—";
const formatsLabel = (f: MatchFormat[]) =>
  f.map((x) => (x === "both" ? "Singles & Doubles" : cap(x))).join(", ") || "—";
const GAME_TYPE_LABEL: Record<GameType, string> = {
  recreational: "Recreational",
  "slightly-competitive": "Slightly competitive",
  "hardcore-competitive": "Hardcore competitive",
};
const ageLabel = (r: AgeRange) => (r === "any" ? "Any age" : `Within ${r} yrs`);
const genderLabel = (g: string) =>
  g === "Male" ? "Prefers men" : g === "Female" ? "Prefers women" : "No preference";
const daysLabel = (av: UserProfile["availability"]) => {
  const d = (av ?? []).filter((x) => x.enabled && x.slots.length > 0).map((x) => x.day);
  return d.length ? d.join(", ") : "None set";
};

/** Factor rows in display order; `val` reads each side's own profile. */
const FACTOR_META: { key: keyof typeof WEIGHTS; label: string; val: (p: UserProfile) => string }[] = [
  { key: "sport", label: "Sport", val: (p) => sportsLabel(p.sports) },
  { key: "ntrp", label: "NTRP Rating", val: (p) => p.ntrpRating.toFixed(1) },
  { key: "availability", label: "Availability", val: (p) => daysLabel(p.availability) },
  { key: "gameType", label: "Play Style", val: (p) => GAME_TYPE_LABEL[p.gameType] ?? "—" },
  { key: "matchFormat", label: "Format", val: (p) => formatsLabel(p.matchFormats) },
  { key: "age", label: "Age Preference", val: (p) => ageLabel(p.partnerPreferences.ageRange) },
  { key: "gender", label: "Partner Gender", val: (p) => genderLabel(p.partnerPreferences.genderPreference) },
];

function factorState(score: number): FactorState {
  if (score >= 0.999) return "match";
  if (score > 0) return "partial";
  return "miss";
}

/**
 * Full compatibility breakdown between the signed-in user and one other player.
 * Runs the engine over real profiles server-side, then returns privacy-safe
 * display values only: coarse preference labels (not exact ages) and the shared
 * availability grid. 404s if either profile is incomplete or the id is invalid.
 */
export async function getCompatibility(db: Db, me: string, otherId: string): Promise<Compatibility> {
  if (otherId === me || otherId === RALLY_ID) throw new NotFoundError("match");
  const rows = await db.select().from(users).where(inArray(users.id, [me, otherId]));
  const meRow = rows.find((u) => u.id === me);
  const otherRow = rows.find((u) => u.id === otherId);
  if (!otherRow) throw new NotFoundError("match");

  const myProfile = meRow ? dbUserToProfile(meRow) : null;
  const otherProfile = dbUserToProfile(otherRow);
  if (!myProfile || !otherProfile) throw new NotFoundError("match");

  // Hard-excluded pairs (issue #40) are hidden here too, so a stale link or
  // old notification can't reach — and invite — an excluded player.
  if (
    mutualNtrpReject(myProfile, otherProfile) ||
    genderPrefReject(myProfile, otherProfile) ||
    sportPrefReject(myProfile, otherProfile)
  ) {
    throw new NotFoundError("match");
  }

  const { score, breakdown } = calculateMatchScore(myProfile, otherProfile);
  const factors: CompatFactor[] = FACTOR_META.map((f) => ({
    key: f.key,
    label: f.label,
    weight: Math.round(WEIGHTS[f.key] * 100),
    score: breakdown[f.key],
    state: factorState(breakdown[f.key]),
    you: f.val(myProfile),
    them: f.val(otherProfile),
  }));

  return {
    player: toPublicPlayer(otherRow),
    score,
    factors,
    grid: availabilityGrid(myProfile.availability, otherProfile.availability),
  };
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
  // Direct games (both players set at creation) are only allowed between
  // accepted connections — open games go through the join endpoint instead.
  if (player2) {
    if (player2 === me) throw new AuthzError("cannot schedule a game with yourself");
    const [conn] = await db
      .select()
      .from(matchRequests)
      .where(
        and(
          eq(matchRequests.status, "accepted"),
          or(
            and(eq(matchRequests.fromUserId, me), eq(matchRequests.toUserId, player2)),
            and(eq(matchRequests.fromUserId, player2), eq(matchRequests.toUserId, me))
          )
        )
      )
      .limit(1);
    if (!conn) throw new AuthzError("player2 must be an accepted connection");
  }
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
  if (player2) {
    await db.insert(notifications).values({
      userId: player2,
      type: "match_scheduled",
      title: "Game scheduled 🎾",
      body: `A game has been scheduled with you${row.date ? ` on ${row.date}` : ""}${row.time ? ` at ${row.time}` : ""}.`,
      link: "/dashboard/open-games",
    });
  }
  return toMatch(row);
}

const MATCH_PATCHABLE = new Set([
  "status", "score", "date", "time", "location", "notes", "conversationId",
  "player2Id", "acceptedBy", "participants", "cancelledBy", "cancelReason",
]);

/** Canonical set-score format: "6-4", "6-4, 3-6, 7-6(5)". */
const SET_SCORE_RE = /^\d{1,2}-\d{1,2}(\(\d{1,2}\))?(,\s*\d{1,2}-\d{1,2}(\(\d{1,2}\))?)*$/;

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

  const winnerId = typeof data.winnerId === "string" && data.winnerId ? data.winnerId : null;
  const isPlayer = me === m.player1Id || me === m.player2Id;
  const twoPlayer = Boolean(m.player2Id);

  // Reporting a result: a player proposes score+winner; the opponent must
  // confirm before any stats are applied (one player's report can't silently
  // mutate both records).
  if (data.status === "pending_confirmation") {
    if (!twoPlayer) throw new AuthzError("solo matches complete directly");
    if (!isPlayer) throw new AuthzError("only a player can report the result");
    if (m.status === "completed") throw new AuthzError("match already completed");
    if (winnerId && winnerId !== "tie" && winnerId !== m.player1Id && winnerId !== m.player2Id) {
      throw new AuthzError("winner must be one of the match players");
    }
    if (typeof data.score === "string" && data.score && !SET_SCORE_RE.test(data.score.trim())) {
      throw new AuthzError("score must be set scores like 6-4, 3-6, 7-6(5)");
    }
    update.winnerId = winnerId;
    update.reportedBy = me;
  }

  // Dispute: the opponent rejects the reported result — back to in_progress
  // with the report cleared so it can be re-entered.
  if (data.status === "in_progress" && m.status === "pending_confirmation") {
    update.score = null;
    update.winnerId = null;
    update.reportedBy = null;
  }

  const completing = data.status === "completed" && m.status !== "completed";
  // The winner applied to stats: for a confirmation it is the REPORTED winner
  // stored on the row — the confirmer can't swap it.
  let statsWinner = winnerId;
  if (completing) {
    if (twoPlayer) {
      if (m.status !== "pending_confirmation") {
        throw new AuthzError("report the score first — the opponent confirms it");
      }
      if (!isPlayer || me === m.reportedBy) {
        throw new AuthzError("only the other player can confirm the result");
      }
      statsWinner = m.winnerId;
      if (update.score === undefined) update.score = m.score;
    } else if (winnerId && winnerId !== "tie" && winnerId !== m.player1Id) {
      throw new AuthzError("winner must be one of the match players");
    }
  }

  const [row] = await db.update(matches).set(update).where(eq(matches.id, matchId)).returning();

  if (data.status === "pending_confirmation" && row.reportedBy) {
    const opponent = row.reportedBy === m.player1Id ? m.player2Id : m.player1Id;
    if (opponent) {
      await db.insert(notifications).values({
        userId: opponent,
        type: "score_reported",
        title: "Confirm your match result 🎾",
        body: `Your opponent reported ${row.score || "a result"} — confirm or dispute it.`,
        link: "/dashboard/open-games",
      });
    }
  }

  if (completing) {
    const ids = [m.player1Id, m.player2Id].filter((x): x is string => Boolean(x));
    for (const id of ids) {
      const win = statsWinner === id ? 1 : 0;
      const loss = statsWinner && statsWinner !== "tie" && statsWinner !== id ? 1 : 0;
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

/** Pending invites older than this flip to "expired" the next time they're read. */
export const REQUEST_TTL_DAYS = 14;

export async function listMatchRequests(db: Db, me: string) {
  // Read-time expiry — there is no cron/scheduler in this stack. Expired
  // requests stop cluttering the dashboard and no longer block a re-invite
  // (the client only treats pending/accepted as blocking).
  const cutoff = new Date(Date.now() - REQUEST_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db
    .update(matchRequests)
    .set({ status: "expired" })
    .where(
      and(
        eq(matchRequests.status, "pending"),
        or(eq(matchRequests.fromUserId, me), eq(matchRequests.toUserId, me)),
        lt(matchRequests.createdAt, cutoff)
      )
    );
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
  if (toUserId === me) throw new AuthzError("cannot match with yourself");
  const [row] = await db
    .insert(matchRequests)
    .values({ fromUserId: me, toUserId, score, status: "pending" })
    .returning();
  await db.insert(notifications).values({
    userId: toUserId,
    type: "match_request",
    title: "It's a Match! 🎾",
    body: `You've been matched with someone (${score}% compatible) — accept to connect!`,
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
  let sharedTimes: string | null = null;
  if (humanIds.length) {
    const rows = await db.select().from(users).where(inArray(users.id, humanIds));
    for (const u of rows) names[u.id] = u.firstName || u.name || "Player";
    // For two-player chats, precompute the real schedule overlap so Rally can
    // propose concrete times instead of guessing. Raw schedules stay server-side.
    if (humanIds.length === 2) {
      const [a, b] = humanIds.map((id) => rows.find((r) => r.id === id));
      if (a?.weeklyAvailability && b?.weeklyAvailability) {
        sharedTimes = sharedSlotsSummary(a.weeklyAvailability, b.weeklyAvailability) || null;
      }
    }
  }
  const hasRally = parts.some((p) => p.userId === RALLY_ID);
  return { messages: msgs.map(toMessage), names, hasRally, sharedTimes };
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

export async function deleteNotification(db: Db, me: string, notificationId: string) {
  const [row] = await db
    .delete(notifications)
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, me)))
    .returning();
  if (!row) throw new NotFoundError("notification");
}

/** Delete all of the signed-in user's notifications. Returns how many were removed. */
export async function clearNotifications(db: Db, me: string) {
  const rows = await db
    .delete(notifications)
    .where(eq(notifications.userId, me))
    .returning({ id: notifications.id });
  return rows.length;
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
