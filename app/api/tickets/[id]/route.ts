/**
 * GET    /api/tickets/[id]   — ticket detail
 * PATCH  /api/tickets/[id]   — transition state, assign, upload resolution
 * DELETE /api/tickets/[id]   — reject ticket (admin)
 */
import { NextRequest } from 'next/server';
import { withAuth, ok, badRequest, notFound, forbidden, serverError } from '@/lib/middleware/auth';
import { getServiceClient }     from '@/lib/db';
import { transitionTicket, autoAssign } from '@/lib/services/tickets';
import { verifyResolution }     from '@/lib/services/ai';
import { uploadImage }          from '@/lib/services/storage';
import { queueJob }             from '@/lib/services/jobs';
import type { AuthContext }     from '@/lib/middleware/auth';
import type { TicketStatus }    from '@/lib/types';

type Params = { params: { id: string } };

// ── GET ──────────────────────────────────────────────────────────
export const GET = withAuth(async (_req: NextRequest, ctx: AuthContext, { params }: Params) => {
  try {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from('tickets')
      .select(`
        *,
        reports (*),
        clusters ( id, latitude, longitude, report_count, first_seen_at, last_seen_at ),
        users    ( id, full_name, email, phone )
      `)
      .eq('id', params.id)
      .single();

    if (error || !data) return notFound('Ticket not found');

    // Repair team can only see their own tickets
    if (ctx.user.role === 'repair_team' && data.assigned_to !== ctx.user.id) {
      return notFound('Ticket not found');
    }

    return ok({ ticket: data });
  } catch (e) {
    return serverError(e);
  }
}, ['admin', 'repair_team']);

// ── PATCH ────────────────────────────────────────────────────────
export const PATCH = withAuth(
  async (req: NextRequest, ctx: AuthContext, { params }: Params) => {
    try {
      const sb = getServiceClient();

      // Support both JSON and multipart (for resolution image upload)
      const contentType = req.headers.get('content-type') ?? '';
      let action: string | null = null;
      let payload: Record<string, unknown> = {};
      let resolutionFile: File | null = null;

      if (contentType.includes('multipart/form-data')) {
        const form   = await req.formData();
        action       = form.get('action') as string;
        resolutionFile = form.get('resolution_image') as File | null;
        const notes  = form.get('resolution_notes') as string;
        if (notes)   payload.resolution_notes = notes;
      } else {
        const body = await req.json();
        action     = body.action;
        payload    = body;
      }

      const { data: ticket, error: fetchErr } = await sb.from('tickets').select('*').eq('id', params.id).single();
      if (fetchErr || !ticket) return notFound('Ticket not found');

      // Repair team can only touch their assigned ticket
      if (ctx.user.role === 'repair_team' && ticket.assigned_to !== ctx.user.id) {
        return forbidden('You are not assigned to this ticket');
      }

      switch (action) {

        // Admin verifies an AI-validated report
        case 'verify':
          await transitionTicket(params.id, 'verified' as TicketStatus);
          break;

        // Assign to a team member
        case 'assign': {
          const assignedTo = payload.assigned_to as string | undefined;
          if (assignedTo) {
            await transitionTicket(params.id, 'assigned' as TicketStatus, {
              assigned_to:   assignedTo,
              assigned_team: payload.assigned_team,
            });
          } else {
            await autoAssign(params.id);
          }
          break;
        }

        // Repair team starts work
        case 'start':
          await transitionTicket(params.id, 'in_progress' as TicketStatus);
          break;

        // Repair team submits resolution with photo
        case 'resolve': {
          let resolution_image_url: string | null  = null;
          let resolution_image_path: string | null = null;

          if (resolutionFile && resolutionFile.size > 0) {
            const uploaded    = await uploadImage(resolutionFile, 'resolution-images', `tickets/${params.id}`);
            resolution_image_url  = uploaded.url;
            resolution_image_path = uploaded.path;
          }

          // Run AI verification
          let aiVerified = false;
          if (resolution_image_path) {
            try {
              const { downloadImageAsBuffer } = await import('@/lib/services/storage');
              
              // 1. Get current resolution image
              const { buffer: afterBuffer, mimeType } = await downloadImageAsBuffer(resolution_image_path, 'resolution-images');

              // 2. Try to get "before" image from the linked report
              let beforeBuffer: Buffer | null = null;
              if (ticket.report_id) {
                const { data: report } = await sb.from('reports').select('image_path').eq('id', ticket.report_id).single();
                if (report?.image_path) {
                  const downloaded = await downloadImageAsBuffer(report.image_path, 'report-images');
                  beforeBuffer = downloaded.buffer;
                }
              }

              // 3. Compare with Gemini
              const verification = await verifyResolution(beforeBuffer, afterBuffer, mimeType);
              aiVerified = verification.verified;
              payload.resolution_notes = (payload.resolution_notes || '') + `\n\n[AI Verification]: ${verification.notes}`;
            } catch (err) {
              console.error("[API] Resolution verification failed:", err);
            }
          }

          await transitionTicket(params.id, 'resolved' as TicketStatus, {
            resolution_image_url,
            resolution_image_path,
            resolution_notes:    payload.resolution_notes,
            ai_verified_resolved: aiVerified,
            verified_at:         aiVerified ? new Date().toISOString() : null,
          });

          // Notify reporter
          await queueJob('notify', {
            event:     'status_change',
            ticket_id: params.id,
            new_status: 'resolved',
            report_id:  ticket.report_id,
          });
          break;
        }

        // Reject ticket
        case 'reject':
          await transitionTicket(params.id, 'rejected' as TicketStatus, {
            resolution_notes: payload.reason ?? 'Rejected by admin',
          });
          break;

        default:
          return badRequest(`Unknown action: ${action}. Valid: verify, assign, start, resolve, reject`);
      }

      const { data: updated } = await sb.from('tickets').select('*').eq('id', params.id).single();
      return ok({ ticket: updated });
    } catch (e: any) {
      if (e?.message?.includes('Cannot transition')) return badRequest(e.message);
      return serverError(e);
    }
  },
  ['admin', 'repair_team'],
);

// ── DELETE ───────────────────────────────────────────────────────
export const DELETE = withAuth(
  async (_req: NextRequest, _ctx: AuthContext, { params }: Params) => {
    try {
      const { error } = await getServiceClient()
        .from('tickets').update({ status: 'rejected' }).eq('id', params.id);
      if (error) throw error;
      return ok({ message: 'Ticket rejected' });
    } catch (e) {
      return serverError(e);
    }
  },
  ['admin'],
);
