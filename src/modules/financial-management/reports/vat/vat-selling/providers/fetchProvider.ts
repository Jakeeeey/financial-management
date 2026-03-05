// src/modules/financial-management/reports/vat/vat-selling/providers/fetchProvider.ts

import { cookies } from 'next/headers';

const COOKIE_KEY = 'springboot_token';

export async function getToken(request?: any): Promise<string | null> {
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

export function setToken(response: any, token: string) {
  response.cookies.set(COOKIE_KEY, token, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24, // 1 day
  });
}