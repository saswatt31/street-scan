import { getServiceClient } from '../db';

export type JobType = 'ai_analyze' | 'cluster' | 'notify' | 'ticket_create';

/**
 * Queues a background job.
 * In this implementation, we insert into a 'jobs' table which can be 
 * picked up by a separate worker process or Supabase Edge Function.
 */
export async function queueJob(type: JobType, payload: any) {
  const sb = getServiceClient();
  
  console.log(`[JobQueue] Queuing job: ${type}`, payload);

  const { data, error } = await sb.from('jobs').insert({
    type,
    payload,
    status: 'pending',
    created_at: new Date().toISOString()
  }).select().single();

  if (error) {
    // If table doesn't exist, we fallback to immediate execution or just log
    console.warn(`[JobQueue] Failed to persist job to DB: ${error.message}`);
    
    // Trigger "Immediate" processing if we are in a dev environment without a worker
    if (process.env.NODE_ENV === 'development') {
       // triggerLocalProcessing(type, payload);
    }
  }

  return data;
}

/**
 * Processes all pending jobs in the queue.
 * Called by a cron job or manual trigger.
 */
export async function processPendingJobs() {
  const sb = getServiceClient();
  
  const { data: jobs, error } = await sb
    .from('jobs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error || !jobs) return { count: 0 };

  console.log(`[JobQueue] Processing ${jobs.length} jobs...`);

  for (const job of jobs) {
    try {
      await sb.from('jobs').update({ status: 'processing', started_at: new Date().toISOString() }).eq('id', job.id);
      
      // In a real implementation, this would route to specific handlers:
      // if (job.type === 'ai_analyze') await handleAiAnalyze(job.payload);
      
      await sb.from('jobs').update({ status: 'completed', finished_at: new Date().toISOString() }).eq('id', job.id);
    } catch (e: any) {
      console.error(`[JobQueue] Job ${job.id} failed:`, e);
      await sb.from('jobs').update({ status: 'failed', error: e.message }).eq('id', job.id);
    }
  }

  return { count: jobs.length };
}
