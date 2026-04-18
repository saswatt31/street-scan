/**
 * GET    /api/admin/users/[id]  — user detail
 * PATCH  /api/admin/users/[id]  — update role, zone, is_active
 * DELETE /api/admin/users/[id]  — deactivate
 */
import { NextRequest } from 'next/server';
import { withAuth, ok, badRequest, notFound, serverError } from '@/lib/middleware/auth';
import { getServiceClient } from '@/lib/db';
import type { AuthContext } from '@/lib/middleware/auth';

type Params = { params: { id: string } };

export const GET = withAuth(async (_req: NextRequest, _ctx: AuthContext, { params }: Params) => {
  try {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from('users')
      .select('id,email,full_name,role,zone,phone,is_active,last_login_at,created_at,metadata')
      .eq('id', params.id)
      .single();
    if (error || !data) return notFound('User not found');
    return ok({ user: data });
  } catch (e) {
    return serverError(e);
  }
}, ['admin']);

export const PATCH = withAuth(
  async (req: NextRequest, ctx: AuthContext, { params }: Params) => {
    try {
      // Prevent admin from demoting themselves
      if (params.id === ctx.user.id) return badRequest('Cannot modify your own account via admin endpoint');

      const body    = await req.json();
      const allowed = ['role', 'zone', 'is_active', 'full_name', 'phone'];
      const updates: Record<string, unknown> = {};
      for (const k of allowed) { if (body[k] !== undefined) updates[k] = body[k]; }
      if (!Object.keys(updates).length) return badRequest('Nothing to update');

      const validRoles = ['citizen', 'admin', 'repair_team', 'iot_device'];
      if (updates.role && !validRoles.includes(updates.role as string)) {
        return badRequest(`role must be one of: ${validRoles.join(', ')}`);
      }

      const sb = getServiceClient();
      const { data, error } = await sb.from('users').update(updates).eq('id', params.id).select().single();
      if (error || !data) return notFound('User not found');

      // Also update Supabase Auth metadata if role changed
      if (updates.role) {
        await sb.auth.admin.updateUserById(params.id, {
          user_metadata: { role: updates.role },
        });
      }

      return ok({ user: data });
    } catch (e) {
      return serverError(e);
    }
  },
  ['admin'],
);

export const DELETE = withAuth(
  async (_req: NextRequest, ctx: AuthContext, { params }: Params) => {
    try {
      if (params.id === ctx.user.id) return badRequest('Cannot deactivate your own account');
      const { error } = await getServiceClient()
        .from('users').update({ is_active: false }).eq('id', params.id);
      if (error) throw error;
      return ok({ message: 'User deactivated' });
    } catch (e) {
      return serverError(e);
    }
  },
  ['admin'],
);
