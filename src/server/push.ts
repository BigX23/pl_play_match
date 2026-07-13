import webpush from "web-push";
import { eq } from "drizzle-orm";
import type { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { otherHumanParticipants } from "./data";

type Db = ReturnType<typeof getDb>;

let configured: boolean | null = null;

/** Configure web-push from env once. Returns false if VAPID keys are absent. */
function configure(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@aiplaymatch.com", pub, priv);
  configured = true;
  return true;
}

export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY || "";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/** Send a push to all of a user's subscriptions; prune ones the browser dropped. */
export async function sendPushToUser(db: Db, userId: string, payload: PushPayload): Promise<void> {
  if (!configure()) return;
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload)
        );
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        // 404/410 → the subscription is gone; remove it.
        if (code === 404 || code === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, s.endpoint));
        } else {
          console.error("[push] send failed:", code ?? err);
        }
      }
    })
  );
}

// ---------- higher-level triggers (mirror the old FCM functions) ----------

export async function pushNewMessage(
  db: Db,
  conversationId: string,
  senderId: string,
  senderName: string,
  text: string
): Promise<void> {
  const recipients = await otherHumanParticipants(db, conversationId, senderId);
  const body = text.length > 80 ? text.slice(0, 80) + "…" : text;
  await Promise.all(
    recipients.map((uid) =>
      sendPushToUser(db, uid, {
        title: `New message from ${senderName || "Someone"}`,
        body,
        url: `/dashboard/messages/${conversationId}`,
      })
    )
  );
}

export async function pushMatchRequest(
  db: Db,
  toUserId: string,
  fromName: string,
  score: number
): Promise<void> {
  await sendPushToUser(db, toUserId, {
    title: "New match request",
    body: `${fromName} wants to play with you (${score}% compatible).`,
    url: "/dashboard",
  });
}

export async function pushMatchAccepted(
  db: Db,
  toUserId: string,
  byName: string,
  conversationId?: string
): Promise<void> {
  await sendPushToUser(db, toUserId, {
    title: "Match accepted",
    body: `${byName} accepted your match request. Open the chat to plan your game.`,
    url: conversationId ? `/dashboard/messages/${conversationId}` : "/dashboard",
  });
}
