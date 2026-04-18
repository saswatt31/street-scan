/**
 * GET  /api/reports  — paginated list with filters
 * POST /api/reports  — create citizen/camera report (JSON body, no file)
 *
 * For file + GPS uploads use POST /api/reports/upload (multipart)
 */
import { NextRequest } from 'next/server';
import { withAuth, ok, created, badRequest, serverError, paginate } from '@/lib/middleware/auth';
import { getServiceClient } from '@/lib/db';
import { analyzeImage }     from '@/lib/services/ai';
import { queueJob }         from '@/lib/services/jobs';
import { simpleGeohash, findNearbyReports } from '@/lib/services/clustering';
import type { AuthContext } from '@/lib/middleware/auth';

// ── GET /api/reports ─────────────────────────────────────────────
export const GET = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const sb           = getServiceClient();
    const { from, to } = paginate(req);
    const sp           = new URL(req.url).searchParams;

    let q = sb.from('reports')
      .select('*, clusters(report_count,severity)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    // Filters
    const status   = sp.get('status');
    const severity = sp.get('severity');
    const source   = sp.get('source');
    const clusterId = sp.get('cluster_id');
    const minScore = sp.get('min_score');
    const latMin   = sp.get('lat_min'), latMax = sp.get('lat_max');
    const lngMin   = sp.get('lng_min'), lngMax = sp.get('lng_max');

    if (status)    q = q.eq('status', status);
    if (severity)  q = q.eq('severity', severity);
    if (source)    q = q.eq('source', source);
    if (clusterId) q = q.eq('cluster_id', clusterId);
    if (minScore)  q = q.gte('severity_score', Number(minScore));
    if (latMin)    q = q.gte('latitude',  Number(latMin));
    if (latMax)    q = q.lte('latitude',  Number(latMax));
    if (lngMin)    q = q.gte('longitude', Number(lngMin));
    if (lngMax)    q = q.lte('longitude', Number(lngMax));

    // Citizens only see their own reports unless admin/repair_team
    if (ctx.user.role === 'citizen') {
      q = q.eq('reporter_id', ctx.user.id);
    }

    const { data, error, count } = await q;
    if (error) throw error;
    return ok({ reports: data, total: count });
  } catch (e) {
    return serverError(e);
  }
});

// ── POST /api/reports ────────────────────────────────────────────
export const POST = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const sb   = getServiceClient();
    const body = await req.json();
    const { latitude, longitude, damage_type, description, severity = 'medium',
            source = 'citizen', image_url, source_device_id } = body;

    if (!latitude || !longitude) return badRequest('latitude and longitude are required');
    if (!damage_type)            return badRequest('damage_type is required');

    const lat = Number(latitude);
    const lng = Number(longitude);

    // ── Deduplication check ──────────────────────────────────────
    const nearby = await findNearbyReports(lat, lng, damage_type, 15);
    if (nearby.length > 0) {
      // Merge into closest existing report
      const closest = nearby[0];
      const newCount = closest.recurrence_count + 1;
      await sb.from('reports').update({
        recurrence_count: newCount,
        last_reported_at: new Date().toISOString(),
        severity_score:   Math.min(99, closest.severity_score + 8),
      }).eq('id', closest.id);

      return ok({
        report_id:   closest.id,
        duplicate:   true,
        merged_into: closest.id,
        recurrence:  newCount,
        message:     'Duplicate detected — merged with existing report',
      });
    }

    // ── Score from severity string ───────────────────────────────
    const scoreMap: Record<string,number> = { low:20, medium:50, high:72, critical:90 };
    const severity_score = scoreMap[severity] ?? 50;
    const geohash        = simpleGeohash(lat, lng);

    // ── Insert report ────────────────────────────────────────────
    const { data: report, error } = await sb.from('reports').insert({
      reporter_id:      ctx.user.id,
      source,
      source_device_id: source_device_id ?? null,
      latitude:         lat,
      longitude:        lng,
      damage_type,
      severity,
      severity_score,
      description:      description ?? null,
      image_url:        image_url ?? null,
      geohash,
      status:           image_url ? 'pending' : 'validated',  // images need AI validation
      ai_validated:     !image_url,
      ai_confidence:    image_url ? 0 : 0.6,
      first_reported_at: new Date().toISOString(),
      last_reported_at:  new Date().toISOString(),
    }).select().single();
    if (error) throw error;

    // ── Queue AI image analysis if image present ─────────────────
    if (image_url) {
      await queueJob('ai_analyze', { report_id: report.id, image_url });
    } else {
      // No image → go straight to clustering + ticket
      await queueJob('cluster', { report_id: report.id });
    }

    return created({ report_id: report.id, duplicate: false });
  } catch (e) {
    return serverError(e);
  }
});
