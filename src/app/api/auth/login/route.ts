import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { getConfig } from '@/lib/config';
import { cookies } from 'next/headers';
import { UserConfig } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const { username, password, autoLogin } = await request.json();
    const config = getConfig();

    const user = (config.users || []).find(
      (u: UserConfig) => u.username === username && u.password === password
    );

    if (user) {
      const secretKey = new TextEncoder().encode(config.jwtSecret || 'CHANGE_ME_TO_A_LONG_RANDOM_STRING');
      const expirationTime = autoLogin ? '365d' : '24h';
      const maxAge = autoLogin ? 60 * 60 * 24 * 365 : 60 * 60 * 24;

      const token = await new SignJWT({ username: user.username })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime(expirationTime)
        .sign(secretKey);

      const response = NextResponse.json({ success: true });
      response.headers.set(
        'Set-Cookie',
        `token=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax`
      );

      return response;
    }

    return NextResponse.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
