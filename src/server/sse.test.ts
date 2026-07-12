// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChangePayload } from "./realtime";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

// Capture the onChange handler so tests can push payloads through it.
let changeHandler: ((p: ChangePayload) => void) | null = null;
const unsub = vi.fn();
vi.mock("./realtime", () => ({
  onChange: (h: (p: ChangePayload) => void) => {
    changeHandler = h;
    return unsub;
  },
}));

import { sseResponse } from "./sse";

function req() {
  return new Request("http://x/stream");
}

async function readFirst(res: Response, byteBudget = 200): Promise<string> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let out = "";
  while (out.length < byteBudget) {
    const { value, done } = await reader.read();
    if (done) break;
    out += dec.decode(value);
    if (out.includes("connected")) break;
  }
  reader.cancel();
  return out;
}

beforeEach(() => {
  authMock.mockReset();
  unsub.mockReset();
  changeHandler = null;
});

describe("sseResponse", () => {
  it("401s without a session", async () => {
    authMock.mockResolvedValue(null);
    const res = await sseResponse(req(), () => true);
    expect(res.status).toBe(401);
  });

  it("403s when the onOpen authz check throws", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    const res = await sseResponse(req(), () => true, {
      onOpen: async () => { throw new Error("not a participant"); },
    });
    expect(res.status).toBe(403);
  });

  it("opens an event-stream and emits the initial ping", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    const res = await sseResponse(req(), () => true);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    const first = await readFirst(res);
    expect(first).toContain("retry: 3000");
    expect(first).toContain("event: ping");
  });

  it("emits a change event only when shouldWake matches", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    const res = await sseResponse(req(), (me, p) => p.participants?.includes(me) ?? false);
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    // Drain the initial ping.
    await reader.read();
    expect(changeHandler).toBeTruthy();
    // Non-matching payload → no event.
    changeHandler!({ participants: ["someone-else"] });
    // Matching payload → change event.
    changeHandler!({ participants: ["u1"] });
    let got = "";
    while (!got.includes("event: change")) {
      const { value, done } = await reader.read();
      if (done) break;
      got += dec.decode(value);
    }
    expect(got).toContain("event: change");
    expect(got).not.toContain("someone-else");
    reader.cancel();
  });

  it("unsubscribes from the bus when the request aborts", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    const controller = new AbortController();
    const request = new Request("http://x/stream", { signal: controller.signal });
    const res = await sseResponse(request, () => true);
    await res.body!.getReader().read(); // ensure start() ran
    controller.abort();
    expect(unsub).toHaveBeenCalled();
  });
});
