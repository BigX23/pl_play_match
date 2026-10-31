import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  blockUser,
  getBlockedUsers,
  getReports,
  reportContent,
  setReportStatus,
  unblockUser,
} from "./safety";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const lastCall = () => fetchMock.mock.calls[fetchMock.mock.calls.length - 1];

describe("safety client", () => {
  it("hits the block endpoints", async () => {
    await getBlockedUsers();
    expect(lastCall()[0]).toBe("/api/blocks");
    await blockUser("u 1");
    expect(lastCall()[0]).toBe("/api/blocks");
    expect(JSON.parse(lastCall()[1].body)).toEqual({ userId: "u 1" });
    await unblockUser("u 1");
    expect(lastCall()[0]).toBe("/api/blocks/u%201");
    expect(lastCall()[1].method).toBe("DELETE");
  });

  it("posts reports and drives the admin endpoints", async () => {
    await reportContent({ reportedUserId: "b", context: "profile", reason: "spam" });
    expect(lastCall()[0]).toBe("/api/reports");
    expect(JSON.parse(lastCall()[1].body)).toMatchObject({ reason: "spam" });
    await getReports();
    expect(lastCall()[0]).toBe("/api/admin/reports?status=open");
    await setReportStatus("r1", "actioned");
    expect(lastCall()[0]).toBe("/api/admin/reports/r1");
    expect(JSON.parse(lastCall()[1].body)).toEqual({ status: "actioned" });
  });

  it("throws with the status on failure", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) });
    await expect(getReports("all")).rejects.toThrow("403");
  });
});
