import { NextResponse } from 'next/server';
import { deleteSessionById } from '@/db/sqlite-data';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const cookieStore = cookies();
  const sessionIdCookie = cookieStore.get('session_id');

  if (sessionIdCookie && sessionIdCookie.value) {
    const sessionId = sessionIdCookie.value;
    try {
      await deleteSessionById(sessionId);
    } catch (error: any) {
      // Log error but proceed to clear cookie anyway
      console.error('Error deleting session from DB:', error);
    }
  }

  // Always attempt to clear the cookie
  const response = NextResponse.json({ message: 'Logged out successfully' }, { status: 200 });
  response.cookies.set('session_id', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0, // Expire the cookie immediately
  });

  return response;
}
