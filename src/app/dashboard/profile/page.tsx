"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { MapPin, Calendar, Edit2, Save, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getMatches, getPlayers, updateUser } from "@/lib/firestore";
import { type Match, type Player, currentUser, getPlayerById } from "@/lib/mock-data";

export default function ProfilePage() {
  const { user } = useAuth();
  const displayUser = user || currentUser;
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(displayUser.bio);
  const [userMatches, setUserMatches] = useState<Match[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);

  useEffect(() => {
    async function load() {
      const [m, p] = await Promise.all([
        getMatches(displayUser.id),
        getPlayers(),
      ]);
      setUserMatches(m);
      setAllPlayers(p);
    }
    load();
  }, [displayUser.id]);

  const completed = userMatches.filter((m) => m.status === "completed");
  const winRate = displayUser.matchesPlayed > 0 ? Math.round((displayUser.wins / displayUser.matchesPlayed) * 100) : 0;

  const findPlayer = (id: string) => allPlayers.find((p) => p.id === id) || getPlayerById(id);

  const getOpponent = (match: Match) => {
    const oppId = match.player1Id === displayUser.id ? match.player2Id : match.player1Id;
    return findPlayer(oppId);
  };

  const handleSave = async () => {
    await updateUser(displayUser.id, { bio });
    setEditing(false);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl">
              {displayUser.name.split(" ").map((n) => n[0]).join("")}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-bold">{displayUser.name}</h1>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{displayUser.location}</span>
                <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Joined {displayUser.joinedDate}</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge>NTRP {displayUser.ntrpRating}</Badge>
                <Badge variant="secondary" className="capitalize">{displayUser.sport}</Badge>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
              {editing ? <><X className="h-4 w-4 mr-1" />Cancel</> : <><Edit2 className="h-4 w-4 mr-1" />Edit</>}
            </Button>
          </div>
          {editing ? (
            <div className="mt-4 space-y-3">
              <div className="space-y-1">
                <Label>Bio</Label>
                <Input value={bio} onChange={(e) => setBio(e.target.value)} />
              </div>
              <Button size="sm" onClick={handleSave}><Save className="h-4 w-4 mr-1" />Save</Button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">{bio}</p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="stats">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="stats">Stats</TabsTrigger>
          <TabsTrigger value="history">Match History</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="space-y-4 mt-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Played", value: displayUser.matchesPlayed },
              { label: "Won", value: displayUser.wins },
              { label: "Win Rate", value: `${winRate}%` },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              {completed.length === 0 ? (
                <p className="text-muted-foreground text-sm">No completed matches yet.</p>
              ) : (
                completed.map((match) => {
                  const opp = getOpponent(match);
                  return (
                    <div key={match.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium">vs {opp?.name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{match.date} · {match.location}</p>
                      </div>
                      <Badge variant="outline">{match.score}</Badge>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="availability" className="mt-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div>
                <Label className="text-sm font-medium">Available Days</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {displayUser.availability.map((d) => <Badge key={d} variant="secondary">{d}</Badge>)}
                </div>
              </div>
              <Separator />
              <div>
                <Label className="text-sm font-medium">Preferred Times</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {displayUser.preferredTimes.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
