/**
 * PlayMatch — Firebase Cloud Functions
 *
 * Firestore-triggered functions that (1) send FCM push notifications and
 * (2) generate Rally's AI replies server-side so the Gemini API key never
 * reaches the browser.
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";

admin.initializeApp();
const db = admin.firestore();

const RALLY_ID = "rally";

// ────────────────────────────────────────────────
// Helper: read a user's private FCM token
// ────────────────────────────────────────────────
async function getFcmToken(userId: string): Promise<string | undefined> {
  // Prefer the private subcollection; fall back to a legacy field on the doc.
  const priv = await db.collection("users").doc(userId).collection("private").doc("profile").get();
  const token = priv.data()?.fcmToken;
  if (token) return token as string;
  const userDoc = await db.collection("users").doc(userId).get();
  return userDoc.data()?.fcmToken as string | undefined;
}

async function clearFcmToken(userId: string): Promise<void> {
  try {
    await db.collection("users").doc(userId).collection("private").doc("profile")
      .set({ fcmToken: admin.firestore.FieldValue.delete() }, { merge: true });
  } catch (err) {
    functions.logger.warn(`Could not clear FCM token for ${userId}:`, err);
  }
}

// ────────────────────────────────────────────────
// Helper: send FCM push to a user by their userId
// ────────────────────────────────────────────────
async function sendPush(userId: string, title: string, body: string, link?: string): Promise<void> {
  try {
    const fcmToken = await getFcmToken(userId);
    if (!fcmToken) return; // User hasn't enabled push notifications

    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: { title, body },
      webpush: {
        fcmOptions: { link: link || "/dashboard" },
        notification: { icon: "/icons/icon-192.png", badge: "/icons/icon-72.png" },
      },
    };

    await admin.messaging().send(message);
    functions.logger.log(`Push sent to ${userId}: ${title}`);
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === "messaging/invalid-registration-token" ||
        error.code === "messaging/registration-token-not-registered") {
      functions.logger.warn(`Removing invalid FCM token for user ${userId}`);
      await clearFcmToken(userId);
    } else {
      functions.logger.error(`Failed to send push to ${userId}:`, err);
    }
  }
}

// ────────────────────────────────────────────────
// 1. New Message → notify other participants + maybe Rally reply
// ────────────────────────────────────────────────
export const onNewMessage = functions.firestore
  .document("messages/{messageId}")
  .onCreate(async (snap) => {
    const msg = snap.data();
    if (!msg) return;

    const { conversationId, senderId, senderName, text, isAI } = msg;
    if (typeof text !== "string" || !conversationId) return;

    // Don't act on Rally's own messages.
    if (isAI || senderId === "ai" || senderId === RALLY_ID) return;

    const convDoc = await db.collection("conversations").doc(conversationId).get();
    if (!convDoc.exists) return;
    const conv = convDoc.data() || {};
    const participants: string[] = conv.participants || [];

    // Push to every human participant except the sender.
    const recipients = participants.filter((id) => id !== senderId && id !== "ai" && id !== RALLY_ID);
    const truncated = text.length > 80 ? text.substring(0, 80) + "…" : text;
    await Promise.all(
      recipients.map((userId) =>
        sendPush(userId, `New message from ${senderName || "Someone"}`, truncated, `/dashboard/messages/${conversationId}`)
      )
    );

    // If Rally is a participant and was addressed, generate a reply server-side.
    if (participants.includes(RALLY_ID) && shouldRallyRespond(text)) {
      await generateRallyReply(conversationId, participants);
    }
  });

// ---------- Rally reply (server-side Gemini) ----------
function shouldRallyRespond(text: string): boolean {
  return /@rally\b/i.test(text) || /\brally[,:]/i.test(text.trim());
}

async function generateRallyReply(conversationId: string, participants: string[]): Promise<void> {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY || functions.config().genai?.key;
  try {
    const msgsSnap = await db.collection("messages")
      .where("conversationId", "==", conversationId)
      .orderBy("createdAt", "asc")
      .get();
    const msgs = msgsSnap.docs.map((d) => d.data());

    // Build a name map from participant docs.
    const names: Record<string, string> = {};
    await Promise.all(
      participants.filter((p) => p !== RALLY_ID).map(async (p) => {
        const u = await db.collection("users").doc(p).get();
        names[p] = u.data()?.firstName || u.data()?.name || "Player";
      })
    );

    let reply: string | null = null;
    if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: RALLY_SYSTEM_PROMPT,
        generationConfig: { maxOutputTokens: 150, temperature: 0.8 },
      });
      const history = msgs.map((m) => {
        const sender = m.senderId === RALLY_ID ? "Rally" : names[m.senderId] || "User";
        return `${sender}: ${m.text}`;
      }).join("\n");
      const result = await model.generateContent(`${history}\n\n--- Reply as Rally (under 80 words) ---`);
      reply = result.response.text().trim();
    } else {
      reply = getStaticResponse(String(msgs[msgs.length - 1]?.text || ""));
    }

    if (!reply) return;
    await db.collection("messages").add({
      conversationId,
      senderId: RALLY_ID,
      senderName: "Rally",
      text: reply,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      readBy: [RALLY_ID],
      isAI: true,
    });
    await db.collection("conversations").doc(conversationId).update({
      lastMessage: reply,
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    functions.logger.error("Rally reply generation failed:", err);
  }
}

const RALLY_SYSTEM_PROMPT = `You are Rally, the PlayMatch assistant — a calm, concrete, helpful tennis & pickleball coach for the Pleasanton community.
VOICE: Warm and encouraging but plain-spoken. No ALL-CAPS. At most one exclamation mark. Emoji rare. Be specific and answer the actual question.
KNOWLEDGE: Local courts, especially Lifetime Activities Pleasanton — (925) 460-8600. Match logistics: scheduling, reservations, warm-up tips, directions.
RULES: Under 80 words. Reference what players actually said; don't repeat yourself. If unsure, say so briefly.`;

function getStaticResponse(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("what time") || lower.includes("when"))
    return "Based on your shared availability, weekday evenings or Saturday mornings tend to work best. Want me to pencil in a time?";
  if (lower.includes("where") || lower.includes("court") || lower.includes("address"))
    return "Lifetime Activities Pleasanton is the usual spot — call (925) 460-8600 to reserve a court.";
  if (lower.includes("score") || lower.includes("won") || lower.includes("lost"))
    return "Nice — drop the final score here and I'll log it for you.";
  if (lower.includes("cancel") || lower.includes("can't make"))
    return "No problem, these things happen. Let me know when you'd like to reschedule.";
  if (lower.includes("thanks") || lower.includes("thank you"))
    return "Anytime. Have a good match!";
  return "Happy to help — ask me about scheduling, courts, or match logistics.";
}

// ────────────────────────────────────────────────
// 2. Match Request → notify the recipient
// ────────────────────────────────────────────────
export const onMatchRequest = functions.firestore
  .document("matchRequests/{requestId}")
  .onCreate(async (snap) => {
    const request = snap.data();
    if (!request) return;
    const { fromUserId, toUserId, score } = request;
    if (!toUserId) return;

    const fromDoc = await db.collection("users").doc(fromUserId).get();
    const fromName = fromDoc.data()?.firstName || fromDoc.data()?.name || "Someone";

    await sendPush(
      toUserId,
      "New match request",
      `${fromName} wants to play with you (${score}% compatible).`,
      "/dashboard"
    );
  });

// ────────────────────────────────────────────────
// 3. Match Request Accepted → notify the sender
// ────────────────────────────────────────────────
export const onMatchAccepted = functions.firestore
  .document("matchRequests/{requestId}")
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();
    if (!before || !after) return;
    if (before.status === "accepted" || after.status !== "accepted") return;

    const { fromUserId, toUserId, conversationId } = after;
    const toDoc = await db.collection("users").doc(toUserId).get();
    const toName = toDoc.data()?.firstName || toDoc.data()?.name || "Someone";

    await sendPush(
      fromUserId,
      "Match accepted",
      `${toName} accepted your match request. Open the chat to plan your game.`,
      conversationId ? `/dashboard/messages/${conversationId}` : "/dashboard"
    );
  });

// ────────────────────────────────────────────────
// 4. New GROUP conversation → notify participants (except the creator)
// ────────────────────────────────────────────────
export const onNewConversation = functions.firestore
  .document("conversations/{conversationId}")
  .onCreate(async (snap) => {
    const conv = snap.data();
    if (!conv) return;
    // Only group (match) conversations warrant a "new match" push — not plain
    // direct chats.
    if (conv.type !== "group") return;

    const participants: string[] = conv.participants || [];
    const createdBy: string | undefined = conv.createdBy;
    const recipients = participants.filter(
      (id) => id !== "ai" && id !== RALLY_ID && id !== createdBy
    );

    await Promise.all(
      recipients.map((userId) =>
        sendPush(
          userId,
          "New match chat",
          "You've been matched — open the chat to meet your partner and plan a game.",
          `/dashboard/messages/${snap.id}`
        )
      )
    );
  });
