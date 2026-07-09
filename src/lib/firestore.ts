import { isFirebaseConfigured, db } from "./firebase";
import type { FieldValue } from "firebase/firestore";
import {
  players,
  matches,
  conversations,
  messages,
  notifications,
  matchRequests,
  RALLY_USER,
  type Player,
  type Match,
  type MatchRequest,
  type Conversation,
  type Message,
  type Notification,
  type Contact,
} from "./mock-data";

/**
 * Data-access layer. Every function works against Firestore when configured,
 * and an in-memory mock otherwise. The mock exposes a tiny pub/sub so that
 * `subscribe*` helpers deliver live updates in dev/test just like Firestore's
 * `onSnapshot`.
 */

// ---------- helpers ----------

/** Monotonic id generator — avoids Date.now() collisions in the same ms. */
let idCounter = 0;
function genId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

/** Deterministic id for a direct conversation between two users. */
export function directConversationId(a: string, b: string): string {
  return `direct_${[a, b].sort().join("_")}`;
}

/** Normalize a Firestore Timestamp (or ISO string) to an ISO string. */
function toIso(value: unknown): string {
  if (!value) return new Date(0).toISOString();
  if (typeof value === "string") return value;
  const maybe = value as { toDate?: () => Date };
  if (typeof maybe.toDate === "function") return maybe.toDate().toISOString();
  return new Date(value as string | number).toISOString();
}

function normalizeMessage(id: string, data: Record<string, unknown>): Message {
  return { ...(data as object), id, createdAt: toIso(data.createdAt) } as Message;
}

function normalizeConversation(id: string, data: Record<string, unknown>): Conversation {
  return {
    ...(data as object),
    id,
    lastMessageAt: toIso(data.lastMessageAt),
    createdAt: toIso(data.createdAt),
  } as Conversation;
}

// ---------- mock pub/sub ----------

type Listener = () => void;
const messageListeners = new Map<string, Set<Listener>>();
const conversationListeners = new Map<string, Set<Listener>>();

function notifyMock(map: Map<string, Set<Listener>>, key: string) {
  map.get(key)?.forEach((l) => l());
}

function subscribeMock(map: Map<string, Set<Listener>>, key: string, l: Listener): () => void {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key)!.add(l);
  return () => map.get(key)?.delete(l);
}

// ---------- Users ----------
export async function getUser(userId: string): Promise<Player | undefined> {
  if (isFirebaseConfigured && db) {
    const { doc, getDoc } = await import("firebase/firestore");
    const snap = await getDoc(doc(db, "users", userId));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Player) : undefined;
  }
  return players.find((p) => p.id === userId);
}

export async function updateUser(userId: string, data: Partial<Player>): Promise<void> {
  if (isFirebaseConfigured && db) {
    const { doc, setDoc } = await import("firebase/firestore");
    await setDoc(doc(db, "users", userId), data as Record<string, unknown>, { merge: true });
    return;
  }
  const idx = players.findIndex((p) => p.id === userId);
  if (idx >= 0) Object.assign(players[idx], data);
}

/**
 * Store a value on the user's private subcollection (email, fcmToken, …) so it
 * is never delivered to other clients by `getPlayers()`.
 */
export async function setUserPrivate(userId: string, data: Record<string, unknown>): Promise<void> {
  if (isFirebaseConfigured && db) {
    const { doc, setDoc } = await import("firebase/firestore");
    await setDoc(doc(db, "users", userId, "private", "profile"), data, { merge: true });
    return;
  }
  // Mock: keep it off the public player object.
  mockPrivate[userId] = { ...(mockPrivate[userId] || {}), ...data };
}

const mockPrivate: Record<string, Record<string, unknown>> = {};

export async function getUserPrivate(userId: string): Promise<Record<string, unknown> | undefined> {
  if (isFirebaseConfigured && db) {
    const { doc, getDoc } = await import("firebase/firestore");
    const snap = await getDoc(doc(db, "users", userId, "private", "profile"));
    return snap.exists() ? snap.data() : undefined;
  }
  return mockPrivate[userId];
}

// ---------- Players ----------
export async function getPlayers(): Promise<Player[]> {
  if (isFirebaseConfigured && db) {
    const { collection, getDocs } = await import("firebase/firestore");
    const snap = await getDocs(collection(db, "users"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Player));
  }
  return players;
}

