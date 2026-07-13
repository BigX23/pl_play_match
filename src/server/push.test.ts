// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendNotification = vi.fn();
const setVapidDetails = vi.fn();
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: (...a: unknown[]) => setVapidDetails(...a),
    sendNotification: (...a: unknown[]) => sendNotification(...a),
  },
}));

const otherHumanParticipants = vi.fn();
vi.mock("./data", () => ({
  otherHumanParticipants: (...a: unknown[]) => otherHumanParticipants(...a),
}));

import { sendPushToUser, pushNewMessage, vapidPublicKey } from "./push";

// Minimal fake Drizzle db: select→from→where returns queued rows; delete chainable.
function fakeDb(subs: Array<{ endpoint: string; p256dh: string; auth: string }>) {
  const deleted: string[] = [];
  const db = {
    select: () => ({ from: () => ({ where: () => Promise.resolve(subs) }) }),
    delete: () => ({ where: (cond: unknown) => { deleted.push(String(cond)); return Promise.resolve(); } }),
    _deleted: deleted,
  };
  return db as never;
}

beforeEach(() => {
  sendNotification.mockReset();
  setVapidDetails.mockReset();
  otherHumanParticipants.mockReset();
  process.env.VAPID_PUBLIC_KEY = "pub";
  process.env.VAPID_PRIVATE_KEY = "priv";
});

describe("sendPushToUser", () => {
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
    expect((db as unknown as { _deleted: string[] })._deleted.length).toBe(1);
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
});

describe("vapidPublicKey", () => {
  it("reads the env", () => {
    process.env.VAPID_PUBLIC_KEY = "the-key";
    expect(vapidPublicKey()).toBe("the-key");
  });
});
