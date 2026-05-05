import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getServiceClient } from '../db';

export type UserRole = 'admin' | 'repair_team' | 'citizen';

export interface AuthContext {
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
}

/**
 * Standard Success Response (200 OK)
 */
export function ok(data: any) {
  return NextResponse.json(data, { status: 200 });
}

/**
 * Created Response (201 Created)
 */
export function created(data: any) {
  return NextResponse.json(data, { status: 201 });
}

/**
 * Bad Request (400)
 */
export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * Unauthorized (401)
 */
export function unauthorized(message: string = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * Forbidden (403)
 */
export function forbidden(message: string = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 });
}

/**
 * Not Found (404)
 */
export function notFound(message: string = 'Not Found') {
  return NextResponse.json({ error: message }, { status: 404 });
}

/**
 * Server Error (500)
 */
export function serverError(error: any) {
  console.error('[API Error]', error);
  return NextResponse.json(
    { error: 'Internal Server Error', details: error?.message || error },
    { status: 500 }
  );
}

/**
 * Extract pagination params from request
 */
export function paginate(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const page = Math.max(1, Number(sp.get('page') || 1));
  const limit = Math.max(1, Math.min(100, Number(sp.get('limit') || 20)));
  return {
    from: (page - 1) * limit,
    to: page * limit - 1,
    page,
    limit,
  };
}

/**
 * Higher Order Function to protect routes with Supabase Auth + RBAC
 */
export function withAuth(
  handler: (req: NextRequest, ctx: AuthContext, ...args: any[]) => Promise<NextResponse>,
  allowedRoles?: UserRole[]
) {
  return async (req: NextRequest, ...args: any[]) => {
    // Initialize Supabase Client
    let supabaseResponse = NextResponse.next({ request: req });
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return req.cookies.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
            supabaseResponse = NextResponse.next({ request: req });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return unauthorized();

    // Fetch Role from our 'users' table
    const sbAdmin = getServiceClient();
    const { data: profile } = await sbAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role as UserRole || 'citizen';

    if (allowedRoles && !allowedRoles.includes(role)) {
      return forbidden('Insufficient permissions');
    }

    const ctx: AuthContext = {
      user: {
        id: user.id,
        email: user.email!,
        role,
      },
    };

    return handler(req, ctx, ...args);
  };
}

/**
 * Authenticate IoT devices via X-Api-Key
 */
export async function authenticateDevice(req: NextRequest) {
  const apiKey = req.headers.get('X-Api-Key');
  if (!apiKey) return null;

  const sb = getServiceClient();
  const { data: device, error } = await sb
    .from('devices')
    .select('*')
    .eq('device_key', apiKey)
    .single();

  if (error || !device) return null;

  return { device };
}