// ---------- Matches ----------
export async function getMatches(userId?: string): Promise<Match[]> {
  if (isFirebaseConfigured && db) {
    const { collection, getDocs, query, where } = await import("firebase/firestore");
    const q = userId
      ? query(collection(db, "matches"), where("participants", "array-contains", userId))
      : undefined;
    const snap = await getDocs(q ?? collection(db, "matches"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Match));
  }
  return userId
    ? matches.filter((m) => m.player1Id === userId || m.player2Id === userId)
    : matches;
}

export async function createMatch(data: Omit<Match, "id">): Promise<string> {
  const now = new Date().toISOString();
  const enriched = {
    ...data,
    participants: [data.player1Id, ...(data.player2Id ? [data.player2Id] : [])].filter(Boolean),
    createdAt: now,
    updatedAt: now,
  };
  if (isFirebaseConfigured && db) {
    const { collection, addDoc } = await import("firebase/firestore");
    const ref = await addDoc(collection(db, "matches"), enriched);
    return ref.id;
  }
  const id = genId("m");
  matches.push({ ...enriched, id } as Match);
  return id;
}

export async function updateMatch(matchId: string, data: Partial<Match>): Promise<void> {
  if (isFirebaseConfigured && db) {
    const { doc, updateDoc } = await import("firebase/firestore");
    await updateDoc(doc(db, "matches", matchId), { ...data, updatedAt: new Date().toISOString() });
    return;
  }
  const idx = matches.findIndex((m) => m.id === matchId);
  if (idx >= 0) Object.assign(matches[idx], data);
}

/**
 * Atomically join an open match. Verifies the match is still open and unclaimed
 * before writing, so two simultaneous joiners can't clobber each other.
 * Returns true if the join succeeded, false if the match was already taken.
 */
export async function joinOpenMatch(matchId: string, userId: string): Promise<boolean> {
  if (isFirebaseConfigured && db) {
    const { doc, runTransaction } = await import("firebase/firestore");
    try {
      return await runTransaction(db, async (tx) => {
        const ref = doc(db!, "matches", matchId);
        const snap = await tx.get(ref);
        if (!snap.exists()) return false;
        const m = snap.data() as Match;
        if (m.status !== "open" || m.player2Id) return false;
        tx.update(ref, {
          player2Id: userId,
          acceptedBy: userId,
          status: "pending",
          participants: [m.player1Id, userId],
          updatedAt: new Date().toISOString(),
        });
        return true;
      });
    } catch {
      return false;
    }
  }
  const m = matches.find((x) => x.id === matchId);
  if (!m || m.status !== "open" || m.player2Id) return false;
  Object.assign(m, {
    player2Id: userId,
    acceptedBy: userId,
    status: "pending" as const,
    participants: [m.player1Id, userId],
  });
  return true;
}

export async function deleteMatch(matchId: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    const { doc, deleteDoc } = await import("firebase/firestore");
    await deleteDoc(doc(db, "matches", matchId));
    return;
  }
  const idx = matches.findIndex((m) => m.id === matchId);
  if (idx >= 0) matches.splice(idx, 1);
}

// ---------- Conversations ----------
export async function getConversations(userId: string): Promise<Conversation[]> {
  if (isFirebaseConfigured && db) {
    const { collection, getDocs, query, where, orderBy } = await import("firebase/firestore");
    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", userId),
      orderBy("lastMessageAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => normalizeConversation(d.id, d.data()));
  }
  return conversations
    .filter((c) => c.participants.includes(userId))
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
}

/** Live subscription to a user's conversation list. Returns an unsubscribe fn. */
export function subscribeConversations(
  userId: string,
  cb: (convs: Conversation[]) => void
): () => void {
  if (isFirebaseConfigured && db) {
    let unsub = () => {};
    (async () => {
      const { collection, query, where, orderBy, onSnapshot } = await import("firebase/firestore");
      const q = query(
        collection(db!, "conversations"),
        where("participants", "array-contains", userId),
        orderBy("lastMessageAt", "desc")
      );
      unsub = onSnapshot(q, (snap) => {
        cb(snap.docs.map((d) => normalizeConversation(d.id, d.data())));
      });
    })();
    return () => unsub();
  }
  const emit = () => { getConversations(userId).then(cb); };
  emit();
  return subscribeMock(conversationListeners, userId, emit);
}

export async function getConversation(conversationId: string): Promise<Conversation | undefined> {
  if (isFirebaseConfigured && db) {
    const { doc, getDoc } = await import("firebase/firestore");
    const snap = await getDoc(doc(db, "conversations", conversationId));
    return snap.exists() ? normalizeConversation(snap.id, snap.data()) : undefined;
  }
  return conversations.find((c) => c.id === conversationId);
}

export async function deleteConversation(conversationId: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    const { doc, collection, getDocs, query, where, writeBatch } = await import("firebase/firestore");
    const msgQ = query(collection(db, "messages"), where("conversationId", "==", conversationId));
    const msgSnap = await getDocs(msgQ);
    const batch = writeBatch(db);
    msgSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, "conversations", conversationId));
    await batch.commit();
    return;
  }
  const idx = conversations.findIndex((c) => c.id === conversationId);
  const participants = idx >= 0 ? conversations[idx].participants : [];
  if (idx >= 0) conversations.splice(idx, 1);
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].conversationId === conversationId) messages.splice(i, 1);
  }
  notifyMock(messageListeners, conversationId);
  participants.forEach((p) => notifyMock(conversationListeners, p));
}

