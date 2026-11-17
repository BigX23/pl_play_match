"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  blockUser,
  reportContent,
  REPORT_REASONS,
  type ReportContext,
  type ReportReason,
} from "@/lib/safety";

/**
 * Block confirmation. Blocking is symmetric in effect: neither player sees the
 * other in matches, suggestions, or open games, and their 1:1 chat is hidden.
 */
export function BlockUserDialog({
  open,
  onOpenChange,
  userId,
  name,
  onBlocked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  name: string;
  onBlocked?: () => void;
}) {
  const { toast } = useToast();

  const handleBlock = async () => {
    try {
      await blockUser(userId);
      toast({ title: `${name} blocked`, description: "You can unblock them any time in Settings." });
      onBlocked?.();
    } catch {
      toast({ title: "Couldn't block", description: "Please try again.", variant: "destructive" });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Block {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            You won&apos;t see each other in matches, suggestions, or open games, and neither of you can
            message the other. Your chat with them will be hidden. They aren&apos;t notified. You can unblock
            them later in Settings.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleBlock}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Block
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export interface ReportTarget {
  /** Display name of who/what is being reported (e.g. "Alice S." or "Rally"). */
  name: string;
  context: ReportContext;
  /** For profile/conversation reports. Message reports derive it server-side. */
  reportedUserId?: string;
  messageId?: string;
  /** When set, offers "Also block this player" (not shown for Rally). */
  blockUserId?: string;
}

/** Report a player, a message, or a Rally (AI) reply: reason + optional details. */
export function ReportDialog({
  open,
  onOpenChange,
  target,
  onReported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ReportTarget | null;
  onReported?: (opts: { blocked: boolean }) => void;
}) {
  const { toast } = useToast();
  const isRally = target?.context === "rally";
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [busy, setBusy] = useState(false);

  // Fresh form each time the dialog opens.
  useEffect(() => {
    if (open) {
      setReason(isRally ? "inappropriate_ai" : "");
      setDetails("");
      setAlsoBlock(false);
    }
  }, [open, isRally]);

  if (!target) return null;

  const subject =
    target.context === "rally"
      ? "this Rally reply"
      : target.context === "message"
        ? `this message from ${target.name}`
        : target.name;

  const handleSubmit = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      await reportContent({
        reportedUserId: target.messageId ? undefined : target.reportedUserId,
        messageId: target.messageId,
        context: target.context,
        reason,
        details: details.trim() || undefined,
      });
      let blocked = false;
      if (alsoBlock && target.blockUserId) {
        await blockUser(target.blockUserId);
        blocked = true;
      }
      toast({
        title: "Report sent",
        description: "Thanks for letting us know. We review reports within 24 hours.",
      });
      onOpenChange(false);
      onReported?.({ blocked });
    } catch {
      toast({ title: "Couldn't send report", description: "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report {subject}</DialogTitle>
          <DialogDescription>
            Reports are private — {isRally ? "this helps us improve Rally" : `${target.name} won't know who reported them`}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>What&apos;s wrong?</Label>
            <RadioGroup
              value={reason}
              onValueChange={(v) => setReason(v as ReportReason)}
              aria-label="Reason"
            >
              {REPORT_REASONS.filter((r) => isRally || r.value !== "inappropriate_ai").map((r) => (
                <div key={r.value} className="flex items-center gap-2">
                  <RadioGroupItem value={r.value} id={`report-reason-${r.value}`} />
                  <Label htmlFor={`report-reason-${r.value}`} className="font-normal">
                    {r.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-details">Details (optional)</Label>
            <Textarea
              id="report-details"
              value={details}
              maxLength={1000}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Anything that helps us understand what happened"
            />
          </div>

          {target.blockUserId && !isRally && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="report-also-block"
                checked={alsoBlock}
                onCheckedChange={(v) => setAlsoBlock(v === true)}
              />
              <Label htmlFor="report-also-block" className="font-normal">
                Also block {target.name}
              </Label>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={!reason || busy}>
            {busy ? "Sending…" : "Send report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
