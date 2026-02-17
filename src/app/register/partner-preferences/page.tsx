"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Trophy } from "lucide-react";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const times = ["Morning", "Afternoon", "Evening"];

export default function PartnerPreferencesPage() {
  const [selectedDays, setSelectedDays] = useState<string[]>(["Sat", "Sun"]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>(["Morning"]);
  const [ratingRange, setRatingRange] = useState([3.0, 4.0]);
  const [maxDistance, setMaxDistance] = useState(15);
  const router = useRouter();

  const toggleDay = (day: string) => setSelectedDays((d) => d.includes(day) ? d.filter((x) => x !== day) : [...d, day]);
  const toggleTime = (time: string) => setSelectedTimes((t) => t.includes(time) ? t.filter((x) => x !== time) : [...t, time]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-br from-green-50 to-orange-50 dark:from-green-950/20 dark:to-orange-950/20">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="inline-flex items-center justify-center gap-2 mb-2">
            <Trophy className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">PlayMatch</span>
          </div>
          <CardTitle className="text-2xl">Partner Preferences</CardTitle>
          <CardDescription>Tell us what you&apos;re looking for in a playing partner</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label className="text-base font-medium">Preferred Days</Label>
            <div className="flex flex-wrap gap-2">
              {days.map((day) => (
                <Button key={day} type="button" variant={selectedDays.includes(day) ? "default" : "outline"} size="sm" onClick={() => toggleDay(day)}>
                  {day}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <Label className="text-base font-medium">Preferred Times</Label>
            <div className="flex flex-wrap gap-2">
              {times.map((time) => (
                <Button key={time} type="button" variant={selectedTimes.includes(time) ? "default" : "outline"} size="sm" onClick={() => toggleTime(time)}>
                  {time}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <Label className="text-base font-medium">Partner NTRP Range: {ratingRange[0].toFixed(1)} – {ratingRange[1].toFixed(1)}</Label>
            <Slider min={2.0} max={5.0} step={0.5} value={ratingRange} onValueChange={setRatingRange} />
          </div>
          <div className="space-y-3">
            <Label className="text-base font-medium">Max Distance: {maxDistance} miles</Label>
            <Slider min={5} max={50} step={5} value={[maxDistance]} onValueChange={([v]) => setMaxDistance(v)} />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="competitive" />
            <Label htmlFor="competitive" className="text-sm">I prefer competitive matches</Label>
          </div>
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={() => router.push("/dashboard")}>
            Save &amp; Go to Dashboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
