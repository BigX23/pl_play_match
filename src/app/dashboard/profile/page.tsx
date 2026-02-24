"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Camera, Edit2, Save, X } from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { getMatches, getPlayers, updateUser } from "@/lib/firestore";
import { storage, isFirebaseConfigured } from "@/lib/firebase";
import { type Match, type Player, currentUser, getPlayerById } from "@/lib/mock-data";
import type { GameType, SportType, MatchFormat, AgeRange, DayAvailability } from "@/lib/matching-engine";

const NTRP_OPTIONS = ["2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0", "5.5"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const EMOJI_AVATARS = ["🎾", "🏓", "💪", "🔥", "⭐", "🏆", "🎯", "🦊", "🐻", "🦁", "🐯", "🦅", "🐬", "🌟", "🎪", "🚀", "💎", "🌈", "🎭", "🎨"];
const TIME_PERIODS = [
  { label: "Morning",   emoji: "🌅", start: 8,  end: 12 },
  { label: "Afternoon", emoji: "☀️", start: 12, end: 17 },
  { label: "Evening",   emoji: "🌆", start: 17, end: 21 },
];

function toggleMulti<T extends string>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
}

function fmt(h: number) {
  if (h === 12) return "12 PM";
  if (h < 12) return `${h} AM`;
  return `${h - 12} PM`;
}

