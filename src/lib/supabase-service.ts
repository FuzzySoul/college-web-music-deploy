import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let serviceClient: SupabaseClient | null = null

export function getServiceSupabase(): SupabaseClient | null {
  if (serviceClient) return serviceClient

  const supabaseUrl =
    process.env['COZE_SUPABASE_URL'] ||
    process.env['NEXT_PUBLIC_COZE_SUPABASE_URL'] ||
    ''
  const supabaseKey =
    process.env['SUPABASE_SERVICE_ROLE_KEY'] ||
    process.env['COZE_SUPABASE_SERVICE_ROLE_KEY'] ||
    ''

  if (!supabaseUrl || !supabaseKey) {
    console.error('[Supabase Service] Missing config:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
    })
    return null
  }

  serviceClient = createClient(supabaseUrl, supabaseKey, {
    db: { schema: 'public' },
  })

  return serviceClient
}

export function resetServiceSupabase() {
  serviceClient = null
}

export function getServiceSupabaseOrThrow(): SupabaseClient {
  const client = getServiceSupabase()
  if (!client) {
    throw new Error('Supabase service client is not configured')
  }
  return client
}
