import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

vi.mock("@/lib/safety", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/safety")>();
  return { ...actual, blockUser: vi.fn(), reportContent: vi.fn() };
});

import { blockUser, reportContent } from "@/lib/safety";
import { BlockUserDialog, ReportDialog } from "./safety-dialogs";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(blockUser).mockResolvedValue(undefined);
  vi.mocked(reportContent).mockResolvedValue(undefined);
});

describe("BlockUserDialog", () => {
  it("confirms, blocks, toasts and calls onBlocked", async () => {
    const onBlocked = vi.fn();
    const user = userEvent.setup();
    render(<BlockUserDialog open onOpenChange={() => {}} userId="u_bob" name="Bob J." onBlocked={onBlocked} />);
    expect(screen.getByText("Block Bob J.?")).toBeInTheDocument();
    expect(screen.getByText(/neither of you can message/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Block" }));
    await waitFor(() => expect(blockUser).toHaveBeenCalledWith("u_bob"));
    expect(onBlocked).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Bob J. blocked" }));
  });

  it("cancel does nothing", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<BlockUserDialog open onOpenChange={onOpenChange} userId="u_bob" name="Bob" />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(blockUser).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("toasts an error when blocking fails", async () => {
    vi.mocked(blockUser).mockRejectedValueOnce(new Error("500"));
    const onBlocked = vi.fn();
    const user = userEvent.setup();
    render(<BlockUserDialog open onOpenChange={() => {}} userId="u_bob" name="Bob" onBlocked={onBlocked} />);
    await user.click(screen.getByRole("button", { name: "Block" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }))
    );
    expect(onBlocked).not.toHaveBeenCalled();
  });
});

describe("ReportDialog", () => {
  it("renders nothing without a target", () => {
    const { container } = render(<ReportDialog open onOpenChange={() => {}} target={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("requires a reason, then sends a profile report with details", async () => {
    const onOpenChange = vi.fn();
    const onReported = vi.fn();
    const user = userEvent.setup();
    render(
      <ReportDialog
        open
        onOpenChange={onOpenChange}
        onReported={onReported}
        target={{ name: "Bob J.", context: "profile", reportedUserId: "u_bob", blockUserId: "u_bob" }}
      />
    );
    expect(screen.getByText("Report Bob J.")).toBeInTheDocument();
    // The AI-only reason isn't offered for people.
    expect(screen.queryByLabelText(/Harmful or wrong AI reply/i)).not.toBeInTheDocument();
    const send = screen.getByRole("button", { name: "Send report" });
    expect(send).toBeDisabled();

    await user.click(screen.getByLabelText("Harassment or bullying"));
    await user.type(screen.getByLabelText(/Details/i), "  kept messaging me  ");
    await user.click(send);

    await waitFor(() =>
      expect(reportContent).toHaveBeenCalledWith({
        reportedUserId: "u_bob",
        messageId: undefined,
        context: "profile",
        reason: "harassment",
        details: "kept messaging me",
      })
    );
    expect(blockUser).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onReported).toHaveBeenCalledWith({ blocked: false });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Report sent" }));
  });

  it("message report can also block the sender", async () => {
    const onReported = vi.fn();
    const user = userEvent.setup();
    render(
      <ReportDialog
        open
        onOpenChange={() => {}}
        onReported={onReported}
        target={{ name: "Bob", context: "message", messageId: "m1", blockUserId: "u_bob" }}
      />
    );
    expect(screen.getByText("Report this message from Bob")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Spam or scam"));
    await user.click(screen.getByLabelText("Also block Bob"));
    await user.click(screen.getByRole("button", { name: "Send report" }));
    await waitFor(() => expect(blockUser).toHaveBeenCalledWith("u_bob"));
    expect(reportContent).toHaveBeenCalledWith(
      expect.objectContaining({ messageId: "m1", context: "message", reason: "spam", details: undefined })
    );
    expect(onReported).toHaveBeenCalledWith({ blocked: true });
  });

  it("Rally reports default to the AI reason and offer no block", async () => {
    const user = userEvent.setup();
    render(
      <ReportDialog open onOpenChange={() => {}} target={{ name: "Rally", context: "rally", messageId: "m_ai" }} />
    );
    expect(screen.getByText("Report this Rally reply")).toBeInTheDocument();
    expect(screen.queryByText(/Also block/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send report" }));
    await waitFor(() =>
      expect(reportContent).toHaveBeenCalledWith(
        expect.objectContaining({ messageId: "m_ai", context: "rally", reason: "inappropriate_ai" })
      )
    );
  });

  it("toasts an error and stays open when sending fails", async () => {
    vi.mocked(reportContent).mockRejectedValueOnce(new Error("500"));
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ReportDialog open onOpenChange={onOpenChange} target={{ name: "Bob", context: "profile", reportedUserId: "u_bob" }} />
    );
    await user.click(screen.getByLabelText("Something else"));
    await user.click(screen.getByRole("button", { name: "Send report" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }))
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
