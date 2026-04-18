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

// ── shared ingestion logic (also used by batch route) ──────────
export async function ingestSingleEvent(device: Record<string,unknown>, payload: Record<string,unknown>) {
  const sb = getServiceClient();
  const { latitude, longitude, gps_accuracy, accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z,
          vibration_rms = 0, frequency_hz, magnitude, temperature_c, firmware_ver, battery_pct } = payload;

  // Update/Provision device telemetry
  const du: Record<string,unknown> = { 
    id: device.id,
    name: (device as any).name || 'IoT Device',
    type: (device as any).type || 'vehicle',
    last_seen_at: new Date().toISOString() 
  };
  if (firmware_ver)             du.firmware_ver = firmware_ver;
  if (battery_pct  != null)     du.battery_pct  = battery_pct;
  if (latitude && longitude) { du.latitude = latitude; du.longitude = longitude; }
  await sb.from('devices').upsert(du);

  const rms    = Number(vibration_rms);
  const mag    = Number(magnitude ?? rms);
  const freqHz = frequency_hz ? Number(frequency_hz) : undefined;
  const ai     = await analyzeVibration({ vibration_rms: rms, magnitude: mag, frequency_hz: freqHz });

  const { data: row, error } = await sb.from('iot_data').insert({
    device_id: device.id, latitude: latitude ?? null, longitude: longitude ?? null,
    gps_accuracy: gps_accuracy ?? null, accel_x: accel_x ?? null, accel_y: accel_y ?? null,
    accel_z: accel_z ?? null, gyro_x: gyro_x ?? null, gyro_y: gyro_y ?? null, gyro_z: gyro_z ?? null,
    vibration_rms: rms, frequency_hz: freqHz ?? null, magnitude: mag, temperature_c: temperature_c ?? null,
    event_type: ai.damage_type, threshold_exceeded: ai.damage, processed: false, raw_payload: payload,
  }).select().single();
  if (error) throw error;
  
  // ── Conflict Resolution: Visual Data Priority ───────────────
  // If the IoT sensor shows a spike, but a nearby visual report 
  // explicitly says "No Damage", we reject the IoT spike.
  let conflictDetected = false;
  if (ai.damage && latitude && longitude) {
    const latNum = Number(latitude);
    const lngNum = Number(longitude);
    const delta  = 15 / 111320; // ~15m in degrees

    const { data: nearby } = await sb.from('reports')
      .select('latitude, longitude, ai_damage, ai_validated')
      .gte('latitude',  latNum - delta)
      .lte('latitude',  latNum + delta)
      .gte('longitude', lngNum - delta)
      .lte('longitude', lngNum + delta);

    const rejections = (nearby ?? []).filter(r => 
      r.ai_validated && r.ai_damage === false &&
      haversineM(latNum, lngNum, r.latitude, r.longitude) <= 15
    );

    if (rejections.length > 0) {
      console.log(`[IoT] Conflict detected at ${latNum},${lngNum}. Visual data says "No Damage".`);
      conflictDetected = true;
      
      // Mark the row as rejected due to conflict
      await sb.from('iot_data').update({ 
        threshold_exceeded: false, 
        processed: true 
      }).eq('id', row.id);
    }
  }
  // ────────────────────────────────────────────────────────────

  if (ai.damage && !conflictDetected && latitude && longitude) {
    await queueJob('ai_analyze', {
      vibration_rms: rms, magnitude: mag, frequency_hz: freqHz,
      latitude, longitude, device_id: device.id, iot_data_id: row.id, source: 'iot',
    });
  }
  return { 
    event_id: row.id, 
    damage:   ai.damage && !conflictDetected, 
    conflict: conflictDetected,
    severity: ai.severity, 
    score:    ai.score, 
    queued:   ai.damage && !conflictDetected && !!latitude 
  };
}
