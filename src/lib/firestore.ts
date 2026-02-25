import { isFirebaseConfigured, db } from "./firebase";
import {
  players,
  matches,
  conversations,
  messages,
  notifications,
  matchRequests,
  currentUser,
  type Player,
  type Match,
  type MatchRequest,
  type Conversation,
  type Message,
  type Notification,
} from "./mock-data";

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
    await setDoc(doc(db, "users", userId), data as { [x: string]: any }, { merge: true });
    return;
  }
  const idx = players.findIndex((p) => p.id === userId);
  if (idx >= 0) Object.assign(players[idx], data);
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
  if (isFirebaseConfigured && db) {
    const { collection, addDoc } = await import("firebase/firestore");
    const ref = await addDoc(collection(db, "matches"), data);
    return ref.id;
  }
  const id = `m${matches.length + 1}`;
  matches.push({ ...data, id } as Match);
  return id;
}

export async function updateMatch(matchId: string, data: Partial<Match>): Promise<void> {
  if (isFirebaseConfigured && db) {
    const { doc, updateDoc } = await import("firebase/firestore");
    await updateDoc(doc(db, "matches", matchId), data as { [x: string]: any });
    return;
  }
  const idx = matches.findIndex((m) => m.id === matchId);
  if (idx >= 0) Object.assign(matches[idx], data);
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
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Conversation));
  }
  return conversations
    .filter((c) => c.participants.includes(userId))
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
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
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message));
  }
  return messages
    .filter((m) => m.conversationId === conversationId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function sendMessage(
  conversationId: string,
  text: string,
  senderId: string = currentUser.id,
  senderName: string = currentUser.name
): Promise<Message> {
  const msg: Message = {
    id: `msg${Date.now()}`,
    conversationId,
    senderId,
    senderName,
    text,
    createdAt: new Date().toISOString(),
    readBy: [senderId],
  };

  if (isFirebaseConfigured && db) {
    const { collection, addDoc, doc, updateDoc } = await import("firebase/firestore");
    const ref = await addDoc(collection(db, "messages"), msg);
    msg.id = ref.id;
    await updateDoc(doc(db, "conversations", conversationId), {
      lastMessage: text,
      lastMessageAt: msg.createdAt,
    });
  } else {
    messages.push(msg);
    const conv = conversations.find((c) => c.id === conversationId);
    if (conv) {
      conv.lastMessage = text;
      conv.lastMessageAt = msg.createdAt;
    }
  }

  return msg;
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
    const all = [...sentSnap.docs, ...receivedSnap.docs].map((d) => ({ id: d.id, ...d.data() } as MatchRequest));
    return all;
  }
  return matchRequests.filter((r) => r.fromUserId === userId || r.toUserId === userId);
}

export async function createMatchRequest(data: Omit<MatchRequest, "id">): Promise<string> {
  if (isFirebaseConfigured && db) {
    const { collection, addDoc } = await import("firebase/firestore");
    const ref = await addDoc(collection(db, "matchRequests"), data);
    return ref.id;
  }
  const id = `mr${matchRequests.length + 1}_${Date.now()}`;
  matchRequests.push({ ...data, id } as MatchRequest);

  // Create notification for recipient
  notifications.push({
    id: `n${Date.now()}`,
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
    await updateDoc(doc(db, "matchRequests", requestId), data as { [x: string]: any });
    return;
  }
  const idx = matchRequests.findIndex((r) => r.id === requestId);
  if (idx >= 0) Object.assign(matchRequests[idx], data);
}

// ---------- Create Conversation (for match acceptance) ----------
export async function createConversation(participants: string[], aiIntro: string): Promise<string> {
  const convId = `conv_${Date.now()}`;
  const conv = {
    id: convId,
    participants: [...participants, "ai"],
    lastMessage: aiIntro,
    lastMessageAt: new Date().toISOString(),
    unreadCount: 1,
    createdAt: new Date().toISOString(),
  };
  const msg = {
    id: `msg_${Date.now()}`,
    conversationId: convId,
    senderId: "ai",
    senderName: "Rally",
    text: aiIntro,
    createdAt: new Date().toISOString(),
    readBy: ["ai"],
    isAI: true,
  };

  if (isFirebaseConfigured && db) {
    const { doc, setDoc, collection, addDoc } = await import("firebase/firestore");
    await setDoc(doc(db, "conversations", convId), conv);
    await addDoc(collection(db, "messages"), msg);
  } else {
    conversations.push(conv);
    messages.push(msg);
  }

  return convId;
}

// ---------- Create Notification ----------
export async function createNotification(data: Omit<Notification, "id">): Promise<void> {
  if (isFirebaseConfigured && db) {
    const { collection, addDoc } = await import("firebase/firestore");
    await addDoc(collection(db, "notifications"), data);
    return;
  }
  notifications.push({ ...data, id: `n${Date.now()}` });
}
