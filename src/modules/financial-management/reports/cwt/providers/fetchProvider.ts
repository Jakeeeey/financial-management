import { cookies } from 'next/headers';

const COOKIE_KEY = 'springboot_token';

export async function getToken(request?: { cookies: { get: (name: string) => { value: string } | undefined } }): Promise<string | null> {
  // Try to get token from cookies
  if (request && request.cookies) {
    return request.cookies.get(COOKIE_KEY)?.value || null;
  }
  try {
    return (await cookies()).get(COOKIE_KEY)?.value || null;
  } catch {
    return null;
  }
}

export function setToken(response: { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } }, token: string) {
  response.cookies.set(COOKIE_KEY, token, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24, // 1 day
  });
}