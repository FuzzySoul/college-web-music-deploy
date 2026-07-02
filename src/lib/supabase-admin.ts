import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (client) return client;
  
  const supabaseUrl = process.env.COZE_SUPABASE_URL;
  const supabaseKey = process.env.COZE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('[Supabase] Missing config:', { hasUrl: !!supabaseUrl, hasKey: !!supabaseKey });
    return null;
  }
  
  client = createClient(supabaseUrl, supabaseKey);
  return client;
}

export function resetClient() {
  client = null;
}
