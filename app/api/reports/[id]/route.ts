/**
 * GET    /api/reports/[id]  — report detail
 * PATCH  /api/reports/[id]  — update status / notes (admin only)
 * DELETE /api/reports/[id]  — soft-delete (admin only)
 */
import { NextRequest } from 'next/server';
import { withAuth, ok, badRequest, notFound, serverError } from '@/lib/middleware/auth';
import { getServiceClient } from '@/lib/db';
import type { AuthContext } from '@/lib/middleware/auth';

type Params = { params: { id: string } };

// ── GET ──────────────────────────────────────────────────────────
export const GET = withAuth(async (_req: NextRequest, ctx: AuthContext, { params }: Params) => {
  try {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from('reports')
      .select(`
        *,
        clusters ( id, report_count, severity, severity_score, first_seen_at, last_seen_at ),
        tickets  ( id, ticket_number, status, priority, assigned_team, assigned_to, created_at )
      `)
      .eq('id', params.id)
      .single();

    if (error || !data) return notFound('Report not found');

    // Citizens can only view their own
    if (ctx.user.role === 'citizen' && data.reporter_id !== ctx.user.id) {
      return notFound('Report not found');
    }

    return ok({ report: data });
  } catch (e) {
    return serverError(e);
  }
});

// ── PATCH ────────────────────────────────────────────────────────
export const PATCH = withAuth(
  async (req: NextRequest, _ctx: AuthContext, { params }: Params) => {
    try {
      const sb   = getServiceClient();
      const body = await req.json();

      const allowed = ['status', 'severity', 'description', 'ai_notes', 'ai_validated', 'damage_type'];
      const updates: Record<string, unknown> = {};
      for (const k of allowed) {
        if (body[k] !== undefined) updates[k] = body[k];
      }
      if (!Object.keys(updates).length) return badRequest('No updatable fields');

      const { data, error } = await sb.from('reports').update(updates).eq('id', params.id).select().single();
      if (error || !data) return notFound('Report not found');

      return ok({ report: data });
    } catch (e) {
      return serverError(e);
    }
  },
  ['admin', 'repair_team'],
);

// ── DELETE (mark rejected) ───────────────────────────────────────
export const DELETE = withAuth(
  async (_req: NextRequest, _ctx: AuthContext, { params }: Params) => {
    try {
      const sb = getServiceClient();
      const { error } = await sb.from('reports').update({ status: 'rejected' }).eq('id', params.id);
      if (error) throw error;
      return ok({ message: 'Report rejected' });
    } catch (e) {
      return serverError(e);
    }
  },
  ['admin'],
);
