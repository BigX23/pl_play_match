// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getTableName } from "drizzle-orm";

const sendNotification = vi.fn();
const setVapidDetails = vi.fn();
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: (...a: unknown[]) => setVapidDetails(...a),
    sendNotification: (...a: unknown[]) => sendNotification(...a),
  },
}));

const otherHumanParticipants = vi.fn();
const unreadBadgeCount = vi.fn();
const blockedIdsFor = vi.fn(async (..._a: unknown[]) => new Set<string>());
vi.mock("./data", () => ({
  otherHumanParticipants: (...a: unknown[]) => otherHumanParticipants(...a),
  unreadBadgeCount: (...a: unknown[]) => unreadBadgeCount(...a),
  blockedIdsFor: (...a: unknown[]) => blockedIdsFor(...a),
}));

// firebase-admin is mocked: no network, no real credentials.
const sendEachForMulticast = vi.fn();
const initializeApp = vi.fn((..._a: unknown[]) => ({ name: "playmatch-push" }));
const cert = vi.fn((c: unknown) => ({ cert: c }));
vi.mock("firebase-admin/app", () => ({
  cert: (c: unknown) => cert(c),
  getApps: () => [],
  initializeApp: (...a: unknown[]) => initializeApp(...a),
}));
vi.mock("firebase-admin/messaging", () => ({
  getMessaging: () => ({ sendEachForMulticast: (m: unknown) => sendEachForMulticast(m) }),
}));

import { sendPushToUser, pushNewMessage, vapidPublicKey, _resetPushForTests } from "./push";

type WebSub = { endpoint: string; p256dh: string; auth: string };
type NativeTok = { token: string; platform: "ios" | "android" };

/**
 * Minimal fake Drizzle db: select→from(table)→where returns that table's rows;
 * delete(table)→where records the table name.
 */
function fakeDb(web: WebSub[], native: NativeTok[] = []) {
  const deleted: string[] = [];
  const rows: Record<string, unknown[]> = { push_subscriptions: web, native_push_tokens: native };
  const db = {
    select: () => ({
      from: (t: Parameters<typeof getTableName>[0]) => ({ where: () => Promise.resolve(rows[getTableName(t)] ?? []) }),
    }),
    delete: (t: Parameters<typeof getTableName>[0]) => ({
      where: () => {
        deleted.push(getTableName(t));
        return Promise.resolve();
      },
    }),
    _deleted: deleted,
  };
  return db as never;
}
const deletedOf = (db: unknown) => (db as { _deleted: string[] })._deleted;

const SERVICE_ACCOUNT = JSON.stringify({
  project_id: "test-project",
  client_email: "push@test-project.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nnot-a-real-key\n-----END PRIVATE KEY-----\n",
});

const ok = (n: number) => ({ responses: Array.from({ length: n }, () => ({ success: true })), successCount: n, failureCount: 0 });

beforeEach(() => {
  sendNotification.mockReset();
  setVapidDetails.mockReset();
  otherHumanParticipants.mockReset();
  unreadBadgeCount.mockReset();
  sendEachForMulticast.mockReset();
  initializeApp.mockClear();
  process.env.VAPID_PUBLIC_KEY = "pub";
  process.env.VAPID_PRIVATE_KEY = "priv";
  delete process.env.FCM_SERVICE_ACCOUNT_JSON;
  _resetPushForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sendPushToUser — web push", () => {
  it("sends a notification to each of the user's subscriptions", async () => {
    sendNotification.mockResolvedValue(undefined);
    const db = fakeDb([
      { endpoint: "e1", p256dh: "p", auth: "a" },
      { endpoint: "e2", p256dh: "p", auth: "a" },
    ]);
    await sendPushToUser(db, "u1", { title: "Hi", body: "there" });
    expect(sendNotification).toHaveBeenCalledTimes(2);
    const [sub, payload] = sendNotification.mock.calls[0];
    expect(sub.endpoint).toBe("e1");
    expect(JSON.parse(payload as string)).toMatchObject({ title: "Hi", body: "there" });
  });

  it("prunes a subscription the browser dropped (410)", async () => {
    sendNotification.mockRejectedValue({ statusCode: 410 });
    const db = fakeDb([{ endpoint: "dead", p256dh: "p", auth: "a" }]);
    await sendPushToUser(db, "u1", { title: "x", body: "y" });
    expect(deletedOf(db)).toEqual(["push_subscriptions"]);
  });

  it("no-ops when VAPID keys are absent", async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    // Force reconfiguration by importing a fresh module instance.
    vi.resetModules();
    const { sendPushToUser: fresh } = await import("./push");
    await fresh(fakeDb([{ endpoint: "e", p256dh: "p", auth: "a" }]), "u1", { title: "x", body: "y" });
    expect(sendNotification).not.toHaveBeenCalled();
  });
});

