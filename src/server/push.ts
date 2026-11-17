import webpush from "web-push";
import { readFileSync } from "node:fs";
import { eq, inArray } from "drizzle-orm";
import type { Messaging, MulticastMessage } from "firebase-admin/messaging";
import type { getDb } from "@/db";
import { nativePushTokens, pushSubscriptions } from "@/db/schema";
import { otherHumanParticipants, unreadBadgeCount } from "./data";

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

/**
 * Send a push to every device the user has: Web Push subscriptions (browsers /
 * the PWA) and FCM tokens (the iOS/Android apps). Each side is skipped when its
 * credentials are absent, and dead subscriptions/tokens are pruned.
 */
export async function sendPushToUser(db: Db, userId: string, payload: PushPayload): Promise<void> {
  await Promise.all([sendWebPush(db, userId, payload), sendNativePush(db, userId, payload)]);
}

async function sendWebPush(db: Db, userId: string, payload: PushPayload): Promise<void> {
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

// ---------- native push (FCM HTTP v1 via firebase-admin) ----------

/**
 * FCM_SERVICE_ACCOUNT_JSON holds the Firebase service-account key, either
 * inline (the JSON itself, one line; what production uses in deploy/.env) or as
 * a path to the .json file (handy locally). Never commit the key.
 */
function readServiceAccount(raw: string): { projectId: string; clientEmail: string; privateKey: string } {
  const text = raw.trim().startsWith("{") ? raw : readFileSync(raw.trim(), "utf8");
  const j = JSON.parse(text) as { project_id?: string; client_email?: string; private_key?: string };
  if (!j.project_id || !j.client_email || !j.private_key) {
    throw new Error("service account JSON is missing project_id, client_email or private_key");
  }
  return { projectId: j.project_id, clientEmail: j.client_email, privateKey: j.private_key };
}

let messaging: Promise<Messaging | null> | null = null;

/**
 * Lazily initialize firebase-admin once. Resolves null (native push off) when
 * the env var is unset or the key is unusable; logs that once. firebase-admin is
 * only imported when configured.
 */
function getMessaging(): Promise<Messaging | null> {
  if (messaging) return messaging;
  messaging = (async () => {
    const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
    if (!raw) {
      console.info("[push] FCM_SERVICE_ACCOUNT_JSON not set; native (iOS/Android) push disabled");
      return null;
    }
    let creds;
    try {
      creds = readServiceAccount(raw);
    } catch (err) {
      // Don't log err.message for JSON errors: it can quote part of the key.
      const detail = err instanceof SyntaxError ? "not valid JSON" : (err as Error).message;
      console.error(`[push] FCM_SERVICE_ACCOUNT_JSON unusable (${detail}); native push disabled`);
      return null;
    }
    try {
      const { cert, getApps, initializeApp } = await import("firebase-admin/app");
      const { getMessaging: messagingFor } = await import("firebase-admin/messaging");
      const name = "playmatch-push";
      const app =
        getApps().find((a) => a.name === name) ??
        initializeApp({ credential: cert(creds), projectId: creds.projectId }, name);
      return messagingFor(app);
    } catch (err) {
      console.error("[push] firebase-admin init failed; native push disabled:", (err as Error).message);
      return null;
    }
  })();
  return messaging;
}

/** FCM error codes that mean the token will never work again. */
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);
const FCM_MULTICAST_LIMIT = 500;

async function sendNativePush(db: Db, userId: string, payload: PushPayload): Promise<void> {
  // Unconfigured → null (cached, logged once) before any DB work.
  const fcm = await getMessaging();
  if (!fcm) return;

  const rows = await db
    .select({ token: nativePushTokens.token, platform: nativePushTokens.platform })
    .from(nativePushTokens)
    .where(eq(nativePushTokens.userId, userId));
  if (rows.length === 0) return;

  let badge: number | undefined;
  if (rows.some((r) => r.platform === "ios")) {
    badge = await unreadBadgeCount(db, userId).catch(() => undefined);
  }

  const base: Omit<MulticastMessage, "tokens"> = {
    notification: { title: payload.title, body: payload.body },
    // data values must be strings; the app routes a tap to data.url.
    data: payload.url ? { url: payload.url } : {},
    // Channel, icon and color match the app (android/app/src/main: MainActivity,
    // ic_stat_playmatch, playmatch_accent); the manifest has the same defaults.
    android: {
      priority: "high",
      notification: { channelId: "default", icon: "ic_stat_playmatch", color: "#309957", sound: "default" },
    },
    apns: { payload: { aps: { sound: "default", ...(badge !== undefined ? { badge } : {}) } } },
  };

  const tokens = rows.map((r) => r.token);
  const dead: string[] = [];
  for (let i = 0; i < tokens.length; i += FCM_MULTICAST_LIMIT) {
    const chunk = tokens.slice(i, i + FCM_MULTICAST_LIMIT);
    try {
      const res = await fcm.sendEachForMulticast({ ...base, tokens: chunk });
      res.responses.forEach((r, j) => {
        if (r.success) return;
        const code = r.error?.code ?? "";
        if (DEAD_TOKEN_CODES.has(code)) dead.push(chunk[j]);
        else console.error("[push] FCM send failed:", code || r.error?.message);
      });
    } catch (err) {
      console.error("[push] FCM request failed:", (err as { code?: string }).code ?? (err as Error).message);
    }
  }
  if (dead.length > 0) {
    await db.delete(nativePushTokens).where(inArray(nativePushTokens.token, dead));
  }
}

/** Test hook: forget the cached firebase-admin instance and VAPID config. */
export function _resetPushForTests() {
  configured = null;
  messaging = null;
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
    title: "It's a Match! 🎾",
    body: `${fromName} matched with you (${score}% compatible) — accept to connect.`,
    url: "/dashboard",
  });
}

export async function pushNewPlayer(
  db: Db,
  toUserId: string,
  newPlayerName: string,
  score: number
): Promise<void> {
  await sendPushToUser(db, toUserId, {
    title: "New player joined 🎾",
    body: `${newPlayerName} just joined and is ${score}% compatible with you.`,
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
    title: "You're connected! 🎾",
    body: `${byName} accepted your match. Open the chat to plan your game.`,
    url: conversationId ? `/dashboard/messages/${conversationId}` : "/dashboard",
  });
}
