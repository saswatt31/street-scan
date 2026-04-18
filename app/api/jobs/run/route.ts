/**
 * POST /api/jobs/run
 * Processes pending background jobs.
 * In production: call this from a cron job (Vercel Cron, pg_cron, etc.)
 * Protected by a shared secret header so it can't be triggered publicly.
 *
 * GET /api/jobs/run  — view pending job queue (admin)
 */
import { NextRequest } from 'next/server';
import { withAuth, ok, unauthorized, serverError } from '@/lib/middleware/auth';
import { getServiceClient } from '@/lib/db';
import { processPendingJobs } from '@/lib/services/jobs';
import { checkSlaBreaches }   from '@/lib/services/tickets';
import type { AuthContext }   from '@/lib/middleware/auth';

// Cron-style runner — secured by shared secret
export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-cron-secret');
    if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV === 'production') {
      return unauthorized('Invalid cron secret');
    }

    const [jobsProcessed, slaBreaches] = await Promise.all([
      processPendingJobs(50),
      checkSlaBreaches(),
    ]);

    return ok({ jobs_processed: jobsProcessed, sla_breaches_flagged: slaBreaches });
  } catch (e) {
    return serverError(e);
  }
}

// Admin: view job queue status
export const GET = withAuth(async (req: NextRequest, _ctx: AuthContext) => {
  try {
    const sb = getServiceClient();
    const sp = new URL(req.url).searchParams;
    const status = sp.get('status') ?? 'pending';

    const { data, error } = await sb
      .from('jobs')
      .select('id,type,status,attempts,max_attempts,error,run_after,created_at,completed_at')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Summary counts
    const { data: counts } = await sb.rpc('jobs_summary').select('*').single()
      .then(r => r)
      .catch(() => ({ data: null }));

    return ok({ jobs: data, summary: counts });
  } catch (e) {
    return serverError(e);
  }
}, ['admin']);
