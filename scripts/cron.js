const fs = require('fs');
const path = require('path');

let cronSecret = 'change-me-in-production';
let appUrl = 'http://localhost:3000';

// Attempt to parse .env.local to grab the cron secret dynamically
try {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envFile = fs.readFileSync(envPath, 'utf8');
  
  const secretMatch = envFile.match(/^CRON_SECRET=(.*)$/m);
  if (secretMatch) cronSecret = secretMatch[1].trim();

  const urlMatch = envFile.match(/^NEXT_PUBLIC_APP_URL=(.*)$/m);
  if (urlMatch) appUrl = urlMatch[1].trim();
} catch (e) {
  // If .env.local doesn't exist yet, we fall back to the defaults
}

const INTERVAL_MS = 10000; // 10 seconds is perfect for an interactive hackathon demo

console.log(`[Cron Worker] Starting StreetScan background processor...`);
console.log(`[Cron Worker] Targeting ping URL: ${appUrl}/api/jobs/run`);
console.log(`[Cron Worker] Polling every ${INTERVAL_MS/1000} seconds...`);

setInterval(async () => {
  try {
    const res = await fetch(`${appUrl}/api/jobs/run`, {
      method: 'POST',
      headers: {
        'x-cron-secret': cronSecret
      }
    });

    if (!res.ok) {
        console.warn(`[Cron Worker] Failed to ping queue. Application returned HTTP ${res.status}`);
        return;
    }
    
    const data = await res.json();
    if (data.jobs_processed > 0 || data.sla_breaches_flagged > 0) {
      console.log(`[Cron Worker ⚡] Processed ${data.jobs_processed} job(s) in queue | Flagged ${data.sla_breaches_flagged} SLA breach(es)`);
    }
  } catch (e) {
    // We swallow the exact fetch connect error internally so it doesn't spam the console 
    // when Next.js is temporarily shut down or restarting.
  }
}, INTERVAL_MS);
