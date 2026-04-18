/**
 * GET /api/analytics?view=...
 *
 * views:
 *   hotspots    — top damage clusters by severity/recurrence
 *   ticket_stats — ticket funnel counts
 *   report_stats — report source/status breakdown
 *   timeline     — reports per day for last N days
 *   unresolved   — unresolved tickets grouped by zone + severity
 *   heatmap      — lat/lng + weight for map heatmap rendering
 */
import { NextRequest } from 'next/server';
import { withAuth, ok, badRequest, serverError } from '@/lib/middleware/auth';
import { getServiceClient } from '@/lib/db';
import type { AuthContext } from '@/lib/middleware/auth';

export const GET = withAuth(async (req: NextRequest, _ctx: AuthContext) => {
  try {
    const sp   = new URL(req.url).searchParams;
    const view = sp.get('view') ?? 'ticket_stats';
    const sb   = getServiceClient();

    switch (view) {

      // ── Hotspots ────────────────────────────────────────────────
      case 'hotspots': {
        const limit = Math.min(100, parseInt(sp.get('limit') ?? '50'));
        const { data, error } = await sb
          .from('v_hotspots')
          .select('*')
          .limit(limit);
        if (error) throw error;
        return ok({ hotspots: data });
      }

      // ── Ticket stats ────────────────────────────────────────────
      case 'ticket_stats': {
        const { data, error } = await sb.from('v_ticket_stats').select('*').single();
        if (error) throw error;
        return ok({ stats: data });
      }

      // ── Report stats ────────────────────────────────────────────
      case 'report_stats': {
        const { data, error } = await sb.from('v_report_stats').select('*').single();
        if (error) throw error;
        return ok({ stats: data });
      }

      // ── Timeline ────────────────────────────────────────────────
      case 'timeline': {
        const days   = Math.min(90, parseInt(sp.get('days') ?? '30'));
        const source = sp.get('source');

        const since = new Date();
        since.setDate(since.getDate() - days);

        let q = sb.from('reports')
          .select('created_at, severity, source')
          .gte('created_at', since.toISOString())
          .order('created_at', { ascending: true });
        if (source) q = q.eq('source', source);

        const { data, error } = await q;
        if (error) throw error;

        // Bucket by day
        const buckets: Record<string, { date: string; total: number; critical: number; high: number; medium: number; low: number }> = {};
        for (const r of (data ?? [])) {
          const day = r.created_at.slice(0, 10);
          if (!buckets[day]) buckets[day] = { date: day, total: 0, critical: 0, high: 0, medium: 0, low: 0 };
          buckets[day].total++;
          buckets[day][r.severity as 'critical' | 'high' | 'medium' | 'low']++;
        }

        // Fill missing days with zeros
        const timeline = [];
        const cursor   = new Date(since);
        const now      = new Date();
        while (cursor <= now) {
          const day = cursor.toISOString().slice(0, 10);
          timeline.push(buckets[day] ?? { date: day, total: 0, critical: 0, high: 0, medium: 0, low: 0 });
          cursor.setDate(cursor.getDate() + 1);
        }

        return ok({ timeline, days });
      }

      // ── Unresolved breakdown ────────────────────────────────────
      case 'unresolved': {
        const { data, error } = await sb
          .from('tickets')
          .select('id, priority, status, zone, sla_breached, due_at, assigned_team, created_at')
          .not('status', 'in', '("resolved","rejected")')
          .order('priority', { ascending: false });
        if (error) throw error;

        // Group by zone → priority
        const byZone: Record<string, Record<string, number>> = {};
        let sla_breached = 0;
        for (const t of (data ?? [])) {
          const zone = t.zone ?? 'Unzoned';
          if (!byZone[zone]) byZone[zone] = { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
          byZone[zone][t.priority]++;
          byZone[zone].total++;
          if (t.sla_breached) sla_breached++;
        }

        return ok({
          total:       data?.length ?? 0,
          sla_breached,
          by_zone:     byZone,
          tickets:     data,
        });
      }

      // ── Heatmap data ────────────────────────────────────────────
      case 'heatmap': {
        const { data, error } = await sb
          .from('reports')
          .select('latitude, longitude, severity_score, severity, damage_type')
          .not('status', 'in', '("rejected")')
          .not('latitude', 'is', null);
        if (error) throw error;

        const points = (data ?? []).map(r => ({
          lat:    r.latitude,
          lng:    r.longitude,
          weight: r.severity_score / 100,
          type:   r.damage_type,
        }));

        return ok({ points });
      }

      // ── Device activity ─────────────────────────────────────────
      case 'devices': {
        const { data, error } = await sb
          .from('devices')
          .select(`
            id, name, type, zone, is_active, last_seen_at, battery_pct,
            iot_data ( id, threshold_exceeded, vibration_rms, created_at )
          `)
          .order('last_seen_at', { ascending: false, nullsFirst: false })
          .limit(50);
        if (error) throw error;

        const enriched = (data ?? []).map((d: any) => ({
          ...d,
          total_events:   d.iot_data?.length ?? 0,
          alert_events:   d.iot_data?.filter((e: any) => e.threshold_exceeded).length ?? 0,
          avg_vibration:  d.iot_data?.length
            ? +(d.iot_data.reduce((s: number, e: any) => s + e.vibration_rms, 0) / d.iot_data.length).toFixed(3)
            : 0,
          iot_data: undefined,
        }));

        return ok({ devices: enriched });
      }

      default:
        return badRequest(`Unknown view: ${view}. Valid: hotspots, ticket_stats, report_stats, timeline, unresolved, heatmap, devices`);
    }
  } catch (e) {
    return serverError(e);
  }
}, ['admin', 'repair_team']);
