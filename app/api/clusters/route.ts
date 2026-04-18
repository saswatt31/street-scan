/**
 * GET /api/clusters          — list active damage clusters / hotspots
 * GET /api/clusters/[id]     — cluster detail with all member reports
 */
import { NextRequest } from 'next/server';
import { withAuth, ok, notFound, serverError, paginate } from '@/lib/middleware/auth';
import { getServiceClient } from '@/lib/db';
import type { AuthContext } from '@/lib/middleware/auth';

export const GET = withAuth(async (req: NextRequest, _ctx: AuthContext) => {
  try {
    const sb           = getServiceClient();
    const { from, to } = paginate(req);
    const sp           = new URL(req.url).searchParams;
    const severity     = sp.get('severity');
    const damageType   = sp.get('damage_type');
    const minCount     = sp.get('min_count');
    const hasTicket    = sp.get('has_ticket');

    let q = sb.from('clusters')
      .select(`
        *,
        tickets ( id, ticket_number, status, priority, assigned_team )
      `, { count: 'exact' })
      .eq('is_active', true)
      .order('severity_score', { ascending: false })
      .order('report_count',   { ascending: false })
      .range(from, to);

    if (severity)   q = q.eq('severity', severity);
    if (damageType) q = q.eq('damage_type', damageType);
    if (minCount)   q = q.gte('report_count', parseInt(minCount));
    if (hasTicket === 'true')  q = q.not('ticket_id', 'is', null);
    if (hasTicket === 'false') q = q.is('ticket_id', null);

    const { data, error, count } = await q;
    if (error) throw error;

    return ok({ clusters: data, total: count });
  } catch (e) {
    return serverError(e);
  }
}, ['admin', 'repair_team']);
