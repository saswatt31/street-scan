/**
 * GET   /api/admin/users         — list all users
 * POST  /api/admin/users         — create user with any role (admin bypass)
 * PATCH /api/admin/users/[id]    — update role, zone, activate/deactivate
 */
import { NextRequest } from 'next/server';
import { withAuth, ok, created, badRequest, notFound, serverError, paginate } from '@/lib/middleware/auth';
import { getServiceClient } from '@/lib/db';
import type { AuthContext } from '@/lib/middleware/auth';

// ── GET /api/admin/users ─────────────────────────────────────────
export const GET = withAuth(async (req: NextRequest, _ctx: AuthContext) => {
  try {
    const sb           = getServiceClient();
    const { from, to } = paginate(req);
    const sp           = new URL(req.url).searchParams;
    const role         = sp.get('role');
    const search       = sp.get('search');
    const zone         = sp.get('zone');

    let q = sb.from('users')
      .select('id,email,full_name,role,zone,is_active,last_login_at,created_at,phone', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (role)   q = q.eq('role', role);
    if (zone)   q = q.eq('zone', zone);
    if (search) q = q.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);

    const { data, error, count } = await q;
    if (error) throw error;
    return ok({ users: data, total: count });
  } catch (e) {
    return serverError(e);
  }
}, ['admin']);

// ── POST /api/admin/users ────────────────────────────────────────
export const POST = withAuth(async (req: NextRequest, _ctx: AuthContext) => {
  try {
    const sb   = getServiceClient();
    const body = await req.json();
    const { email, password, full_name, role, zone, phone } = body;

    if (!email || !password || !role) return badRequest('email, password, role are required');
    const validRoles = ['citizen', 'admin', 'repair_team', 'iot_device'];
    if (!validRoles.includes(role)) return badRequest(`role must be one of: ${validRoles.join(', ')}`);

    const { data, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role, phone, zone },
    });
    if (error) {
      if (error.message.includes('already registered')) return badRequest('Email already in use');
      throw error;
    }

    if (zone || phone) {
      await sb.from('users').update({ zone: zone ?? null, phone: phone ?? null }).eq('id', data.user.id);
    }

    const { data: profile } = await sb.from('users').select('*').eq('id', data.user.id).single();
    return created({ user: profile });
  } catch (e) {
    return serverError(e);
  }
}, ['admin']);
