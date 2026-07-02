'use client';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================
// 浏览器端统一的 Supabase 客户端单例
// ============================================

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_COZE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  '';
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_COZE_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

let browserClient: SupabaseClient | null = null;

/**
 * 获取浏览器端 Supabase 客户端单例
 * 使用统一的硬编码配置，确保登录页和首页共享同一个 localStorage session
 */
export function getBrowserClient(): SupabaseClient {
  if (!browserClient) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Supabase browser env is missing');
    }
    browserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
  return browserClient;
}

/**
 * 重置客户端（用于测试或登出后）
 */
export function resetBrowserClient(): void {
  browserClient = null;
}
