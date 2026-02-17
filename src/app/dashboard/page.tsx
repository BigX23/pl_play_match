"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trophy, Calendar, TrendingUp, Users } from "lucide-react";
import { currentUser, getMatchesForPlayer, getOpponent, getCompatiblePlayers } from "@/lib/mock-data";
import Link from "next/link";

export default function DashboardPage() {
  const userMatches = getMatchesForPlayer(currentUser.id);
  const upcoming = userMatches.filter((m) => m.status === "upcoming");
  const completed = userMatches.filter((m) => m.status === "completed");
  const compatible = getCompatiblePlayers(currentUser.id).slice(0, 5);
  const winRate = currentUser.matchesPlayed > 0 ? Math.round((currentUser.wins / currentUser.matchesPlayed) * 100) : 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Welcome back, {currentUser.name.split(" ")[0]}! 🎾</h1>
        <p className="text-muted-foreground">Here&apos;s your tennis overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Trophy, label: "Matches", value: currentUser.matchesPlayed, color: "text-primary" },
          { icon: TrendingUp, label: "Win Rate", value: `${winRate}%`, color: "text-accent" },
          { icon: Calendar, label: "Upcoming", value: upcoming.length, color: "text-blue-500" },
          { icon: Users, label: "NTRP", value: currentUser.ntrpRating.toFixed(1), color: "text-purple-500" },
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

      {/* Upcoming Matches */}
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
              const opp = getOpponent(match, currentUser.id);
              return (
                <div key={match.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      {opp?.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <p className="font-medium">{opp?.name}</p>
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

      {/* Top Compatible Players */}
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

      {/* Recent Results */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Recent Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {completed.map((match) => {
            const opp = getOpponent(match, currentUser.id);
            return (
              <div key={match.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center font-bold text-sm">
                    {opp?.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <p className="font-medium">vs {opp?.name}</p>
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
