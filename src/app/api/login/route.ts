import { NextResponse } from 'next/server';
import { login } from '@/db/sqlite-data'; // Assuming login function exists in sqlite-data

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const user = await login(email, password); // Use your SQLite login function

    if (user) {
      // You might want to return a token or other user information here
      return NextResponse.json({ success: true, user: { email: user.email } }, { status: 200 });
    } else {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}