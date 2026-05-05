import { createClient } from '@supabase/supabase-js';
import type { Report, Ticket, UserRole } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Client-side Supabase client (using anon key).
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type { Report, Ticket, UserRole };
