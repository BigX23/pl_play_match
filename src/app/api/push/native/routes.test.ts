// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const auth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => auth() }));
const fakeDb = { fake: true };
vi.mock("@/db", () => ({ getDb: () => fakeDb }));

const registerNativePushToken = vi.fn();
const unregisterNativePushToken = vi.fn();
vi.mock("@/server/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/data")>()),
  registerNativePushToken: (...a: unknown[]) => registerNativePushToken(...a),
  unregisterNativePushToken: (...a: unknown[]) => unregisterNativePushToken(...a),
}));

import { POST as register } from "./register/route";
import { POST as unregister } from "./unregister/route";

const ctx = { params: Promise.resolve({}) };
const post = (body: unknown) =>
  new Request("http://localhost/api/push/native/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  auth.mockReset();
  registerNativePushToken.mockReset();
  unregisterNativePushToken.mockReset();
});

describe("POST /api/push/native/register", () => {
  it("requires a session", async () => {
    auth.mockResolvedValue(null);
    const res = await register(post({ token: "t", platform: "ios" }), ctx);
    expect(res.status).toBe(401);
    expect(registerNativePushToken).not.toHaveBeenCalled();
  });

  it("registers the token for the session user, never a user id from the body", async () => {
    auth.mockResolvedValue({ user: { id: "alice" } });
    const res = await register(post({ token: "t", platform: "android", userId: "mallory" }), ctx);
    expect(res.status).toBe(200);
    expect(registerNativePushToken).toHaveBeenCalledWith(fakeDb, "alice", "t", "android");
  });

  it("rejects an unknown platform or missing token", async () => {
    auth.mockResolvedValue({ user: { id: "alice" } });
    expect((await register(post({ token: "t", platform: "web" }), ctx)).status).toBe(403);
    expect((await register(post({ platform: "ios" }), ctx)).status).toBe(403);
    expect(registerNativePushToken).not.toHaveBeenCalled();
  });
});

describe("POST /api/push/native/unregister", () => {
  it("requires a session", async () => {
    auth.mockResolvedValue(null);
    expect((await unregister(post({ token: "t" }), ctx)).status).toBe(401);
    expect(unregisterNativePushToken).not.toHaveBeenCalled();
  });

  it("unregisters the session user's token", async () => {
    auth.mockResolvedValue({ user: { id: "bob" } });
    const res = await unregister(post({ token: "t" }), ctx);
    expect(res.status).toBe(200);
    expect(unregisterNativePushToken).toHaveBeenCalledWith(fakeDb, "bob", "t");
  });

  it("rejects a missing token", async () => {
    auth.mockResolvedValue({ user: { id: "bob" } });
    expect((await unregister(post({}), ctx)).status).toBe(403);
  });
});
