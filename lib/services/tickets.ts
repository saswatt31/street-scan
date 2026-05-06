import { getServiceClient } from '../db';
import { TicketStatus } from '../types';

/**
 * Creates a new ticket from a validated report.
 * If the report is part of a cluster, it links to the cluster.
 */
export async function createTicketFromReport(report: any) {
  const sb = getServiceClient();
  
  // Calculate priority based on severity score
  let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  if (report.severity_score >= 90) priority = 'critical';
  else if (report.severity_score >= 70) priority = 'high';
  else if (report.severity_score < 30) priority = 'low';

  // Generate ticket number: SS-YYYYMMDD-RAND
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randStr = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const ticket_number = `SS-${dateStr}-${randStr}`;

  const { data: ticket, error } = await sb.from('tickets').insert({
    report_id: report.id,
    cluster_id: report.cluster_id || null,
    ticket_number,
    title: `Repair: ${report.damage_type} at ${report.nearest_landmark || 'Location'}`,
    description: report.description || `Repair required for ${report.damage_type} detected at ${report.latitude}, ${report.longitude}.`,
    status: 'reported',
    priority,
    metadata: {
      source: report.source,
      initial_severity: report.severity
    }
  }).select().single();

  if (error) throw error;
  
  // Update report to link back if needed (schema dependent)
  // await sb.from('reports').update({ ticket_id: ticket.id }).eq('id', report.id);

  return ticket;
}

/**
 * Updates ticket status and associated metadata
 */
export async function transitionTicket(id: string, status: TicketStatus, payload: any = {}) {
  const sb = getServiceClient();
  
  const { data, error } = await sb.from('tickets').update({
    status,
    ...payload,
    updated_at: new Date().toISOString()
  }).eq('id', id).select().single();

  if (error) throw error;
  return data;
}

/**
 * Automatically assigns a ticket to the least busy or default worker
 */
export async function autoAssign(ticketId: string) {
  const sb = getServiceClient();
  
  // For MVP: Assign to a default worker email if exists, or just pick first available repair_team
  const { data: worker } = await sb
    .from('users')
    .select('id')
    .eq('role', 'repair_team')
    .limit(1)
    .single();

  if (worker) {
    return transitionTicket(ticketId, 'assigned', { assigned_to: worker.id });
  }
  
  return null;
}

/**
 * Checks for tickets that have been open for too long without resolution.
 */
export async function checkSlaBreaches() {
  const sb = getServiceClient();
  
  // Find open/assigned tickets older than 24 hours
  const yesterday = new Date();
  yesterday.setHours(yesterday.getHours() - 24);

  const { data: staleTickets } = await sb
    .from('tickets')
    .select('id, priority')
    .in('status', ['open', 'assigned'])
    .lt('created_at', yesterday.toISOString());

  if (staleTickets && staleTickets.length > 0) {
    console.log(`[SLA] Found ${staleTickets.length} stale tickets. Escalating...`);
    // Escalation logic here
  }

  return { count: staleTickets?.length || 0 };
}
