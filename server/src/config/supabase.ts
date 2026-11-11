import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Reads Supabase URL and anon key from environment variables.
 */
export function getSupabaseConfig(): { url: string; anonKey: string } {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Missing Supabase configuration (URL or ANON_KEY)');
  }

  return { url, anonKey };
}

/**
 * Creates a Supabase client with the service role key (for server-side operations like cron).
 */
export function createServiceClient(): SupabaseClient {
  const { url } = getSupabaseConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error('Missing Supabase configuration (SERVICE_ROLE_KEY)');
  }

  return createClient(url, key);
}

/**
 * Creates a Supabase client scoped to a specific user's JWT token.
 * This ensures RLS policies are enforced for the requesting user.
 */
export function createUserClient(token: string): SupabaseClient {
  const { url, anonKey } = getSupabaseConfig();

  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

/**
 * Creates a generic anon client for public Supabase queries.
 */
export function getAnonClient(): SupabaseClient {
  const { url, anonKey } = getSupabaseConfig();
  return createClient(url, anonKey);
}

/**
 * Creates a stateless anon client using implicit flow so server-side auth calls
 * do not persist session state or expect browser PKCE storage.
 */
export function createStatelessAnonClient(): SupabaseClient {
  const { url, anonKey } = getSupabaseConfig();
  return createClient(url, anonKey, {
    auth: {
      flowType: 'implicit',
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
