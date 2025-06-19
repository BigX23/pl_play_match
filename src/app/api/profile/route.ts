import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const cookieHeader = request.headers.get('Cookie');
  const cookies = cookieHeader ? cookieHeader.split('; ').reduce((acc, cookie) => {
    const [name, value] = cookie.split('=');
    acc[name] = value;
    return acc;
  }, {} as Record<string, string>) : {};

  const sessionId = cookies['session_id'];

  if (sessionId) {
    // In a real application, you would validate the sessionId against your database here
    // and fetch the actual user data associated with the session.
    return NextResponse.json({ user: { email: 'test@example.com' } }, { status: 200 });
  } else {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}