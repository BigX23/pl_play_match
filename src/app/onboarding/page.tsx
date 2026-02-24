"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { updateUser } from "@/lib/firestore";
import type { GameType, SportType, MatchFormat, AgeRange, DayAvailability, PartnerPreferences } from "@/lib/matching-engine";

const EMOJI_AVATARS = ["🎾", "🏓", "💪", "🔥", "⭐", "🏆", "🎯", "🦊", "🐻", "🦁", "🐯", "🦅", "🐬", "🌟", "🎪", "🚀", "💎", "🌈", "🎭", "🎨"];
const NTRP_OPTIONS = ["2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0", "5.5"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6am to 10pm

function formatHour(h: number) {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

export default function OnboardingPage() {
  const { user, updateUserProfile, setProfileComplete } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [age, setAge] = useState(user?.age?.toString() || "");
  const [gender, setGender] = useState(user?.gender || "");
  const [avatar, setAvatar] = useState(user?.avatar || "");
  const [aboutMe, setAboutMe] = useState(user?.aboutMe || user?.bio || "");

  // Step 2
  const [ntrp, setNtrp] = useState(user?.ntrpRating?.toString() || "3.5");
  const [sports, setSports] = useState<SportType[]>(user?.sports || []);
  const [matchFormats, setMatchFormats] = useState<MatchFormat[]>(user?.matchFormats || []);
  const [gameType, setGameType] = useState<GameType>(user?.gameType || "slightly-competitive");

  // Step 3
  const [availability, setAvailability] = useState<DayAvailability[]>(
    user?.weeklyAvailability || DAYS.map((d) => ({ day: d, enabled: false, slots: [] }))
  );

  // Step 4
  const [ageRange, setAgeRange] = useState<AgeRange>(user?.partnerPreferences?.ageRange || "10");
  const [partnerNtrpMin, setPartnerNtrpMin] = useState(user?.partnerPreferences?.ntrpMin?.toString() || "2.0");
  const [partnerNtrpMax, setPartnerNtrpMax] = useState(user?.partnerPreferences?.ntrpMax?.toString() || "5.5");
  const [partnerGameTypes, setPartnerGameTypes] = useState<GameType[]>(user?.partnerPreferences?.gameTypes || []);
  const [partnerSports, setPartnerSports] = useState<SportType[]>(user?.partnerPreferences?.sports || []);
  const [partnerFormats, setPartnerFormats] = useState<MatchFormat[]>(user?.partnerPreferences?.matchFormats || []);

  const toggleMulti = <T extends string>(arr: T[], val: T, setter: (v: T[]) => void) => {
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const toggleDay = (day: string) => {
    setAvailability((prev) =>
      prev.map((d) =>
        d.day === day
          ? { ...d, enabled: !d.enabled, slots: !d.enabled && d.slots.length === 0 ? [{ start: 9, end: 12 }] : d.slots }
          : d
      )
    );
  };

  const updateSlot = (day: string, field: "start" | "end", value: number) => {
    setAvailability((prev) =>
      prev.map((d) =>
        d.day === day
          ? { ...d, slots: d.slots.length > 0 ? [{ ...d.slots[0], [field]: value }] : [{ start: 9, end: 12, [field]: value }] }
          : d
      )
    );
  };

  const canProceed = () => {
    if (step === 1) return firstName && lastName && age && gender && avatar;
    if (step === 2) return ntrp && sports.length > 0 && matchFormats.length > 0 && gameType;
    if (step === 3) return availability.some((d) => d.enabled);
    if (step === 4) return partnerGameTypes.length > 0 && partnerSports.length > 0 && partnerFormats.length > 0;
    return false;
  };

  const handleComplete = async () => {
    const prefs: PartnerPreferences = {
      ageRange,
      ntrpMin: parseFloat(partnerNtrpMin),
      ntrpMax: parseFloat(partnerNtrpMax),
      gameTypes: partnerGameTypes,
      sports: partnerSports,
      matchFormats: partnerFormats,
    };

    const profileData = {
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      age: parseInt(age),
      gender,
      avatar,
      aboutMe,
      bio: aboutMe,
      ntrpRating: parseFloat(ntrp),
      sports,
      matchFormats,
      gameType,
      weeklyAvailability: availability,
      partnerPreferences: prefs,
      profileComplete: true,
    };

    if (user) {
      await updateUser(user.id, profileData as Record<string, unknown>);
    }
    updateUserProfile(profileData);
    setProfileComplete(true);
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Set Up Your Profile 🎾</h1>
          <p className="text-muted-foreground text-sm mt-1">Step {step} of 4</p>
        </div>

        <Progress value={step * 25} className="h-2" />

        {step === 1 && (
          <Card>
            <CardHeader><CardTitle>Basic Info</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>First Name *</Label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
                </div>
                <div>
                  <Label>Last Name *</Label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Age *</Label>
                  <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" min={13} max={99} />
                </div>
                <div>
                  <Label>Gender *</Label>
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
                <Label>Profile Picture *</Label>
                <p className="text-xs text-muted-foreground mb-2">Pick an avatar emoji</p>
                <div className="grid grid-cols-10 gap-2">
                  {EMOJI_AVATARS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setAvatar(emoji)}
                      className={`text-2xl p-1 rounded-lg border-2 transition-all hover:scale-110 ${
                        avatar === emoji ? "border-primary bg-primary/10 scale-110" : "border-transparent"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>About Me (optional)</Label>
                <Textarea
                  value={aboutMe}
                  onChange={(e) => setAboutMe(e.target.value.slice(0, 300))}
                  placeholder="Tell others about yourself..."
                  maxLength={300}
                />
                <p className="text-xs text-muted-foreground text-right">{aboutMe.length}/300</p>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader><CardTitle>Play Preferences</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>NTRP Rating *</Label>
                <Select value={ntrp} onValueChange={setNtrp}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NTRP_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sport *</Label>
                <div className="flex gap-2 mt-1">
                  {(["tennis", "pickleball", "both"] as SportType[]).map((s) => (
                    <Badge
                      key={s}
                      variant={sports.includes(s) ? "default" : "outline"}
                      className="cursor-pointer capitalize text-sm px-3 py-1"
                      onClick={() => toggleMulti(sports, s, setSports)}
                    >
                      {s === "both" ? "Both" : s === "tennis" ? "🎾 Tennis" : "🏓 Pickleball"}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label>Match Format *</Label>
                <div className="flex gap-2 mt-1">
                  {(["singles", "doubles", "both"] as MatchFormat[]).map((f) => (
                    <Badge
                      key={f}
                      variant={matchFormats.includes(f) ? "default" : "outline"}
                      className="cursor-pointer capitalize text-sm px-3 py-1"
                      onClick={() => toggleMulti(matchFormats, f, setMatchFormats)}
                    >
                      {f}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label>Game Type *</Label>
                <div className="flex flex-col gap-2 mt-1">
                  {(["recreational", "slightly-competitive", "hardcore-competitive"] as GameType[]).map((g) => (
                    <Badge
                      key={g}
                      variant={gameType === g ? "default" : "outline"}
                      className="cursor-pointer capitalize text-sm px-3 py-2 justify-start"
                      onClick={() => setGameType(g)}
                    >
                      {g === "recreational" ? "🎉 Recreational" : g === "slightly-competitive" ? "💪 Slightly Competitive" : "🔥 Hardcore Competitive"}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader><CardTitle>Your Availability</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Tap a day to enable it, then set your available hours.</p>
              {availability.map((day) => (
                <div key={day.day} className={`rounded-lg border p-3 transition-all ${day.enabled ? "border-primary bg-primary/5" : "border-muted"}`}>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => toggleDay(day.day)}
                      className="font-medium flex items-center gap-2"
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs ${day.enabled ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"}`}>
                        {day.enabled && "✓"}
                      </div>
                      {day.day}
                    </button>
                    {day.enabled && day.slots[0] && (
                      <span className="text-sm text-muted-foreground">
                        {formatHour(day.slots[0].start)} – {formatHour(day.slots[0].end)}
                      </span>
                    )}
                  </div>
                  {day.enabled && (
                    <div className="flex items-center gap-2 mt-2">
                      <Select value={day.slots[0]?.start?.toString() || "9"} onValueChange={(v) => updateSlot(day.day, "start", parseInt(v))}>
                        <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {HOURS.map((h) => (
                            <SelectItem key={h} value={h.toString()}>{formatHour(h)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-sm">to</span>
                      <Select value={day.slots[0]?.end?.toString() || "12"} onValueChange={(v) => updateSlot(day.day, "end", parseInt(v))}>
                        <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {HOURS.map((h) => (
                            <SelectItem key={h} value={h.toString()}>{formatHour(h)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader><CardTitle>Partner Preferences</CardTitle></CardHeader>
            <CardContent className="space-y-4">
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
                    <SelectContent>
                      {NTRP_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <span className="text-sm">to</span>
                  <Select value={partnerNtrpMax} onValueChange={setPartnerNtrpMax}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {NTRP_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Partner Game Type *</Label>
                <div className="flex flex-col gap-2 mt-1">
                  {(["recreational", "slightly-competitive", "hardcore-competitive"] as GameType[]).map((g) => (
                    <Badge
                      key={g}
                      variant={partnerGameTypes.includes(g) ? "default" : "outline"}
                      className="cursor-pointer capitalize text-sm px-3 py-2 justify-start"
                      onClick={() => toggleMulti(partnerGameTypes, g, setPartnerGameTypes)}
                    >
                      {g === "recreational" ? "🎉 Recreational" : g === "slightly-competitive" ? "💪 Slightly Competitive" : "🔥 Hardcore Competitive"}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label>Partner Sport *</Label>
                <div className="flex gap-2 mt-1">
                  {(["tennis", "pickleball", "both"] as SportType[]).map((s) => (
                    <Badge
                      key={s}
                      variant={partnerSports.includes(s) ? "default" : "outline"}
                      className="cursor-pointer capitalize text-sm px-3 py-1"
                      onClick={() => toggleMulti(partnerSports, s, setPartnerSports)}
                    >
                      {s === "both" ? "Both" : s === "tennis" ? "🎾 Tennis" : "🏓 Pickleball"}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label>Partner Match Format *</Label>
                <div className="flex gap-2 mt-1">
                  {(["singles", "doubles", "both"] as MatchFormat[]).map((f) => (
                    <Badge
                      key={f}
                      variant={partnerFormats.includes(f) ? "default" : "outline"}
                      className="cursor-pointer capitalize text-sm px-3 py-1"
                      onClick={() => toggleMulti(partnerFormats, f, setPartnerFormats)}
                    >
                      {f}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-between">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>
          ) : <div />}
          {step < 4 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>Next</Button>
          ) : (
            <Button onClick={handleComplete} disabled={!canProceed()}>Complete Profile 🎉</Button>
          )}
        </div>
      </div>
    </div>
  );
}
