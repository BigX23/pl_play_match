import { NextResponse } from 'next/server';
import { getSessionById, getUserById, getUserProfileByUserId } from '@/db/sqlite-data'; // Import getUserProfileByUserId
import { cookies } from 'next/headers'; // Use next/headers for cookie access in Route Handlers

export async function GET(request: Request) {
  const cookieStore = cookies();
  const sessionIdCookie = cookieStore.get('session_id');

  if (!sessionIdCookie || !sessionIdCookie.value) {
    return NextResponse.json({ error: 'Unauthorized: No session cookie' }, { status: 401 });
  }

  const sessionId = sessionIdCookie.value;

  try {
    const session = await getSessionById(sessionId);

    if (!session || new Date(session.expiresAt) < new Date()) {
      // If session doesn't exist or is expired, clear the cookie and return unauthorized
      const response = NextResponse.json({ error: 'Unauthorized: Invalid or expired session' }, { status: 401 });
      response.cookies.set('session_id', '', { httpOnly: true, path: '/', maxAge: 0 }); // Clear cookie
      return response;
    }

    // Session is valid, fetch user data (user basic info + profile)
    const user = await getUserById(session.userId);

    if (!user) {
        // This case should ideally not happen if session.userId is valid and DB is consistent
        const response = NextResponse.json({ error: 'User not found for session' }, { status: 404 });
        // Clear potentially problematic cookie
        response.cookies.set('session_id', '', { httpOnly: true, path: '/', maxAge: 0 });
        return response;
    }

    const userProfile = await getUserProfileByUserId(session.userId); // Use userId here

    // Note: userProfile can be undefined if the profile hasn't been created yet, which is valid.
    // So, no specific error for !userProfile unless your logic requires a profile to always exist post-registration.

    // Combine user and profile data.
    const userData = {
      id: user.id,
      email: user.email,
      profile: userProfile // This will be the profile object or undefined
    };

    return NextResponse.json({ user: userData }, { status: 200 });
  } catch (error: any) {
    console.error('Profile fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}