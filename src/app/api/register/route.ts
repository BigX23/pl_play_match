
import { signUp } from "../../../auth/sqlite-auth";
import { NextResponse } from 'next/server';
import { createUserProfile } from "../../../db/sqlite-data";

export async function POST(request: Request) {
  const { email, password, sportPreference, age, skillLevel, gender, typeOfPlayer, preferredPlayingTimes, howOftenTheyPlay, gameType, notes, phoneNumber } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
  }

  try {
    // Create the user using the signUp function from sqlite-auth
    const userId = await signUp(email, password);

    // Create the user profile
    await createUserProfile({
      email, // Pass the email for the profile
      sportPreference,
      age,
      skillLevel,
      gender,
      typeOfPlayer,
      preferredPlayingTimes: typeof preferredPlayingTimes === 'object' ? JSON.stringify(preferredPlayingTimes) : preferredPlayingTimes,
      howOftenTheyPlay,
      gameType,
      notes,
      phoneNumber,
    });

    return NextResponse.json({ message: 'User and profile created successfully', userId }, { status: 200 });
  } catch (error: any) {
    console.error('Registration error:', error);
    // Check for specific errors like unique constraint violation for email
    if (error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ message: 'User with this email already exists' }, { status: 400 });
    }
    return NextResponse.json({ message: 'Error registering user', error: error.message }, { status: 500 });
  }
}

