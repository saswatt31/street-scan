/**
 * GET   /api/notifications         — user's notifications
 * PATCH /api/notifications         — mark as read
 * GET   /api/notifications?count=1 — unread count only
 */
import { NextRequest } from 'next/server';
import { withAuth, ok, badRequest, serverError, paginate } from '@/lib/middleware/auth';
import { getServiceClient } from '@/lib/db';
import { markRead }         from '@/lib/services/notifications';
import type { AuthContext } from '@/lib/middleware/auth';

export const GET = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const sb           = getServiceClient();
    const sp           = new URL(req.url).searchParams;
    const countOnly    = sp.get('count') === '1';
    const unreadOnly   = sp.get('unread') === 'true';

    if (countOnly) {
      const { count } = await sb
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', ctx.user.id)
        .eq('is_read', false);
      return ok({ unread: count ?? 0 });
    }

    const { from, to } = paginate(req);
    let q = sb.from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', ctx.user.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (unreadOnly) q = q.eq('is_read', false);

    const { data, error, count } = await q;
    if (error) throw error;

    return ok({ notifications: data, total: count });
  } catch (e) {
    return serverError(e);
  }
});

// PATCH — mark notifications as read
export const PATCH = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const body = await req.json();
    const { ids, all } = body;

    const sb = getServiceClient();

    if (all) {
      await sb.from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', ctx.user.id)
        .eq('is_read', false);
    } else if (Array.isArray(ids) && ids.length > 0) {
      await markRead(ctx.user.id, ids);
    } else {
      return badRequest('Provide ids array or all:true');
    }

    return ok({ message: 'Marked as read' });
  } catch (e) {
    return serverError(e);
  }
});
