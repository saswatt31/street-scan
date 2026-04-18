/**
 * POST /api/iot/batch
 *
 * Accepts a batch of sensor events from a vehicle that was offline
 * and is now syncing. Processes each event, deduplicates, returns summary.
 *
 * Body: { device_key: string, events: SensorEvent[], batch_id?: string }
 */
import { NextRequest } from 'next/server';
import { authenticateDevice, unauthorized, created, badRequest, serverError } from '@/lib/middleware/auth';
import { getServiceClient } from '@/lib/db';
import { ingestSingleEvent } from '@/app/api/iot/route';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  try {
    const deviceCtx = await authenticateDevice(req);
    if (!deviceCtx) return unauthorized('Invalid or missing API key');

    const { device } = deviceCtx;
    if (!device.is_active) return unauthorized('Device is disabled');

    const body = await req.json();
    const { events, batch_id: clientBatchId } = body;

    if (!Array.isArray(events) || events.length === 0) {
      return badRequest('events must be a non-empty array');
    }
    if (events.length > 500) {
      return badRequest('Batch limit is 500 events per request');
    }

    const batchId  = clientBatchId ?? uuidv4();
    const sb       = getServiceClient();

    const results: { index: number; event_id?: string; damage: boolean; error?: string }[] = [];
    let damageCount = 0;

    // Process events in parallel chunks of 10
    const CHUNK = 10;
    for (let i = 0; i < events.length; i += CHUNK) {
      const chunk = events.slice(i, i + CHUNK);
      const settled = await Promise.allSettled(
        chunk.map((event: Record<string, unknown>, j: number) =>
          ingestSingleEvent(device, { ...event, batch_id: batchId })
            .then(res => ({ index: i + j, ...res }))
        )
      );

      for (const result of settled) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
          if (result.value.damage) damageCount++;
        } else {
          const idx = results.length;
          results.push({ index: idx, damage: false, error: String(result.reason) });
        }
      }
    }

    // Tag all inserted rows with the batch_id for traceability
    await sb.from('iot_data')
      .update({ batch_id: batchId })
      .is('batch_id', null)
      .eq('device_id', device.id)
      .in('id', results.filter(r => r.event_id).map(r => r.event_id!));

    const failed = results.filter(r => r.error).length;

    return created({
      batch_id:     batchId,
      total:        events.length,
      processed:    events.length - failed,
      failed,
      damage_events: damageCount,
      results,
    });
  } catch (e) {
    return serverError(e);
  }
}
