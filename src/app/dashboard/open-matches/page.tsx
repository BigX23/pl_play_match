"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Search, MapPin, Clock, Star } from "lucide-react";
import { matches, getPlayerById } from "@/lib/mock-data";

export default function OpenMatchesPage() {
  const [sportFilter, setSportFilter] = useState("all");
  const [search, setSearch] = useState("");

  const openMatches = matches.filter((m) => m.status === "open");
  const filtered = openMatches.filter((m) => {
    if (sportFilter !== "all" && m.sport !== sportFilter) return false;
    if (search) {
      const p1 = getPlayerById(m.player1Id);
      const p2 = getPlayerById(m.player2Id);
      const text = `${p1?.name} ${p2?.name} ${m.location}`.toLowerCase();
      if (!text.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Open Matches</h1>
        <p className="text-muted-foreground">Browse and join available matches near you</p>
      </div>

      {/* Filters */}
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

      {/* Match Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((match) => {
          const p1 = getPlayerById(match.player1Id);
          const p2 = getPlayerById(match.player2Id);
          return (
            <Card key={match.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge className="capitalize">{match.sport}</Badge>
                  <div className="flex items-center gap-1 text-sm">
                    <Star className="h-4 w-4 text-accent fill-accent" />
                    <span className="font-bold text-primary">{match.compatibilityScore}%</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold mx-auto">
                      {p1?.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <p className="text-sm font-medium mt-1">{p1?.name}</p>
                    <p className="text-xs text-muted-foreground">NTRP {p1?.ntrpRating}</p>
                  </div>
                  <span className="text-lg font-bold text-muted-foreground">vs</span>
                  <div className="text-center">
                    <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold mx-auto">
                      {p2?.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <p className="text-sm font-medium mt-1">{p2?.name}</p>
                    <p className="text-xs text-muted-foreground">NTRP {p2?.ntrpRating}</p>
                  </div>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" />{match.date} · {match.time}</div>
                  <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />{match.location}</div>
                </div>
                <p className="text-xs text-muted-foreground italic">{match.matchExplanation}</p>
                <Progress value={match.compatibilityScore} className="h-1.5" />
                <Button className="w-full" size="sm">Join Match</Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">No open matches found.</p>
          <p className="text-sm">Try adjusting your filters or check back later.</p>
        </div>
      )}
    </div>
  );
}
