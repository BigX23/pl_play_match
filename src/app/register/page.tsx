"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Icons } from "@/components/icons";

// utility
import { cn } from "@/lib/utils";

// -----------------------------------------------------------------------------
// Register Page (FULL VERSION) – 100% complete
// -----------------------------------------------------------------------------
export default function RegisterPage() {
  const router = useRouter();

  // ─── State ───────────────────────────────────────────────────────────────────
  const [sportPreference, setSportPreference] = useState("");
  const [age, setAge] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [skillLevel, setSkillLevel] = useState("3.0");
  const [gender, setGender] = useState("");
  const [typeOfPlayer, setTypeOfPlayer] = useState("");
  const [preferredPlayingTimes, setPreferredPlayingTimes =
    useState<Record<string, Record<string, Record<number, boolean>>>>({});
  const [howOftenTheyPlay, setHowOftenTheyPlay] = useState("");
  const [gameType, setGameType] = useState("");
  const [contactDetails, setContactDetails] = useState("");
  const [playingStyle, setPlayingStyle] = useState("");
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  // error state
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const ntrpLevels = [
    "1.0",
    "1.5",
    "2.0",
    "2.5",
    "3.0",
    "3.5",
    "4.0",
    "4.5",
    "5.0",
    "5.5",
    "6.0",
    "6.5",
    "7.0",
  ];

  const timeSlots: Record<string, Record<string, number[]>> = {
    Monday: {
      Morning: Array.from({ length: 4 }, (_, i) => i + 8),
      Afternoon: Array.from({ length: 5 }, (_, i) => i + 12),
      Evening: Array.from({ length: 5 }, (_, i) => i + 17),
    },
    Tuesday: {
      Morning: Array.from({ length: 4 }, (_, i) => i + 8),
      Afternoon: Array.from({ length: 5 }, (_, i) => i + 12),
      Evening: Array.from({ length: 5 }, (_, i) => i + 17),
    },
    Wednesday: {
      Morning: Array.from({ length: 4 }, (_, i) => i + 8),
      Afternoon: Array.from({ length: 5 }, (_, i) => i + 12),
      Evening: Array.from({ length: 5 }, (_, i) => i + 17),
    },
    Thursday: {
      Morning: Array.from({ length: 4 }, (_, i) => i + 8),
      Afternoon: Array.from({ length: 5 }, (_, i) => i + 12),
      Evening: Array.from({ length: 5 }, (_, i) => i + 17),
    },
    Friday: {
      Morning: Array.from({ length: 4 }, (_, i) => i + 8),
      Afternoon: Array.from({ length: 5 }, (_, i) => i + 12),
      Evening: Array.from({ length: 5 }, (_, i) => i + 17),
    },
    Saturday: {
      Morning: Array.from({ length: 4 }, (_, i) => i + 8),
      Afternoon: Array.from({ length: 5 }, (_, i) => i + 12),
      Evening: Array.from({ length: 4 }, (_, i) => i + 17),
    },
    Sunday: {
      Morning: Array.from({ length: 4 }, (_, i) => i + 8),
      Afternoon: Array.from({ length: 5 }, (_, i) => i + 12),
      Evening: Array.from({ length: 3 }, (_, i) => i + 17),
    },
  };

  // ─── Event Handlers ─────────────────────────────────────────────────────────
  const handleProfilePictureChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (e.target.files?.length) setProfilePicture(e.target.files[0]);
  };

  // Immutable deep update for multi‑select
  const handleTimeSlotChange = (day: string, period: string, hour: number) => {
    setPreferredPlayingTimes(prev => ({
      ...prev,
      [day]: {
        ...(prev[day] ?? {}),
        [period]: {
          ...(prev[day]?.[period] ?? {}),
          [hour]: !prev[day]?.[period]?.[hour],
        },
      },
    }));
  };

  const toggleDayExpansion = (day: string) => {
    setExpandedDays(prev => ({ ...prev, [day]: !prev[day] }));
  };

  // ─── Validation & Submit ────────────────────────────────────────────────────
  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!email) errors.email = "Email is required";
    if (!password) errors.password = "Password is required";
    if (!confirmPassword) errors.confirmPassword = "Confirm Password is required";
    if (password && confirmPassword && password !== confirmPassword)
      errors.confirmPassword = "Passwords do not match";

    if (!sportPreference) errors.sportPreference = "Sport Preference is required";
    if (!age) errors.age = "Age is required";
    if (!skillLevel) errors.skillLevel = "Skill Level is required";
    if (!gender) errors.gender = "Gender is required";
    if (!typeOfPlayer) errors.typeOfPlayer = "Type of Player is required";
    if (!howOftenTheyPlay)
      errors.howOftenTheyPlay = "How Often Do You Play? is required";
    if (!gameType) errors.gameType = "Game Type is required";
    if (!contactDetails) errors.contactDetails = "Phone Number is required";

    let hours = 0;
    Object.values(preferredPlayingTimes).forEach(dayObj =>
      Object.values(dayObj).forEach(periodObj => {
        hours += Object.values(periodObj).filter(Boolean).length;
      })
    );
    if (hours < 2)
      errors.preferredPlayingTimes =
        "Select at least 2 hours in Preferred Playing Times";

    return errors;
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateForm();
    setFormErrors(errors);
    if (Object.keys(errors).length) return;

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          sportPreference,
          age: Number(age),
          skillLevel,
          gender,
          typeOfPlayer,
          preferredPlayingTimes,
          howOftenTheyPlay,
          gameType,
          notes: playingStyle,
          phoneNumber: contactDetails,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setFormErrors(prev => ({ ...prev, database: data.message || 'Registration failed' }));
        return; // Stop execution if registration failed
      }

      router.push("/register/partner-preferences");
    } catch (err: any) {
      // This catch block will now primarily handle network errors or issues with response.json()
      setFormErrors(prev => ({ ...prev, database: err?.message || "Unexpected error during registration" }));
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex justify-center items-center min-h-screen bg-background-light-gray py-12">
      <Card className="w-full max-w-3xl shadow-md rounded-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary">Registration (Step 1 of 2)</CardTitle>
          <CardDescription>Create your profile to find the perfect match.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
          <form onSubmit={handleNext} className="space-y-4">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                type="email"
                id="email"
                placeholder="Enter your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              {formErrors.email && <p className="text-red-500 text-sm">{formErrors.email}</p>}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                type="password"
                id="password"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              {formErrors.password && <p className="text-red-500 text-sm">{formErrors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                type="password"
                id="confirmPassword"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
              {formErrors.confirmPassword && <p className="text-red-500 text-sm">{formErrors.confirmPassword}</p>}
            </div>

            {/* Profile Picture */}
            <div className="space-y-2">
              <Label htmlFor="profilePicture">Profile Picture (Optional)</Label>
              <Input
                type="file"
                id="profilePicture"
                accept="image/*"
                onChange={handleProfilePictureChange}
              />
            </div>

            {/* Sport Preference */}
            <div className="space-y-2">
              <Label htmlFor="sportPreference">Sport Preference</Label>
              <Select value={sportPreference} onValueChange={setSportPreference}>
                <SelectTrigger id="sportPreference">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tennis">Tennis</SelectItem>
                  <SelectItem value="Pickleball">Pickleball</SelectItem>
                  <SelectItem value="Both">Both</SelectItem>
                </SelectContent>
              </Select>
              {formErrors.sportPreference && <p className="text-red-500 text-sm">{formErrors.sportPreference}</p>}
            </div>

            {/* Age */}
            <div className="space-y-2">
              <Label htmlFor="age">Age</Label>
              <Input
                type="number"
                id="age"
                placeholder="Enter your age"
                value={age}
                onChange={e => setAge(e.target.value)}
              />
              {formErrors.age && <p className="text-red-500 text-sm">{formErrors.age}</p>}
            </div>

            {/* Skill Level */}
            <div className="space-y-1">
              <div className="mb-1 flex items-center gap-2">
                <Label htmlFor="skillLevel">Skill Level (NTRP)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-5 w-5">
                      <Icons.help className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <Image
                      src="/ntrp-skill-levels.png"
                      alt="NTRP Skill Levels"
                      width={300}
                      height={400}
                      style={{ objectFit: "contain" }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <Select value={skillLevel} onValueChange={setSkillLevel}>
                <SelectTrigger id="skillLevel">
                  <SelectValue placeholder="Select your NTRP level" />
                </SelectTrigger>
                <SelectContent>
                  {ntrpLevels.map(level => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.skillLevel && <p className="text-red-500 text-sm">{formErrors.skillLevel}</p>}
            </div>

            {/* Gender */}
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger id="gender">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              {formErrors.gender && <p className="text-red-500 text-sm">{formErrors.gender}</p>}
            </div>

            {/* Type of Player */}
            <div className="space-y-2">
              <Label htmlFor="typeOfPlayer">Type of Player</Label>
              <Select value={typeOfPlayer} onValueChange={setTypeOfPlayer}>
                <SelectTrigger id="typeOfPlayer">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Recreational">Recreational</SelectItem>
                  <SelectItem value="Somewhat Competitive">Somewhat Competitive</SelectItem>
                  <SelectItem value="Really Competitive">Really Competitive</SelectItem>
                </SelectContent>
              </Select>
              {formErrors.typeOfPlayer && <p className="text-red-500 text-sm">{formErrors.typeOfPlayer}</p>}
            </div>

            {/* Preferred Playing Days/Times */}
            <div className="space-y-2">
              <Label>Preferred Playing Days/Times</Label>
              <div>
                {Object.entries(timeSlots).map(([day, periods]) => (
                  <div key={day} className="mb-4">
                    <div
                      className="flex cursor-pointer items-center"
                      onClick={() => toggleDayExpansion(day)}
                    >
                      <h3 className="mr-2 font-semibold">{day}</h3>
                      <Icons.chevronDown
                        className={cn(
                          "h-4 w-4 transition-transform",
                          expandedDays[day] && "rotate-180"
                        )}
                      />
                    </div>
                    {expandedDays[day] && (
                      <div className="pl-4 mt-2 space-y-2">
                        {Object.entries(periods).map(([period, hours]) => (
                          <div key={period}>
                            <h4 className="text-sm font-medium mb-1">{period}</h4>
                            <div className="flex flex-wrap gap-2">
                              {hours.map(hour => (
                                <label key={hour} className="flex items-center text-xs cursor-pointer select-none gap-1">
                                  <Checkbox
                                    checked={!!preferredPlayingTimes[day]?.[period]?.[hour]}
                                    onCheckedChange={() => handleTimeSlotChange(day, period, hour)}
                                  />
                                  <span>
                                    {hour === 0
                                      ? "12 AM"
                                      : hour < 12
                                      ? `${hour} AM`
                                      : hour === 12
                                      ? "12 PM"
                                      : `${hour - 12} PM`}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {formErrors.preferredPlayingTimes && (
                <p className="text-red-500 text-sm">{formErrors.preferredPlayingTimes}</p>
              )}
            </div>

            {/* How Often They Play */}
            <div className="space-y-2">
              <Label htmlFor="howOftenTheyPlay">How Often Do You Play?</Label>
              <Select value={howOftenTheyPlay} onValueChange={setHowOftenTheyPlay}>
                <SelectTrigger id="howOftenTheyPlay">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Once per month or less">Once per month or less</SelectItem>
                  <SelectItem value="2 - 5 times per month">2 - 5 times per month</SelectItem>
                  <SelectItem value="More than 5 times per month">More than 5 times per month</SelectItem>
                </SelectContent>
              </Select>
              {formErrors.howOftenTheyPlay && <p className="text-red-500 text-sm">{formErrors.howOftenTheyPlay}</p>}
            </div>

            {/* Game Type */}
            <div className="space-y-2">
              <Label htmlFor="gameType">Game Type</Label>
              <Select value={gameType} onValueChange={setGameType}>
                <SelectTrigger id="gameType">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Singles only">Singles only</SelectItem>
                  <SelectItem value="Doubles only">Doubles only</SelectItem>
                  <SelectItem value="Singles or Doubles">Singles or Doubles</SelectItem>
                </SelectContent>
              </Select>
              {formErrors.gameType && <p className="text-red-500 text-sm">{formErrors.gameType}</p>}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="(Optional) Any additional info you would like to share"
                value={playingStyle}
                onChange={e => setPlayingStyle(e.target.value)}
              />
            </div>

            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="contactDetails">Phone Number</Label>
              <Input
                type="text"
                id="contactDetails"
                placeholder="Enter your phone number"
                value={contactDetails}
                onChange={e => setContactDetails(e.target.value)}
              />
              {formErrors.contactDetails && <p className="text-red-500 text-sm">{formErrors.contactDetails}</p>}
            </div>

            {/* Submit */}
            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/80">
              Next
            </Button>

            {formErrors.database && <p className="text-red-500 text-sm">{formErrors.database}</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
