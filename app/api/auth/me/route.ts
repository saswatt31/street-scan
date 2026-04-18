import { NextRequest } from 'next/server';
import { withAuth, ok } from '@/lib/middleware/auth';
import type { AuthContext } from '@/lib/middleware/auth';

export const GET = withAuth(async (_req: NextRequest, ctx: AuthContext) => {
  return ok({ user: { ...ctx.user, device_key: undefined } });
});

// PATCH — update own profile
export const PATCH = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const { getServiceClient } = await import('@/lib/db');
  const { badRequest, serverError } = await import('@/lib/middleware/auth');
  const sb = getServiceClient();

  try {
    const body = await req.json();
    const allowed = ['full_name', 'phone', 'avatar_url'];
    const updates: Record<string, unknown> = {};
    for (const k of allowed) { if (body[k] !== undefined) updates[k] = body[k]; }

    if (!Object.keys(updates).length) return badRequest('No updatable fields provided');

    const { data, error } = await sb.from('users').update(updates).eq('id', ctx.user.id).select().single();
    if (error) throw error;

    return ok({ user: data });
  } catch (e) {
    return serverError(e);
  }
});
