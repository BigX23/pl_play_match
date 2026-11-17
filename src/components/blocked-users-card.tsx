"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Ban } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getBlockedUsers, unblockUser, type BlockedPlayer } from "@/lib/safety";

/** Settings → "Blocked users": everyone I've blocked, with unblock. */
export default function BlockedUsersCard() {
  const { toast } = useToast();
  const [blocked, setBlocked] = useState<BlockedPlayer[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getBlockedUsers()
      .then((list) => { if (!cancelled) setBlocked(list); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);

  const handleUnblock = async (p: BlockedPlayer) => {
    setBusyId(p.id);
    try {
      await unblockUser(p.id);
      setBlocked((prev) => (prev ?? []).filter((b) => b.id !== p.id));
      toast({ title: `${p.name} unblocked` });
    } catch {
      toast({ title: "Couldn't unblock", description: "Please try again.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Ban className="h-5 w-5" />Blocked users</CardTitle>
        <CardDescription>Blocked players can&apos;t see you or message you, and you won&apos;t see them</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {failed ? (
          <p className="text-sm text-muted-foreground">Couldn&apos;t load your blocked list. Try again later.</p>
        ) : blocked === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : blocked.length === 0 ? (
          <p className="text-sm text-muted-foreground">You haven&apos;t blocked anyone.</p>
        ) : (
          <ul className="divide-y">
            {blocked.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-muted grid place-items-center flex-shrink-0 text-sm">
                    {p.avatar || p.name.charAt(0)}
                  </div>
                  <span className="text-sm font-medium truncate">{p.name}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busyId === p.id}
                  onClick={() => handleUnblock(p)}
                >
                  Unblock
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