describe("sendPushToUser — native (FCM)", () => {
  beforeEach(() => {
    process.env.FCM_SERVICE_ACCOUNT_JSON = SERVICE_ACCOUNT;
  });

  it("fans out to web subscriptions AND native tokens", async () => {
    sendNotification.mockResolvedValue(undefined);
    sendEachForMulticast.mockResolvedValue(ok(2));
    unreadBadgeCount.mockResolvedValue(3);
    const db = fakeDb(
      [{ endpoint: "e1", p256dh: "p", auth: "a" }],
      [
        { token: "ios-tok", platform: "ios" },
        { token: "and-tok", platform: "android" },
      ]
    );
    await sendPushToUser(db, "u1", { title: "Hi", body: "there", url: "/dashboard/messages/c1" });

    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(sendEachForMulticast).toHaveBeenCalledTimes(1);
    const msg = sendEachForMulticast.mock.calls[0][0];
    expect(msg.tokens).toEqual(["ios-tok", "and-tok"]);
    expect(msg.notification).toEqual({ title: "Hi", body: "there" });
    expect(msg.data).toEqual({ url: "/dashboard/messages/c1" });
    expect(msg.apns.payload.aps.badge).toBe(3);
    expect(msg.android.notification).toMatchObject({ channelId: "default", icon: "ic_stat_playmatch", color: "#309957" });
    expect(deletedOf(db)).toEqual([]);
  });

  it("initializes firebase-admin once with the service account", async () => {
    sendEachForMulticast.mockResolvedValue(ok(1));
    const db = fakeDb([], [{ token: "t", platform: "android" }]);
    await sendPushToUser(db, "u1", { title: "a", body: "b" });
    await sendPushToUser(db, "u1", { title: "a", body: "b" });
    expect(initializeApp).toHaveBeenCalledTimes(1);
    expect(cert).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "test-project", clientEmail: "push@test-project.iam.gserviceaccount.com" })
    );
    expect(sendEachForMulticast).toHaveBeenCalledTimes(2);
  });

  it("omits the badge when the user has no iOS tokens", async () => {
    sendEachForMulticast.mockResolvedValue(ok(1));
    const db = fakeDb([], [{ token: "and-tok", platform: "android" }]);
    await sendPushToUser(db, "u1", { title: "a", body: "b" });
    expect(unreadBadgeCount).not.toHaveBeenCalled();
    const msg = sendEachForMulticast.mock.calls[0][0];
    expect(msg.apns.payload.aps.badge).toBeUndefined();
    expect(msg.data).toEqual({});
  });

  it("prunes tokens FCM reports as unregistered or invalid, keeps the rest", async () => {
    sendEachForMulticast.mockResolvedValue({
      responses: [
        { success: false, error: { code: "messaging/registration-token-not-registered" } },
        { success: true },
        { success: false, error: { code: "messaging/invalid-registration-token" } },
        { success: false, error: { code: "messaging/internal-error" } },
      ],
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    unreadBadgeCount.mockResolvedValue(0);
    const db = fakeDb(
      [],
      [
        { token: "gone", platform: "ios" },
        { token: "fine", platform: "ios" },
        { token: "bad", platform: "android" },
        { token: "flaky", platform: "android" },
      ]
    );
    await sendPushToUser(db, "u1", { title: "a", body: "b" });
    expect(deletedOf(db)).toEqual(["native_push_tokens"]);
  });

  it("doesn't prune when the whole FCM request fails", async () => {
    sendEachForMulticast.mockRejectedValue({ code: "app/network-error" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const db = fakeDb([], [{ token: "t", platform: "android" }]);
    await expect(sendPushToUser(db, "u1", { title: "a", body: "b" })).resolves.toBeUndefined();
    expect(deletedOf(db)).toEqual([]);
  });

  it("skips FCM entirely when the user has no native tokens", async () => {
    const db = fakeDb([], []);
    await sendPushToUser(db, "u1", { title: "a", body: "b" });
    expect(sendEachForMulticast).not.toHaveBeenCalled();
  });

  it("reads the service account from a file path", async () => {
    const { mkdtempSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const path = await import("node:path");
    const file = path.join(mkdtempSync(path.join(tmpdir(), "fcm-")), "sa.json");
    writeFileSync(file, SERVICE_ACCOUNT);
    process.env.FCM_SERVICE_ACCOUNT_JSON = file;
    sendEachForMulticast.mockResolvedValue(ok(1));
    await sendPushToUser(fakeDb([], [{ token: "t", platform: "android" }]), "u1", { title: "a", body: "b" });
    expect(sendEachForMulticast).toHaveBeenCalledTimes(1);
  });
});

describe("sendPushToUser — native unconfigured", () => {
  it("is a no-op that never loads firebase-admin, and logs once", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    sendNotification.mockResolvedValue(undefined);
    const db = fakeDb([{ endpoint: "e", p256dh: "p", auth: "a" }], [{ token: "t", platform: "ios" }]);
    await sendPushToUser(db, "u1", { title: "a", body: "b" });
    await sendPushToUser(db, "u1", { title: "a", body: "b" });
    expect(initializeApp).not.toHaveBeenCalled();
    expect(sendEachForMulticast).not.toHaveBeenCalled();
    expect(sendNotification).toHaveBeenCalledTimes(2); // web push unaffected
    expect(info).toHaveBeenCalledTimes(1);
  });

  it("disables native push on an unusable key without logging its contents", async () => {
    process.env.FCM_SERVICE_ACCOUNT_JSON = '{"private_key": "SECRET-MATERIAL"';
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await sendPushToUser(fakeDb([], [{ token: "t", platform: "ios" }]), "u1", { title: "a", body: "b" });
    expect(initializeApp).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0])).not.toContain("SECRET");
  });

  it("disables native push when the key lacks required fields", async () => {
    process.env.FCM_SERVICE_ACCOUNT_JSON = '{"project_id": "p"}';
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await sendPushToUser(fakeDb([], [{ token: "t", platform: "ios" }]), "u1", { title: "a", body: "b" });
    expect(initializeApp).not.toHaveBeenCalled();
    expect(String(error.mock.calls[0])).toContain("missing");
  });
});