/** Find an existing direct conversation between two users. */
export async function findDirectConversation(userId1: string, userId2: string): Promise<Conversation | undefined> {
  return getConversation(directConversationId(userId1, userId2));
}

/** Create (or return existing) a 1-on-1 direct conversation. Idempotent by id. */
export async function createDirectConversation(
  userId1: string,
  userId2: string,
  _user1Name: string,
  _user2Name: string
): Promise<string> {
  const convId = directConversationId(userId1, userId2);
  const existing = await getConversation(convId);
  if (existing) return existing.id;

  const now = new Date().toISOString();
  const conv: Conversation = {
    id: convId,
    participants: [userId1, userId2],
    type: "direct",
    lastMessage: "",
    lastMessageAt: now,
    unread: { [userId1]: 0, [userId2]: 0 },
    createdAt: now,
  };

  if (isFirebaseConfigured && db) {
    const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");
    await setDoc(doc(db, "conversations", convId), { ...conv, lastMessageAt: serverTimestamp(), createdAt: serverTimestamp() });
  } else {
    conversations.push(conv);
    [userId1, userId2].forEach((p) => notifyMock(conversationListeners, p));
  }
  return convId;
}

/** Create a group conversation for a match (includes Rally). */
export async function createGroupConversation(
  participantIds: string[],
  matchId: string,
  groupName: string,
  rallyIntro: string,
  createdBy: string = participantIds[0] || ""
): Promise<string> {
  const now = new Date().toISOString();
  const allParticipants = [...participantIds, RALLY_USER.id];
  // Everyone except Rally starts with one unread (the intro), except the actor.
  const unread: Record<string, number> = {};
  participantIds.forEach((p) => { unread[p] = p === createdBy ? 0 : 1; });

  if (isFirebaseConfigured && db) {
    const { doc, setDoc, collection, addDoc, serverTimestamp } = await import("firebase/firestore");
    const convId = genId("conv");
    await setDoc(doc(db, "conversations", convId), {
      participants: allParticipants,
      type: "group",
      name: groupName,
      matchId,
      createdBy,
      lastMessage: rallyIntro,
      lastMessageAt: serverTimestamp(),
      unread,
      createdAt: serverTimestamp(),
    });
    await addDoc(collection(db, "messages"), {
      conversationId: convId,
      senderId: RALLY_USER.id,
      senderName: RALLY_USER.name,
      text: rallyIntro,
      createdAt: serverTimestamp(),
      readBy: [RALLY_USER.id],
      isAI: true,
    });
    return convId;
  }

  const convId = genId("conv");
  const conv: Conversation = {
    id: convId,
    participants: allParticipants,
    type: "group",
    name: groupName,
    matchId,
    createdBy,
    lastMessage: rallyIntro,
    lastMessageAt: now,
    unread,
    createdAt: now,
  };
  const msg: Message = {
    id: genId("msg"),
    conversationId: convId,
    senderId: RALLY_USER.id,
    senderName: RALLY_USER.name,
    text: rallyIntro,
    createdAt: now,
    readBy: [RALLY_USER.id],
    isAI: true,
  };
  conversations.push(conv);
  messages.push(msg);
  allParticipants.forEach((p) => notifyMock(conversationListeners, p));
  notifyMock(messageListeners, convId);
  return convId;
}

