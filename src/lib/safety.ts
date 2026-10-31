import type { Player } from "./mock-data";

/**
 * Client API for blocking, reporting, and moderation (App Store 1.2 / Play
 * UGC). Kept out of src/lib/data.ts so pages that mock that module in tests
 * don't need to know about these calls. Enforcement is server-side.
 */

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    cache: "no-store",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}`);
  return res.json();
}

export type BlockedPlayer = Player & { blockedAt: string };

export function getBlockedUsers(): Promise<BlockedPlayer[]> {
  return call<BlockedPlayer[]>("GET", "/api/blocks");
}

export async function blockUser(userId: string): Promise<void> {
  await call("POST", "/api/blocks", { userId });
}

export async function unblockUser(userId: string): Promise<void> {
  await call("DELETE", `/api/blocks/${encodeURIComponent(userId)}`);
}

export const REPORT_REASONS = [
  { value: "spam", label: "Spam or scam" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate", label: "Hate speech" },
  { value: "sexual", label: "Sexual or inappropriate content" },
  { value: "violence", label: "Threats or violence" },
  { value: "impersonation", label: "Fake profile or impersonation" },
  { value: "inappropriate_ai", label: "Harmful or wrong AI reply" },
  { value: "other", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];
export type ReportContext = "profile" | "message" | "rally" | "conversation";

export interface ReportPayload {
  reportedUserId?: string;
  messageId?: string;
  context?: ReportContext;
  reason: ReportReason;
  details?: string;
}

export async function reportContent(payload: ReportPayload): Promise<void> {
  await call("POST", "/api/reports", payload);
}

// ---------- admin ----------

export interface AdminReport {
  id: string;
  reporter: { id: string | null; name: string; email: string | null };
  reported: { id: string | null; name: string; email: string | null };
  context: ReportContext;
  reason: string;
  details: string;
  messageId?: string;
  messageText?: string;
  conversationId?: string;
  status: "open" | "reviewed" | "actioned";
  reviewedAt?: string;
  createdAt: string;
}

/** Admin-only. Rejects (403) for non-admins. */
export function getReports(status: "open" | "reviewed" | "actioned" | "all" = "open") {
  return call<AdminReport[]>("GET", `/api/admin/reports?status=${status}`);
}

export async function setReportStatus(id: string, status: AdminReport["status"]): Promise<void> {
  await call("PATCH", `/api/admin/reports/${encodeURIComponent(id)}`, { status });
}
