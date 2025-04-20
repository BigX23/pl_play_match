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

export default function RegisterPage() {
  const router = useRouter();

  const [sportPreference, setSportPreference] = useState('');
  const [age, setAge] = useState('');
  const [skillLevel, setSkillLevel] = useState('');
  const [gender, setGender] = useState('');
  const [typeOfPlayer, setTypeOfPlayer] = useState('');
  const [preferredPlayingTimes, setPreferredPlayingTimes] = useState('');
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
            <div>
              <Label htmlFor="skillLevel">Skill Level</Label>
              <Input
                type="text"
                id="skillLevel"
                value={skillLevel}
                onChange={(e) => setSkillLevel(e.target.value)}
                placeholder="e.g., NTRP 3.5"
              />
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
              <Label htmlFor="preferredPlayingTimes">Preferred Playing Times</Label>
              <Input
                type="text"
                id="preferredPlayingTimes"
                value={preferredPlayingTimes}
                onChange={(e) => setPreferredPlayingTimes(e.target.value)}
                placeholder="e.g., Weekends, Evenings"
              />
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