export default function ProfilePage() {
  const { user, updateUserProfile } = useAuth();
  const displayUser = user || currentUser;

  const [userMatches, setUserMatches] = useState<Match[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);

  useEffect(() => {
    async function load() {
      const [m, p] = await Promise.all([getMatches(displayUser.id), getPlayers()]);
      setUserMatches(m);
      setAllPlayers(p);
    }
    load();
  }, [displayUser.id]);

  // ── Basic Info ─────────────────────────────────────────────────────────────
  const [editingBasic, setEditingBasic] = useState(false);
  const [firstName, setFirstName] = useState(displayUser.firstName || "");
  const [lastName, setLastName]   = useState(displayUser.lastName || "");
  const [age, setAge]             = useState(displayUser.age?.toString() || "");
  const [gender, setGender]       = useState(displayUser.gender || "");
  const [avatar, setAvatar]       = useState(displayUser.avatar || "");
  const [aboutMe, setAboutMe]     = useState(displayUser.aboutMe || displayUser.bio || "");
  const [photoURL, setPhotoURL]   = useState(displayUser.photoURL || "");
  const [photoPreview, setPhotoPreview] = useState(displayUser.photoURL || "");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Show local preview immediately
    const objectURL = URL.createObjectURL(file);
    setPhotoPreview(objectURL);
    if (!isFirebaseConfigured || !storage) return;
    setUploading(true);
    try {
      const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
      const storageRef = ref(storage, `profile-photos/${displayUser.id}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setPhotoURL(url);
      setPhotoPreview(url);
    } finally {
      setUploading(false);
    }
  };

  const saveBasic = async () => {
    const data = { firstName, lastName, name: `${firstName} ${lastName}`, age: parseInt(age), gender, avatar, aboutMe, bio: aboutMe, ...(photoURL ? { photoURL } : {}) };
    await updateUser(displayUser.id, data);
    updateUserProfile(data);
    setEditingBasic(false);
  };

  // ── Play Preferences ───────────────────────────────────────────────────────
  const [editingPlay, setEditingPlay] = useState(false);
  const [ntrp, setNtrp]               = useState(displayUser.ntrpRating?.toString() || "3.5");
  const [sports, setSports]           = useState<SportType[]>(displayUser.sports || []);
  const [matchFormats, setMatchFormats] = useState<MatchFormat[]>(displayUser.matchFormats || []);
  const [gameType, setGameType]       = useState<GameType>(displayUser.gameType || "slightly-competitive");

  const savePlay = async () => {
    const data = { ntrpRating: parseFloat(ntrp), sports, matchFormats, gameType };
    await updateUser(displayUser.id, data);
    updateUserProfile(data);
    setEditingPlay(false);
  };

  // ── Availability ───────────────────────────────────────────────────────────
  const [editingAvail, setEditingAvail] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(() => {
    const set = new Set<string>();
    (displayUser.weeklyAvailability || []).forEach((day: DayAvailability) => {
      if (day.enabled) {
        day.slots.forEach((slot) => {
          TIME_PERIODS.forEach((period, i) => {
            if (slot.start <= period.start && slot.end >= period.end) set.add(`${day.day}-${i}`);
          });
        });
      }
    });
    return set;
  });

  const toggleSlot = (day: string, periodIdx: number) => {
    const key = `${day}-${periodIdx}`;
    setSelectedSlots((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  };

  const saveAvail = async () => {
    const weeklyAvailability: DayAvailability[] = DAYS.map((day) => {
      const enabledPeriods = TIME_PERIODS.filter((_, i) => selectedSlots.has(`${day}-${i}`));
      return { day, enabled: enabledPeriods.length > 0, slots: enabledPeriods.map((p) => ({ start: p.start, end: p.end })) };
    });
    await updateUser(displayUser.id, { weeklyAvailability });
    updateUserProfile({ weeklyAvailability });
    setEditingAvail(false);
  };

  // ── Partner Preferences ────────────────────────────────────────────────────
  const [editingPartner, setEditingPartner] = useState(false);
  const [ageRange, setAgeRange]             = useState<AgeRange>(displayUser.partnerPreferences?.ageRange || "10");
  const [partnerNtrpMin, setPartnerNtrpMin] = useState(displayUser.partnerPreferences?.ntrpMin?.toString() || "2.0");
  const [partnerNtrpMax, setPartnerNtrpMax] = useState(displayUser.partnerPreferences?.ntrpMax?.toString() || "5.5");
  const [partnerGameTypes, setPartnerGameTypes] = useState<GameType[]>(displayUser.partnerPreferences?.gameTypes || []);
  const [partnerSports, setPartnerSports]   = useState<SportType[]>(displayUser.partnerPreferences?.sports || []);
  const [partnerFormats, setPartnerFormats] = useState<MatchFormat[]>(displayUser.partnerPreferences?.matchFormats || []);
  const [partnerGender, setPartnerGender] = useState<"Male" | "Female" | "No Preference">(displayUser.partnerPreferences?.genderPreference || "No Preference");

  const savePartner = async () => {
    const partnerPreferences = { ageRange, ntrpMin: parseFloat(partnerNtrpMin), ntrpMax: parseFloat(partnerNtrpMax), gameTypes: partnerGameTypes, sports: partnerSports, matchFormats: partnerFormats, genderPreference: partnerGender };
    await updateUser(displayUser.id, { partnerPreferences });
    updateUserProfile({ partnerPreferences });
    setEditingPartner(false);
  };

  // ── Stats helpers ──────────────────────────────────────────────────────────
  const completed = userMatches.filter((m) => m.status === "completed");
  const winRate = (displayUser.matchesPlayed ?? 0) > 0 ? Math.round(((displayUser.wins ?? 0) / displayUser.matchesPlayed) * 100) : 0;
  const getOpponent = (match: Match) => {
    const id = match.player1Id === displayUser.id ? match.player2Id : match.player1Id;
    return allPlayers.find((p) => p.id === id) || getPlayerById(id);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">

      {/* Header card */}
      <Card>
        <CardContent className="p-6 flex items-center gap-4">
          <div className="relative h-16 w-16 shrink-0">
            {photoPreview || displayUser.photoURL ? (
              <Image src={(photoPreview || displayUser.photoURL)!} alt="Profile photo" fill className="rounded-full object-cover" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl">
                {displayUser.avatar || displayUser.name?.split(" ").map((n: string) => n[0]).join("")}
              </div>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{displayUser.name || `${displayUser.firstName} ${displayUser.lastName}`}</h1>
            <p className="text-sm text-muted-foreground">{displayUser.email}</p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="profile">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="partner">Partner Prefs</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
        </TabsList>

        {/* ── PROFILE TAB ── */}
        <TabsContent value="profile" className="space-y-4 mt-4">

          {/* Basic Info */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Basic Info</CardTitle>
              {editingBasic
                ? <div className="flex gap-2">
                    <Button size="sm" onClick={saveBasic}><Save className="h-4 w-4 mr-1" />Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingBasic(false)}><X className="h-4 w-4" /></Button>
                  </div>
                : <Button size="sm" variant="outline" onClick={() => setEditingBasic(true)}><Edit2 className="h-4 w-4 mr-1" />Edit</Button>
              }
            </CardHeader>
            <CardContent className="space-y-3">
              {editingBasic ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>First Name</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
                    <div><Label>Last Name</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Age</Label><Input type="number" value={age} onChange={(e) => setAge(e.target.value)} min={13} max={99} /></div>
                    <div>
                      <Label>Gender</Label>
                      <Select value={gender} onValueChange={setGender}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Non-binary">Non-binary</SelectItem>
                          <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Profile Photo (optional)</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="relative h-16 w-16 shrink-0">
                        {photoPreview ? (
                          <Image src={photoPreview} alt="Preview" fill className="rounded-full object-cover" />
                        ) : (
                          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-2xl">
                            {avatar || "👤"}
                          </div>
                        )}
                        {uploading && (
                          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                            <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                          <Camera className="h-4 w-4 mr-1" />{uploading ? "Uploading…" : "Upload Photo"}
                        </Button>
                        {photoPreview && (
                          <Button type="button" size="sm" variant="ghost" className="text-destructive text-xs h-7"
                            onClick={() => { setPhotoURL(""); setPhotoPreview(""); }}>
                            Remove photo
                          </Button>
                        )}
                        <p className="text-xs text-muted-foreground">JPG, PNG or GIF · max 5 MB</p>
                      </div>
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                    </div>
                  </div>
                  <div>
                    <Label>Avatar Emoji (used when no photo)</Label>
                    <div className="grid grid-cols-10 gap-1 mt-1">
                      {EMOJI_AVATARS.map((emoji) => (
                        <button key={emoji} type="button" onClick={() => setAvatar(emoji)}
                          className={`text-2xl p-1 rounded-lg border-2 transition-all hover:scale-110 ${avatar === emoji ? "border-primary bg-primary/10 scale-110" : "border-transparent"}`}>
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>About Me</Label>
                    <Textarea value={aboutMe} onChange={(e) => setAboutMe(e.target.value.slice(0, 300))} maxLength={300} />
                    <p className="text-xs text-muted-foreground text-right">{aboutMe.length}/300</p>
                  </div>
                </>
              ) : (
                <div className="space-y-1 text-sm">
                  <div className="flex gap-6">
                    <span><span className="text-muted-foreground">Age: </span>{displayUser.age}</span>
                    <span><span className="text-muted-foreground">Gender: </span>{displayUser.gender}</span>
                  </div>
                  <p className="text-muted-foreground mt-2">{displayUser.aboutMe || displayUser.bio || <em>No bio yet</em>}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Play Preferences */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Play Preferences</CardTitle>
              {editingPlay
                ? <div className="flex gap-2">
                    <Button size="sm" onClick={savePlay}><Save className="h-4 w-4 mr-1" />Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingPlay(false)}><X className="h-4 w-4" /></Button>
                  </div>
                : <Button size="sm" variant="outline" onClick={() => setEditingPlay(true)}><Edit2 className="h-4 w-4 mr-1" />Edit</Button>
              }
            </CardHeader>
            <CardContent className="space-y-3">
              {editingPlay ? (
                <>
                  <div>
                    <Label>NTRP Rating</Label>
                    <Select value={ntrp} onValueChange={setNtrp}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{NTRP_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Sport</Label>
                    <div className="flex gap-2 mt-1">
                      {(["tennis", "pickleball", "both"] as SportType[]).map((s) => (
                        <Badge key={s} variant={sports.includes(s) ? "default" : "outline"}
                          className="cursor-pointer capitalize text-sm px-3 py-1"
                          onClick={() => setSports(toggleMulti(sports, s))}>
                          {s === "tennis" ? "🎾 Tennis" : s === "pickleball" ? "🏓 Pickleball" : "Both"}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Match Format</Label>
                    <div className="flex gap-2 mt-1">
                      {(["singles", "doubles", "both"] as MatchFormat[]).map((f) => (
                        <Badge key={f} variant={matchFormats.includes(f) ? "default" : "outline"}
                          className="cursor-pointer capitalize text-sm px-3 py-1"
                          onClick={() => setMatchFormats(toggleMulti(matchFormats, f))}>
                          {f}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Game Type</Label>
                    <div className="flex flex-col gap-2 mt-1">
                      {(["recreational", "slightly-competitive", "hardcore-competitive"] as GameType[]).map((g) => (
                        <Badge key={g} variant={gameType === g ? "default" : "outline"}
                          className="cursor-pointer text-sm px-3 py-2 justify-start"
                          onClick={() => setGameType(g)}>
                          {g === "recreational" ? "🎉 Recreational" : g === "slightly-competitive" ? "💪 Slightly Competitive" : "🔥 Hardcore Competitive"}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Badge>NTRP {displayUser.ntrpRating}</Badge>
                  {(displayUser.sports || []).map((s: string) => <Badge key={s} variant="secondary" className="capitalize">{s}</Badge>)}
                  {(displayUser.matchFormats || []).map((f: string) => <Badge key={f} variant="outline" className="capitalize">{f}</Badge>)}
                  {displayUser.gameType && <Badge variant="outline" className="capitalize">{displayUser.gameType.replace(/-/g, " ")}</Badge>}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── AVAILABILITY TAB ── */}
        <TabsContent value="availability" className="mt-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Weekly Availability</CardTitle>
              {editingAvail
                ? <div className="flex gap-2">
                    <Button size="sm" onClick={saveAvail} disabled={selectedSlots.size < 3}><Save className="h-4 w-4 mr-1" />Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingAvail(false)}><X className="h-4 w-4" /></Button>
                  </div>
                : <Button size="sm" variant="outline" onClick={() => setEditingAvail(true)}><Edit2 className="h-4 w-4 mr-1" />Edit</Button>
              }
            </CardHeader>
            <CardContent>
              {editingAvail ? (
                <>
                  <p className="text-sm mb-3">
                    <span className={selectedSlots.size >= 3 ? "text-primary font-semibold" : "text-amber-600 font-semibold"}>{selectedSlots.size} selected</span>
                    <span className="text-muted-foreground"> — select at least 3</span>
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full border-separate border-spacing-1">
                      <thead>
                        <tr>
                          <th className="w-24" />
                          {DAYS.map((day) => <th key={day} className="text-center text-xs font-semibold text-muted-foreground pb-1">{day}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {TIME_PERIODS.map((period, periodIdx) => (
                          <tr key={period.label}>
                            <td className="pr-2 py-0.5"><span className="text-xs text-muted-foreground whitespace-nowrap">{period.emoji} {period.label}</span></td>
                            {DAYS.map((day) => {
                              const key = `${day}-${periodIdx}`;
                              const selected = selectedSlots.has(key);
                              return (
                                <td key={day} className="py-0.5">
                                  <button type="button" onClick={() => toggleSlot(day, periodIdx)}
                                    className={`w-full h-11 rounded-lg border-2 transition-all text-sm ${selected ? "border-primary bg-primary text-primary-foreground font-bold" : "border-muted hover:border-primary/50 hover:bg-primary/5 text-transparent"}`}>✓</button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  {(!displayUser.weeklyAvailability || displayUser.weeklyAvailability.filter((d: DayAvailability) => d.enabled).length === 0) ? (
                    <p className="text-sm text-muted-foreground">No availability set yet.</p>
                  ) : (
                    displayUser.weeklyAvailability.filter((d: DayAvailability) => d.enabled).map((d: DayAvailability) => (
                      <div key={d.day} className="flex items-center gap-3 py-1">
                        <Badge variant="secondary" className="w-12 justify-center">{d.day}</Badge>
                        <div className="flex flex-wrap gap-1">
                          {d.slots.map((slot, i) => <Badge key={i} variant="outline" className="text-xs">{fmt(slot.start)} – {fmt(slot.end)}</Badge>)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PARTNER PREFS TAB ── */}
        <TabsContent value="partner" className="mt-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Partner Preferences</CardTitle>
              {editingPartner
                ? <div className="flex gap-2">
                    <Button size="sm" onClick={savePartner}><Save className="h-4 w-4 mr-1" />Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingPartner(false)}><X className="h-4 w-4" /></Button>
                  </div>
                : <Button size="sm" variant="outline" onClick={() => setEditingPartner(true)}><Edit2 className="h-4 w-4 mr-1" />Edit</Button>
              }
            </CardHeader>
            <CardContent className="space-y-4">
              {editingPartner ? (
                <>
                  <div>
                    <Label>Partner Gender</Label>
                    <div className="flex gap-2 mt-1">
                      {(["Male", "Female", "No Preference"] as const).map((g) => (
                        <Badge
                          key={g}
                          variant={partnerGender === g ? "default" : "outline"}
                          className="cursor-pointer text-sm px-3 py-1"
                          onClick={() => setPartnerGender(g)}
                        >
                          {g === "Male" ? "👨 Male" : g === "Female" ? "👩 Female" : "🤝 No Preference"}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Preferred Age Range</Label>
                    <Select value={ageRange} onValueChange={(v) => setAgeRange(v as AgeRange)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">±2 years</SelectItem>
                        <SelectItem value="5">±5 years</SelectItem>
                        <SelectItem value="10">±10 years</SelectItem>
                        <SelectItem value="any">Any age</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Partner NTRP Range</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Select value={partnerNtrpMin} onValueChange={setPartnerNtrpMin}>
                        <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>{NTRP_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                      <span className="text-sm">to</span>
                      <Select value={partnerNtrpMax} onValueChange={setPartnerNtrpMax}>
                        <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>{NTRP_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Partner Game Type</Label>
                    <div className="flex flex-col gap-2 mt-1">
                      {(["recreational", "slightly-competitive", "hardcore-competitive"] as GameType[]).map((g) => (
                        <Badge key={g} variant={partnerGameTypes.includes(g) ? "default" : "outline"}
                          className="cursor-pointer text-sm px-3 py-2 justify-start"
                          onClick={() => setPartnerGameTypes(toggleMulti(partnerGameTypes, g))}>
                          {g === "recreational" ? "🎉 Recreational" : g === "slightly-competitive" ? "💪 Slightly Competitive" : "🔥 Hardcore Competitive"}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Partner Sport</Label>
                    <div className="flex gap-2 mt-1">
                      {(["tennis", "pickleball", "both"] as SportType[]).map((s) => (
                        <Badge key={s} variant={partnerSports.includes(s) ? "default" : "outline"}
                          className="cursor-pointer capitalize text-sm px-3 py-1"
                          onClick={() => setPartnerSports(toggleMulti(partnerSports, s))}>
                          {s === "tennis" ? "🎾 Tennis" : s === "pickleball" ? "🏓 Pickleball" : "Both"}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Partner Match Format</Label>
                    <div className="flex gap-2 mt-1">
                      {(["singles", "doubles", "both"] as MatchFormat[]).map((f) => (
                        <Badge key={f} variant={partnerFormats.includes(f) ? "default" : "outline"}
                          className="cursor-pointer capitalize text-sm px-3 py-1"
                          onClick={() => setPartnerFormats(toggleMulti(partnerFormats, f))}>
                          {f}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-3 text-sm">
                  {!displayUser.partnerPreferences ? (
                    <p className="text-muted-foreground">No partner preferences set yet.</p>
                  ) : (
                    <>
                      <div className="flex justify-between"><span className="text-muted-foreground">Gender preference</span><span>{displayUser.partnerPreferences.genderPreference || "No Preference"}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Age range</span><span>{displayUser.partnerPreferences.ageRange === "any" ? "Any age" : `±${displayUser.partnerPreferences.ageRange} years`}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">NTRP range</span><span>{displayUser.partnerPreferences.ntrpMin} – {displayUser.partnerPreferences.ntrpMax}</span></div>
                      <div><p className="text-muted-foreground mb-1">Game types</p><div className="flex flex-wrap gap-1">{(displayUser.partnerPreferences.gameTypes || []).map((g: string) => <Badge key={g} variant="secondary" className="capitalize">{g.replace(/-/g, " ")}</Badge>)}</div></div>
                      <div><p className="text-muted-foreground mb-1">Sports</p><div className="flex flex-wrap gap-1">{(displayUser.partnerPreferences.sports || []).map((s: string) => <Badge key={s} variant="secondary" className="capitalize">{s}</Badge>)}</div></div>
                      <div><p className="text-muted-foreground mb-1">Match formats</p><div className="flex flex-wrap gap-1">{(displayUser.partnerPreferences.matchFormats || []).map((f: string) => <Badge key={f} variant="outline" className="capitalize">{f}</Badge>)}</div></div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── STATS TAB ── */}
        <TabsContent value="stats" className="space-y-4 mt-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Played",   value: displayUser.matchesPlayed ?? 0 },
              { label: "Won",      value: displayUser.wins ?? 0 },
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
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Match History</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {completed.length === 0 ? (
                <p className="text-muted-foreground text-sm">No completed matches yet.</p>
              ) : completed.map((match) => {
                const opp = getOpponent(match);
                return (
                  <div key={match.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium text-sm">vs {opp?.name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{match.date} · {match.location}</p>
                    </div>
                    <Badge variant="outline">{match.score}</Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

