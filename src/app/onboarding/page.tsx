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
import { HelpCircle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { updateUser } from "@/lib/firestore";
import type { GameType, SportType, MatchFormat, AgeRange, DayAvailability, PartnerPreferences } from "@/lib/matching-engine";

const EMOJI_AVATARS = ["🎾", "🏓", "💪", "🔥", "⭐", "🏆", "🎯", "🦊", "🐻", "🦁", "🐯", "🦅", "🐬", "🌟", "🎪", "🚀", "💎", "🌈", "🎭", "🎨"];
const NTRP_OPTIONS = ["2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0", "5.5"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIME_PERIODS = [
  { label: "Morning",   emoji: "🌅", start: 8,  end: 12 },
  { label: "Afternoon", emoji: "☀️", start: 12, end: 17 },
  { label: "Evening",   emoji: "🌆", start: 17, end: 21 },
];

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

  const [showNtrpInfo, setShowNtrpInfo] = useState(false);

  // Step 2
  const [ntrp, setNtrp] = useState(user?.ntrpRating?.toString() || "3.5");
  const [sports, setSports] = useState<SportType[]>(user?.sports || []);
  const [matchFormats, setMatchFormats] = useState<MatchFormat[]>(user?.matchFormats || []);
  const [gameType, setGameType] = useState<GameType>(user?.gameType || "slightly-competitive");

  // Step 3 — weekly calendar grid
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(() => {
    const set = new Set<string>();
    (user?.weeklyAvailability || []).forEach((day) => {
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
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Step 4
  const [ageRange, setAgeRange] = useState<AgeRange>(user?.partnerPreferences?.ageRange || "10");
  const [partnerNtrpMin, setPartnerNtrpMin] = useState(user?.partnerPreferences?.ntrpMin?.toString() || "2.0");
  const [partnerNtrpMax, setPartnerNtrpMax] = useState(user?.partnerPreferences?.ntrpMax?.toString() || "5.5");
  const [partnerGameTypes, setPartnerGameTypes] = useState<GameType[]>(user?.partnerPreferences?.gameTypes || []);
  const [partnerSports, setPartnerSports] = useState<SportType[]>(user?.partnerPreferences?.sports || []);
  const [partnerFormats, setPartnerFormats] = useState<MatchFormat[]>(user?.partnerPreferences?.matchFormats || []);
  const [partnerGender, setPartnerGender] = useState<"Male" | "Female" | "No Preference">(user?.partnerPreferences?.genderPreference || "No Preference");

  const toggleMulti = <T extends string>(arr: T[], val: T, setter: (v: T[]) => void) => {
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const canProceed = () => {
    if (step === 1) return firstName && lastName && age && gender && avatar;
    if (step === 2) return ntrp && sports.length > 0 && matchFormats.length > 0 && gameType;
    if (step === 3) return selectedSlots.size >= 3;
    if (step === 4) return partnerGameTypes.length > 0 && partnerSports.length > 0 && partnerFormats.length > 0 && !!partnerGender;
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
      genderPreference: partnerGender,
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
      weeklyAvailability: DAYS.map((day) => {
        const enabledPeriods = TIME_PERIODS.filter((_, i) => selectedSlots.has(`${day}-${i}`));
        return { day, enabled: enabledPeriods.length > 0, slots: enabledPeriods.map((p) => ({ start: p.start, end: p.end })) } as DayAvailability;
      }),
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
          <h1 className="text-2xl font-bold">Set Up Your Profile</h1>
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
                      aria-pressed={avatar === emoji}
                      className={`text-2xl p-1 rounded-lg border-2 transition-colors ${
                        avatar === emoji ? "border-primary bg-primary/10" : "border-transparent"
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
                <div className="flex items-center gap-1.5 mb-1">
                  <Label className="mb-0">NTRP Rating *</Label>
                  <button
                    type="button"
                    onClick={() => setShowNtrpInfo(true)}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    aria-label="What is NTRP?"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </div>
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
                    <button
                      key={s}
                      type="button"
                      aria-pressed={sports.includes(s)}
                      onClick={() => toggleMulti(sports, s, setSports)}
                    >
                      <Badge
                        variant={sports.includes(s) ? "default" : "outline"}
                        className="cursor-pointer capitalize text-sm px-3 py-1"
                      >
                        {s === "both" ? "Both" : s === "tennis" ? "Tennis" : "Pickleball"}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Match Format *</Label>
                <div className="flex gap-2 mt-1">
                  {(["singles", "doubles", "both"] as MatchFormat[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={matchFormats.includes(f)}
                      onClick={() => toggleMulti(matchFormats, f, setMatchFormats)}
                    >
                      <Badge
                        variant={matchFormats.includes(f) ? "default" : "outline"}
                        className="cursor-pointer capitalize text-sm px-3 py-1"
                      >
                        {f}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Game Type *</Label>
                <div className="flex flex-col gap-2 mt-1">
                  {(["recreational", "slightly-competitive", "hardcore-competitive"] as GameType[]).map((g) => (
                    <button
                      key={g}
                      type="button"
                      aria-pressed={gameType === g}
                      className="text-left"
                      onClick={() => setGameType(g)}
                    >
                      <Badge
                        variant={gameType === g ? "default" : "outline"}
                        className="cursor-pointer capitalize text-sm px-3 py-2 justify-start w-full"
                      >
                        {g === "recreational" ? "Recreational" : g === "slightly-competitive" ? "Slightly Competitive" : "Hardcore Competitive"}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Your Availability</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-1">
                Tap the time slots when you&apos;re free to play.
              </p>
              <p className="text-sm mb-4">
                <span className={selectedSlots.size >= 3 ? "text-primary font-semibold" : "text-amber-600 font-semibold"}>
                  {selectedSlots.size} selected
                </span>
                <span className="text-muted-foreground"> — select at least 3</span>
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-1">
                  <thead>
                    <tr>
                      <th className="w-24" />
                      {DAYS.map((day) => (
                        <th key={day} className="text-center text-xs font-semibold text-muted-foreground pb-1">{day}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TIME_PERIODS.map((period, periodIdx) => (
                      <tr key={period.label}>
                        <td className="pr-2 py-0.5">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{period.emoji} {period.label}</span>
                        </td>
                        {DAYS.map((day) => {
                          const key = `${day}-${periodIdx}`;
                          const selected = selectedSlots.has(key);
                          return (
                            <td key={day} className="py-0.5">
                              <button
                                type="button"
                                onClick={() => toggleSlot(day, periodIdx)}
                                aria-pressed={selected}
                                aria-label={`${day} ${period.label}`}
                                className={`w-full h-11 rounded-lg border-2 transition-colors text-sm ${
                                  selected
                                    ? "border-primary bg-primary text-primary-foreground font-bold"
                                    : "border-muted hover:border-primary/50 hover:bg-primary/5 text-transparent"
                                }`}
                              >
                                ✓
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader><CardTitle>Partner Preferences</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Partner Gender *</Label>
                <div className="flex gap-2 mt-1">
                  {(["Male", "Female", "No Preference"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      aria-pressed={partnerGender === g}
                      onClick={() => setPartnerGender(g)}
                    >
                      <Badge
                        variant={partnerGender === g ? "default" : "outline"}
                        className="cursor-pointer text-sm px-3 py-1"
                      >
                        {g}
                      </Badge>
                    </button>
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
                    <button
                      key={g}
                      type="button"
                      aria-pressed={partnerGameTypes.includes(g)}
                      className="text-left"
                      onClick={() => toggleMulti(partnerGameTypes, g, setPartnerGameTypes)}
                    >
                      <Badge
                        variant={partnerGameTypes.includes(g) ? "default" : "outline"}
                        className="cursor-pointer capitalize text-sm px-3 py-2 justify-start w-full"
                      >
                        {g === "recreational" ? "Recreational" : g === "slightly-competitive" ? "Slightly Competitive" : "Hardcore Competitive"}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Partner Sport *</Label>
                <div className="flex gap-2 mt-1">
                  {(["tennis", "pickleball", "both"] as SportType[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={partnerSports.includes(s)}
                      onClick={() => toggleMulti(partnerSports, s, setPartnerSports)}
                    >
                      <Badge
                        variant={partnerSports.includes(s) ? "default" : "outline"}
                        className="cursor-pointer capitalize text-sm px-3 py-1"
                      >
                        {s === "both" ? "Both" : s === "tennis" ? "Tennis" : "Pickleball"}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Partner Match Format *</Label>
                <div className="flex gap-2 mt-1">
                  {(["singles", "doubles", "both"] as MatchFormat[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={partnerFormats.includes(f)}
                      onClick={() => toggleMulti(partnerFormats, f, setPartnerFormats)}
                    >
                      <Badge
                        variant={partnerFormats.includes(f) ? "default" : "outline"}
                        className="cursor-pointer capitalize text-sm px-3 py-1"
                      >
                        {f}
                      </Badge>
                    </button>
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

      <Dialog open={showNtrpInfo} onOpenChange={setShowNtrpInfo}>
        <DialogContent className="max-w-2xl p-4">
          <DialogTitle className="text-lg font-semibold mb-2">NTRP Skill Levels</DialogTitle>
          <div className="relative w-full">
            <Image
              src="/ntrp-skill-levels.png"
              alt="NTRP Skill Level Guide"
              width={800}
              height={600}
              className="w-full h-auto rounded-md"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