// ---------- Messages ----------
export async function getMessages(conversationId: string): Promise<Message[]> {
  if (isFirebaseConfigured && db) {
    const { collection, getDocs, query, where, orderBy } = await import("firebase/firestore");
    const q = query(
      collection(db, "messages"),
      where("conversationId", "==", conversationId),
      orderBy("createdAt", "asc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => normalizeMessage(d.id, d.data()));
  }
  return messages
    .filter((m) => m.conversationId === conversationId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/** Live subscription to a conversation's messages. Returns an unsubscribe fn. */
export function subscribeMessages(
  conversationId: string,
  cb: (msgs: Message[]) => void
): () => void {
  if (isFirebaseConfigured && db) {
    let unsub = () => {};
    (async () => {
      const { collection, query, where, orderBy, onSnapshot } = await import("firebase/firestore");
      const q = query(
        collection(db!, "messages"),
        where("conversationId", "==", conversationId),
        orderBy("createdAt", "asc")
      );
      unsub = onSnapshot(q, (snap) => {
        cb(snap.docs.map((d) => normalizeMessage(d.id, d.data())));
      });
    })();
    return () => unsub();
  }
  const emit = () => { getMessages(conversationId).then(cb); };
  emit();
  return subscribeMock(messageListeners, conversationId, emit);
}

export async function sendMessage(
  conversationId: string,
  text: string,
  senderId: string = "",
  senderName: string = "",
  isAI: boolean = false
): Promise<Message> {
  const now = new Date().toISOString();

  if (isFirebaseConfigured && db) {
    const { collection, addDoc, doc, updateDoc, getDoc, serverTimestamp, increment } =
      await import("firebase/firestore");
    const ref = await addDoc(collection(db, "messages"), {
      conversationId,
      senderId,
      senderName,
      text,
      createdAt: serverTimestamp(),
      readBy: [senderId],
      ...(isAI ? { isAI: true } : {}),
    });
    // Increment unread for every participant except the sender.
    const convRef = doc(db, "conversations", conversationId);
    const convSnap = await getDoc(convRef);
    const parts: string[] = convSnap.exists() ? convSnap.data()?.participants || [] : [];
    const unreadUpdate: Record<string, string | FieldValue> = { lastMessage: text, lastMessageAt: serverTimestamp() };
    parts.forEach((p) => { if (p !== senderId && p !== RALLY_USER.id) unreadUpdate[`unread.${p}`] = increment(1); });
    await updateDoc(convRef, unreadUpdate);
    return { id: ref.id, conversationId, senderId, senderName, text, createdAt: now, readBy: [senderId], ...(isAI ? { isAI: true } : {}) };
  }

  const msg: Message = {
    id: genId("msg"),
    conversationId,
    senderId,
    senderName,
    text,
    createdAt: now,
    readBy: [senderId],
    ...(isAI ? { isAI: true } : {}),
  };
  messages.push(msg);
  const conv = conversations.find((c) => c.id === conversationId);
  if (conv) {
    conv.lastMessage = text;
    conv.lastMessageAt = now;
    conv.unread = conv.unread || {};
    conv.participants.forEach((p) => {
      if (p !== senderId && p !== RALLY_USER.id) conv.unread[p] = (conv.unread[p] || 0) + 1;
    });
    conv.participants.forEach((p) => notifyMock(conversationListeners, p));
  }
  notifyMock(messageListeners, conversationId);
  return msg;
}

/** Mark a conversation read for a user — zeroes their unread counter. */
export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    const { doc, updateDoc } = await import("firebase/firestore");
    await updateDoc(doc(db, "conversations", conversationId), { [`unread.${userId}`]: 0 });
    return;
  }
  const conv = conversations.find((c) => c.id === conversationId);
  if (conv) {
    conv.unread = conv.unread || {};
    if (conv.unread[userId]) {
      conv.unread[userId] = 0;
      conv.participants.forEach((p) => notifyMock(conversationListeners, p));
    }
  }
}

/** Total unread across all of a user's conversations (for the nav badge). */
export async function getTotalUnread(userId: string): Promise<number> {
  const convs = await getConversations(userId);
  return convs.reduce((sum, c) => sum + (c.unread?.[userId] || 0), 0);
}

// ---------- Contacts ----------
const mockContacts: Record<string, Contact[]> = {};

export async function getContacts(userId: string): Promise<Contact[]> {
  if (isFirebaseConfigured && db) {
    const { collection, getDocs } = await import("firebase/firestore");
    const snap = await getDocs(collection(db, "users", userId, "contacts"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Contact));
  }
  return mockContacts[userId] || [];
}

export async function addContact(userId: string, contact: Contact): Promise<void> {
  if (isFirebaseConfigured && db) {
    const { doc, setDoc } = await import("firebase/firestore");
    await setDoc(doc(db, "users", userId, "contacts", contact.id), contact);
    return;
  }
  mockContacts[userId] = mockContacts[userId] || [];
  if (!mockContacts[userId].find((c) => c.id === contact.id)) mockContacts[userId].push(contact);
}

export async function removeContact(userId: string, contactId: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    const { doc, deleteDoc } = await import("firebase/firestore");
    await deleteDoc(doc(db, "users", userId, "contacts", contactId));
    return;
  }
  const list = mockContacts[userId];
  if (!list) return;
  const idx = list.findIndex((c) => c.id === contactId);
  if (idx >= 0) list.splice(idx, 1);
}

// ---------- Notifications ----------
export async function getNotifications(userId: string): Promise<Notification[]> {
  if (isFirebaseConfigured && db) {
    const { collection, getDocs, query, where, orderBy } = await import("firebase/firestore");
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification));
  }
  return notifications
    .filter((n) => n.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    const { doc, updateDoc } = await import("firebase/firestore");
    await updateDoc(doc(db, "notifications", notificationId), { read: true });
    return;
  }
  const n = notifications.find((x) => x.id === notificationId);
  if (n) n.read = true;
}

