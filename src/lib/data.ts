import {
  type Player,
  type Match,
  type MatchRequest,
  type Conversation,
  type Message,
  type Notification,
  type Contact,
} from "./mock-data";
import type { AvailabilityGrid } from "./availability";

/**
 * Client data layer — REST client for the app's API routes (Postgres behind
 * session-authorized endpoints). Function names/signatures match the old
 * the previous data module, so page imports did not have to change.
 *
 * subscribe* helpers poll for now; Phase 4 replaces them with SSE.
 */

const POLL_MS = 5000;

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.json();
}

async function send<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}`);
  return res.json();
}

function poll<T>(fetcher: () => Promise<T>, cb: (data: T) => void): () => void {
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    fetcher().then((data) => { if (!stopped) cb(data); }).catch(() => {});
  };
  tick();
  const interval = setInterval(tick, POLL_MS);
  return () => { stopped = true; clearInterval(interval); };
}

/**
 * Live subscription via Server-Sent Events: the server pushes a "change" event
 * (and an initial "ping"), and we re-fetch through the normal authorized API.
 * Falls back to polling if EventSource is unavailable or the stream closes.
 */
function subscribeSSE<T>(
  streamUrl: string,
  fetcher: () => Promise<T>,
  cb: (data: T) => void
): () => void {
  if (typeof window === "undefined" || typeof EventSource === "undefined") {
    return poll(fetcher, cb);
  }
  let stopped = false;
  let pollStop: (() => void) | null = null;
  const refresh = () => {
    fetcher().then((d) => { if (!stopped) cb(d); }).catch(() => {});
  };

  const es = new EventSource(streamUrl);
  es.addEventListener("ping", refresh);   // initial connect + auto-reconnect
  es.addEventListener("change", refresh); // a relevant write happened
  es.onerror = () => {
    // EventSource retries network blips itself; only fall back once it gives up.
    if (es.readyState === EventSource.CLOSED && !pollStop && !stopped) {
      pollStop = poll(fetcher, cb);
    }
  };

  return () => {
    stopped = true;
    es.close();
    if (pollStop) pollStop();
  };
}

// ---------- Users / players ----------

export async function getUser(userId: string): Promise<Player | undefined> {
  try {
    return await get<Player>(`/api/players/${encodeURIComponent(userId)}`);
  } catch {
    return undefined;
  }
}

/** Updates the SIGNED-IN user's profile (the userId arg is legacy). */
export async function updateUser(_userId: string, data: Partial<Player>): Promise<void> {
  await send("PATCH", "/api/me", data);
}

export async function getPlayers(): Promise<Player[]> {
  return get<Player[]>("/api/players");
}

export async function findPlayerByEmail(email: string): Promise<Player | undefined> {
  try {
    return await get<Player>(`/api/players/lookup?email=${encodeURIComponent(email)}`);
  } catch {
    return undefined;
  }
}

// ---------- Matches ----------

export async function getMatches(userId?: string): Promise<Match[]> {
  return get<Match[]>(userId ? "/api/matches?mine=1" : "/api/matches");
}

/** Ranked compatibility suggestions (privacy-safe players + matchScore). */
export async function getMatchSuggestions(): Promise<Player[]> {
  return get<Player[]>("/api/matches/suggestions");
}

/** One row of the You-vs-them compatibility table. */
export interface CompatFactor {
  key: string;
  label: string;
  weight: number;
  score: number;
  state: "match" | "partial" | "miss";
  you: string;
  them: string;
}

/** Full compatibility breakdown for the match-detail view. */
export interface Compatibility {
  player: Player;
  score: number;
  factors: CompatFactor[];
  grid: AvailabilityGrid;
}

/** Compatibility breakdown between the signed-in user and one other player. */
export async function getCompatibility(id: string): Promise<Compatibility> {
  return get<Compatibility>(`/api/matches/compatibility/${encodeURIComponent(id)}`);
}

export async function createMatch(data: Omit<Match, "id">): Promise<string> {
  const m = await send<Match>("POST", "/api/matches", data);
  return m.id;
}

/** Extra fields (e.g. winnerId when completing) ride along to the server. */
export async function updateMatch(
  matchId: string,
  data: Partial<Match> & { winnerId?: string }
): Promise<void> {
  await send("PATCH", `/api/matches/${encodeURIComponent(matchId)}`, data);
}

export async function deleteMatch(matchId: string): Promise<void> {
  await send("DELETE", `/api/matches/${encodeURIComponent(matchId)}`);
}

export async function joinOpenMatch(matchId: string, _userId: string): Promise<boolean> {
  const res = await send<{ joined: boolean }>(
    "POST",
    `/api/matches/${encodeURIComponent(matchId)}/join`
  );
  return res.joined;
}

// ---------- Match requests ----------

export async function getMatchRequests(_userId: string): Promise<MatchRequest[]> {
  return get<MatchRequest[]>("/api/match-requests");
}

export async function createMatchRequest(data: Omit<MatchRequest, "id">): Promise<string> {
  const r = await send<MatchRequest>("POST", "/api/match-requests", {
    toUserId: data.toUserId,
    score: data.score,
  });
  return r.id;
}

export async function updateMatchRequest(
  requestId: string,
  data: Partial<MatchRequest>
): Promise<void> {
  await send("PATCH", `/api/match-requests/${encodeURIComponent(requestId)}`, data);
}

// ---------- Conversations ----------

export function directConversationId(a: string, b: string): string {
  return `direct_${[a, b].sort().join("_")}`;
}

export async function getConversations(_userId: string): Promise<Conversation[]> {
  return get<Conversation[]>("/api/conversations");
}

export function subscribeConversations(
  _userId: string,
  cb: (convs: Conversation[]) => void
): () => void {
  return subscribeSSE("/api/conversations/stream", () => get<Conversation[]>("/api/conversations"), cb);
}

export async function getConversation(conversationId: string): Promise<Conversation | undefined> {
  try {
    return await get<Conversation>(`/api/conversations/${encodeURIComponent(conversationId)}`);
  } catch {
    return undefined;
  }
}

export async function findDirectConversation(
  userId1: string,
  userId2: string
): Promise<Conversation | undefined> {
  return getConversation(directConversationId(userId1, userId2));
}

export async function createDirectConversation(
  _me: string,
  otherUserId: string,
  _myName?: string,
  _otherName?: string
): Promise<string> {
  const c = await send<Conversation>("POST", "/api/conversations", {
    type: "direct",
    otherUserId,
  });
  return c.id;
}

export async function createGroupConversation(
  participantIds: string[],
  matchId: string,
  groupName: string,
  rallyIntro: string,
  _createdBy?: string
): Promise<string> {
  const c = await send<Conversation>("POST", "/api/conversations", {
    type: "group",
    participantIds,
    matchId,
    name: groupName,
    rallyIntro,
  });
  return c.id;
}

export async function deleteConversation(conversationId: string): Promise<void> {
  await send("DELETE", `/api/conversations/${encodeURIComponent(conversationId)}`);
}

export async function markConversationRead(conversationId: string, _userId: string): Promise<void> {
  await send("POST", `/api/conversations/${encodeURIComponent(conversationId)}/read`);
}

export async function getTotalUnread(userId: string): Promise<number> {
  const convs = await getConversations(userId);
  return convs.reduce((sum, c) => sum + (c.unread?.[userId] || 0), 0);
}

// ---------- Messages ----------

export async function getMessages(conversationId: string): Promise<Message[]> {
  return get<Message[]>(`/api/conversations/${encodeURIComponent(conversationId)}/messages`);
}

export function subscribeMessages(
  conversationId: string,
  cb: (msgs: Message[]) => void
): () => void {
  const enc = encodeURIComponent(conversationId);
  return subscribeSSE(
    `/api/conversations/${enc}/messages/stream`,
    () => get<Message[]>(`/api/conversations/${enc}/messages`),
    cb
  );
}

/** senderId/senderName are stamped server-side from the session. */
export async function sendMessage(
  conversationId: string,
  text: string,
  _senderId?: string,
  _senderName?: string,
  _isAI?: boolean
): Promise<Message> {
  return send<Message>("POST", `/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
    text,
  });
}

// ---------- Contacts ----------

export async function getContacts(_userId: string): Promise<Contact[]> {
  return get<Contact[]>("/api/contacts");
}

export async function addContact(_userId: string, contact: Contact): Promise<void> {
  await send("POST", "/api/contacts", contact);
}

export async function removeContact(_userId: string, contactId: string): Promise<void> {
  await send("DELETE", `/api/contacts/${encodeURIComponent(contactId)}`);
}

// ---------- Notifications ----------

export async function getNotifications(_userId: string): Promise<Notification[]> {
  return get<Notification[]>("/api/notifications");
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await send("PATCH", `/api/notifications/${encodeURIComponent(notificationId)}`);
}
