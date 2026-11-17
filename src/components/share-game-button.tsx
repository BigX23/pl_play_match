"use client";

import * as React from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canShare, share } from "@/lib/share";
import type { Match } from "@/lib/mock-data";

const noopSubscribe = () => () => {};

/** Text for sharing an open game, e.g. "Looking for a tennis singles partner: ...". */
export function openGameShareContent(match: Pick<Match, "sport" | "matchType" | "date" | "time" | "location">, origin: string) {
  const kind = [match.sport, match.matchType].filter(Boolean).join(" ");
  const when = [match.date, match.time].filter(Boolean).join(" at ");
  const details = [when, match.location].filter(Boolean).join(", ");
  return {
    title: "Join my game on PlayMatch",
    text: `Looking for a ${kind} partner${details ? `: ${details}` : ""}. Join me on PlayMatch!`,
    url: `${origin}/dashboard/open-games`,
  };
}

/**
 * Share an open game through the system share sheet (M5). Hidden where the
 * device can't share (desktop browsers without navigator.share).
 */
export function ShareGameButton({ match }: { match: Match }) {
  // Server render and hydration see `false`; the client value applies after.
  const available = React.useSyncExternalStore(noopSubscribe, canShare, () => false);
  if (!available) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full"
      onClick={() => void share(openGameShareContent(match, window.location.origin))}
    >
      <Share2 className="h-3.5 w-3.5 mr-1" /> Share Game
    </Button>
  );
}
