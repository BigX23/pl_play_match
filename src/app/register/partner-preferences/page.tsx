"use client";

import {useRouter} from 'next/navigation';
import {useState, useMemo, useEffect} from 'react';
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/firebase/init"; // Import the initialized auth instance

const ntrpLevels = ['1.0', '1.5', '2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0', '5.5', '6.0', '6.5', '7.0'];

const generateAgeOptions = (userAge: number): number[] => {
  const minAge = Math.max(18, userAge - 20);
  const maxAge = userAge + 20;
  const ages: number[] = [];
  for (let i = minAge; i <= maxAge; i++) {
    ages.push(i);
  }
  return ages;
};

export default function PartnerPreferencesPage() {
  const router = useRouter();
  // const auth = getAuth(); // No longer needed, using imported auth

  // --- State Management Placeholder ---
  // In a real app, get user data and userAge from context, Zustand, localStorage, etc.
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe(); // Cleanup subscription on unmount
  }, [auth, router]);

   if (!user) {
        return <div>Loading...</div>; // Or a more appropriate loading indicator
    }

  const userAge = 30; // Example: Fetched user age
  const userData = {
    sportPreference: 'Tennis',
    age: '30',
    skillLevel: '3.0',
    gender: 'Male',
    typeOfPlayer: 'Recreational',
    preferredPlayingTimes: {},
    howOftenTheyPlay: '2 - 5 times per month',
    gameType: 'Singles only',
    notes: 'Enjoys hitting',
    contactDetails: 'email',
    profilePicture: null,
  }
  // -----------------------------------

  const [partnerSkillLevels, setPartnerSkillLevels] = useState({
    min: '1.0',
    max: '7.0',
  });

    const initialMinAge = String(Math.max(18, userAge - 20));
    const initialMaxAge = String(userAge + 20);

    const [partnerGender, setPartnerGender] = useState('');
    const [partnerAgeRange, setPartnerAgeRange] = useState<{ min: string; max: string }>({ min: initialMinAge, max: initialMaxAge });
  const [formErrors, setFormErrors] = useState({
    partnerSkillLevels: '',
    partnerAgeRange: '',
  });

  const ageOptions = useMemo(() => generateAgeOptions(userAge), [userAge]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const errors = validateForm();
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      return; // Prevent form submission if there are errors
    }

    // TODO: Retrieve user profile data from previous step
    const partnerPreferencesData = {
      partnerSkillLevels,
      partnerGender,
      partnerAgeRange,
    };

    const registrationData = {
      ...userData,
      ...partnerPreferencesData,
    }

    console.log("Combined Registration Data:", registrationData);

    try {
      // Replace '/api/register' with your actual API endpoint
       const response = await fetch('/api/register', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
         },
         body: JSON.stringify(registrationData),
       });

      if (response.ok) {
        alert('Registration Complete!');
        // router.push('/success'); //Optional: Redirect to a success page
      } else {
        alert('Registration failed. Please try again.');
      }
    } catch (error) {
      console.error("Registration error:", error);
      alert('An error occurred during registration. Please try again later.');
    }
  };

  const validateForm = () => {
    const errors: any = {};

    const skillLevelMin = parseFloat(partnerSkillLevels.min);
    const skillLevelMax = parseFloat(partnerSkillLevels.max);
    if (skillLevelMax - skillLevelMin > 2.0) {
      errors.partnerSkillLevels = 'Skill Level range cannot exceed 2.0 NTRP levels.';
    }

    const ageMin = parseInt(partnerAgeRange.min, 10);
    const ageMax = parseInt(partnerAgeRange.max, 10);
    if (ageMax - ageMin > 25) {
      errors.partnerAgeRange = 'Age range cannot exceed 25 years.';
    }

    return errors;
  };

  const setMinSkillLevel = (min: string) => {
    setPartnerSkillLevels(prevState => {
      const newMax = parseFloat(min) > parseFloat(prevState.max) ? min : prevState.max;
      return {
        ...prevState,
        min: min,
        max: newMax,
      }
    });
  };

  const setMaxSkillLevel = (max: string) => {
    setPartnerSkillLevels(prevState => {
      const newMin = parseFloat(max) < parseFloat(prevState.min) ? max : prevState.min;
      return {
        ...prevState,
        max: max,
        min: newMin,
      }
    });
  };

    const setMinAge = (min: string) => {
        setPartnerAgeRange(prevState => {
            const newMax = parseInt(min) > parseInt(prevState.max) ? min : prevState.max;
            return {
                ...prevState,
                min: min,
                max: newMax,
            };
        });
    };

    const setMaxAge = (max: string) => {
        setPartnerAgeRange(prevState => {
            const newMin = parseInt(max) < parseInt(prevState.min) ? max : prevState.min;
            return {
                ...prevState,
                max: max,
                min: newMin,
            };
        });
    };

  return (
    <div className="flex justify-center items-center min-h-screen bg-background-light-gray py-12">
      <Card className="w-full max-w-3xl shadow-md rounded-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary">Registration (Step 2 of 2)</CardTitle>
          <CardDescription>Tell us about your ideal partner preferences.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Partner Skill Levels */}
            <div>
              <Label>Partner Skill Levels (NTRP)</Label>
              <div className="flex gap-4">
                <div>
                  <Label htmlFor="partnerSkillLevelsMin">Min:</Label>
                  <Select onValueChange={setMinSkillLevel} value={partnerSkillLevels.min}>
                    <SelectTrigger id="partnerSkillLevelsMin">
                      <SelectValue placeholder="Select Min" />
                    </SelectTrigger>
                    <SelectContent>
                      {ntrpLevels.map((level) => (
                        <SelectItem key={level} value={level}>
                          {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="partnerSkillLevelsMax">Max:</Label>
                  <Select onValueChange={setMaxSkillLevel} value={partnerSkillLevels.max}>
                    <SelectTrigger id="partnerSkillLevelsMax">
                      <SelectValue placeholder="Select Max" />
                    </SelectTrigger>
                    <SelectContent>
                      {ntrpLevels.map((level) => (
                        <SelectItem key={level} value={level}>
                          {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {formErrors.partnerSkillLevels && (<p className="text-red-500 text-sm">{formErrors.partnerSkillLevels}</p>)}
              <p className="text-sm text-muted-foreground mt-1">
                Selected NTRP Level Range: {partnerSkillLevels.min} - {partnerSkillLevels.max}
              </p>
            </div>

            {/* Partner Gender */}
            <div>
              <Label htmlFor="partnerGender">Partner Gender</Label>
              <Select onValueChange={setPartnerGender}>
                <SelectTrigger id="partnerGender">
                  <SelectValue placeholder="Select preferred partner gender"/>
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
           <Label>Partner Age Range</Label>
           <div className="flex gap-4">
             <div>
               <Label htmlFor="partnerAgeRangeMin">Min:</Label>
               <Select onValueChange={setMinAge} value={partnerAgeRange.min}>
                 <SelectTrigger id="partnerAgeRangeMin">
                   <SelectValue placeholder="Select Min" />
                 </SelectTrigger>
                 <SelectContent>
                   {ageOptions.map((age) => (
                     <SelectItem key={age} value={String(age)}> {age} </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
             <div>
               <Label htmlFor="partnerAgeRangeMax">Max:</Label>
               <Select onValueChange={setMaxAge} value={partnerAgeRange.max}>
                 <SelectTrigger id="partnerAgeRangeMax">
                   <SelectValue placeholder="Select Max" />
                 </SelectTrigger>
                 <SelectContent>
                   {ageOptions.map((age) => (
                     <SelectItem key={age} value={String(age)}> {age} </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
           </div>
            {formErrors.partnerAgeRange && (<p className="text-red-500 text-sm">{formErrors.partnerAgeRange}</p>)}
           <p className="text-sm text-muted-foreground mt-1">
             Selected Age Range: {partnerAgeRange.min} - {partnerAgeRange.max}
           </p>
         </div>

            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/80">
              Complete Registration
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