// ---------- Match Requests ----------
export async function getMatchRequests(userId: string): Promise<MatchRequest[]> {
  if (isFirebaseConfigured && db) {
    const { collection, getDocs, query, where } = await import("firebase/firestore");
    const [sentSnap, receivedSnap] = await Promise.all([
      getDocs(query(collection(db, "matchRequests"), where("fromUserId", "==", userId))),
      getDocs(query(collection(db, "matchRequests"), where("toUserId", "==", userId))),
    ]);
    return [...sentSnap.docs, ...receivedSnap.docs].map((d) => ({ id: d.id, ...d.data() } as MatchRequest));
  }
  return matchRequests.filter((r) => r.fromUserId === userId || r.toUserId === userId);
}

export async function createMatchRequest(data: Omit<MatchRequest, "id">): Promise<string> {
  if (isFirebaseConfigured && db) {
    const { collection, addDoc } = await import("firebase/firestore");
    const ref = await addDoc(collection(db, "matchRequests"), data);
    await createNotification({
      userId: data.toUserId,
      type: "match_request",
      title: "New Match Request!",
      body: `Someone wants to match with you! (${data.score}% compatible)`,
      read: false,
      createdAt: new Date().toISOString(),
      link: "/dashboard",
    });
    return ref.id;
  }
  const id = genId("mr");
  matchRequests.push({ ...data, id } as MatchRequest);
  notifications.push({
    id: genId("n"),
    userId: data.toUserId,
    type: "match_request",
    title: "New Match Request!",
    body: `Someone wants to match with you! (${data.score}% compatible)`,
    read: false,
    createdAt: new Date().toISOString(),
    link: "/dashboard",
  });
  return id;
}

export async function updateMatchRequest(requestId: string, data: Partial<MatchRequest>): Promise<void> {
  if (isFirebaseConfigured && db) {
    const { doc, updateDoc } = await import("firebase/firestore");
    await updateDoc(doc(db, "matchRequests", requestId), data);
    return;
  }
  const idx = matchRequests.findIndex((r) => r.id === requestId);
  if (idx >= 0) Object.assign(matchRequests[idx], data);
}

// ---------- Legacy helpers ----------
export async function createConversation(participants: string[], aiIntro: string): Promise<string> {
  return createGroupConversation(participants, "", "Match Chat", aiIntro);
}

export async function createNotification(data: Omit<Notification, "id">): Promise<void> {
  if (isFirebaseConfigured && db) {
    const { collection, addDoc } = await import("firebase/firestore");
    await addDoc(collection(db, "notifications"), data);
    return;
  }
  notifications.push({ ...data, id: genId("n") });
}

/** Test-only: reset mock listeners and private store. */
export function __resetMockState(): void {
  messageListeners.clear();
  conversationListeners.clear();
  for (const k of Object.keys(mockContacts)) delete mockContacts[k];
  for (const k of Object.keys(mockPrivate)) delete mockPrivate[k];
}
