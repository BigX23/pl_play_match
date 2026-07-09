"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  Clock,
  Star,
  Plus,
  X,
  Check,
  Ban,
  Trash2,
  MessageCircle,
  CalendarCheck,
  Play,
  Trophy,
  MapPin,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  getMatches,
  getPlayers,
  createMatch,
  updateMatch,
  deleteMatch,
  joinOpenMatch,
  createGroupConversation,
  addContact,
  getUser,
  updateUser,
} from "@/lib/firestore";
import { type Match, type MatchStatus, type Player, type Contact, getPlayerById } from "@/lib/mock-data";
import { buildMatchIntro } from "@/lib/ai-assistant";
import { useToast } from "@/hooks/use-toast";

/* ──────────────────── status helpers ──────────────────── */
const STATUS_CONFIG: Record<
  MatchStatus,
  { label: string; color: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: string }
> = {
  open: { label: "Open", color: "bg-blue-500/10 text-blue-700 border-blue-300", variant: "default", icon: "🟢" },
  pending: { label: "Pending Approval", color: "bg-amber-500/10 text-amber-700 border-amber-300", variant: "secondary", icon: "⏳" },
  confirmed: { label: "Confirmed", color: "bg-green-500/10 text-green-700 border-green-300", variant: "default", icon: "✅" },
  scheduled: { label: "Scheduled", color: "bg-purple-500/10 text-purple-700 border-purple-300", variant: "secondary", icon: "📅" },
  in_progress: { label: "In Progress", color: "bg-orange-500/10 text-orange-700 border-orange-300", variant: "default", icon: "🏃" },
  completed: { label: "Completed", color: "bg-emerald-500/10 text-emerald-700 border-emerald-300", variant: "outline", icon: "🏆" },
  cancelled: { label: "Cancelled", color: "bg-red-500/10 text-red-700 border-red-300", variant: "destructive", icon: "❌" },
};

