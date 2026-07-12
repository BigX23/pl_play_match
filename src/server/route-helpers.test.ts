// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));
vi.mock("@/db", () => ({ getDb: () => ({ tag: "db" }) }));

import { withUser, jsonBody } from "./route-helpers";
import { AuthzError, NotFoundError } from "./data";

function ctx(params: Record<string, string> = {}) {
  return { params: Promise.resolve(params) };
}

beforeEach(() => authMock.mockReset());

describe("withUser", () => {
  it("401s when there is no session", async () => {
    authMock.mockResolvedValue(null);
    const res = await withUser(async () => ({ ok: true }))(new Request("http://x"), ctx());
    expect(res.status).toBe(401);
  });

  it("passes db, session id, request and params to the handler and returns its JSON", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    const handler = vi.fn(async (db, me, _req, params) => ({ me, tag: db.tag, id: params.id }));
    const res = await withUser(handler)(new Request("http://x"), ctx({ id: "42" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ me: "u1", tag: "db", id: "42" });
  });

  it("defaults to { ok: true } when the handler returns nothing", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    const res = await withUser(async () => undefined)(new Request("http://x"), ctx());
    expect(await res.json()).toEqual({ ok: true });
  });

  it("maps AuthzError → 403", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    const res = await withUser(async () => { throw new AuthzError("nope"); })(new Request("http://x"), ctx());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "nope" });
  });

  it("maps NotFoundError → 404", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    const res = await withUser(async () => { throw new NotFoundError("gone"); })(new Request("http://x"), ctx());
    expect(res.status).toBe(404);
  });

  it("maps unexpected errors → 500", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await withUser(async () => { throw new Error("boom"); })(new Request("http://x"), ctx());
    expect(res.status).toBe(500);
    spy.mockRestore();
  });
});

describe("jsonBody", () => {
  it("parses a JSON body", async () => {
    const req = new Request("http://x", { method: "POST", body: JSON.stringify({ a: 1 }) });
    expect(await jsonBody(req)).toEqual({ a: 1 });
  });
  it("returns {} on invalid JSON", async () => {
    const req = new Request("http://x", { method: "POST", body: "not json" });
    expect(await jsonBody(req)).toEqual({});
  });
});
