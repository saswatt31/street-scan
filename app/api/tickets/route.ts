/**
 * GET  /api/tickets  — paginated list with filters
 * POST /api/tickets  — manually create a ticket (admin)
 */
import { NextRequest } from 'next/server';
import { withAuth, ok, created, badRequest, serverError, paginate } from '@/lib/middleware/auth';
import { getServiceClient } from '@/lib/db';
import { createTicketFromReport } from '@/lib/services/tickets';
import type { AuthContext } from '@/lib/middleware/auth';

export const GET = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const sb           = getServiceClient();
    const { from, to } = paginate(req);
    const sp           = new URL(req.url).searchParams;

    let q = sb.from('tickets')
      .select(`
        *,
        reports ( id, latitude, longitude, damage_type, source, image_url, recurrence_count ),
        users   ( id, full_name, email )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    const status   = sp.get('status');
    const priority = sp.get('priority');
    const team     = sp.get('team');
    const assignedTo = sp.get('assigned_to');
    const breached = sp.get('sla_breached');

    if (status)   q = q.eq('status', status);
    if (priority) q = q.eq('priority', priority);
    if (team)     q = q.eq('assigned_team', team);
    if (assignedTo) q = q.eq('assigned_to', assignedTo);
    if (breached)   q = q.eq('sla_breached', breached === 'true');

    // Repair team: only see their assigned tickets
    if (ctx.user.role === 'repair_team') {
      q = q.eq('assigned_to', ctx.user.id);
    }

    const { data, error, count } = await q;
    if (error) throw error;
    return ok({ tickets: data, total: count });
  } catch (e) {
    return serverError(e);
  }
}, ['admin', 'repair_team']);

export const POST = withAuth(async (req: NextRequest, _ctx: AuthContext) => {
  try {
    const body = await req.json();
    const { report_id } = body;
    if (!report_id) return badRequest('report_id is required');

    const sb = getServiceClient();
    const { data: report, error } = await sb.from('reports').select('*').eq('id', report_id).single();
    if (error || !report) return badRequest('Report not found');

    const ticket = await createTicketFromReport(report);
    return created({ ticket });
  } catch (e) {
    return serverError(e);
  }
}, ['admin']);
