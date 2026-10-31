import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/lib/safety", () => ({ getReports: vi.fn(), setReportStatus: vi.fn() }));

import { getReports, setReportStatus, type AdminReport } from "@/lib/safety";
import AdminReportsPage from "./page";

const report: AdminReport = {
  id: "r1",
  reporter: { id: "u_a", name: "Alice S.", email: "a@example.com" },
  reported: { id: "u_b", name: "Bob J.", email: "b@example.com" },
  context: "message",
  reason: "harassment",
  details: "kept at it",
  messageText: "nasty words",
  status: "open",
  createdAt: "2026-10-30T12:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(setReportStatus).mockResolvedValue(undefined);
});

describe("AdminReportsPage", () => {
  it("shows 'Admins only' for a non-admin (403)", async () => {
    vi.mocked(getReports).mockRejectedValue(new Error("GET /api/admin/reports?status=open → 403"));
    render(<AdminReportsPage />);
    expect(await screen.findByText("Admins only.")).toBeInTheDocument();
    expect(screen.queryByText("Bob J.")).not.toBeInTheDocument();
  });

  it("shows a generic error for other failures", async () => {
    vi.mocked(getReports).mockRejectedValue(new Error("500"));
    render(<AdminReportsPage />);
    expect(await screen.findByText(/Couldn.t load reports/)).toBeInTheDocument();
  });

  it("lists open reports and marks one actioned", async () => {
    vi.mocked(getReports).mockResolvedValueOnce([report]).mockResolvedValueOnce([]);
    const user = userEvent.setup();
    render(<AdminReportsPage />);
    expect(await screen.findByText("Bob J.")).toBeInTheDocument();
    expect(screen.getByText("nasty words")).toBeInTheDocument();
    expect(screen.getByText("kept at it")).toBeInTheDocument();
    expect(screen.getByText(/reported by Alice S\./)).toBeInTheDocument();
    expect(getReports).toHaveBeenCalledWith("open");

    await user.click(screen.getByRole("button", { name: "Mark actioned" }));
    await waitFor(() => expect(setReportStatus).toHaveBeenCalledWith("r1", "actioned"));
    expect(await screen.findByText("No open reports.")).toBeInTheDocument();
  });

  it("switches filters and can reopen a reviewed report", async () => {
    vi.mocked(getReports).mockResolvedValue([]);
    const user = userEvent.setup();
    render(<AdminReportsPage />);
    await screen.findByText("No open reports.");
    vi.mocked(getReports).mockResolvedValue([{ ...report, status: "reviewed" }]);
    await user.click(screen.getByRole("button", { name: "reviewed" }));
    await waitFor(() => expect(getReports).toHaveBeenCalledWith("reviewed"));
    await user.click(await screen.findByRole("button", { name: "Reopen" }));
    await waitFor(() => expect(setReportStatus).toHaveBeenCalledWith("r1", "open"));
  });

  it("toasts when an update fails", async () => {
    vi.mocked(getReports).mockResolvedValue([report]);
    vi.mocked(setReportStatus).mockRejectedValueOnce(new Error("500"));
    const user = userEvent.setup();
    render(<AdminReportsPage />);
    await user.click(await screen.findByRole("button", { name: "Mark reviewed" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }))
    );
  });
});