export default function OpenMatchesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const displayUser = user;
  const userId = displayUser?.id || "";

  const [sportFilter, setSportFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [playerCache, setPlayerCache] = useState<Record<string, Player>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Create form
  const [newSport, setNewSport] = useState<"tennis" | "pickleball">("tennis");
  const [newType, setNewType] = useState<"singles" | "doubles">("singles");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newLocation, setNewLocation] = useState("Lifetime Activities Pleasanton");
  const [newNotes, setNewNotes] = useState("");

  // Score dialog
  const [scoreDialog, setScoreDialog] = useState<Match | null>(null);
  const [scoreInput, setScoreInput] = useState("");
  const [winnerId, setWinnerId] = useState("");

  async function load() {
    try {
      const [m, p] = await Promise.all([getMatches(), getPlayers()]);
      setAllMatches(m);
      setAllPlayers(p);
      const cache: Record<string, Player> = {};
      p.forEach((pl) => { cache[pl.id] = pl; });
      setPlayerCache(cache);
    } catch (e) {
      console.error("Failed to load matches:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const findPlayer = (id: string): Player | undefined => {
    if (!id) return undefined;
    return playerCache[id] || allPlayers.find((p) => p.id === id) || getPlayerById(id);
  };

  const resolvePlayer = async (id: string): Promise<Player | undefined> => {
    if (!id) return undefined;
    if (playerCache[id]) return playerCache[id];
    const p = allPlayers.find((pl) => pl.id === id);
    if (p) return p;
    const firestoreUser = await getUser(id);
    if (firestoreUser) {
      setPlayerCache((prev) => ({ ...prev, [id]: firestoreUser }));
      return firestoreUser;
    }
    return getPlayerById(id);
  };

  useEffect(() => {
    if (allMatches.length === 0) return;
    const ids = new Set<string>();
    allMatches.forEach((m) => {
      [m.player1Id, m.player2Id, m.createdBy, m.acceptedBy].forEach((id) => { if (id) ids.add(id); });
    });
    ids.forEach((id) => { if (!playerCache[id]) resolvePlayer(id); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMatches]);

  /* ──────────────────── role helpers ──────────────────── */
  const isCreator = (m: Match) => (m.createdBy || m.player1Id) === userId;
  const isPartner = (m: Match) => m.player2Id === userId || m.acceptedBy === userId;
  const isInvolved = (m: Match) =>
    m.player1Id === userId || m.player2Id === userId ||
    m.createdBy === userId || m.acceptedBy === userId ||
    (m.participants && m.participants.includes(userId));

  /* ──────────────────── filter helpers ──────────────────── */
  const applyFilters = (m: Match) => {
    if (sportFilter !== "all" && m.sport !== sportFilter) return false;
    if (search) {
      const p1 = findPlayer(m.player1Id);
      const p2 = findPlayer(m.player2Id);
      const text = `${p1?.name} ${p2?.name} ${m.location} ${m.notes || ""} ${m.matchExplanation || ""}`.toLowerCase();
      if (!text.includes(search.toLowerCase())) return false;
    }
    return true;
  };

  const browseMatches = allMatches.filter((m) => m.status === "open" && !isCreator(m) && applyFilters(m));

  const myActiveMatches = allMatches
    .filter((m) => isInvolved(m) && !["completed", "cancelled"].includes(m.status) && applyFilters(m))
    .sort((a, b) => {
      const order: Record<string, number> = { pending: 0, confirmed: 1, open: 2, scheduled: 3, in_progress: 4 };
      return (order[a.status] ?? 5) - (order[b.status] ?? 5);
    });

  const myPastMatches = allMatches
    .filter((m) => isInvolved(m) && ["completed", "cancelled"].includes(m.status) && applyFilters(m));

  /* ──────────────────── actions ──────────────────── */
  const withLoading = async (matchId: string, fn: () => Promise<void>) => {
    setActionLoading(matchId);
    try { await fn(); await load(); } finally { setActionLoading(null); }
  };

  const handleCreateMatch = async () => {
    if (!newDate || !newTime) return;
    await createMatch({
      player1Id: userId,
      player2Id: "",
      date: newDate,
      time: newTime,
      location: newLocation,
      sport: newSport,
      status: "open",
      compatibilityScore: 0,
      matchExplanation: newNotes || `Open ${newSport} ${newType} match`,
      matchType: newType,
      notes: newNotes,
      createdBy: userId,
    } as Omit<Match, "id">);
    setShowCreate(false);
    setNewDate("");
    setNewTime("");
    setNewNotes("");
    await load();
  };

  const handleRequestJoin = (match: Match) =>
    withLoading(match.id, async () => {
      const joined = await joinOpenMatch(match.id, userId);
      if (!joined) {
        toast({
          title: "Match no longer available",
          description: "Someone else just joined this match. Try another one.",
          variant: "destructive",
        });
      }
    });

  const handleAcceptPartner = (match: Match) =>
    withLoading(match.id, async () => {
      const creatorId = match.createdBy || match.player1Id;
      const partnerId = match.acceptedBy || match.player2Id;
      const creator = findPlayer(creatorId);
      const partner = findPlayer(partnerId);
      const cName = creator?.firstName || creator?.name || "there";
      const pName = partner?.firstName || partner?.name || "there";
      const intro = buildMatchIntro(cName, pName, {
        sport: match.sport,
        matchType: match.matchType,
        date: match.date,
        time: match.time,
        location: match.location,
      });
      const participantIds = [creatorId, partnerId].filter(Boolean);
      const groupName = `Match: ${cName} vs ${pName}`;
      const convId = await createGroupConversation(participantIds, match.id, groupName, intro, userId);

      // Auto-add each other as contacts
      if (creator) {
        const creatorContact: Contact = { id: creatorId, name: cName, email: creator.email, avatar: creator.avatar, addedAt: new Date().toISOString() };
        await addContact(partnerId, creatorContact).catch(() => {});
      }
      if (partner) {
        const partnerContact: Contact = { id: partnerId, name: pName, email: partner.email, avatar: partner.avatar, addedAt: new Date().toISOString() };
        await addContact(creatorId, partnerContact).catch(() => {});
      }

      await updateMatch(match.id, {
        status: "confirmed" as MatchStatus,
        conversationId: convId,
      });
    });

  const handleDeclinePartner = (match: Match) =>
    withLoading(match.id, async () => {
      await updateMatch(match.id, {
        player2Id: "",
        acceptedBy: "",
        status: "open" as MatchStatus,
        participants: [match.createdBy || match.player1Id],
        conversationId: "",
      });
    });

  const handleWithdraw = (match: Match) =>
    withLoading(match.id, async () => {
      await updateMatch(match.id, {
        player2Id: "",
        acceptedBy: "",
        status: "open" as MatchStatus,
        participants: [match.createdBy || match.player1Id],
        conversationId: "",
      });
    });

  const handleDeleteMatch = (match: Match) =>
    withLoading(match.id, async () => { await deleteMatch(match.id); });

  const handleCancelMatch = (match: Match) =>
    withLoading(match.id, async () => {
      await updateMatch(match.id, { status: "cancelled" as MatchStatus, cancelledBy: userId });
    });

  const handleMarkScheduled = (match: Match) =>
    withLoading(match.id, async () => {
      await updateMatch(match.id, { status: "scheduled" as MatchStatus });
    });

  const handleStartMatch = (match: Match) =>
    withLoading(match.id, async () => {
      await updateMatch(match.id, { status: "in_progress" as MatchStatus });
    });

  /** Increment matchesPlayed for both players, and wins/losses per the winner. */
  const recordStats = async (match: Match, winner: string) => {
    const ids = [match.player1Id, match.player2Id].filter(Boolean);
    for (const id of ids) {
      const p = await getUser(id);
      if (!p) continue;
      const played = (p.matchesPlayed ?? 0) + 1;
      const wins = (p.wins ?? 0) + (winner === id ? 1 : 0);
      const losses = (p.losses ?? 0) + (winner && winner !== "tie" && winner !== id ? 1 : 0);
      await updateUser(id, { matchesPlayed: played, wins, losses });
    }
  };

  const handleReportScore = () => {
    if (!scoreDialog || !scoreInput.trim()) return;
    const match = scoreDialog;
    withLoading(match.id, async () => {
      await updateMatch(match.id, { status: "completed" as MatchStatus, score: scoreInput.trim() });
      await recordStats(match, winnerId);
      setScoreDialog(null);
      setScoreInput("");
      setWinnerId("");
    });
  };

  /* ──────────────────── action buttons component ──────────────────── */
  function MatchActions({ match, iAmCreator: cr, iAmPartner: pt, busy }: {
    match: Match; iAmCreator: boolean; iAmPartner: boolean; busy: boolean;
  }) {
    const s = match.status;

    if (s === "open" && !cr && !pt) {
      return <Button className="w-full" size="sm" disabled={busy} onClick={() => handleRequestJoin(match)}>{busy ? "Joining..." : "Request to Join"}</Button>;
    }

    if (s === "open" && cr) {
      return (
        <div className="space-y-2">
          <p className="text-xs text-center text-muted-foreground">Your open match — waiting for a partner</p>
          <Button variant="destructive" size="sm" className="w-full" disabled={busy} onClick={() => handleDeleteMatch(match)}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete Match
          </Button>
        </div>
      );
    }

    if (s === "pending" && cr) {
      const pn = findPlayer(match.acceptedBy || match.player2Id)?.name || "Someone";
      return (
        <div className="space-y-2">
          <p className="text-xs text-center font-medium text-amber-700 dark:text-amber-400">{pn} wants to join this match!</p>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" disabled={busy} onClick={() => handleAcceptPartner(match)}><Check className="h-3.5 w-3.5 mr-1" /> Accept</Button>
            <Button size="sm" variant="outline" className="flex-1" disabled={busy} onClick={() => handleDeclinePartner(match)}><X className="h-3.5 w-3.5 mr-1" /> Decline</Button>
          </div>
          <Button variant="ghost" size="sm" className="w-full text-destructive" disabled={busy} onClick={() => handleDeleteMatch(match)}><Trash2 className="h-3 w-3 mr-1" /> Delete Match</Button>
        </div>
      );
    }

    if (s === "pending" && pt) {
      const cn = findPlayer(match.createdBy || match.player1Id)?.name || "the creator";
      return (
        <div className="space-y-2">
          <p className="text-xs text-center text-muted-foreground">Waiting for {cn} to approve...</p>
          <Button variant="outline" size="sm" className="w-full" disabled={busy} onClick={() => handleWithdraw(match)}><Ban className="h-3.5 w-3.5 mr-1" /> Withdraw Request</Button>
        </div>
      );
    }

    if (s === "confirmed" && cr) {
      return (
        <div className="space-y-2">
          <p className="text-xs text-center text-green-700 dark:text-green-400 font-medium">Partner confirmed! Reserve a court, then mark scheduled.</p>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" disabled={busy} onClick={() => handleMarkScheduled(match)}><CalendarCheck className="h-3.5 w-3.5 mr-1" /> Mark Scheduled</Button>
            {match.conversationId && <Link href={`/dashboard/messages/`}><Button size="sm" variant="outline"><MessageCircle className="h-3.5 w-3.5 mr-1" /> Chat</Button></Link>}
          </div>
          <Button variant="ghost" size="sm" className="w-full text-destructive" disabled={busy} onClick={() => handleCancelMatch(match)}>Cancel Match</Button>
        </div>
      );
    }

    if (s === "confirmed" && pt) {
      return (
        <div className="space-y-2">
          <p className="text-xs text-center text-green-700 dark:text-green-400 font-medium">You&apos;re confirmed! Waiting for court reservation.</p>
          <div className="flex gap-2">
            {match.conversationId && <Link href={`/dashboard/messages/`} className="flex-1"><Button size="sm" variant="outline" className="w-full"><MessageCircle className="h-3.5 w-3.5 mr-1" /> Chat</Button></Link>}
            <Button variant="outline" size="sm" className="flex-1 text-destructive border-destructive/30" disabled={busy} onClick={() => handleWithdraw(match)}><Ban className="h-3.5 w-3.5 mr-1" /> Withdraw</Button>
          </div>
        </div>
      );
    }

    if (s === "scheduled" && cr) {
      return (
        <div className="space-y-2">
          <p className="text-xs text-center text-purple-700 dark:text-purple-400 font-medium">Court reserved — ready to play!</p>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" disabled={busy} onClick={() => handleStartMatch(match)}><Play className="h-3.5 w-3.5 mr-1" /> Start Match</Button>
            {match.conversationId && <Link href={`/dashboard/messages/`}><Button size="sm" variant="outline"><MessageCircle className="h-3.5 w-3.5 mr-1" /> Chat</Button></Link>}
          </div>
          <Button variant="ghost" size="sm" className="w-full text-destructive" disabled={busy} onClick={() => handleCancelMatch(match)}>Cancel Match</Button>
        </div>
      );
    }

    if (s === "scheduled" && pt) {
      return (
        <div className="space-y-2">
          <p className="text-xs text-center text-purple-700 dark:text-purple-400 font-medium">Scheduled — see you on the court!</p>
          <div className="flex gap-2">
            {match.conversationId && <Link href={`/dashboard/messages/`} className="flex-1"><Button size="sm" variant="outline" className="w-full"><MessageCircle className="h-3.5 w-3.5 mr-1" /> Chat</Button></Link>}
            <Button variant="outline" size="sm" className="flex-1 text-destructive border-destructive/30" disabled={busy} onClick={() => handleWithdraw(match)}><Ban className="h-3.5 w-3.5 mr-1" /> Withdraw</Button>
          </div>
        </div>
      );
    }

    if (s === "in_progress" && (cr || pt)) {
      return (
        <div className="space-y-2">
          <p className="text-xs text-center text-orange-700 dark:text-orange-400 font-medium">Match in progress — good luck!</p>
          <Button size="sm" className="w-full" disabled={busy} onClick={() => { setScoreDialog(match); setScoreInput(""); }}><Trophy className="h-3.5 w-3.5 mr-1" /> Report Score</Button>
        </div>
      );
    }

    return null;
  }

  /* ──────────────────── match card ──────────────────── */
  function MatchCard({ match }: { match: Match }) {
    const sc = STATUS_CONFIG[match.status] || STATUS_CONFIG.open;
    const creator = findPlayer(match.createdBy || match.player1Id);
    const partner = findPlayer(match.player2Id || match.acceptedBy || "");
    const cr = isCreator(match);
    const pt = isPartner(match);
    const busy = actionLoading === match.id;

    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="capitalize">{match.sport}</Badge>
              {match.matchType && <Badge variant="outline" className="capitalize">{match.matchType}</Badge>}
            </div>
            <Badge variant={sc.variant} className={`${sc.color} border`}>{sc.icon} {sc.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="text-2xl">{creator?.avatar || "👤"}</div>
              <div>
                <p className="font-medium text-sm">{creator?.name || "Unknown"}{cr && " (You)"}</p>
                <p className="text-xs text-muted-foreground">NTRP {creator?.ntrpRating || "?"}</p>
              </div>
            </div>
            {partner && partner.id ? (
              <>
                <span className="text-lg font-bold text-muted-foreground">vs</span>
                <div className="flex items-center gap-2">
                  <div className="text-2xl">{partner.avatar || "👤"}</div>
                  <div>
                    <p className="font-medium text-sm">{partner.name || "Unknown"}{pt && " (You)"}</p>
                    <p className="text-xs text-muted-foreground">NTRP {partner.ntrpRating || "?"}</p>
                  </div>
                </div>
              </>
            ) : match.status === "open" ? (
              <>
                <span className="text-lg font-bold text-muted-foreground">vs</span>
                <div className="flex items-center gap-2">
                  <div className="text-2xl">❓</div>
                  <p className="text-sm text-muted-foreground italic">Waiting for opponent</p>
                </div>
              </>
            ) : null}
          </div>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" />{match.date} · {match.time}</div>
            <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {match.location}</div>
          </div>
          {match.notes && <p className="text-xs text-muted-foreground italic">&ldquo;{match.notes}&rdquo;</p>}
          {match.status === "completed" && match.score && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10">
              <Trophy className="h-4 w-4 text-emerald-600" />
              <span className="font-bold text-sm">Final Score: {match.score}</span>
            </div>
          )}
          {match.status === "cancelled" && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10">
              <Ban className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-700 dark:text-red-400">Cancelled{match.cancelledBy ? ` by ${findPlayer(match.cancelledBy)?.name || "a player"}` : ""}</span>
            </div>
          )}
          {match.compatibilityScore > 0 && (
            <div className="flex items-center gap-2">
              <Star className="h-3.5 w-3.5 text-accent fill-accent" />
              <span className="text-xs font-semibold text-primary">{match.compatibilityScore}% match</span>
              <Progress value={match.compatibilityScore} className="h-1 flex-1" />
            </div>
          )}
          <MatchActions match={match} iAmCreator={cr} iAmPartner={pt} busy={busy} />
        </CardContent>
      </Card>
    );
  }

  /* ──────────────────── render ──────────────────── */
  if (loading) {
    return <div className="p-4 md:p-6 flex items-center justify-center min-h-[50vh]"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Matches</h1>
          <p className="text-muted-foreground">Browse, create & manage your matches</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)} size="sm">
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
                    <SelectItem value="tennis">Tennis</SelectItem>
                    <SelectItem value="pickleball">Pickleball</SelectItem>
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
              <div><Label>Date</Label><Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} /></div>
              <div><Label>Time</Label><Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} /></div>
            </div>
            <div><Label>Location</Label><Input value={newLocation} onChange={(e) => setNewLocation(e.target.value)} placeholder="e.g. Lifetime Activities Pleasanton" /></div>
            <div><Label>Notes (optional)</Label><Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Any details about the match..." /></div>
            <Button onClick={handleCreateMatch} disabled={!newDate || !newTime} className="w-full">Post Open Match</Button>
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

      <Tabs defaultValue="my-matches">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="my-matches">My Matches{myActiveMatches.length > 0 && <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">{myActiveMatches.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="browse">Browse Open{browseMatches.length > 0 && <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">{browseMatches.length}</Badge>}</TabsTrigger>
        </TabsList>

        <TabsContent value="my-matches" className="space-y-6 mt-4">
          {myActiveMatches.length === 0 && myPastMatches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">No matches yet.</p>
              <p className="text-sm">Create one or browse open matches to get started!</p>
            </div>
          ) : (
            <>
              {myActiveMatches.length > 0 && (
                <div className="space-y-4">
                  <h2 className="font-semibold text-lg">Active</h2>
                  <div className="grid gap-4 md:grid-cols-2">{myActiveMatches.map((m) => <MatchCard key={m.id} match={m} />)}</div>
                </div>
              )}
              {myPastMatches.length > 0 && (
                <div className="space-y-4">
                  <h2 className="font-semibold text-lg">Past</h2>
                  <div className="grid gap-4 md:grid-cols-2">{myPastMatches.map((m) => <MatchCard key={m.id} match={m} />)}</div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="browse" className="space-y-4 mt-4">
          {browseMatches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">No open matches to join right now.</p>
              <p className="text-sm">Create your own or check back later!</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">{browseMatches.map((m) => <MatchCard key={m.id} match={m} />)}</div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!scoreDialog} onOpenChange={(open) => { if (!open) setScoreDialog(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Report Final Score</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Enter the final score (e.g. &ldquo;6-4, 3-6, 7-5&rdquo;)</p>
            <Input placeholder="6-4, 6-3" value={scoreInput} onChange={(e) => setScoreInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleReportScore(); }} />
            {scoreDialog && (
              <div>
                <Label>Winner</Label>
                <Select value={winnerId} onValueChange={setWinnerId}>
                  <SelectTrigger><SelectValue placeholder="Who won?" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={scoreDialog.player1Id}>{findPlayer(scoreDialog.player1Id)?.name || "Player 1"}</SelectItem>
                    {scoreDialog.player2Id && <SelectItem value={scoreDialog.player2Id}>{findPlayer(scoreDialog.player2Id)?.name || "Player 2"}</SelectItem>}
                    <SelectItem value="tie">Tie / no result</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScoreDialog(null)}>Cancel</Button>
            <Button onClick={handleReportScore} disabled={!scoreInput.trim() || actionLoading !== null}><Trophy className="h-4 w-4 mr-1" /> Submit Score</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
