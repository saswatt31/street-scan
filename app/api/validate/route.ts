import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { validateVisualDamage } from '@/lib/services/ai';
import { getServiceClient } from '@/lib/db';
import { createTicketFromReport } from '@/lib/services/tickets';
import { ok, created, badRequest, serverError } from '@/lib/middleware/auth';

/**
 * POST /api/validate
 * -------------------
 * The "Validation Orchestrator" route.
 * 1. Receives image + telemetry.
 * 2. Runs YOLO + Gemini analysis.
 * 3. Saves to DB only if verified.
 * 4. Returns direct feedback to user.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const image = formData.get('image') as File | null;
    const lat = formData.get('latitude');
    const lng = formData.get('longitude');
    const type = formData.get('damage_type') as string;
    const desc = formData.get('description') as string;
    const rms = formData.get('vibration_rms');
    const reporterName = formData.get('reporter_name') as string | null;
    const nearestLandmark = formData.get('nearest_landmark') as string | null;

    if (!image || !lat || !lng) {
      return badRequest('Image, latitude, and longitude are required for manual reports.');
    }

    // Convert image to buffer for AI service
    const arrayBuffer = await image.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Run validation pipeline (YOLOv8 -> Gemini 2.5 Flash)
    console.log("[Orchestrator] Starting evaluation for report at", lat, lng);

    const evaluation = await validateVisualDamage(buffer, image.type, {
      vibration_rms: rms ? Number(rms) : undefined,
      description: desc,
      damage_type: type as any
    });

    // 2. Reject if no damage found
    if (!evaluation.damage) {
      console.log("[Orchestrator] Damage not verified. Explanation:", evaluation.explanation);
      return ok({
        verified: false,
        explanation: evaluation.explanation,
        message: "Report rejected: AI did not confirm infrastructure damage."
      });
    }

    // 3. Verified -> Persist to Database
    console.log("[Orchestrator] Damage verified. Saving report...");
    const sb = getServiceClient();

    // Upload image to Supabase Storage
    let image_url = null;
    let image_path = null;
    try {
      const ext = image.name.split('.').pop() || 'jpg';
      image_path = `reports/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await sb.storage.from('report-images').upload(image_path, buffer, {
        contentType: image.type,
        upsert: true
      });

      if (!upErr) {
        const { data } = sb.storage.from('report-images').getPublicUrl(image_path);
        image_url = data.publicUrl;
      } else {
        console.error("[Orchestrator] Storage upload failed:", upErr.message);
      }
    } catch (upErr: any) {
      console.error("[Orchestrator] Storage error:", upErr.message);
    }

    // Note: In production, use authenticated user ID
    const { data: report, error: reportErr } = await sb.from('reports').insert({
      latitude: Number(lat),
      longitude: Number(lng),
      damage_type: evaluation.damage_type,
      severity: evaluation.severity,
      severity_score: evaluation.score,
      description: desc || null,
      reporter_name: reporterName || null,
      nearest_landmark: nearestLandmark || null,
      source: 'citizen',
      status: 'validated',
      image_url,
      image_path,
      ai_validated: true,
      ai_damage: true,
      ai_confidence: evaluation.confidence,
      ai_notes: evaluation.notes,
      ai_processed_at: new Date().toISOString(),
      first_reported_at: new Date().toISOString(),
      last_reported_at: new Date().toISOString(),
    }).select().single();

    if (reportErr) {
      console.error("[Orchestrator] Database insert failed:", reportErr.message, reportErr.details);
      throw reportErr;
    }

    console.log("[Orchestrator] Report saved successfully. Creating ticket...");

    // 4. Auto-generate Ticket
    try {
      const ticket = await createTicketFromReport(report);
      console.log("[Orchestrator] Ticket created successfully:", ticket.ticket_number);

      return created({
        verified: true,
        report_id: report.id,
        ticket_id: ticket.id,
        severity: evaluation.severity,
        score: evaluation.score,
        explanation: evaluation.explanation
      });
    } catch (ticketErr: any) {
      console.error("[Orchestrator] Ticket creation failed:", ticketErr.message);
      // Still return success for report but mention ticket failure
      return created({
        verified: true,
        report_id: report.id,
        severity: evaluation.severity,
        score: evaluation.score,
        explanation: evaluation.explanation,
        warning: "Report saved, but ticket generation failed: " + ticketErr.message
      });
    }

  } catch (e) {
    console.error("[Orchestrator] Critical error:", e);
    return serverError(e);
  }
}
