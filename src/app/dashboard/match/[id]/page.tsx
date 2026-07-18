"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getCompatibility, createMatchRequest, type Compatibility } from "@/lib/data";
import MatchComparison from "@/components/match-comparison";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function MatchDetailPage() {
  const pathname = usePathname();
  // Last path segment is the other player's id (mirrors the messages route).
  const id = pathname.replace(/\/+$/, "").split("/").pop() || "";
  const { user } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<Compatibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    getCompatibility(id)
      .then((c) => { if (!cancelled) setData(c); })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const handleAccept = async () => {
    if (!user || !data) return;
    setBusy(true);
    try {
      await createMatchRequest({
        fromUserId: user.id,
        toUserId: data.player.id,
        status: "pending",
        score: data.score,
        createdAt: new Date().toISOString(),
      });
      router.push("/dashboard");
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = () => router.push("/dashboard");

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-sm text-muted-foreground mt-2">Loading match…</p>
      </div>
    );
  }

  if (failed || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-muted-foreground">This match is no longer available.</p>
        <Button variant="ghost" className="mt-2" onClick={() => router.push("/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to dashboard
        </Button>
      </div>
    );
  }

  return <MatchComparison data={data} onAccept={handleAccept} onDecline={handleDecline} busy={busy} />;
}
