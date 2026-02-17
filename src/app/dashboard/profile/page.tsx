"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Trophy, MapPin, Calendar, Edit2, Save, X } from "lucide-react";
import { currentUser, getMatchesForPlayer, getOpponent } from "@/lib/mock-data";

export default function ProfilePage() {
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(currentUser.bio);
  const userMatches = getMatchesForPlayer(currentUser.id);
  const completed = userMatches.filter((m) => m.status === "completed");
  const winRate = currentUser.matchesPlayed > 0 ? Math.round((currentUser.wins / currentUser.matchesPlayed) * 100) : 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      {/* Profile Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl">
              {currentUser.name.split(" ").map((n) => n[0]).join("")}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-bold">{currentUser.name}</h1>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{currentUser.location}</span>
                <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Joined {currentUser.joinedDate}</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge>NTRP {currentUser.ntrpRating}</Badge>
                <Badge variant="secondary" className="capitalize">{currentUser.sport}</Badge>
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
              <Button size="sm" onClick={() => setEditing(false)}><Save className="h-4 w-4 mr-1" />Save</Button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">{bio}</p>
          )}
        </CardContent>
      </Card>

      {/* Stats & History */}
      <Tabs defaultValue="stats">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="stats">Stats</TabsTrigger>
          <TabsTrigger value="history">Match History</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="space-y-4 mt-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Played", value: currentUser.matchesPlayed },
              { label: "Won", value: currentUser.wins },
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
                  const opp = getOpponent(match, currentUser.id);
                  return (
                    <div key={match.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium">vs {opp?.name}</p>
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
                  {currentUser.availability.map((d) => <Badge key={d} variant="secondary">{d}</Badge>)}
                </div>
              </div>
              <Separator />
              <div>
                <Label className="text-sm font-medium">Preferred Times</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {currentUser.preferredTimes.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
