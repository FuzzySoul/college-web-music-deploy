import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================
// 统一的 Supabase 客户端管理器
// ============================================

// 全局单例
let supabaseClientInstance: SupabaseClient | null = null;
let isConfigured = false;
let configError: string | null = null;

/**
 * 获取 Supabase 配置
 * 优先顺序：
 * 1. 客户端：从全局变量获取（由 API 路由注入）
 * 2. 服务端：从环境变量获取
 */
function getConfig(): { url: string; key: string } {
  if (typeof window !== 'undefined') {
    const url = (window as any).__SUPABASE_URL__;
    const key = (window as any).__SUPABASE_ANON_KEY__;

    if (url && key) {
      return { url, key };
    }

    const pubUrl = (window as any).__NEXT_PUBLIC_SUPABASE_URL__;
    const pubKey = (window as any).__NEXT_PUBLIC_SUPABASE_ANON_KEY__;
    
    if (pubUrl && pubKey) {
      return { url: pubUrl, key: pubKey };
    }
  }

  const url = process.env.COZE_SUPABASE_URL || process.env.NEXT_PUBLIC_COZE_SUPABASE_URL;
  const key = process.env.COZE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_COZE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Supabase credentials not found in environment variables or globals');
  }

  return { url, key };
}

/**
 * 创建或获取 Supabase 客户端实例
 * 使用单例模式确保整个应用只创建一个实例
 */
export async function getSupabaseClient(token?: string): Promise<SupabaseClient> {
  // 如果已配置，直接返回实例
  if (supabaseClientInstance && isConfigured) {
    return supabaseClientInstance;
  }

  // 获取配置
  let config: { url: string; key: string };
  try {
    config = getConfig();
  } catch (error) {
    configError = error instanceof Error ? error.message : String(error);
    isConfigured = false;
    throw new Error(`Supabase configuration error: ${configError}`);
  }

  // 创建或更新客户端实例
  try {
    supabaseClientInstance = createClient(config.url, config.key, {
      db: {
        timeout: 60000,
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: token ? {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      } : undefined,
    });

    isConfigured = true;
    configError = null;

    return supabaseClientInstance;
  } catch (error) {
    isConfigured = false;
    configError = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to create Supabase client: ${configError}`);
  }
}

/**
 * 检查 Supabase 是否已配置
 */
export function isSupabaseConfigured(): boolean {
  return isConfigured && supabaseClientInstance !== null;
}

/**
 * 获取配置错误信息
 */
export function getConfigError(): string | null {
  return configError;
}

/**
 * 重置客户端实例（用于测试或重新配置）
 */
export function resetClient(): void {
  supabaseClientInstance = null;
  isConfigured = false;
  configError = null;
}

/**
 * 健康检查 - 测试数据库连接
 */
export async function healthCheck(): Promise<{
  configured: boolean;
  connected: boolean;
  error: string | null;
}> {
  try {
    const client = await getSupabaseClient();

    const { data, error } = await client
      .from('health_check')
      .select('updated_at')
      .limit(1)
      .maybeSingle();

    if (error) {
      return {
        configured: isConfigured,
        connected: false,
        error: error.message,
      };
    }

    return {
      configured: isConfigured,
      connected: true,
      error: null,
    };
  } catch (error) {
    return {
      configured: isConfigured,
      connected: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
