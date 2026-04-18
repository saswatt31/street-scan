/**
 * POST /api/reports/upload
 *
 * Multipart form upload: image file + GPS + damage metadata.
 * Stores image in Supabase Storage, creates report, queues AI analysis.
 *
 * Form fields:
 *   image        File     (required)
 *   latitude     string   (required)
 *   longitude    string   (required)
 *   damage_type  string
 *   severity     string
 *   description  string
 *   source       string   (default: citizen)
 */
import { NextRequest } from 'next/server';
import { withAuth, ok, created, badRequest, serverError } from '@/lib/middleware/auth';
import { getServiceClient } from '@/lib/db';
import { uploadImage }       from '@/lib/services/storage';
import { queueJob }          from '@/lib/services/jobs';
import { simpleGeohash, findNearbyReports } from '@/lib/services/clustering';
import type { AuthContext }  from '@/lib/middleware/auth';

export const POST = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  try {
    // Parse multipart
    const form = await req.formData();
    const file = form.get('image') as File | null;

    const latitude     = form.get('latitude')    as string | null;
    const longitude    = form.get('longitude')   as string | null;
    const damage_type  = (form.get('damage_type')  as string) || 'pothole';
    const severity     = (form.get('severity')     as string) || 'medium';
    const description  = form.get('description')  as string | null;
    const source       = (form.get('source')       as string) || 'citizen';

    if (!latitude || !longitude) return badRequest('latitude and longitude are required');

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng)) return badRequest('Invalid coordinates');

    // ── Deduplication ─────────────────────────────────────────────
    const nearby = await findNearbyReports(lat, lng, damage_type as any, 15);
    if (nearby.length > 0) {
      const closest = nearby[0];
      const sb      = getServiceClient();
      await sb.from('reports').update({
        recurrence_count: closest.recurrence_count + 1,
        last_reported_at: new Date().toISOString(),
        severity_score:   Math.min(99, closest.severity_score + 6),
      }).eq('id', closest.id);
      return ok({ report_id: closest.id, duplicate: true, merged_into: closest.id });
    }

    // ── Upload image ──────────────────────────────────────────────
    let image_url: string | null  = null;
    let image_path: string | null = null;

    if (file && file.size > 0) {
      const folder = `reports/${ctx.user.id}`;
      const result = await uploadImage(file, 'report-images', folder);
      image_url  = result.url;
      image_path = result.path;
    }

    const scoreMap: Record<string,number> = { low:20, medium:50, high:72, critical:90 };
    const geohash = simpleGeohash(lat, lng);

    const sb = getServiceClient();
    const { data: report, error } = await sb.from('reports').insert({
      reporter_id:       ctx.user.id,
      source,
      latitude:          lat,
      longitude:         lng,
      damage_type,
      severity,
      severity_score:    scoreMap[severity] ?? 50,
      description,
      image_url,
      image_path,
      geohash,
      status:            'pending',
      ai_validated:      false,
      ai_confidence:     0,
      first_reported_at: new Date().toISOString(),
      last_reported_at:  new Date().toISOString(),
    }).select().single();
    if (error) throw error;

    // ── Queue AI pipeline ─────────────────────────────────────────
    await queueJob('ai_analyze', {
      report_id:  report.id,
      image_url:  image_url ?? null,
      image_path: image_path ?? null,
    });

    return created({
      report_id:  report.id,
      duplicate:  false,
      image_url,
      message:    'Report received. AI validation in progress.',
    });
  } catch (e) {
    return serverError(e);
  }
});
