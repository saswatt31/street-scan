/**
 * GET  /api/devices  — list all devices (admin) or own devices
 * POST /api/devices  — register a new device + generate API key
 */
import { NextRequest } from 'next/server';
import { withAuth, ok, created, badRequest, serverError, paginate } from '@/lib/middleware/auth';
import { getServiceClient } from '@/lib/db';
import type { AuthContext } from '@/lib/middleware/auth';

// ── GET /api/devices ─────────────────────────────────────────────
export const GET = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const sb           = getServiceClient();
    const { from, to } = paginate(req);
    const sp           = new URL(req.url).searchParams;

    let q = sb.from('devices')
      .select('id,name,type,zone,latitude,longitude,address,is_active,last_seen_at,firmware_ver,battery_pct,metadata,created_at', { count: 'exact' })
      .order('last_seen_at', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (ctx.user.role !== 'admin') {
      q = q.eq('owner_id', ctx.user.id);
    }

    const type = sp.get('type');
    const zone = sp.get('zone');
    if (type) q = q.eq('type', type);
    if (zone) q = q.eq('zone', zone);

    const { data, error, count } = await q;
    if (error) throw error;

    return ok({ devices: data, total: count });
  } catch (e) {
    return serverError(e);
  }
}, ['admin', 'repair_team']);

// ── POST /api/devices ────────────────────────────────────────────
export const POST = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const sb   = getServiceClient();
    const body = await req.json();
    const { name, type, zone, latitude, longitude, address, metadata } = body;

    if (!name || !type) return badRequest('name and type are required');
    if (!['vehicle','building','static'].includes(type)) {
      return badRequest('type must be: vehicle, building, or static');
    }

    // Generate cryptographically secure API key
    const rawKey    = generateApiKey();
    const keyHash   = await sha256hex(rawKey);
    const keyPrefix = rawKey.slice(0, 8);

    // Insert device
    const { data: device, error: devErr } = await sb.from('devices').insert({
      name, type, zone: zone ?? null,
      latitude: latitude ?? null, longitude: longitude ?? null,
      address: address ?? null,
      owner_id: ctx.user.id,
      is_active: true,
      metadata: metadata ?? {},
    }).select().single();
    if (devErr) throw devErr;

    // Insert API key record
    const { error: keyErr } = await sb.from('api_keys').insert({
      key_hash:  keyHash,
      key_prefix: keyPrefix,
      device_id: device.id,
      name:      `${name} primary key`,
      scopes:    ['iot:write'],
    });
    if (keyErr) throw keyErr;

    // Return raw key ONCE — never stored in plaintext
    return created({
      device: { ...device, device_key: undefined },
      api_key: rawKey,
      warning: 'Store this API key now — it will not be shown again.',
    });
  } catch (e) {
    return serverError(e);
  }
}, ['admin']);

// ── helpers ──────────────────────────────────────────────────────
function generateApiKey(): string {
  const chars  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array  = new Uint8Array(40);
  crypto.getRandomValues(array);
  return 'sk_' + Array.from(array).map(b => chars[b % chars.length]).join('');
}

async function sha256hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
