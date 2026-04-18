/**
 * POST /api/auth/refresh
 * Exchange a refresh_token for a new access_token
 */
import { NextRequest } from 'next/server';
import { getServiceClient } from '@/lib/db';
import { ok, badRequest, unauthorized, serverError } from '@/lib/middleware/auth';

export async function POST(req: NextRequest) {
  try {
    const { refresh_token } = await req.json();
    if (!refresh_token) return badRequest('refresh_token is required');

    const sb = getServiceClient();
    const { data, error } = await sb.auth.refreshSession({ refresh_token });
    if (error || !data.session) return unauthorized('Invalid or expired refresh token');

    const { session } = data;

    const response = ok({
      access_token:  session.access_token,
      refresh_token: session.refresh_token,
      expires_at:    session.expires_at,
    });

    response.cookies.set('sb-access-token', session.access_token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   session.expires_in,
      path:     '/',
    });

    return response;
  } catch (e) {
    return serverError(e);
  }
}
