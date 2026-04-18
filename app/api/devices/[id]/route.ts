/**
 * GET    /api/devices/[id]             — device detail
 * PATCH  /api/devices/[id]             — update device
 * DELETE /api/devices/[id]             — deactivate device
 * POST   /api/devices/[id]/rotate-key  — regenerate API key
 */
import { NextRequest } from 'next/server';
import { withAuth, ok, notFound, badRequest, serverError } from '@/lib/middleware/auth';
import { getServiceClient } from '@/lib/db';
import type { AuthContext } from '@/lib/middleware/auth';

type Params = { params: { id: string } };

export const GET = withAuth(async (_req: NextRequest, ctx: AuthContext, { params }: Params) => {
  try {
    const sb = getServiceClient();
    let q = sb.from('devices')
      .select('*, iot_data(id,created_at,vibration_rms,event_type,threshold_exceeded,latitude,longitude)')
      .eq('id', params.id)
      .order('created_at', { referencedTable: 'iot_data', ascending: false })
      .limit(20, { referencedTable: 'iot_data' });

    const { data, error } = await q.single();
    if (error || !data) return notFound('Device not found');

    // Non-admins can only see their own devices
    if (ctx.user.role !== 'admin' && data.owner_id !== ctx.user.id) {
      return notFound('Device not found');
    }

    // Never expose full device_key in list — only the raw key on creation
    return ok({ device: { ...data, device_key: undefined } });
  } catch (e) {
    return serverError(e);
  }
}, ['admin', 'repair_team']);

export const PATCH = withAuth(
  async (req: NextRequest, _ctx: AuthContext, { params }: Params) => {
    try {
      const sb   = getServiceClient();
      const body = await req.json();
      const allowed = ['name', 'zone', 'latitude', 'longitude', 'address', 'is_active', 'metadata', 'firmware_ver'];
      const updates: Record<string, unknown> = {};
      for (const k of allowed) { if (body[k] !== undefined) updates[k] = body[k]; }

      if (!Object.keys(updates).length) return badRequest('Nothing to update');

      const { data, error } = await sb.from('devices').update(updates).eq('id', params.id).select().single();
      if (error || !data) return notFound('Device not found');
      return ok({ device: { ...data, device_key: undefined } });
    } catch (e) {
      return serverError(e);
    }
  },
  ['admin'],
);

export const DELETE = withAuth(
  async (_req: NextRequest, _ctx: AuthContext, { params }: Params) => {
    try {
      const { error } = await getServiceClient().from('devices').update({ is_active: false }).eq('id', params.id);
      if (error) throw error;
      return ok({ message: 'Device deactivated' });
    } catch (e) {
      return serverError(e);
    }
  },
  ['admin'],
);
