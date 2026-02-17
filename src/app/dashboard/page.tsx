"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trophy, Calendar, TrendingUp, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getMatches, getPlayers } from "@/lib/firestore";
import { type Match, type Player, getPlayerById, getCompatiblePlayers, currentUser } from "@/lib/mock-data";
import Link from "next/link";

export default function DashboardPage() {
  const { user } = useAuth();
  const [userMatches, setUserMatches] = useState<Match[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  const displayUser = user || currentUser;

  useEffect(() => {
    async function load() {
      try {
        const [m, p] = await Promise.all([
          getMatches(displayUser.id),
          getPlayers(),
        ]);
        setUserMatches(m);
        setAllPlayers(p);
      } catch (e) {
        console.error("Failed to load dashboard data:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [displayUser.id]);

  const upcoming = userMatches.filter((m) => m.status === "upcoming");
  const completed = userMatches.filter((m) => m.status === "completed");
  const winRate = displayUser.matchesPlayed > 0 ? Math.round((displayUser.wins / displayUser.matchesPlayed) * 100) : 0;

  const compatible = getCompatiblePlayers(displayUser.id).slice(0, 5);

  const getOpponentFromPlayers = (match: Match) => {
    const oppId = match.player1Id === displayUser.id ? match.player2Id : match.player1Id;
    return allPlayers.find((p) => p.id === oppId) || getPlayerById(oppId);
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Welcome back, {displayUser.name.split(" ")[0]}! 🎾</h1>
        <p className="text-muted-foreground">Here&apos;s your tennis overview</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Trophy, label: "Matches", value: displayUser.matchesPlayed, color: "text-primary" },
          { icon: TrendingUp, label: "Win Rate", value: `${winRate}%`, color: "text-accent" },
          { icon: Calendar, label: "Upcoming", value: upcoming.length, color: "text-blue-500" },
          { icon: Users, label: "NTRP", value: displayUser.ntrpRating.toFixed(1), color: "text-purple-500" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-8 w-8 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Upcoming Matches</CardTitle>
          <Link href="/dashboard/open-matches">
            <Button variant="ghost" size="sm">View All</Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {upcoming.length === 0 ? (
            <p className="text-muted-foreground text-sm">No upcoming matches. <Link href="/dashboard/open-matches" className="text-primary hover:underline">Find one!</Link></p>
          ) : (
            upcoming.map((match) => {
              const opp = getOpponentFromPlayers(match);
              return (
                <div key={match.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      {opp?.name.split(" ").map((n) => n[0]).join("") || "?"}
                    </div>
                    <div>
                      <p className="font-medium">{opp?.name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{match.date} · {match.time} · {match.location}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="capitalize">{match.sport}</Badge>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Top Compatible Players</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {compatible.map(({ player, score, explanation }) => (
            <div key={player.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-sm">
                  {player.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <p className="font-medium">{player.name} <span className="text-xs text-muted-foreground">NTRP {player.ntrpRating}</span></p>
                  <p className="text-xs text-muted-foreground">{explanation}</p>
                </div>
              </div>
              <div className="text-right min-w-[60px]">
                <p className="font-bold text-primary">{score}%</p>
                <Progress value={score} className="h-1.5 w-14" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Recent Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {completed.map((match) => {
            const opp = getOpponentFromPlayers(match);
            return (
              <div key={match.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center font-bold text-sm">
                    {opp?.name.split(" ").map((n) => n[0]).join("") || "?"}
                  </div>
                  <div>
                    <p className="font-medium">vs {opp?.name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{match.date} · {match.location}</p>
                  </div>
                </div>
                <Badge variant="outline">{match.score}</Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
