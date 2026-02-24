"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Search, Clock, Star, Plus, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getMatches, getPlayers, createMatch, updateMatch, createConversation } from "@/lib/firestore";
import { type Match, type Player, getPlayerById, currentUser } from "@/lib/mock-data";

export default function OpenMatchesPage() {
  const { user } = useAuth();
  const displayUser = user || currentUser;
  const [sportFilter, setSportFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [newSport, setNewSport] = useState<"tennis" | "pickleball">("tennis");
  const [newType, setNewType] = useState<"singles" | "doubles">("singles");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newNotes, setNewNotes] = useState("");

  async function load() {
    try {
      const [m, p] = await Promise.all([getMatches(), getPlayers()]);
      setAllMatches(m);
      setAllPlayers(p);
    } catch (e) {
      console.error("Failed to load matches:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const findPlayer = (id: string) => allPlayers.find((p) => p.id === id) || getPlayerById(id);

  const openMatches = allMatches.filter((m) => m.status === "open" || m.status === "confirmed");
  const filtered = openMatches.filter((m) => {
    if (sportFilter !== "all" && m.sport !== sportFilter) return false;
    if (search) {
      const p1 = findPlayer(m.player1Id);
      const p2 = findPlayer(m.player2Id);
      const text = `${p1?.name} ${p2?.name} ${m.location}`.toLowerCase();
      if (!text.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const handleCreateMatch = async () => {
    if (!newDate || !newTime) return;
    await createMatch({
      player1Id: displayUser.id,
      player2Id: "",
      date: newDate,
      time: newTime,
      location: "Lifetime Activities Pleasanton",
      sport: newSport,
      status: "open",
      compatibilityScore: 0,
      matchExplanation: newNotes || `Open ${newSport} ${newType} match`,
      matchType: newType,
      notes: newNotes,
      createdBy: displayUser.id,
    } as Omit<Match, "id">);
    setShowCreate(false);
    setNewDate("");
    setNewTime("");
    setNewNotes("");
    await load();
  };

  const handleAcceptMatch = async (match: Match) => {
    const creator = findPlayer(match.player1Id || match.createdBy || "");
    const intro = `Hey ${creator?.firstName || creator?.name} and ${displayUser.firstName || displayUser.name}! 🎾 You're set to play ${match.sport} ${match.matchType || "singles"} on ${match.date} at ${match.time}. Please call Lifetime Activities at (925) 460-8600 to reserve a court. Update here once it's reserved!`;
    const convId = await createConversation([match.player1Id, displayUser.id], intro);
    await updateMatch(match.id, {
      player2Id: displayUser.id,
      status: "confirmed" as Match["status"],
    });
    void convId;
    await load();
  };

  if (loading) {
    return <div className="p-4 md:p-6 flex items-center justify-center min-h-[50vh]"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Open Matches</h1>
          <p className="text-muted-foreground">Browse and join available matches</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? <><X className="h-4 w-4 mr-1" /> Cancel</> : <><Plus className="h-4 w-4 mr-1" /> Create Match</>}
        </Button>
      </div>

      {showCreate && (
        <Card className="border-primary">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold">Create Open Match</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Sport</Label>
                <Select value={newSport} onValueChange={(v) => setNewSport(v as "tennis" | "pickleball")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tennis">🎾 Tennis</SelectItem>
                    <SelectItem value="pickleball">🏓 Pickleball</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Match Type</Label>
                <Select value={newType} onValueChange={(v) => setNewType(v as "singles" | "doubles")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="singles">Singles</SelectItem>
                    <SelectItem value="doubles">Doubles</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              </div>
              <div>
                <Label>Time</Label>
                <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Any details about the match..." />
            </div>
            <Button onClick={handleCreateMatch} disabled={!newDate || !newTime} className="w-full">
              Post Open Match
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search players or locations..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={sportFilter} onValueChange={setSportFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sports</SelectItem>
            <SelectItem value="tennis">Tennis</SelectItem>
            <SelectItem value="pickleball">Pickleball</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((match) => {
          const creator = findPlayer(match.createdBy || match.player1Id);
          const isOwn = (match.createdBy || match.player1Id) === displayUser.id;
          const isOpen = match.status === "open";
          const p2 = match.player2Id ? findPlayer(match.player2Id) : null;

          return (
            <Card key={match.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className="capitalize">{match.sport}</Badge>
                    {match.matchType && <Badge variant="outline" className="capitalize">{match.matchType}</Badge>}
                    <Badge variant={match.status === "open" ? "default" : "secondary"} className="capitalize">{match.status}</Badge>
                  </div>
                  {match.compatibilityScore > 0 && (
                    <div className="flex items-center gap-1 text-sm">
                      <Star className="h-4 w-4 text-accent fill-accent" />
                      <span className="font-bold text-primary">{match.compatibilityScore}%</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{creator?.avatar || "👤"}</div>
                  <div>
                    <p className="font-medium">{creator?.name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">NTRP {creator?.ntrpRating}</p>
                  </div>
                  {p2 && (
                    <>
                      <span className="text-lg font-bold text-muted-foreground">vs</span>
                      <div className="flex items-center gap-2">
                        <div className="text-2xl">{p2.avatar || "👤"}</div>
                        <div>
                          <p className="font-medium">{p2.name}</p>
                          <p className="text-xs text-muted-foreground">NTRP {p2.ntrpRating}</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" />{match.date} · {match.time}</div>
                  <div className="flex items-center gap-2">📍 {match.location}</div>
                </div>
                {match.notes && <p className="text-xs text-muted-foreground italic">{match.notes}</p>}
                {match.matchExplanation && <p className="text-xs text-muted-foreground italic">{match.matchExplanation}</p>}
                {match.compatibilityScore > 0 && <Progress value={match.compatibilityScore} className="h-1.5" />}
                {isOpen && !isOwn && (
                  <Button className="w-full" size="sm" onClick={() => handleAcceptMatch(match)}>
                    Accept Match
                  </Button>
                )}
                {isOpen && isOwn && (
                  <p className="text-xs text-center text-muted-foreground">Your open match — waiting for a partner</p>
                )}
                {match.status === "confirmed" && (
                  <Badge variant="default" className="w-full justify-center">Confirmed — reserve a court!</Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">No open matches found.</p>
          <p className="text-sm">Create one or check back later.</p>
        </div>
      )}
    </div>
  );
}
