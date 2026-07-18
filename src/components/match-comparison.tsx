"use client";

import Link from "next/link";
import { ArrowLeft, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Compatibility } from "@/lib/data";
import type { CellState } from "@/lib/availability";

/**
 * Match-detail compatibility view: a ring + score-composition bar, a You-vs-them
 * factor table color-coded by what matched, and a time-of-day availability
 * heatmap. Presentational — the parent supplies the data and the accept/decline
 * handlers. All values are already privacy-safe (see server `getCompatibility`).
 */

const STRIPE: Record<string, string> = {
  match: "bg-green-600",
  partial: "bg-amber-500",
  miss: "bg-red-600",
};
const CHIP: Record<string, string> = {
  match: "bg-green-100 text-green-700",
  partial: "bg-amber-100 text-amber-700",
  miss: "bg-red-100 text-red-700",
};
const ICON: Record<string, string> = { match: "✓", partial: "~", miss: "✕" };

function cellClass(c: CellState): string {
  if (c === "both") return "bg-green-100 border-green-300 text-green-700";
  if (c === "none") return "bg-muted border-border text-transparent";
  return "bg-amber-100 border-amber-300 text-transparent"; // you / them
}

export default function MatchComparison({
  data,
  onAccept,
  onDecline,
  busy = false,
}: {
  data: Compatibility;
  onAccept: () => void;
  onDecline: () => void;
  busy?: boolean;
}) {
  const { player, factors, grid } = data;
  const score = Math.round(data.score);

  const strong = factors.filter((f) => f.state === "match").map((f) => f.label);
  const weak = factors.filter((f) => f.state === "miss").map((f) => f.label);
  const verdict =
    (strong.length ? `You line up on ${strong.slice(0, 3).join(", ").toLowerCase()}. ` : "") +
    (weak.length ? `${weak.join(" and ")} hold the score back.` : "Very few gaps between you.");

  const meta = [
    player.ageBracket ? `Age ${player.ageBracket}` : null,
    (player.sports ?? []).join(", ") || null,
    player.location || null,
  ].filter(Boolean).join(" · ");

  const earned = factors.reduce((s, f) => s + f.weight * f.score, 0);
  const remainder = Math.max(0, 100 - earned);

  return (
    <div className="flex flex-col max-w-2xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <Link href="/dashboard" aria-label="Back to dashboard">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <p className="text-sm text-muted-foreground">Potential Match</p>
      </div>

      <div className="px-4 space-y-6">
        {/* Hero */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-4">
            <div className="text-4xl w-14 h-14 rounded-full bg-muted grid place-items-center flex-shrink-0">
              {player.avatar || "🎾"}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold truncate">{player.name}</h1>
              <p className="text-sm text-muted-foreground">{meta}</p>
            </div>
          </div>
          <div className="flex items-center gap-5 mt-5">
            <div
              className="relative w-24 h-24 rounded-full grid place-items-center flex-shrink-0"
              style={{ background: `conic-gradient(hsl(var(--primary)) ${score}%, hsl(var(--muted)) 0)` }}
              role="img"
              aria-label={`${score} percent compatibility`}
            >
              <div className="absolute inset-[9px] rounded-full bg-card" />
              <div className="relative text-center">
                <span className="block text-2xl font-bold tabular-nums leading-none">{score}%</span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Match</span>
              </div>
            </div>
            <p className="text-sm text-foreground/80">{verdict}</p>
          </div>
        </div>

        {/* Score composition */}
        <section>
          <div className="flex items-baseline justify-between mb-2 px-0.5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              How the {score}% is built
            </h2>
            <span className="text-[11px] text-muted-foreground tabular-nums">{score} / 100 pts</span>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex h-4 rounded-md overflow-hidden border bg-muted" aria-hidden="true">
              {factors.filter((f) => f.score > 0).map((f) => (
                <div
                  key={f.key}
                  className={`h-full border-r-2 border-card ${f.state === "match" ? "bg-green-600" : "bg-amber-500"}`}
                  style={{ width: `${f.weight * f.score}%` }}
                />
              ))}
              {remainder > 0 && (
                <div
                  className="h-full bg-[repeating-linear-gradient(-45deg,hsl(150_8%_90%)_0_5px,hsl(150_8%_94%)_5px_10px)]"
                  style={{ width: `${remainder}%` }}
                />
              )}
            </div>
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-green-600" /> Full match</span>
              <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Partial credit</span>
              <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-muted border border-border" /> Points left on the court</span>
            </div>
          </div>
        </section>

        {/* Comparison table */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 px-0.5">
            How you two line up
          </h2>
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="text-left font-semibold px-3 py-2">Factor</th>
                  <th className="text-left font-semibold px-3 py-2 text-primary">You</th>
                  <th className="text-left font-semibold px-3 py-2">{player.firstName || player.name}</th>
                  <th className="w-8" aria-label="Match state" />
                </tr>
              </thead>
              <tbody>
                {factors.map((f) => (
                  <tr key={f.key} className="border-t">
                    <td className="relative px-3 py-2.5 align-top">
                      <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${STRIPE[f.state]}`} />
                      <div className="font-medium">{f.label}</div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">{f.weight}% weight</div>
                    </td>
                    <td className="px-3 py-2.5 align-top">{f.you}</td>
                    <td className={`px-3 py-2.5 align-top ${f.state === "match" ? "text-green-700 font-medium" : ""}`}>{f.them}</td>
                    <td className="px-2 py-2.5 text-center align-top">
                      <span className={`inline-grid place-items-center rounded-full text-xs font-bold ${CHIP[f.state]}`}
                        style={{ width: "1.4rem", height: "1.4rem" }}
                        title={f.state}
                      >
                        {ICON[f.state]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Availability heatmap */}
        <section>
          <div className="flex items-baseline justify-between mb-2 px-0.5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Weekly availability</h2>
            <span className="text-[11px] text-muted-foreground">
              {grid.sharedCount} shared {grid.sharedCount === 1 ? "slot" : "slots"}
            </span>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="overflow-x-auto">
              <div
                className="grid gap-1.5 items-center min-w-[340px]"
                style={{ gridTemplateColumns: "78px repeat(7, minmax(32px, 1fr))" }}
                role="img"
                aria-label={`Availability heatmap. You are both free in ${grid.sharedCount} time slots this week.`}
              >
                <div />
                {grid.days.map((d) => (
                  <div key={d} className="text-center text-[11px] font-semibold uppercase text-muted-foreground">{d}</div>
                ))}
                {grid.periods.map((p) => (
                  <div key={p.key} className="contents">
                    <div className="text-right pr-2.5 text-xs font-medium text-foreground/70 whitespace-nowrap">{p.label}</div>
                    {grid.cells[p.key].map((c, i) => (
                      <div
                        key={i}
                        className={`h-[30px] rounded-md border grid place-items-center text-xs font-bold ${cellClass(c)}`}
                      >
                        {c === "both" ? "✓" : ""}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-3.5 mt-3.5 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-green-100 border border-green-300" /> Both free</span>
              <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-300" /> One of you</span>
              <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-muted border border-border" /> Neither</span>
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onDecline} disabled={busy}>
            <X className="h-4 w-4 mr-1.5" /> Decline
          </Button>
          <Button className="flex-1" onClick={onAccept} disabled={busy}>
            <Check className="h-4 w-4 mr-1.5" /> {busy ? "…" : "Accept Match"}
          </Button>
        </div>
      </div>
    </div>
  );
}
