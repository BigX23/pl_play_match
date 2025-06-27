
import { signUp } from "../../../auth/sqlite-auth";
import { NextResponse } from 'next/server';
import { createUserProfile, createSession } from "../../../db/sqlite-data"; // Added createSession
import crypto from 'crypto'; // For generating session ID

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function POST(request: Request) {
  const { email, password, sportPreference, age, skillLevel, gender, typeOfPlayer, preferredPlayingTimes, howOftenTheyPlay, gameType, notes, phoneNumber } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
  }

  try {
    // Create the user using the signUp function from sqlite-auth
    // signUp now returns { id: number, email: string }
    const registeredUser = await signUp(email, password);

    if (!registeredUser || !registeredUser.id) {
      throw new Error("User registration failed to return user ID.");
    }

    // Create the user profile
    await createUserProfile({
      user_id: registeredUser.id, // Add user_id here
      email: registeredUser.email,
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

    // Automatically log in the user by creating a session
    const sessionId = crypto.randomBytes(32).toString('hex');
    await createSession(sessionId, registeredUser.id, registeredUser.email, SESSION_DURATION_MS);

    const response = NextResponse.json({
      message: 'User and profile created successfully. User logged in.',
      user: { id: registeredUser.id, email: registeredUser.email }
    }, { status: 200 });

    response.cookies.set('session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_DURATION_MS / 1000,
    });

    return response;
  } catch (error: any) {
    console.error('Registration error:', error);
    // Check for specific errors like unique constraint violation for email
    if (error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ message: 'User with this email already exists' }, { status: 400 });
    }
    return NextResponse.json({ message: 'Error registering user', error: error.message }, { status: 500 });
  }
}

