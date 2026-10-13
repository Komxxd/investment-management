import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client with the service role key (for server-side operations like cron).
 */
export function createServiceClient(): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase configuration (URL or SERVICE_ROLE_KEY)');
  }

  return createClient(url, key);
}

/**
 * Creates a Supabase client scoped to a specific user's JWT token.
 * This ensures RLS policies are enforced for the requesting user.
 */
export function createUserClient(token: string): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Missing Supabase configuration (URL or ANON_KEY)');
  }

  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
}

/**
 * Creates a generic anon client to be used for unauthenticated operations like login/signup.
 */
export function getAnonClient(): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Missing Supabase configuration (URL or ANON_KEY)');
  }
  return createClient(url, anonKey);
}
