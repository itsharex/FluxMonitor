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

      const isHttps = request.headers.get('x-forwarded-proto') === 'https' || request.url.startsWith('https://');

      const cookieStore = await cookies();
      cookieStore.set('token', token, {
        httpOnly: true,
        secure: isHttps,
        sameSite: 'lax',
        maxAge: maxAge,
        path: '/',
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
