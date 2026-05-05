import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client for backend operations that bypass RLS.
 * Requires SUPABASE_SERVICE_ROLE_KEY to be set in .env.local
 */
export function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Supabase URL and Key must be provided in environment variables.');
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Standard client (using anon key) for general purposes.
 */
export function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Supabase URL and Anon Key must be provided in environment variables.');
  }

  return createClient(url, key);
}
