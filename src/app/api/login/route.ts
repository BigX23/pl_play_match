import { NextResponse } from 'next/server';
import { signIn } from '@/auth/sqlite-auth';
import { createSession } from '@/db/sqlite-data'; // Import createSession
import crypto from 'crypto';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const user = await signIn(email, password);

    if (user && user.id) { // Ensure user and user.id exist
      const sessionId = crypto.randomBytes(32).toString('hex'); // Increased session ID length

      // Store session in database
      await createSession(sessionId, user.id, user.email, SESSION_DURATION_MS);

      const response = NextResponse.json({ success: true, user: { id: user.id, email: user.email } }, { status: 200 });
      response.cookies.set('session_id', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/', // Important for cookie visibility
        maxAge: SESSION_DURATION_MS / 1000, // maxAge is in seconds
      });
      return response;
    } else {
      return NextResponse.json({ error: 'Invalid credentials or user ID missing' }, { status: 401 });
    }
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: error.message === 'Invalid credentials' ? 401 : 500 });
  }
}