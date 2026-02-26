/**
 * PlayMatch — Firebase Cloud Functions
 *
 * These functions listen for Firestore document changes and send push
 * notifications via FCM to users who have enabled push notifications.
 *
 * Triggers:
 * 1. onNewMessage  — when a new message is created in a conversation
 * 2. onMatchRequest — when someone sends a match request
 * 3. onMatchAccepted — when a match request is accepted
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// ────────────────────────────────────────────────
// Helper: send FCM push to a user by their userId
// ────────────────────────────────────────────────
async function sendPush(userId: string, title: string, body: string, link?: string): Promise<void> {
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return;

    const fcmToken = userDoc.data()?.fcmToken;
    if (!fcmToken) return; // User hasn't enabled push notifications

    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: { title, body },
      webpush: {
        fcmOptions: { link: link || "/dashboard" },
        notification: {
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-72.png",
        },
      },
    };

    await admin.messaging().send(message);
    functions.logger.log(`Push sent to ${userId}: ${title}`);
  } catch (err: unknown) {
    const error = err as { code?: string };
    // If the token is invalid/expired, remove it
    if (error.code === "messaging/invalid-registration-token" ||
        error.code === "messaging/registration-token-not-registered") {
      functions.logger.warn(`Removing invalid FCM token for user ${userId}`);
      await db.collection("users").doc(userId).update({ fcmToken: admin.firestore.FieldValue.delete() });
    } else {
      functions.logger.error(`Failed to send push to ${userId}:`, err);
    }
  }
}

// ────────────────────────────────────────────────
// 1. New Message → notify other participants
// ────────────────────────────────────────────────
export const onNewMessage = functions.firestore
  .document("messages/{messageId}")
  .onCreate(async (snap) => {
    const msg = snap.data();
    if (!msg) return;

    const { conversationId, senderId, senderName, text, isAI } = msg;

    // Don't send push for AI messages (Rally bot messages)
    if (isAI || senderId === "ai" || senderId === "rally") return;

    // Find the conversation to get participants
    const convDoc = await db.collection("conversations").doc(conversationId).get();
    if (!convDoc.exists) return;

    const participants: string[] = convDoc.data()?.participants || [];

    // Notify all participants except the sender and Rally
    const recipients = participants.filter((id: string) => id !== senderId && id !== "ai" && id !== "rally");

    const truncatedText = text.length > 80 ? text.substring(0, 80) + "..." : text;

    await Promise.all(
      recipients.map((userId: string) =>
        sendPush(
          userId,
          `New message from ${senderName || "Someone"}`,
          truncatedText,
          `/dashboard/messages/${conversationId}`
        )
      )
    );
  });

// ────────────────────────────────────────────────
// 2. Match Request → notify the recipient
// ────────────────────────────────────────────────
export const onMatchRequest = functions.firestore
  .document("matchRequests/{requestId}")
  .onCreate(async (snap) => {
    const request = snap.data();
    if (!request) return;

    const { fromUserId, toUserId, score } = request;

    // Look up the sender's name
    const fromDoc = await db.collection("users").doc(fromUserId).get();
    const fromName = fromDoc.data()?.firstName || fromDoc.data()?.name || "Someone";

    await sendPush(
      toUserId,
      "New Match Request! 🎾",
      `${fromName} wants to play with you! (${score}% compatible)`,
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

    // Only trigger when status changes to "accepted"
    if (before.status === "accepted" || after.status !== "accepted") return;

    const { fromUserId, toUserId, conversationId } = after;

    // Look up the acceptor's name
    const toDoc = await db.collection("users").doc(toUserId).get();
    const toName = toDoc.data()?.firstName || toDoc.data()?.name || "Someone";

    await sendPush(
      fromUserId,
      "Match Accepted! 🎾🔥",
      `${toName} accepted your match request! Open the chat to start planning your game!`,
      conversationId ? `/dashboard/messages/${conversationId}` : "/dashboard"
    );
  });

// ────────────────────────────────────────────────
// 4. New Conversation (with Rally intro) → notify participants
// ────────────────────────────────────────────────
export const onNewConversation = functions.firestore
  .document("conversations/{conversationId}")
  .onCreate(async (snap) => {
    const conv = snap.data();
    if (!conv) return;

    const participants: string[] = conv.participants || [];
    const humanParticipants = participants.filter((id: string) => id !== "ai" && id !== "rally");

    await Promise.all(
      humanParticipants.map((userId: string) =>
        sendPush(
          userId,
          "Rally has a new match for you! 🎾",
          "You've got a new match! Open the chat to meet your partner and start planning!",
          `/dashboard/messages/${snap.id}`
        )
      )
    );
  });
