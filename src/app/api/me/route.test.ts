// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
const auth = vi.fn();
const revoke = vi.fn();
const deleteAccount = vi.fn();

vi.mock("@/auth", () => ({ auth: () => auth() }));
vi.mock("@/db", () => ({ getDb: () => ({}) }));
vi.mock("@/server/push", () => ({ pushNewPlayer: vi.fn() }));
vi.mock("@/server/data", () => ({
  deleteAccount: (...a: unknown[]) => deleteAccount(...a),
  notifyNewCompatiblePlayer: vi.fn(),
}));
vi.mock("@/server/apple", () => ({
  revokeAppleTokensForUser: (...a: unknown[]) => revoke(...a),
}));

import { DELETE } from "./route";

describe("DELETE /api/me — Apple token revocation (App Store 5.1.1(v))", () => {
  beforeEach(() => {
    calls.length = 0;
    vi.clearAllMocks();
    auth.mockResolvedValue({ user: { id: "u1" } });
    revoke.mockImplementation(async () => {
      calls.push("revoke");
      return { revoked: 1, failed: 0 };
    });
    deleteAccount.mockImplementation(async () => {
      calls.push("delete");
    });
  });

  it("revokes Apple tokens before deleting the account", async () => {
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(calls).toEqual(["revoke", "delete"]);
    expect(revoke).toHaveBeenCalledWith({}, "u1", { nativeClientId: "com.aiplaymatch.app" });
  });

  it("still deletes when revocation reports failures", async () => {
    revoke.mockResolvedValue({ revoked: 0, failed: 2 });
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(deleteAccount).toHaveBeenCalledWith({}, "u1");
  });

  it("does nothing when signed out", async () => {
    auth.mockResolvedValue(null);
    expect((await DELETE()).status).toBe(401);
    expect(revoke).not.toHaveBeenCalled();
    expect(deleteAccount).not.toHaveBeenCalled();
  });
});
