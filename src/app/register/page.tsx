"use client";

import {useRouter} from 'next/navigation';
import {useState} from 'react';
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Textarea} from "@/components/ui/textarea";
import {cn} from "@/lib/utils";
import {Checkbox} from "@/components/ui/checkbox";
import {Calendar} from "@/components/ui/calendar";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {Icons} from "@/components/icons"; // Import Icons
import Image from 'next/image'; // Import Image component
import { createUser, createUserProfile } from '@/db/sqlite-data'; // Import SQLite data access functions


export default function RegisterPage() {
  const router = useRouter();

  const [sportPreference, setSportPreference] = useState('');
  const [age, setAge] = useState('');
    const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); // Added confirm password state
  const [skillLevel, setSkillLevel] = useState('3.0');
  const [gender, setGender] = useState('');
  const [typeOfPlayer, setTypeOfPlayer] = useState('');
  const [preferredPlayingTimes, setPreferredPlayingTimes] = useState({});
  const [howOftenTheyPlay, setHowOftenTheyPlay] = useState('');
  const [gameType, setGameType] = useState('');
  const [contactDetails, setContactDetails] = useState(''); // Keeping the state name
  const [playingStyle, setPlayingStyle] = useState(''); // Renamed to 'notes' for consistency
  const [profilePicture, setProfilePicture] = useState<File | null>(null);

  // State to manage the expanded state of each day
  const [expandedDays, setExpandedDays] = useState<{[key: string]: boolean}>({});

  // State to manage form errors
  const [formErrors, setFormErrors] = useState({
    sportPreference: '',
    age: '',
    skillLevel: '',
    gender: '',
    typeOfPlayer: '',
    preferredPlayingTimes: '',
    howOftenTheyPlay: '',
    gameType: '',
    contactDetails: '', // Keeping error state name
    email: '',
    password: '', // Keeping password error state
    confirmPassword: '', // Added confirm password error state
    firebase: '', // For Firebase errors
  });

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setProfilePicture(e.target.files[0]);
    }
  };

  const validateForm = () => {
    const errors: any = {};

    if (!email) errors.email = 'Email is required';
    if (!password) errors.password = 'Password is required';
    if (!confirmPassword) {
        errors.confirmPassword = 'Confirm Password is required';
      } else if (password !== confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
    if (!sportPreference) errors.sportPreference = 'Sport Preference is required';
    if (!age) errors.age = 'Age is required';
    if (!skillLevel) errors.skillLevel = 'Skill Level is required';
    if (!gender) errors.gender = 'Gender is required';
    if (!typeOfPlayer) errors.typeOfPlayer = 'Type of Player is required';
    if (!howOftenTheyPlay) errors.howOftenTheyPlay = 'How Often Do You Play? is required';
    if (!gameType) errors.gameType = 'Game Type is required';
    // Updated validation for Phone Number
    if (!contactDetails) errors.contactDetails = 'Phone Number is required';

    // Validate Preferred Playing Times (at least 2 hours selected)
    let totalHoursSelected = 0;
    Object.values(preferredPlayingTimes).forEach((day) => {
        Object.values(day as any).forEach((timeOfDay) => {
            totalHoursSelected += Object.keys(timeOfDay as any).length;
        });
    });
    if (totalHoursSelected < 2) {
        errors.preferredPlayingTimes = 'Please select at least 2 hours of preferred playing times.';
    }

    return errors;
  };

  const handleNext = async (event: React.FormEvent) => {
        event.preventDefault();

        const errors = validateForm();
        setFormErrors(errors);

        if (Object.keys(errors).length > 0) {
            return; // Prevent navigation if there are errors
        }


    try {
      // Create user in SQLite
      await createUser(email, password);

      // Create user profile in SQLite
      const userProfileData = {
        email,
        sportPreference,
        age: parseInt(age, 10), // Ensure age is a number
        skillLevel,
        gender,
        typeOfPlayer,
        preferredPlayingTimes: JSON.stringify(preferredPlayingTimes), // Store as JSON string
        howOftenTheyPlay,
        gameType,
        notes: playingStyle, // Using playingStyle state for notes
        phoneNumber: contactDetails, // This will now store the phone number
        profilePicture: null, // Profile picture handling would require file storage (e.g., Firebase Storage)
      };

      await createUserProfile(userProfileData);

              // After successful signup and data storage, navigate to the next step
              router.push('/register/partner-preferences');
          }

        } catch (error: any) {
            // Handle errors from Firebase signup
            console.error("Error during signup:", error);
            setFormErrors(prevErrors => ({ ...prevErrors, firebase: error.message }));
        }
  };

  const handleTimeSlotChange = (day: string, timeOfDay: string, hour: number) => {
    const newPreferredPlayingTimes = { ...preferredPlayingTimes } as any; // Added type assertion

    if (!newPreferredPlayingTimes[day]) {
      newPreferredPlayingTimes[day] = {};
    }

    if (!newPreferredPlayingTimes[day][timeOfDay]) {
      newPreferredPlayingTimes[day][timeOfDay] = {};
    }

    newPreferredPlayingTimes[day][timeOfDay][hour] = !newPreferredPlayingTimes[day][timeOfDay][hour];

    setPreferredPlayingTimes(newPreferredPlayingTimes);
  };

  const toggleDayExpansion = (day: string) => {
    setExpandedDays(prev => ({ ...prev, [day]: !prev[day] }));
  };

  const timeSlots = {
    Monday: {
      Morning: Array.from({ length: 4 }, (_, i) => i + 8), // 8 AM - 11 AM
      Afternoon: Array.from({ length: 5 }, (_, i) => i + 12), // 12 PM - 4 PM
      Evening: Array.from({ length: 5 }, (_, i) => i + 17), // 5 PM - 9 PM
    },
    Tuesday: {
      Morning: Array.from({ length: 4 }, (_, i) => i + 8), // 8 AM - 11 AM
      Afternoon: Array.from({ length: 5 }, (_, i) => i + 12), // 12 PM - 4 PM
      Evening: Array.from({ length: 5 }, (_, i) => i + 17), // 5 PM - 9 PM
    },
    Wednesday: {
      Morning: Array.from({ length: 4 }, (_, i) => i + 8), // 8 AM - 11 AM
      Afternoon: Array.from({ length: 5 }, (_, i) => i + 12), // 12 PM - 4 PM
      Evening: Array.from({ length: 5 }, (_, i) => i + 17), // 5 PM - 9 PM
    },
    Thursday: {
      Morning: Array.from({ length: 4 }, (_, i) => i + 8), // 8 AM - 11 AM
      Afternoon: Array.from({ length: 5 }, (_, i) => i + 12), // 12 PM - 4 PM
      Evening: Array.from({ length: 5 }, (_, i) => i + 17), // 5 PM - 9 PM
    },
    Friday: {
      Morning: Array.from({ length: 4 }, (_, i) => i + 8), // 8 AM - 11 AM
      Afternoon: Array.from({ length: 5 }, (_, i) => i + 12), // 12 PM - 4 PM
      Evening: Array.from({ length: 5 }, (_, i) => i + 17), // 5 PM - 9 PM
    },
    Saturday: {
      Morning: Array.from({ length: 4 }, (_, i) => i + 8), // 8 AM - 11 AM
      Afternoon: Array.from({ length: 5 }, (_, i) => i + 12), // 12 PM - 4 PM
      Evening: Array.from({ length: 4 }, (_, i) => i + 17), // 5 PM - 8 PM
    },
    Sunday: {
      Morning: Array.from({ length: 4 }, (_, i) => i + 8), // 8 AM - 11 AM
      Afternoon: Array.from({ length: 5 }, (_, i) => i + 12), // 12 PM - 4 PM
      Evening: Array.from({ length: 3 }, (_, i) => i + 17), // 5 PM - 7 PM
    },
  };

  const ntrpLevels = ['1.0', '1.5', '2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0', '5.5', '6.0', '6.5', '7.0'];

  return (
    <div className="flex justify-center items-center min-h-screen bg-background-light-gray py-12">
      <Card className="w-full max-w-3xl shadow-md rounded-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary">Registration (Step 1 of 2)</CardTitle>
          <CardDescription>Create your profile to find the perfect match.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleNext} className="space-y-4">

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                type="email"
                id="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {formErrors.email && (
                <p className="text-red-500 text-sm">{formErrors.email}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                type="password"
                id="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {formErrors.password && (
                <p className="text-red-500 text-sm">{formErrors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                type="password"
                id="confirmPassword"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {formErrors.confirmPassword && (
                <p className="text-red-500 text-sm">{formErrors.confirmPassword}</p>
              )}
            </div>

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
              <Select onValueChange={setSportPreference} value={sportPreference}>
                <SelectTrigger id="sportPreference">
                  <SelectValue placeholder="Select"/>
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
            <div>
              <Label htmlFor="age">Age</Label>
              <Input
                type="number"
                id="age"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Enter your age"
              />
              {formErrors.age && <p className="text-red-500 text-sm">{formErrors.age}</p>}
            </div>

            {/* Skill Level Section */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Label htmlFor="skillLevel">Skill Level (NTRP)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-5 w-5"><Icons.help className="h-4 w-4"/></Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <Image
                      src="/ntrp-skill-levels.png"
                      alt="NTRP Skill Levels"
                      width={300}
                      height={400}
                      objectFit="contain"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <Select onValueChange={setSkillLevel} value={skillLevel}>
                <SelectTrigger id="skillLevel">
                  <SelectValue placeholder="Select your NTRP level"/>
                </SelectTrigger>
                <SelectContent>
                  {ntrpLevels.map(level => (
                    <SelectItem key={level} value={level}>{level}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.skillLevel && <p className="text-red-500 text-sm">{formErrors.skillLevel}</p>}
            </div>

            {/* Gender */}
            <div>
              <Label htmlFor="gender">Gender</Label>
              <Select onValueChange={setGender} value={gender}>
                <SelectTrigger id="gender">
                  <SelectValue placeholder="Select"/>
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
            <div>
              <Label htmlFor="typeOfPlayer">Type of Player</Label>
              <Select onValueChange={setTypeOfPlayer} value={typeOfPlayer}>
                <SelectTrigger id="typeOfPlayer">
                  <SelectValue placeholder="Select"/>
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
            <div>
              <Label>Preferred Playing Days/Times</Label>
              <div >
              {Object.entries(timeSlots).map(([day, timesOfDay]) => (
                <div key={day} className="mb-4">
                  <div className="flex items-center cursor-pointer" onClick={() => toggleDayExpansion(day)}>
                    <h3 className="font-semibold mr-2">{day}</h3>
                    <Icons.chevronDown className={cn("h-4 w-4 transition-transform", expandedDays[day] && "rotate-180")}/>
                  </div>
                  {expandedDays[day] && (
                    <div>
                      {Object.entries(timesOfDay).map(([timeOfDay, hours]) => (
                        <div key={timeOfDay} className="mb-2">
                          <h4>{timeOfDay}</h4>
                          <div className="flex flex-wrap gap-2">
                            {(hours as number[]).map(hour => (
                              <label key={hour} className="flex items-center cursor-pointer">
                                <Checkbox
                                  checked={(preferredPlayingTimes as any)[day]?.[timeOfDay]?.[hour] || false}
                                  onCheckedChange={() => handleTimeSlotChange(day, timeOfDay, hour)}
                                />
                                <span className="ml-1 text-sm">
                                  {hour > 12 ? `${hour - 12} PM` : hour === 0 ? `12 AM` : hour === 12 ? `12 PM` : `${hour} AM`}
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
               {formErrors.preferredPlayingTimes && <p className="text-red-500 text-sm">{formErrors.preferredPlayingTimes}</p>}
            </div>

            {/* How Often They Play */}
            <div>
              <Label htmlFor="howOftenTheyPlay">How Often Do You Play?</Label>
              <Select onValueChange={setHowOftenTheyPlay} value={howOftenTheyPlay}>
                <SelectTrigger id="howOftenTheyPlay">
                  <SelectValue placeholder="Select"/>
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
            <div>
              <Label htmlFor="gameType">Game Type</Label>
              <Select onValueChange={setGameType} value={gameType}>
                <SelectTrigger id="gameType">
                  <SelectValue placeholder="Select"/>
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
             <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="(Optional) Any additional info you would like to share"
                value={playingStyle} // Keep using playingStyle state for notes
                onChange={(e) => setPlayingStyle(e.target.value)}
              />
            </div>

            {/* Phone Number (Updated) */}
            <div>
              <Label htmlFor="contactDetails">Phone Number</Label> {/* Changed Label */}
              {/* Changed placeholder */}
              <Input
                type="text"
                id="contactDetails"
                value={contactDetails}
                onChange={(e) => setContactDetails(e.target.value)}
                placeholder="Enter your phone number"
              />
              {formErrors.contactDetails && <p className="text-red-500 text-sm">{formErrors.contactDetails}</p>} {/* Error message will now say 'Phone Number is required' */}
            </div>

            {/* Navigation Button */}
            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/80">
              Next
            </Button>
                {formErrors.firebase && (
                    <p className="text-red-500 text-sm">{formErrors.firebase}</p>
                )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