describe("pushNewMessage", () => {
  it("pushes to other human participants with a truncated body", async () => {
    sendNotification.mockResolvedValue(undefined);
    otherHumanParticipants.mockResolvedValue(["bob"]);
    const db = fakeDb([{ endpoint: "e", p256dh: "p", auth: "a" }]);
    const long = "x".repeat(200);
    await pushNewMessage(db, "c1", "alice", "Alice", long);
    expect(otherHumanParticipants).toHaveBeenCalledWith(db, "c1", "alice");
    const [, payload] = sendNotification.mock.calls[0];
    const parsed = JSON.parse(payload as string);
    expect(parsed.title).toContain("Alice");
    expect(parsed.body.endsWith("…")).toBe(true);
    expect(parsed.url).toBe("/dashboard/messages/c1");
  });
  it("never pushes to a recipient on the other side of a block with the sender", async () => {
    sendNotification.mockResolvedValue(undefined);
    otherHumanParticipants.mockResolvedValue(["bob", "cara"]);
    blockedIdsFor.mockResolvedValueOnce(new Set(["bob"]));
    const sentTo: string[] = [];
    const db = {
      select: () => ({
        from: () => ({
          where: () => {
            sentTo.push("lookup");
            return Promise.resolve([{ endpoint: "e", p256dh: "p", auth: "a" }]);
          },
        }),
      }),
      delete: () => ({ where: () => Promise.resolve() }),
    } as never;
    await pushNewMessage(db, "c1", "alice", "Alice", "hi");
    expect(blockedIdsFor).toHaveBeenCalledWith(db, "alice");
    // Only cara's subscriptions were looked up / pushed.
    expect(sentTo).toHaveLength(1);
    expect(sendNotification).toHaveBeenCalledTimes(1);
  });
});

describe("vapidPublicKey", () => {
  it("reads the env", () => {
    process.env.VAPID_PUBLIC_KEY = "the-key";
    expect(vapidPublicKey()).toBe("the-key");
  });
});
