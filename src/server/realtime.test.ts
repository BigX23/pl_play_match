// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { notifyChange, onChange } from "./realtime";

describe("notifyChange", () => {
  it("issues a pg_notify on the pooled connection", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await notifyChange({ execute } as any, { conversationId: "c1", participants: ["a", "b"] });
    expect(execute).toHaveBeenCalledOnce();
  });

  it("swallows NOTIFY errors (best-effort)", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(notifyChange({ execute } as any, { conversationId: "c1" })).resolves.toBeUndefined();
    spy.mockRestore();
  });
});

describe("onChange", () => {
  it("returns an unsubscribe function (no DB configured in tests)", () => {
    const off = onChange(() => {});
    expect(typeof off).toBe("function");
    expect(() => off()).not.toThrow();
  });
});
