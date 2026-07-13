"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trophy, Calendar, TrendingUp, Users, Send, Check, X, MessageCircle, Bell, Clock, CircleCheck, Target } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getMatches, getPlayers, getMatchRequests, createMatchRequest, updateMatchRequest, createGroupConversation, addContact } from "@/lib/data";
import { type Match, type Player, type MatchRequest, getPlayerById, playerToUserProfile } from "@/lib/mock-data";
import { findMatches, type MatchResult } from "@/lib/matching-engine";
import { buildMatchIntro } from "@/lib/ai-assistant";
import Link from "next/link";

function scoreColor(score: number) {
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-yellow-500";
  return "text-orange-500";
}

function scoreBg(score: number) {
  if (score >= 80) return "bg-green-500/10";
  if (score >= 60) return "bg-yellow-500/10";
  return "bg-orange-500/10";
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [userMatches, setUserMatches] = useState<Match[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [requests, setRequests] = useState<MatchRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const displayUser = user;

  const loadData = useCallback(async () => {
    if (!displayUser) return;
    try {
      const [m, p, r] = await Promise.all([
        getMatches(displayUser.id),
        getPlayers(),
        getMatchRequests(displayUser.id),
      ]);
      setUserMatches(m);
      setAllPlayers(p);
      setRequests(r);

      // Run matching engine
      const myProfile = playerToUserProfile(displayUser as Player);
      if (myProfile) {
        const otherProfiles = p
          .filter((pl) => pl.id !== displayUser.id)
          .map(playerToUserProfile)
          .filter(Boolean) as NonNullable<ReturnType<typeof playerToUserProfile>>[];
        setMatchResults(findMatches(myProfile, otherProfiles));
      }
    } catch (e) {
      console.error("Failed to load dashboard data:", e);
    } finally {
      setLoading(false);
    }
  }, [displayUser]);

  useEffect(() => { loadData(); }, [loadData]);

  if (!displayUser) return null;

  const matchesPlayed = displayUser.matchesPlayed ?? 0;
  const wins = displayUser.wins ?? 0;
  const upcoming = userMatches.filter((m) => m.status === "scheduled" || m.status === "confirmed");
  const completed = userMatches.filter((m) => m.status === "completed");
  const winRate = matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0;

  const pendingSent = requests.filter((r) => r.fromUserId === displayUser.id && r.status === "pending");
  const pendingReceived = requests.filter((r) => r.toUserId === displayUser.id && r.status === "pending");
  const acceptedRequests = requests.filter((r) => r.status === "accepted");

  // Only pending/accepted requests block re-requesting — a declined or expired
  // request should let either party try again.
  const alreadyRequested = new Set(
    requests
      .filter((r) => r.status === "pending" || r.status === "accepted")
      .map((r) => (r.fromUserId === displayUser.id ? r.toUserId : r.fromUserId))
  );

  const handleSendRequest = async (targetId: string, score: number) => {
    setSendingTo(targetId);
    try {
      await createMatchRequest({
        fromUserId: displayUser.id,
        toUserId: targetId,
        status: "pending",
        score,
        createdAt: new Date().toISOString(),
      });
      await loadData();
    } finally {
      setSendingTo(null);
    }
  };

  const handleAcceptRequest = async (req: MatchRequest) => {
    if (actingOn) return; // guard double-click
    setActingOn(req.id);
    try {
      const fromPlayer = allPlayers.find((p) => p.id === req.fromUserId) || getPlayerById(req.fromUserId);
      const toPlayer = allPlayers.find((p) => p.id === req.toUserId) || getPlayerById(req.toUserId);
      const fromName = fromPlayer?.firstName || fromPlayer?.name || "there";
      const toName = toPlayer?.firstName || toPlayer?.name || "there";
      const intro = buildMatchIntro(fromName, toName, { score: req.score });
      const groupName = `Match: ${fromName} vs ${toName}`;
      const convId = await createGroupConversation([req.fromUserId, req.toUserId], "", groupName, intro, displayUser.id);
      if (fromPlayer) {
        await addContact(req.toUserId, { id: req.fromUserId, name: fromName, email: fromPlayer.email, avatar: fromPlayer.avatar, addedAt: new Date().toISOString() }).catch(() => {});
      }
      if (toPlayer) {
        await addContact(req.fromUserId, { id: req.toUserId, name: toName, email: toPlayer.email, avatar: toPlayer.avatar, addedAt: new Date().toISOString() }).catch(() => {});
      }
      await updateMatchRequest(req.id, { status: "accepted", conversationId: convId });
      await loadData();
    } finally {
      setActingOn(null);
    }
  };

  const handleDeclineRequest = async (req: MatchRequest) => {
    if (actingOn) return;
    setActingOn(req.id);
    try {
      await updateMatchRequest(req.id, { status: "declined" });
      await loadData();
    } finally {
      setActingOn(null);
    }
  };

  const getOpponentFromPlayers = (match: Match) => {
    const oppId = match.player1Id === displayUser.id ? match.player2Id : match.player1Id;
    return allPlayers.find((p) => p.id === oppId) || getPlayerById(oppId);
  };

  if (loading) {
    return <div className="p-4 md:p-6 flex items-center justify-center min-h-[50vh]"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Welcome back, {displayUser.firstName || displayUser.name.split(" ")[0]}</h1>
        <p className="text-muted-foreground">Here&apos;s your tennis overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Trophy, label: "Matches", value: matchesPlayed, color: "text-primary" },
          { icon: TrendingUp, label: "Win Rate", value: `${winRate}%`, color: "text-accent" },
          { icon: Calendar, label: "Upcoming", value: upcoming.length, color: "text-blue-500" },
          { icon: Users, label: "NTRP", value: (displayUser.ntrpRating ?? 0).toFixed(1), color: "text-purple-500" },
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

      {/* New Match Requests (received) */}
      {pendingReceived.length > 0 && (
        <Card className="border-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" /> New Match Requests <Badge variant="destructive">{pendingReceived.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingReceived.map((req) => {
              const fromPlayer = allPlayers.find((p) => p.id === req.fromUserId) || getPlayerById(req.fromUserId);
              return (
                <div key={req.id} className="flex items-center justify-between p-3 rounded-lg border bg-primary/5">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{fromPlayer?.avatar || "👤"}</div>
                    <div>
                      <p className="font-medium">{fromPlayer?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        NTRP {fromPlayer?.ntrpRating} · <span className={scoreColor(req.score)}>{req.score}% compatible</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="default" disabled={actingOn !== null} onClick={() => handleAcceptRequest(req)}>
                      <Check className="h-4 w-4 mr-1" /> {actingOn === req.id ? "Accepting…" : "Accept"}
                    </Button>
                    <Button size="sm" variant="outline" disabled={actingOn !== null} onClick={() => handleDeclineRequest(req)}>
                      <X className="h-4 w-4 mr-1" /> Decline
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Pending Sent Requests */}
      {pendingSent.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2"><Clock className="h-5 w-5 text-muted-foreground" /> Pending Requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingSent.map((req) => {
              const toPlayer = allPlayers.find((p) => p.id === req.toUserId) || getPlayerById(req.toUserId);
              return (
                <div key={req.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{toPlayer?.avatar || "👤"}</div>
                    <div>
                      <p className="font-medium">{toPlayer?.name}</p>
                      <p className="text-xs text-muted-foreground">{req.score}% compatible · Awaiting response</p>
                    </div>
                  </div>
                  <Badge variant="secondary">Pending</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Accepted Matches */}
      {acceptedRequests.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2"><CircleCheck className="h-5 w-5 text-green-600" /> Accepted Matches</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {acceptedRequests.map((req) => {
              const otherId = req.fromUserId === displayUser.id ? req.toUserId : req.fromUserId;
              const other = allPlayers.find((p) => p.id === otherId) || getPlayerById(otherId);
              return (
                <div key={req.id} className="flex items-center justify-between p-3 rounded-lg border border-green-500/30 bg-green-500/5">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{other?.avatar || "👤"}</div>
                    <div>
                      <p className="font-medium">{other?.name}</p>
                      <p className="text-xs text-muted-foreground">{req.score}% compatible</p>
                    </div>
                  </div>
                  {req.conversationId && (
                    <Link href={`/dashboard/messages/${req.conversationId}`}>
                      <Button size="sm" variant="outline"><MessageCircle className="h-4 w-4 mr-1" /> Chat</Button>
                    </Link>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Top Matches (from matching engine) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg flex items-center gap-2"><Target className="h-5 w-5 text-primary" /> Your Top Matches</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {matchResults.length === 0 ? (
            <p className="text-muted-foreground text-sm">No compatible players found yet. Check back soon!</p>
          ) : (
            matchResults.slice(0, 10).map(({ user: matchUser, score }) => {
              const player = allPlayers.find((p) => p.id === matchUser.id) || getPlayerById(matchUser.id);
              const requested = alreadyRequested.has(matchUser.id);
              return (
                <div key={matchUser.id} className={`flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors ${scoreBg(score)}`}>
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{matchUser.avatar || "👤"}</div>
                    <div>
                      <p className="font-medium">
                        {matchUser.firstName} {matchUser.lastName}{" "}
                        <span className="text-xs text-muted-foreground">NTRP {matchUser.ntrpRating}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Age {matchUser.age} · {matchUser.sports.join(", ")} · {matchUser.gameType.replace("-", " ")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={`font-bold ${scoreColor(score)}`}>{score}%</p>
                      <Progress value={score} className="h-1.5 w-14" />
                    </div>
                    {requested ? (
                      <Badge variant="secondary" className="text-xs">Requested</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSendRequest(matchUser.id, score)}
                        disabled={sendingTo === matchUser.id}
                      >
                        <Send className="h-3 w-3 mr-1" />
                        {sendingTo === matchUser.id ? "..." : "Match"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Upcoming Matches */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Upcoming Matches</CardTitle>
          <Link href="/dashboard/open-matches"><Button variant="ghost" size="sm">View All</Button></Link>
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
                    <div className="text-2xl">{opp?.avatar || "👤"}</div>
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

      {/* Recent Results */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-lg">Recent Results</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {completed.length === 0 && (
            <p className="text-muted-foreground text-sm">No completed matches yet — your results will show up here.</p>
          )}
          {completed.map((match) => {
            const opp = getOpponentFromPlayers(match);
            return (
              <div key={match.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{opp?.avatar || "👤"}</div>
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
