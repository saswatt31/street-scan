/**
 * POST /api/iot  — single sensor event (device-key auth)
 * GET  /api/iot  — list recent events  (admin/repair_team)
 */
import { NextRequest } from 'next/server';
import { authenticateDevice, withAuth, ok, created, badRequest, unauthorized, serverError, paginate } from '@/lib/middleware/auth';
import { getServiceClient } from '@/lib/db';
import { analyzeVibration }  from '@/lib/services/ai';
import { queueJob }          from '@/lib/services/jobs';
import { haversineM }       from '@/lib/services/clustering';
import { ingestSingleEvent } from '@/lib/services/iot';
import type { AuthContext }  from '@/lib/middleware/auth';

export async function POST(req: NextRequest) {
  try {
    const deviceCtx = await authenticateDevice(req);
    if (!deviceCtx) return unauthorized('Invalid or missing API key');
    const { device } = deviceCtx;
    if (!device.is_active) return unauthorized('Device is disabled');
    const body   = await req.json();
    const result = await ingestSingleEvent(device, body);
    return created(result);
  } catch (e) {
    return serverError(e);
  }
}

export const GET = withAuth(async (req: NextRequest, _ctx: AuthContext) => {
  try {
    const sb           = getServiceClient();
    const { from, to } = paginate(req);
    const sp           = new URL(req.url).searchParams;
    const deviceId     = sp.get('device_id');
    const unprocessed  = sp.get('unprocessed') === 'true';

    let q = sb.from('iot_data').select('*, devices(id,name,type)', { count: 'exact' })
      .order('created_at', { ascending: false }).range(from, to);
    if (deviceId)    q = q.eq('device_id', deviceId);
    if (unprocessed) q = q.eq('processed', false);

    const { data, error, count } = await q;
    if (error) throw error;
    return ok({ events: data, total: count });
  } catch (e) {
    return serverError(e);
  }
}, ['admin', 'repair_team']);

