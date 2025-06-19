import { NextResponse } from 'next/server';
import { signIn } from '/workspace/pleasanton-playmatch/src/auth/sqlite-auth'; // Corrected import
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const user = await signIn(email, password);

    if (user) {
      // Generate a session ID
      const sessionId = crypto.randomBytes(16).toString('hex');

      // Set the session ID in an httpOnly cookie
      const response = NextResponse.json({ success: true, user: { email: user.email } }, { status: 200 });
      response.cookies.set('session_id', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Use secure cookie in production
      });
      return response;
    }

  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: error.message === 'Invalid credentials' ? 401 : 500 });
  }
}