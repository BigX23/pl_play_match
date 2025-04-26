"use client";

import {useRouter} from 'next/navigation';
import {useState} from 'react';
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Textarea} from "@/components/ui/textarea";
import {Slider} from "@/components/ui/slider";
import {cn} from "@/lib/utils";
import {Checkbox} from "@/components/ui/checkbox";
import {Calendar} from "@/components/ui/calendar";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {format} from "date-fns";
import {PopoverClose} from "@radix-ui/react-popover";
import {Icons} from "@/components/icons"; // Import Icons
import Image from 'next/image'; // Import Image component

export default function RegisterPage() {
  const router = useRouter();

  const [sportPreference, setSportPreference] = useState('');
  const [age, setAge] = useState('');
  const [skillLevel, setSkillLevel] = useState([3.0]); // Default skill level
  const [gender, setGender] = useState('');
  const [typeOfPlayer, setTypeOfPlayer] = useState('');
  const [preferredPlayingTimes, setPreferredPlayingTimes] = useState({});
  const [howOftenTheyPlay, setHowOftenTheyPlay] = useState('');
  const [partnerSkillLevels, setPartnerSkillLevels] = useState([2.5]);
  const [partnerGender, setPartnerGender] = useState('');
  const [partnerAgeRange, setPartnerAgeRange] = useState('');
  const [contactDetails, setContactDetails] = useState('');
  const [playingStyle, setPlayingStyle] = useState('');
  const [profilePicture, setProfilePicture] = useState<File | null>(null);

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setProfilePicture(e.target.files[0]);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    // Handle the submission logic here
    console.log({
      sportPreference,
      age,
      skillLevel,
      gender,
      typeOfPlayer,
      preferredPlayingTimes,
      howOftenTheyPlay,
      partnerSkillLevels,
      partnerGender,
      partnerAgeRange,
      contactDetails,
      playingStyle,
      profilePicture,
    });
    alert('Registration data submitted (check console for details).');
  };

  const handleTimeSlotChange = (day: string, timeOfDay: string, hour: number) => {
    const newPreferredPlayingTimes = { ...preferredPlayingTimes };

    if (!newPreferredPlayingTimes[day]) {
      newPreferredPlayingTimes[day] = {};
    }

    if (!newPreferredPlayingTimes[day][timeOfDay]) {
      newPreferredPlayingTimes[day][timeOfDay] = {};
    }

    newPreferredPlayingTimes[day][timeOfDay][hour] = !newPreferredPlayingTimes[day][timeOfDay][hour];

    setPreferredPlayingTimes(newPreferredPlayingTimes);
  };

  const timeSlots = {
    Monday: {
      Morning: Array.from({ length: 4 }, (_, i) => i + 8), // 8 AM - 11 AM
      Afternoon: Array.from({ length: 4 }, (_, i) => i + 12), // 12 PM - 3 PM
      Evening: Array.from({ length: 5 }, (_, i) => i + 17), // 5 PM - 9 PM
    },
    Tuesday: {
      Morning: Array.from({ length: 4 }, (_, i) => i + 8), // 8 AM - 11 AM
      Afternoon: Array.from({ length: 4 }, (_, i) => i + 12), // 12 PM - 3 PM
      Evening: Array.from({ length: 5 }, (_, i) => i + 17), // 5 PM - 9 PM
    },
    Wednesday: {
      Morning: Array.from({ length: 4 }, (_, i) => i + 8), // 8 AM - 11 AM
      Afternoon: Array.from({ length: 4 }, (_, i) => i + 12), // 12 PM - 3 PM
      Evening: Array.from({ length: 5 }, (_, i) => i + 17), // 5 PM - 9 PM
    },
    Thursday: {
      Morning: Array.from({ length: 4 }, (_, i) => i + 8), // 8 AM - 11 AM
      Afternoon: Array.from({ length: 4 }, (_, i) => i + 12), // 12 PM - 3 PM
      Evening: Array.from({ length: 5 }, (_, i) => i + 17), // 5 PM - 9 PM
    },
    Friday: {
      Morning: Array.from({ length: 4 }, (_, i) => i + 8), // 8 AM - 11 AM
      Afternoon: Array.from({ length: 4 }, (_, i) => i + 12), // 12 PM - 3 PM
      Evening: Array.from({ length: 5 }, (_, i) => i + 17), // 5 PM - 9 PM
    },
    Saturday: {
      Morning: Array.from({ length: 4 }, (_, i) => i + 8), // 8 AM - 11 AM
      Afternoon: Array.from({ length: 4 }, (_, i) => i + 12), // 12 PM - 3 PM
      Evening: Array.from({ length: 4 }, (_, i) => i + 17), // 5 PM - 8 PM
    },
    Sunday: {
      Morning: Array.from({ length: 4 }, (_, i) => i + 8), // 8 AM - 11 AM
      Afternoon: Array.from({ length: 4 }, (_, i) => i + 12), // 12 PM - 3 PM
      Evening: Array.from({ length: 3 }, (_, i) => i + 17), // 5 PM - 7 PM
    },
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-background-light-gray py-12">
      <Card className="w-full max-w-3xl shadow-md rounded-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary">
            Registration
          </CardTitle>
          <CardDescription>
            Create your profile to find the perfect match.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Profile Picture */}
            <div>
              <Label htmlFor="profilePicture">Profile Picture (Optional)</Label>
              <Input
                type="file"
                id="profilePicture"
                accept="image/*"
                onChange={handleProfilePictureChange}
                className="mt-1"
              />
            </div>

            {/* Sport Preference */}
            <div>
              <Label htmlFor="sportPreference">Sport Preference</Label>
              <Select onValueChange={setSportPreference}>
                <SelectTrigger id="sportPreference">
                  <SelectValue placeholder="Select"/>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tennis">Tennis</SelectItem>
                  <SelectItem value="Pickleball">Pickleball</SelectItem>
                  <SelectItem value="Both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Age */}
            <div>
              <Label htmlFor="age">Age</Label>
              <Input
                type="number"
                id="age"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Enter your age"
              />
            </div>

            {/* Skill Level */}
            <div className="flex items-center gap-2">
              <Label htmlFor="skillLevel">Skill Level (NTRP)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5"><Icons.help className="h-4 w-4"/></Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  {/* 
                    Add the NTRP skill level image here.
                    You can place the image in the `public` directory, for example `public/ntrp-skill-levels.png`
                    Then use the Image component like this:
                    <Image
                      src="/ntrp-skill-levels.png"
                      alt="NTRP Skill Levels"
                      width={300}
                      height={400}
                      objectFit="contain"
                    />
                  */}
                  <p>Please add the NTRP skill level image to the `public` directory and update this PopoverContent to display it using the Next.js Image component.</p>
                </PopoverContent>
              </Popover>
            </div>

            {/* Gender */}
            <div>
              <Label htmlFor="gender">Gender</Label>
              <Select onValueChange={setGender}>
                <SelectTrigger id="gender">
                  <SelectValue placeholder="Select"/>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Type of Player */}
            <div>
              <Label htmlFor="typeOfPlayer">Type of Player</Label>
              <Select onValueChange={setTypeOfPlayer}>
                <SelectTrigger id="typeOfPlayer">
                  <SelectValue placeholder="Select"/>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Recreational">Recreational</SelectItem>
                  <SelectItem value="Somewhat Competitive">Somewhat Competitive</SelectItem>
                  <SelectItem value="Really Competitive">Really Competitive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Preferred Playing Times */}
            <div>
              <Label>Preferred Playing Times</Label>
              {Object.entries(timeSlots).map(([day, timesOfDay]) => (
                <div key={day} className="mb-4">
                  <h3 className="font-semibold">{day}</h3>
                  {Object.entries(timesOfDay).map(([timeOfDay, hours]) => (
                    <div key={timeOfDay} className="mb-2">
                      <h4>{timeOfDay}</h4>
                      <div className="flex flex-wrap">
                        {hours.map(hour => (
                          <label key={hour} className="mr-2">
                            <Checkbox
                              checked={preferredPlayingTimes[day]?.[timeOfDay]?.[hour] || false}
                              onCheckedChange={() => handleTimeSlotChange(day, timeOfDay, hour)}
                            />
                            {hour}:00
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* How Often They Play */}
            <div>
              <Label htmlFor="howOftenTheyPlay">How Often Do You Play?</Label>
              <Select onValueChange={setHowOftenTheyPlay}>
                <SelectTrigger id="howOftenTheyPlay">
                  <SelectValue placeholder="Select"/>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Once per month or less">Once per month or less</SelectItem>
                  <SelectItem value="2 - 5 times per month">2 - 5 times per month</SelectItem>
                  <SelectItem value="More than 5 times per month">More than 5 times per month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Playing Style */}
            <div>
              <Label htmlFor="playingStyle">Playing Style</Label>
              <Textarea
                id="playingStyle"
                placeholder="Describe your playing style (e.g., Aggressive baseliner)"
                value={playingStyle}
                onChange={(e) => setPlayingStyle(e.target.value)}
              />
            </div>

            {/* Partner Skill Levels */}
            <div>
              <Label htmlFor="partnerSkillLevels">Partner Skill Levels (NTRP)</Label>
              <Slider
                id="partnerSkillLevels"
                defaultValue={[2.5]}
                max={5.0}
                min={2.5}
                step={0.5}
                onValueChange={(value) => setPartnerSkillLevels(value)}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Selected NTRP Level: {partnerSkillLevels ? partnerSkillLevels[0] : 'Not selected'}
              </p>
            </div>

            {/* Partner Gender */}
            <div>
              <Label htmlFor="partnerGender">Partner Gender</Label>
              <Select onValueChange={setPartnerGender}>
                <SelectTrigger id="partnerGender">
                  <SelectValue placeholder="Select"/>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Any">Any</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Partner Age Range */}
            <div>
              <Label htmlFor="partnerAgeRange">Partner Age Range</Label>
              <Input
                type="text"
                id="partnerAgeRange"
                value={partnerAgeRange}
                onChange={(e) => setPartnerAgeRange(e.target.value)}
                placeholder="e.g., 25-35"
              />
            </div>

            {/* Contact Details */}
            <div>
              <Label htmlFor="contactDetails">Preferred Contact Details</Label>
              <Input
                type="text"
                id="contactDetails"
                value={contactDetails}
                onChange={(e) => setContactDetails(e.target.value)}
                placeholder="e.g., Email, Phone"
              />
            </div>

            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/80">
              Register
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

