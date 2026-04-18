// app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ok } from '@/lib/middleware/auth';

export async function POST(_req: NextRequest) {
  const res = ok({ message: 'Logged out' });
  res.cookies.set('sb-access-token', '', { maxAge: 0, path: '/' });
  return res;
}
